# node-telegram-oauth-helper (EN)

A small helper web app for Telegram MTProto login (Node.js + TypeScript + Express + EJS) with session persistence using @mtproto/core.

- Repository: https://github.com/dikey1/node-telegram-oauth-helper
- Developer: dikey1

---

## Purpose and audience
This project helps developers quickly perform an interactive Telegram MTProto login and obtain a working session.

Use cases:
- Quick experiments with Telegram API via @mtproto/core;
- Demonstrating the step-by-step login flow: send code → enter code → (optional) cloud password (2FA);
- Viewing dialogs after login;
- Debugging: all errors are logged and displayed in the UI.

Goal: show a minimal but correct authorization flow with on-disk session storage.

---

## Highlights
- Node.js + TypeScript + Express + EJS;
- @mtproto/core with file-backed session storage;
- Login flow: sendCode → signIn → (if needed) checkPassword (SRP, 2FA);
- Chats/dialogs listing after login;
- Logging via pino with extensive logger.debug calls for troubleshooting.

---

## Project structure
```
project-root/
├─ src/
│  ├─ index.ts                # Express entry point; routes and EJS rendering
│  ├─ telegram/
│  │  └─ mtproto.ts          # TelegramClient wrapper around @mtproto/core
│  ├─ logger/
│  │  └─ logger.ts           # Pino logger (debug-friendly)
│  └─ types/
│     ├─ types.ts            # Shared types/interfaces
│     └─ mtproto-core.d.ts   # Module declaration for @mtproto/core
│
├─ views/                     # EJS templates (index, code, password, chats, layout)
├─ public/                    # Static assets (styles.css)
├─ dist/                      # Compiled JS (tsc outDir)
├─ package.json
├─ tsconfig.json
├─ README.ru.md               # Russian readme
├─ README.en.md               # This file
└─ License.md                 # License (EN)
```

Session file note: in dev (ts-node-dev) the file is created at `src/data/1.json`; in the built app it is at `dist/data/1.json`. The directory is auto-created at runtime.

---

## Classes and methods
Class `TelegramClient` (src/telegram/mtproto.ts):
- `constructor(api_id: number, api_hash: string)` — initializes MTProto client with file storage;
- `invoke(method: string, params: object, opts?: object)` — unified call wrapper with logging;
- `sendCode(phone: string)` — sends login code (auth.sendCode);
- `signIn(phone: string, code: string, phone_code_hash: string)` — signs in with code (auth.signIn);
- `checkPassword(password: string)` — SRP-based cloud password (2FA) check (account.getPassword + auth.checkPassword); if your @mtproto/core lacks SRP helper, add an external one;
- `getDialogs(limit = 50)` — fetches dialogs (messages.getDialogs).

Express routes (src/index.ts):
- `GET /` — form for api_id, api_hash, phone;
- `POST /sendCode` — step 1: sends code and stores `phone_code_hash` in session;
- `POST /signIn` — step 2: sign in with code; asks for 2FA password if required;
- `POST /checkPassword` — step 3: 2FA cloud password via SRP;
- `GET /chats` — renders chats list after successful login.

Logging (src/logger/logger.ts):
- Uses pino; defaults to `debug` level in development;
- `logger.debug(...)` is used extensively for easier troubleshooting.

Types (src/types/types.ts):
- `SessionData` — stored in express-session (api_id, api_hash, phone, phone_code_hash, uiErrors);
- `DialogItem` — normalized chat list item;
- `TelegramDialogs`, `SendCodeResult` — partial interfaces for used API responses.

---

## How to run
Requirements:
- Node.js 18+ (LTS recommended).

Install and run:
1. Install dependencies:
   ```bash
   npm i
   ```
2. Development mode (auto-reload):
   ```bash
   npm run dev
   ```
3. Build and start:
   ```bash
   npm run build
   npm start
   ```
4. Open http://localhost:3000

Environment variables (.env, optional):
```
PORT=3000
SESSION_SECRET=dev_secret
API_ID=your_api_id
API_HASH=your_api_hash
PHONE=+15551234567
LOG_LEVEL=debug
```

Important:
- 2FA requires SRP computations. If your `@mtproto/core` doesn’t provide `crypto.getSRPParams`, add an external SRP helper (see https://core.telegram.org/api/srp).
- Do not commit session files (`src/data/1.json` or `dist/data/1.json`).

---

## License and disclaimer
- License: MIT (see License.md) — permissive, allowing use, copy, modification, and distribution with attribution and license notice retained.
- Disclaimer: Provided “as is”, without warranties. The author is not liable for any damages arising from use. Use at your own risk and respect Telegram API terms and limits.
