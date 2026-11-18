import { services } from './content.mjs';

const ids = new Set(services.map(([id]) => id));
const limits = {name:100,email:254,company:150,message:3000};
export const validEmail = value => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u.test(value);
export function applicationInput(input) {
  const data = {};
  const errors = {};
  for (const [key,max] of Object.entries(limits)) {
    const raw = input[key] ?? '';
    data[key] = typeof raw === 'string' ? raw.trim() : '';
    if (typeof raw !== 'string' || data[key].length > max) errors[key] = 'Допустимо до '+max+' символов.';
  }
  if (!data.name && !errors.name) errors.name = 'Укажите имя.';
  if (!validEmail(data.email) && !errors.email) errors.email = 'Укажите email в формате name@company.ru.';
  data.service = input.service || null;
  if (data.service !== null && !ids.has(data.service)) errors.service = 'Выберите услугу из списка.';
  return {data,errors};
}

const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,'0')).join('');
const digest = async text => hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const random = length => hex(crypto.getRandomValues(new Uint8Array(length)));
const sessionSeconds = 60 * 60 * 24 * 7;
async function derive(password,salt) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
function equal(a,b) {
  let diff = a.length ^ b.length;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function json(data,status=200,extra={}) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
}
const error = (status,message,extra) => json({error:message},status,extra);
const invalid = fields => json({error:'Проверьте выделенные поля.',fields},422);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const now = () => Math.floor(Date.now()/1000);
const period = 900;
async function rate(db,scope,source,limit) {
  const time = now();
  const bucket = Math.floor(time/period);
  const sourceHash = await digest(source);
  if (Math.random()<.02) await db.prepare('DELETE FROM rate_limits WHERE bucket < ?').bind(bucket-4).run();
  const row = await db.prepare(`INSERT INTO rate_limits(scope,source_hash,bucket,count) VALUES (?,?,?,1)
    ON CONFLICT(scope,source_hash,bucket) DO UPDATE SET count=min(count+1,?)
    RETURNING count`).bind(scope,sourceHash,bucket,limit+1).first();
  return row.count > limit ? period - time%period : 0;
}

async function parse(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return null;
  if (!request.body || Number(request.headers.get('Content-Length')) > 16000) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size=0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size>16000) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(await new Blob(chunks).text());
    return data && typeof data==='object' && !Array.isArray(data) ? data : null;
  } catch { return null; }
}
function cookie(token,age,secure) {
  return `aegis_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
}
async function session(request,db) {
  const raw = request.headers.get('Cookie')?.match(/(?:^|;\s*)aegis_session=([0-9a-f]{64})(?:;|$)/)?.[1];
  if (!raw) return {token:null,user:null};
  const token = await digest(raw);
  const user = await db.prepare(`SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id
    WHERE token_hash=? AND expires_at>?`).bind(token,now()).first();
  return {token,user};
}

async function authenticate(db,route,body,secure,priorToken) {
  const email = typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password = typeof body.password==='string'?body.password:'';
  const registering = route === '/api/register';
  const errors = {};
  if (!validEmail(email) || email.length>254) errors.email='Введите действительный email.';
  if (password.length>128 || password.length<(registering?12:1)) errors.password=registering?'Введите от 12 до 128 символов.':'Введите пароль.';
  if (Object.keys(errors).length) return invalid(errors);
  let user = await db.prepare('SELECT id,email,password_hash FROM users WHERE email=?').bind(email).first();
  if (registering) {
    if (user) return invalid({email:'Этот email уже зарегистрирован.'});
    const salt = random(16);
    const hash = salt+':'+await derive(password,salt);
    const id = crypto.randomUUID();
    user = await db.prepare('INSERT INTO users(id,email,password_hash) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING RETURNING id,email').bind(id,email,hash).first();
    if (!user) return invalid({email:'Этот email уже зарегистрирован.'});
  } else {
    const [salt, expected] = user ? user.password_hash.split(':') : ['0'.repeat(32),'0'.repeat(64)];
    const verified = equal(await derive(password,salt),expected);
    if (!user || !verified) return error(401,'Проверьте email и пароль.');
  }
  const token = random(32);
  const tokenHash = await digest(token);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at<=? OR token_hash=?').bind(now(),priorToken),
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(tokenHash,user.id,now()+sessionSeconds),
  ]);
  return json({email:user.email},registering?201:200,{'Set-Cookie':cookie(token,sessionSeconds,secure)});
}

async function applications(request,db,route,user,source) {
  const method = request.method;
  const base = '/api/applications';
  if (route===base && method==='POST') {
    const retry = await rate(db,'application',source,5);
    if (retry) return error(429,'Слишком много попыток. Повторите отправку позже.',{'Retry-After':String(retry)});
    const input = await parse(request);
    if (!input) return error(400,'Получены некорректные данные.');
    const {data,errors} = applicationInput(input);
    if (Object.keys(errors).length) return invalid(errors);
    const key = request.headers.get('Idempotency-Key');
    const id = uuid.test(key ?? '') ? key : crypto.randomUUID();
    const owner = user?.id ?? null;
    const inserted = await db.prepare(`INSERT INTO applications(id,user_id,service_id,name,email,company,message)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id`).bind(id,owner,data.service,data.name,data.email,data.company,data.message).first();
    if (inserted) return json({saved:true, id},201);
    const matching = await db.prepare(`SELECT id FROM applications WHERE id=? AND user_id IS ? AND service_id IS ?
      AND name=? AND email=? AND company=? AND message=?`).bind(id,owner,data.service,data.name,data.email,data.company,data.message).first();
    return matching ? json({saved:true,id}) : error(409,'Данные запроса изменились. Отправьте заявку ещё раз.');
  }
  if (!user) return error(401,'Войдите в личный кабинет.');
  if (route===base && method==='GET') {
    const rows = await db.prepare(`SELECT applications.id,service_id AS service,services.name AS service_name,
      applications.name,email,company,message,applications.created_at
      FROM applications LEFT JOIN services ON service_id=services.id
      WHERE user_id=? ORDER BY applications.created_at DESC,applications.id DESC`).bind(user.id).all();
    return json({items:rows.results});
  }
  const id = route.slice(base.length+1);
  if (!uuid.test(id)) return error(404,'Заявка не найдена.');
  if (method==='PATCH') {
    const input = await parse(request);
    if (!input) return error(400,'Получены некорректные данные.');
    const {data,errors} = applicationInput(input);
    if (Object.keys(errors).length) return invalid(errors);
    const changed = await db.prepare(`UPDATE applications SET service_id=?,name=?,email=?,company=?,message=?,
      updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? RETURNING id`).bind(data.service,data.name,data.email,data.company,data.message,id,user.id).first();
    return changed ? json({saved:true,id}) : error(404,'Заявка не найдена.');
  }
  if (method==='DELETE') {
    const changed = await db.prepare('DELETE FROM applications WHERE id=? AND user_id=? RETURNING id').bind(id,user.id).first();
    return changed ? json({deleted:true}) : error(404,'Заявка не найдена.');
  }
  return error(405,'Действие недоступно.');
}

export async function api(request,env) {
  const url = new URL(request.url);
  const secure = url.protocol==='https:';
  const loopback = env.LOCAL===true && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (!secure && !loopback) return error(400,'Требуется безопасное соединение HTTPS.');
  if (request.method!=='GET' && request.headers.get('Origin')!==url.origin) return error(403,'Источник запроса не разрешён.');
  if (!env.DB) return error(503,'Сервис заявок временно недоступен. Повторите попытку позже.');
  const db=env.DB;
  try {
    const route=url.pathname;
    const source=request.headers.get('CF-Connecting-IP') ?? env.CLIENT_IP ?? 'unknown';
    const {token,user}=await session(request,db);
    if (route==='/api/session' && request.method==='GET') return json({email:user?.email??null});
    if (route==='/api/logout' && request.method==='POST') {
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(token).run();
      return json({signedOut:true},200,{'Set-Cookie':cookie('',0,secure)});
    }
    if (['/api/register','/api/login'].includes(route) && request.method==='POST') {
      const input=await parse(request);
      if (!input) return error(400,'Получены некорректные данные.');
      let retry=await rate(db,route,source,12);
      if (!retry && typeof input.email==='string') retry=await rate(db,route+'/email',input.email.trim().toLowerCase(),10);
      return retry ? error(429,'Слишком много попыток. Повторите позже.',{'Retry-After':String(retry)}) : await authenticate(db,route,input,secure,token);
    }
    if (route==='/api/applications' || route.startsWith('/api/applications/')) return await applications(request,db,route,user,source);
    return error(404,'Адрес не найден.');
  } catch (cause) {
    console.error('AEGIS API failure',cause?.name??'Error');
    return error(503,'Не удалось сохранить изменения. Повторите попытку позже.');
  }
}
