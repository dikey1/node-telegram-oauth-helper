# node-telegram-oauth-helper (RU)

Веб‑приложение‑помощник для авторизации в Telegram по MTProto (Node.js + TypeScript + Express + EJS) с сохранением сессии через @mtproto/core.

- Репозиторий: https://github.com/dikey1/node-telegram-oauth-helper
- Разработчик: dikey1

---

## Для чего и для кого
Проект предназначен для разработчиков, которым нужно быстро и наглядно пройти интерактивную авторизацию в Telegram и получить рабочую сессию MTProto.

Подходит для:
- Быстрых экспериментов с Telegram API (@mtproto/core);
- Демонстрации пошаговой авторизации: отправка кода → ввод кода → (опционально) облачный пароль (2FA);
- Просмотра списка диалогов после входа;
- Отладки: все ошибки логируются и выводятся в интерфейсе.

Цель — показать минимальный, но корректный поток авторизации с хранением сессии на диске.

---

## Ключевые возможности
- Node.js + TypeScript + Express + EJS;
- @mtproto/core с сохранением сессии в файл;
- Пошаговый сценарий: sendCode → signIn → (при необходимости) checkPassword (SRP, 2FA);
- Список чатов/диалогов после успешного входа;
- Логирование через pino, в коде используются подробные вызовы logger.debug для удобной отладки.

---

## Структура проекта
```
project-root/
├─ src/
│  ├─ index.ts                # Точка входа Express; роуты и рендеринг EJS
│  ├─ telegram/
│  │  └─ mtproto.ts          # Класс TelegramClient (обёртка @mtproto/core)
│  ├─ logger/
│  │  └─ logger.ts           # Pino-логгер (logger.debug для отладки)
│  └─ types/
│     ├─ types.ts            # Общие типы/интерфейсы
│     └─ mtproto-core.d.ts   # Объявление модуля для @mtproto/core
│
├─ views/                     # EJS-шаблоны (index, code, password, chats, layout)
├─ public/                    # Статические ресурсы (styles.css)
├─ dist/                      # Скомпилированный JS (tsc outDir)
├─ package.json
├─ tsconfig.json
├─ README.ru.md               # Этот файл
├─ README.en.md               # Английское описание
└─ License.md                 # Лицензия (EN)
```

Примечание о файле сессии: в dev‑режиме (ts-node-dev) он создаётся по пути `src/data/1.json`; в собранной версии — `dist/data/1.json`. Каталог создаётся автоматически во время работы.

---

## Классы и методы
Класс `TelegramClient` (src/telegram/mtproto.ts):
- `constructor(api_id: number, api_hash: string)` — инициализация клиента MTProto с хранением сессии в файле;
- `invoke(method: string, params: object, opts?: object)` — обёртка вызова методов с единым логированием;
- `sendCode(phone: string)` — отправляет код подтверждения (auth.sendCode);
- `signIn(phone: string, code: string, phone_code_hash: string)` — вход по коду (auth.signIn);
- `checkPassword(password: string)` — проверка облачного пароля (2FA) по SRP (account.getPassword + auth.checkPassword); если в вашей сборке @mtproto/core нет SRP‑хелпера, требуется внешний помощник;
- `getDialogs(limit = 50)` — получение списка диалогов (messages.getDialogs).

Роуты Express (src/index.ts):
- `GET /` — форма для ввода api_id, api_hash, phone;
- `POST /sendCode` — шаг 1: отправка кода, сохраняется `phone_code_hash`;
- `POST /signIn` — шаг 2: вход по коду; если нужна 2FA — переход на ввод пароля;
- `POST /checkPassword` — шаг 3: проверка облачного пароля (2FA) через SRP;
- `GET /chats` — вывод списка чатов.

Логирование (src/logger/logger.ts):
- Используется pino; по умолчанию в разработке уровень `debug`;
- Важное требование: широко использовать `logger.debug(...)` для отладки.

Типы (src/types/types.ts):
- `SessionData` — данные в express-session (api_id, api_hash, phone, phone_code_hash, uiErrors);
- `DialogItem` — нормализованный элемент для списка чатов;
- `TelegramDialogs`, `SendCodeResult` — частичные интерфейсы под используемые ответы API.

---

## Как запустить
Требования:
- Node.js 18+ (рекомендуется LTS).

Установка и запуск:
1. Установите зависимости:
   ```bash
   npm i
   ```
2. Dev-режим (автоперезапуск):
   ```bash
   npm run dev
   ```
3. Сборка и запуск production-сборки:
   ```bash
   npm run build
   npm start
   ```
4. Откройте http://localhost:3000

Переменные окружения (.env, опционально):
```
PORT=3000
SESSION_SECRET=dev_secret
API_ID=ваш_api_id
API_HASH=ваш_api_hash
PHONE=+79991234567
LOG_LEVEL=debug
```

Важно:
- Для 2FA (облачного пароля) требуется SRP. Если в `@mtproto/core` нет `crypto.getSRPParams`, добавьте внешний помощник (см. https://core.telegram.org/api/srp).
- Не коммитьте файлы сессии (`src/data/1.json` или `dist/data/1.json`).

---

## Лицензия и отказ от ответственности
- Лицензия: MIT (см. License.md) — свободное использование, копирование, модификация и распространение при сохранении уведомления об авторских правах и текста лицензии.
- Отказ от ответственности: ПО предоставляется «как есть», без каких‑либо гарантий. Автор не несёт ответственности за любой ущерб, возникший из‑за использования проекта. Используйте на свой страх и риск и соблюдайте условия Telegram API.
