import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sqlite } from '../local.mjs';
import worker from '../dist/server/index.js';

async function fixture(t,makeDB=()=>sqlite(':memory:')) {
  const db=makeDB();
  t.after(()=>db?.close());
  const base='https://aegis.example';
  const invoke=(url,init)=>worker.fetch(new Request(url,init),{DB:db,CLIENT_IP:'qa'});
  const request=async(path,method='GET',body,opts={})=>{
    const headers={Origin:base,...opts.headers};
    if(body)headers['Content-Type']='application/json';
    if(opts.cookie)headers.Cookie=opts.cookie;
    const res=await invoke(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
    return {res,body:await res.json(),cookie:res.headers.get('Set-Cookie')?.split(';')[0]};
  };
  return {base,request,db,invoke};
}
const path='/api/applications';
const data={name:'Тест',email:'qa@example.com',company:'Example',service:'audit',message:'Тестовая заявка'};
const register=(request,email='demo@example.com')=>request('/api/register','POST',{email,password:'local-passphrase-1'});

test('Landing, cabinet and hero respond with the expected content types',async t=>{
  const {base,invoke}=await fixture(t);
  for(const [path,type] of [['/','text/html'],['/cabinet','text/html'],['/hero.jpg','image/jpeg'],['/site.css','text/css'],['/site.js','text/javascript']]){
    const res=await invoke(base+path);
    assert.equal(res.status,200);
    assert.ok(res.headers.get('Content-Type').startsWith(type));
    await res.arrayBuffer();
  }
});
test('Validation rejects required fields and unknown services',async t=>{
  const {request,db}=await fixture(t);
  const response=await request(path,'POST',{name:' ',email:'wrong',service:'unknown'});
  assert.equal(response.res.status,422);
  assert.deepEqual(Object.keys(response.body.fields).sort(),['email','name','service']);
  assert.equal((await db.prepare('SELECT count(*) AS count FROM applications').bind().first()).count,0);
});
test('Confirmed application persists in a SQLite file and duplicate retries reuse it',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'aegis-'));
  const file=join(dir,'test.sqlite');
  const {request}=await fixture(t,()=>sqlite(file));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const options={headers:{'Idempotency-Key':crypto.randomUUID()}};
  const [one,two]=await Promise.all([request(path,'POST',data,options),request(path,'POST',data,options)]);
  assert.deepEqual([one.res.status,two.res.status].sort(),[200,201]);
  assert.equal(one.body.id,two.body.id);
  assert.equal(one.body.saved,true);
  const disk=sqlite(file);
  try {
    const record=await disk.prepare('SELECT name,service_id FROM applications WHERE id=?').bind(one.body.id).first();
    assert.equal(record.name,data.name);
    assert.equal(record.service_id,'audit');
    assert.equal((await disk.prepare('SELECT count(*) AS count FROM applications').bind().first()).count,1);
  } finally {disk.close();}
});
test('Rate limit blocks the sixth attempt and exposes Retry-After',async t=>{
  const {request}=await fixture(t);
  for(let i=0;i<5;i++)assert.equal((await request(path,'POST',data)).res.status,201);
  const last=await request(path,'POST',data);
  assert.equal(last.res.status,429);
  assert.ok(+last.res.headers.get('Retry-After')>0);
});
test('Unavailable storage never returns an application receipt',async t=>{
  const {request}=await fixture(t,()=>undefined);
  const response=await request(path,'POST',data);
  assert.equal(response.res.status,503);
  assert.equal(response.body.saved,undefined);
});
test('A foreign Origin cannot write or modify the database',async t=>{
  const {request}=await fixture(t);
  const response=await request(path,'POST',data,{headers:{Origin:'https://example.org'}});
  assert.equal(response.res.status,403);
});
test('Accounts can create, list, edit and delete their own applications',async t=>{
  const {request}=await fixture(t);
  const first=await register(request);
  assert.equal(first.res.status,201);
  const owner={cookie:first.cookie};
  const created=await request(path,'POST',data,owner);
  assert.equal(created.res.status,201);
  const item=path+'/'+created.body.id;
  const second=await register(request,'second@example.com');
  const stranger={cookie:second.cookie};
  assert.equal((await request(path,'GET',undefined,stranger)).body.items.length,0);
  assert.equal((await request(item,'PATCH',data,stranger)).res.status,404);
  assert.equal((await request(item,'DELETE',undefined,stranger)).res.status,404);
  const edited=await request(item,'PATCH',{...data,service:'training',company:"Компания «Пример»",message:'Текст <пример> & проверка'},owner);
  assert.equal(edited.body.saved,true);
  const items=(await request(path,'GET',undefined,owner)).body.items;
  assert.equal(items[0].service_name,'Обучение сотрудников');
  assert.equal(items[0].message,'Текст <пример> & проверка');
  assert.equal((await request(item,'DELETE',undefined,owner)).body.deleted,true);
  assert.equal((await request(path,'GET',undefined,owner)).body.items.length,0);
});
test('Passwords and session tokens are not stored directly, logout invalidates the session',async t=>{
  const {request,db}=await fixture(t);
  const created=await register(request);
  const row=await db.prepare('SELECT password_hash FROM users').bind().first();
  assert.match(row.password_hash,/^[0-9a-f]{32}:[0-9a-f]{64}$/);
  const token=created.cookie.split('=')[1];
  const session=await db.prepare('SELECT token_hash FROM sessions').bind().first();
  assert.notEqual(session.token_hash,token);
  assert.equal((await request('/api/logout','POST',undefined,{cookie:created.cookie})).body.signedOut,true);
  assert.equal((await request(path,'GET',undefined,{cookie:created.cookie})).res.status,401);
  assert.equal((await request('/api/login','POST',{email:'demo@example.com',password:'wrong'})).res.status,401);
  assert.equal((await request('/api/login','POST',{email:'demo@example.com',password:'local-passphrase-1'})).res.status,200);
});
