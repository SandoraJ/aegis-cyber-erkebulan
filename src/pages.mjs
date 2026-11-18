import { services, steps, cases, faq } from './content.mjs';

const paths = {
  brand:'M12 2 21 7v7c0 4-5 7-9 9-4-2-9-5-9-9V7z M7.5 15l4.5-8 4.5 8 M9.4 12h5.2',
  shield:'M12 22s7-3.5 7-9V6l-7-3-7 3v7c0 5.5 7 9 7 9z M9 12l2 2 4-4',
  pulse:'M3 12h4l3-7 4 14 3-7h4',
  bolt:'m13 2-8 12h6l-1 8 9-12h-6z',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4 M13 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  commerce:'M3 5h2l2.5 10h10.8L21 8H6 M10 20h.01 M18 20h.01',
  cloud:'M7 18h10a4 4 0 0 0 .7-8 6 6 0 0 0-11.2 1A3.6 3.6 0 0 0 7 18z',
  response:'M12 3l9 5v8l-9 5-9-5V8z M12 8v5 M12 16h.01',
  arrow:'M4 12h15 M13 6l6 6-6 6',
  diagonal:'M6 18 18 6 M8 6h10v10',
  lock:'M6 11h12v9H6z M9 11V8a3 3 0 0 1 6 0v3',
};
const icon = (name, cls='') => `<svg class="${cls}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const logo = `<a class="brand" href="/" aria-label="AEGIS CYBER — главная">${icon('brand')}<span>AEGIS<span class="brand-tone"> CYBER</span></span></a>`;
const options = `<option value="">Выберите услугу</option>${services.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}`;
const control = (key,label,attr,tag='input') => `<label class="field ${key==='message'?'full':''}"><span>${label}</span>${tag==='select'?`<select name="${key}" aria-describedby="err-${key}">${options}</select>`:tag==='textarea'?`<textarea name="${key}" aria-describedby="err-${key}" ${attr}></textarea>`:`<input name="${key}" aria-describedby="err-${key}" ${attr}>`}<small id="err-${key}" class="error" data-error="${key}"></small></label>`;
const fields = [
  control('name','Имя <em>*</em>','required maxlength="100" autocomplete="name" placeholder="Как к вам обращаться"'),
  control('email','Рабочий email <em>*</em>','required type="email" maxlength="254" autocomplete="email" placeholder="name@company.ru"'),
  control('company','Компания','maxlength="150" autocomplete="organization" placeholder="Название компании"'),
  control('service','Услуга','','select'),
  control('message','Кратко о задаче','maxlength="3000" rows="4" placeholder="Что вы хотите защитить или улучшить?"','textarea'),
].join('');
const form = `<form class="form-panel" id="application" novalidate><div class="form-grid">${fields}</div><div class="form-foot"><button class="button primary" type="submit">Отправить заявку ${icon('arrow')}</button><p class="form-status" role="status" aria-live="polite"></p></div></form>`;
const consultation = `<a class="button primary" href="#contacts">Обсудить проект ${icon('diagonal')}</a>`;
const head = (title,desc) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0B0E14"><meta name="description" content="${desc}"><title>${title}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/site.css"><script src="/site.js" defer></script></head>`;
const description = 'AEGIS CYBER помогает бизнесу оценивать риски, выявлять угрозы и восстанавливать инфраструктуру после инцидентов.';
const nav = `<nav id="site-nav" aria-label="Основная навигация"><a href="#services">Услуги</a><a href="#process">Как мы работаем</a><a href="#cases">Кейсы</a><a href="#contacts">Контакты</a><a class="mobile-account" href="/cabinet">Личный кабинет</a><a class="button outline mobile-cta" href="#contacts">Обсудить проект ${icon('diagonal')}</a></nav>`;
const header = `<a class="skip" href="#main">К содержанию</a><header class="site-header"><div class="wrap header-grid">${logo}${nav}<a class="button outline header-cta" href="#contacts">Обсудить проект ${icon('diagonal')}</a><button type="button" class="menu-toggle" aria-controls="site-nav" aria-expanded="false" aria-label="Открыть меню"><span></span><span></span></button></div></header>`;
const footer = `<footer class="footer"><div class="wrap">${logo}<p>Кибербезопасность для бизнеса</p><a href="/cabinet">Личный кабинет ${icon('diagonal')}</a></div></footer>`;

export const home = head('AEGIS CYBER — Кибербезопасность для бизнеса',description)+`<body>${header}<main id="main">
<section class="hero"><div class="hero-image"><img src="/hero.jpg" width="1200" height="900" alt="" fetchpriority="high"></div><div class="wrap hero-inner"><div class="hero-copy"><div class="eyebrow"><i></i> Защита цифровой инфраструктуры</div><h1>Кибербезопасность<br><span>для бизнеса</span></h1><p>Находим слабые места, защищаем инфраструктуру и помогаем восстановить работу после инцидентов.</p><div class="hero-actions">${consultation}<a class="button outline" href="#services">Посмотреть услуги ${icon('arrow')}</a></div></div></div></section>
<div class="discipline"><div class="wrap"><span>АНАЛИЗ РИСКОВ</span><span>ЗАЩИТА ИНФРАСТРУКТУРЫ</span><span>РЕАГИРОВАНИЕ</span></div></div>
<section class="section wrap" id="services"><div class="section-heading"><div><div class="eyebrow"><i></i> Экспертиза</div><h2>Услуги</h2></div><p>От оценки рисков до восстановления после инцидента. Подберём работы под вашу инфраструктуру.</p></div><div class="services-grid">${services.map(([id,name,summary,work,result,shape])=>`<article class="service-card"><div class="service-icon">${icon(shape)}</div><h3>${name}</h3><p>${summary}</p><details><summary>Подробнее <span class="plus" aria-hidden="true"></span></summary><div class="service-details"><p><strong>Состав работ</strong>${work}</p><p><strong>Результат</strong>${result}</p></div></details><a href="#contacts" data-service="${id}" class="service-link" aria-label="Обсудить услугу «${name}»">Обсудить ${icon('diagonal')}</a></article>`).join('')}</div></section>
<section class="section section-alt" id="process"><div class="wrap"><div class="section-heading"><div><div class="eyebrow"><i></i> Этапы проекта</div><h2>Как мы работаем</h2></div></div><ol class="steps">${steps.map(([title,body],index)=>`<li><span aria-hidden="true">0${index+1}</span><h3>${title}</h3><p>${body}</p></li>`).join('')}</ol></div></section>
<section class="section wrap" id="cases"><div class="section-heading"><div><div class="eyebrow"><i></i> Задачи бизнеса</div><h2>Кейсы</h2></div><p>Три примера того, как может выглядеть проект по защите инфраструктуры.</p></div><div class="case-grid">${cases.map(([shape,title,task,work,result])=>`<article class="case-card"><div class="case-art ${shape}">${icon(shape)}<span>Пример проекта</span></div><div class="case-content"><h3>${title}</h3><dl><dt>Задача</dt><dd>${task}</dd><dt>Действия</dt><dd>${work}</dd><dt>Итог</dt><dd>${result}</dd></dl></div></article>`).join('')}</div></section>
<section class="section section-alt" id="faq"><div class="wrap split"><div><div class="eyebrow"><i></i> Перед началом</div><h2>Частые вопросы</h2></div><div class="faq">${faq.map(([q,a])=>`<details><summary>${q}<span class="plus" aria-hidden="true"></span></summary><p>${a}</p></details>`).join('')}</div></div></section>
<section class="section wrap split contact" id="contacts"><div><div class="eyebrow"><i></i> Контакты</div><h2>Обсудим ваш проект</h2><p>Расскажите, с какой задачей вы столкнулись. Заявка поможет нам подготовиться к первой консультации.</p><div class="privacy">${icon('lock')}<p>Опишите задачу в общих чертах. Указывать пароли и другие секретные данные не требуется.</p></div></div>${form}</section>
</main>${footer}</body></html>`;

export const cabinet = head('Личный кабинет — AEGIS CYBER','Управление вашими заявками на консультацию.')+`<body><a class="skip" href="#main">К содержанию</a><header class="site-header"><div class="wrap cabinet-head">${logo}<a href="/#contacts" class="button outline">На главную ${icon('arrow')}</a></div></header><main id="main" class="wrap section cabinet"><div class="eyebrow"><i></i> AEGIS CYBER</div><h1>Личный кабинет</h1><p id="cabinet-status" role="status"></p><div id="auth-area" class="auth-grid" hidden>
<form id="login" class="form-panel" novalidate><h2>Вход</h2><label class="field">Email<input name="email" type="email" required autocomplete="username" maxlength="254"><small class="error" data-error="email"></small></label><label class="field">Пароль<input name="password" type="password" required maxlength="128" autocomplete="current-password"><small class="error" data-error="password"></small></label><button class="button primary">Войти</button><p class="form-status" role="status"></p></form>
<form id="register" class="form-panel" novalidate><h2>Регистрация</h2><label class="field">Email<input name="email" type="email" required autocomplete="email" maxlength="254"><small class="error" data-error="email"></small></label><label class="field">Пароль<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="password-hint"><small id="password-hint">От 12 до 128 символов</small><small class="error" data-error="password"></small></label><button class="button primary">Создать аккаунт</button><p class="form-status" role="status"></p></form></div>
<section id="account-area" hidden><div class="cabinet-toolbar"><p id="session-email"></p><button type="button" class="button outline" id="logout">Выйти</button></div><h2>Новая заявка</h2>${form}<h2>Мои заявки</h2><p id="list-status" role="status"></p><div id="applications" class="application-list"></div></section></main>${footer}</body></html>`;

export const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0B0E14"/><g transform="translate(4 4)" fill="none" stroke="#5EEAD4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths.brand}"/></g></svg>`;
