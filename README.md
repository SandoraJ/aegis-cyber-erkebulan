# AEGIS CYBER

AEGIS CYBER — русскоязычный сайт консультаций по кибербезопасности. Страница / содержит услуги, кейсы и форму. По адресу /cabinet пользователь может зарегистрироваться и управлять своими заявками. Заявка с главной страницы доступна без аккаунта. Заявки, созданные после входа, принадлежат учётной записи.

## Запуск

Требуется Node.js 24+. Рабочие зависимости устанавливать не нужно.

```bash
npm run build
npm test
npm start
```

Откройте http://127.0.0.1:4173/. По умолчанию хранилище — aegis.sqlite. Переменная AEGIS_SQLITE_PATH позволяет выбрать другой файл. PORT меняет порт. Для проверки недоступной базы запустите приложение с AEGIS_FORCE_UNAVAILABLE=1.

Для просмотра заявок владельцем используйте защищённый интерфейс своей БД или локальный SQLite в режиме чтения.

```bash
node -e "const db=new (require('node:sqlite').DatabaseSync)('aegis.sqlite',{readOnly:true}); console.table(db.prepare('SELECT id,name,email,company,service_id,message,created_at FROM applications ORDER BY created_at DESC').all());db.close()"
```

## API

| Метод и путь | Назначение |
| --- | --- |
| POST /api/applications | Создать заявку с аккаунтом или без него |
| GET /api/applications | Список своих заявок после входа |
| PATCH /api/applications/:id | Изменить свою заявку |
| DELETE /api/applications/:id | Удалить свою заявку |
| POST /api/register | Регистрация и создание сессии |
| POST /api/login | Вход |
| GET /api/session | Текущая сессия |
| POST /api/logout | Выход |

Изменяющие запросы должны содержать Origin текущего сайта. Для формы и авторизации тело передаётся в JSON. Для безопасного повтора форма посылает Idempotency-Key. Кабинет выводит пользовательские поля через textContent.

## Рабочее окружение

В Sites привязка D1 называется DB. Схема находится в drizzle, а npm run build собирает Worker в dist/server/index.js. При развертывании Node-варианта разместите приложение за HTTPS-прокси на той же машине, укажите AEGIS_PUBLIC_ORIGIN с HTTPS-адресом без завершающего слеша и разместите файл SQLite на постоянном диске. Локальный HTTP предназначен для loopback. Токены сессий генерируются на сервере. Ключи внешних сервисов для этой версии не требуются.

В комплекте поставки Git bundle позволяет восстановить историю коммитов командой git clone aegis-cyber.bundle aegis-cyber. Для публикации на GitHub подключите пустой репозиторий и отправьте ветку main.
