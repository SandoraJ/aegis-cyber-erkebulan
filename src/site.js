'use strict';
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
function setMenu(open) {
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');
  nav.classList.toggle('open',open);
}
if (toggle && nav) {
  toggle.addEventListener('click',()=>setMenu(toggle.getAttribute('aria-expanded')!=='true'));
  nav.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if (!link || !nav.classList.contains('open')) return;
    setMenu(false);
    if (link.hash) {
      const section=document.getElementById(link.hash.slice(1));
      section?.setAttribute('tabindex','-1');
      section?.focus({preventScroll:true});
    }
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && nav.classList.contains('open')) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 941px)').addEventListener('change',event=>{if(event.matches)setMenu(false);});
}
const application=document.querySelector('#application');
document.querySelectorAll('[data-service]').forEach(link=>{
  link.addEventListener('click',()=>{
    if(application) {
      application.elements.service.value=link.dataset.service;
      application.elements.name.focus({preventScroll:true});
    }
  });
});

function notice(node,message,kind='error') {
  if (!node) return;
  node.textContent=message;
  node.dataset.kind=kind;
}
function fields(form,errors={}) {
  let first;
  form.querySelectorAll('[data-error]').forEach(label=>{
    const key=label.dataset.error;
    const control=form.elements[key];
    const message=errors[key]||'';
    label.textContent=message;
    if (!label.id) {
      label.id=form.id+'-err-'+key;
      control.setAttribute('aria-describedby',[control.getAttribute('aria-describedby'),label.id].filter(Boolean).join(' '));
    }
    if (message) { control.setAttribute('aria-invalid','true'); first ??= control; }
    else control.removeAttribute('aria-invalid');
  });
  return first;
}
document.querySelectorAll('form').forEach(form=>{
  form.addEventListener('input',event=>{
    const name=event.target.name;
    if (!name) return;
    event.target.removeAttribute('aria-invalid');
    const label=Array.from(form.querySelectorAll('[data-error]')).find(element=>element.dataset.error===name);
    if(label)label.textContent='';
  });
});
async function request(url,method='GET',body,key) {
  const headers={Accept:'application/json'};
  if(body)headers['Content-Type']='application/json';
  if(key)headers['Idempotency-Key']=key;
  try {
    const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    return {ok:response.ok,data,status:response.status};
  } catch {
    return {ok:false,data:{error:'Не удалось связаться с сервером. Повторите отправку.'},status:0};
  }
}
function payload(form) {return Object.fromEntries(new FormData(form));}
const emailValid=value=>/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u.test(value);
function bindForm(form,validate,send,onSuccess) {
  if(!form)return;
  let busy=false;
  const submit=form.querySelector('button[type=submit],button:not([type])');
  const status=form.querySelector('.form-status');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    const data=payload(form);
    const first=fields(form,validate(data));
    notice(status,'');
    if(first) {first.focus();return;}
    busy=true;
    const controls=Array.from(form.elements).filter(control=>!control.disabled);
    const oldLabel=submit.innerHTML;
    controls.forEach(control=>{control.disabled=true;});
    submit.textContent='Отправляем…';
    form.setAttribute('aria-busy','true');
    let focus;
    try {
      const result=await send(data);
      if(result.ok) await onSuccess(result.data,status);
      else {
        focus=fields(form,result.data.fields);
        notice(status,result.data.error||'Не удалось выполнить запрос.');
      }
    } catch {
      notice(status,'Не удалось завершить запрос. Повторите попытку.');
    } finally {
      busy=false;
      controls.forEach(control=>{control.disabled=false;});
      if(submit.textContent==='Отправляем…')submit.innerHTML=oldLabel;
      form.removeAttribute('aria-busy');
      focus?.focus();
    }
  });
}
function validateApplication(data) {
  const errors={};
  data.name=data.name.trim();
  data.email=data.email.trim();
  if(!data.name)errors.name='Укажите имя.';
  if(!emailValid(data.email))errors.email='Укажите email в формате name@company.ru.';
  for(const [key,max] of Object.entries({name:100,email:254,company:150,message:3000})) {
    if(data[key].trim().length>max)errors[key]='Допустимо до '+max+' символов.';
  }
  return errors;
}
const account=document.querySelector('#account-area');
let sessionEmail='';
let editing='';
let key;
let previous='';
function mode(id='') {
  editing=id;
  if(!account)return;
  account.querySelector('h2').textContent=id?'Изменение заявки':'Новая заявка';
  application.querySelector('[data-cancel]')?.toggleAttribute('hidden',!id);
  application.querySelector('button[type=submit]').textContent=id?'Сохранить изменения':'Отправить заявку';
}
if(application) {
  bindForm(application,validateApplication,async data=>{
    const snapshot=JSON.stringify(data);
    if(snapshot!==previous || !key) key=crypto.randomUUID();
    previous=snapshot;
    const result=await request('/api/applications'+(editing?'/'+editing:''),editing?'PATCH':'POST',data,editing?undefined:key);
    if(result.status===409)key=undefined;
    if(result.ok && result.data.saved!==true) return {ok:false,data:{error:'Сервер не подтвердил сохранение. Повторите отправку.'}};
    return result;
  },async (_data,status)=>{
    const changed=Boolean(editing);
    key=undefined;
    application.reset();
    notice(status,changed?'Изменения сохранены':'Заявка принята','success');
    mode();
    if(sessionEmail&&account) {
      application.elements.email.value=sessionEmail;
      await listApplications();
    }
  });
}
if(account) {
  const status=document.querySelector('#cabinet-status');
  const auth=document.querySelector('#auth-area');
  const list=document.querySelector('#applications');
  const listStatus=document.querySelector('#list-status');
  const cancel=document.createElement('button');
  cancel.type='button';cancel.className='button outline';cancel.dataset.cancel='';cancel.hidden=true;cancel.textContent='Отменить';
  application.querySelector('.form-foot').insertBefore(cancel,application.querySelector('.form-status'));
  cancel.addEventListener('click',()=>{
    application.reset();fields(application);notice(application.querySelector('.form-status'),'');mode();
    application.elements.email.value=sessionEmail;
  });
  async function display(email) {
    sessionEmail=email||'';
    account.hidden=!sessionEmail;
    auth.hidden=Boolean(sessionEmail);
    document.querySelector('#session-email').textContent=sessionEmail;
    list.replaceChildren();
    application.reset();
    fields(application);
    notice(application.querySelector('.form-status'),'');
    previous='';key=undefined;
    mode();
    if(sessionEmail) {
      application.elements.email.value=sessionEmail;
      await listApplications();
    }
  }
  for(const name of ['register','login']) {
    const form=document.getElementById(name);
    bindForm(form,data=>{
      const errors={};
      data.email=data.email.trim();
      if(!emailValid(data.email))errors.email='Введите действительный email.';
      if(data.password.length<(name==='register'?12:1))errors.password=name==='register'?'Введите минимум 12 символов.':'Введите пароль.';
      return errors;
    },data=>request('/api/'+name,'POST',data),async data=>{
      form.reset();
      notice(status,'');
      await display(data.email);
      document.querySelector('#logout').focus();
    });
  }
  const logout=document.querySelector('#logout');
  logout.addEventListener('click',async ()=>{
    logout.disabled=true;
    const result=await request('/api/logout','POST');
    logout.disabled=false;
    if(result.ok) { await display();document.querySelector('#login input').focus(); }
    else notice(status,result.data.error);
  });
  function render(item) {
    const article=document.createElement('article');
    const title=document.createElement('h3');
    title.textContent=item.service_name||'Консультация';
    const contact=document.createElement('p');
    contact.textContent=[item.name,item.email,item.company].filter(Boolean).join(' · ');
    const message=document.createElement('p');
    message.textContent=item.message;
    const actions=document.createElement('div');
    actions.className='application-actions';
    for(const label of ['Изменить','Удалить']) {
      const button=document.createElement('button');
      button.type='button';button.className='button outline';button.textContent=label;
      if(label==='Изменить')button.addEventListener('click',()=>{
        mode(item.id);fields(application);notice(application.querySelector('.form-status'),'');
        for(const key of ['name','email','company','service','message'])application.elements[key].value=item[key]??'';
        application.elements.name.focus();
      });
      else button.addEventListener('click',async()=>{
        if(!window.confirm('Удалить эту заявку?'))return;
        button.disabled=true;
        const result=await request('/api/applications/'+item.id,'DELETE');
        button.disabled=false;
        if(result.ok){if(editing===item.id)cancel.click();await listApplications();notice(listStatus,'Заявка удалена.','success');}
        else notice(listStatus,result.data.error);
      });
      actions.append(button);
    }
    article.append(title,contact,message,actions);
    return article;
  }
  async function refresh() {
    const result=await request('/api/applications');
    if(!result.ok){notice(listStatus,result.data.error);return;}
    list.replaceChildren(...result.data.items.map(render));
    notice(listStatus,result.data.items.length?'':'У вас пока нет заявок.','info');
  }
  listApplications=refresh;
  (async()=>{
    const result=await request('/api/session');
    if(result.ok)await display(result.data.email);
    else { auth.hidden=false;notice(status,result.data.error); }
  })();
}
var listApplications;
