// Express application entry point
// Implements multi-step auth flow using Telegram MTProto and renders EJS views.

import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { logger } from './logger/logger';
import { SessionData, DialogItem, TelegramDialogs } from './types/types';
import { TelegramClient } from './telegram/mtproto';

// Load .env if present
dotenv.config();

// Base directory of compiled files (dist). In CommonJS, __dirname is available.
const __basedir = __dirname;

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Ensure runtime directories exist
try {
  fs.mkdirSync(path.join(__basedir, '../public'), { recursive: true });
  fs.mkdirSync(path.join(__basedir, '../views'), { recursive: true });
} catch (e) {
  logger.debug({ e }, 'Failed to ensure runtime directories');
}

// View engine setup
app.set('views', path.join(__basedir, '../views'));
app.set('view engine', 'ejs');

// Middlewares
app.use(express.static(path.join(__basedir, '../public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 }
  })
);

// Attach UI error storage on session
app.use((req, _res, next) => {
  const sess = req.session as unknown as SessionData;
  if (!sess.uiErrors) sess.uiErrors = [];
  next();
});

// Helper: push error to UI and log debug
function pushUiError(req: express.Request, message: string) {
  const sess = req.session as unknown as SessionData;
  sess.uiErrors = sess.uiErrors || [];
  sess.uiErrors.push(message);
  logger.debug({ message }, 'UI error added');
}

// Format known Telegram error messages to Russian user-friendly strings
function formatTelegramError(err: any): string {
  const code = err?.error_code;
  const msg = err?.error_message || err?.message || String(err);

  if (msg.includes('PHONE_MIGRATE_') || msg.includes('NETWORK_MIGRATE_')) {
    return 'Ошибка: ваш номер привязан к другому дата-центру. Повторите попытку (клиент сам переключится).';
  }
  if (msg.includes('FLOOD_WAIT_')) {
    return 'Слишком много запросов. Подождите перед повторной попыткой.';
  }
  if (msg.includes('SESSION_PASSWORD_NEEDED')) {
    return 'Требуется облачный пароль (2FA).';
  }
  if (msg.includes('PHONE_CODE_INVALID')) {
    return 'Неверный код подтверждения.';
  }
  if (msg.includes('PHONE_NUMBER_INVALID')) {
    return 'Неверный номер телефона.';
  }
  return code ? `Ошибка ${code}: ${msg}` : `Ошибка: ${msg}`;
}

// Routes
app.get('/', (req, res) => {
  const sess = req.session as unknown as SessionData;
  const uiErrors = sess.uiErrors || [];
  sess.uiErrors = []; // reset once shown

  logger.debug({ uiErrors }, 'Rendering index');

  res.render('index', {
    api_id: process.env.API_ID || '',
    api_hash: process.env.API_HASH || '',
    phone: process.env.PHONE || '',
    errors: uiErrors
  });
});

// Step 1: send code
app.post('/sendCode', async (req, res) => {
  try {
    const { api_id, api_hash, phone } = req.body as Record<string, string>;
    logger.debug({ api_id, api_hash_present: Boolean(api_hash), phone }, 'sendCode request');

    if (!api_id || !api_hash || !phone) throw new Error('Заполните api_id, api_hash и phone');

    const sess = req.session as unknown as SessionData;
    sess.api_id = Number(api_id);
    sess.api_hash = api_hash;
    sess.phone = phone;

    const tg = new TelegramClient(Number(api_id), api_hash);
    const result = await tg.sendCode(phone) as any;

    sess.phone_code_hash = result.phone_code_hash;

    res.render('code', { phone, errors: [] });
  } catch (err: any) {
    logger.debug({ err }, 'sendCode failed');
    pushUiError(req, formatTelegramError(err));
    res.redirect('/');
  }
});

// Step 2: sign in
app.post('/signIn', async (req, res) => {
  try {
    const code = String((req.body as any).code || '').trim();
    const sess = req.session as unknown as SessionData;

    logger.debug({ code_present: Boolean(code) }, 'signIn request');

    if (!sess.api_id || !sess.api_hash || !sess.phone || !sess.phone_code_hash) {
      throw new Error('Сессия истекла, начните заново');
    }

    const tg = new TelegramClient(sess.api_id, sess.api_hash);

    try {
      await tg.signIn(sess.phone, code, sess.phone_code_hash);
      return res.redirect('/chats');
    } catch (err: any) {
      if (String(err?.error_message || '').includes('SESSION_PASSWORD_NEEDED')) {
        return res.render('password', { errors: [] });
      }
      throw err;
    }
  } catch (err: any) {
    logger.debug({ err }, 'signIn failed');
    pushUiError(req, formatTelegramError(err));
    res.redirect('/');
  }
});

// Step 3: 2FA password
app.post('/checkPassword', async (req, res) => {
  try {
    const password = String((req.body as any).password || '');
    const sess = req.session as unknown as SessionData;

    logger.debug({ password_present: Boolean(password) }, 'checkPassword request');

    if (!sess.api_id || !sess.api_hash) throw new Error('Сессия истекла, начните заново');

    const tg = new TelegramClient(sess.api_id, sess.api_hash);
    await tg.checkPassword(password);

    res.redirect('/chats');
  } catch (err: any) {
    logger.debug({ err }, 'checkPassword failed');
    const msg = String(err?.message || err?.error_message || 'Unknown error');
    if (msg.includes('SRP helper is missing')) {
      pushUiError(req, 'В вашей версии @mtproto/core нет SRP-хелпера. Добавьте внешний помощник для SRP (см. примечание в коде).');
      return res.redirect('/');
    }
    pushUiError(req, formatTelegramError(err));
    res.render('password', { errors: (req.session as any).uiErrors });
  }
});

// Chats list
app.get('/chats', async (req, res) => {
  try {
    const sess = req.session as unknown as SessionData;
    logger.debug({ hasCreds: Boolean(sess.api_id && sess.api_hash) }, 'chats request');

    if (!sess.api_id || !sess.api_hash) throw new Error('Сессия истекла, начните заново');

    const tg = new TelegramClient(sess.api_id, sess.api_hash);
    const dialogs = (await tg.getDialogs(50)) as unknown as TelegramDialogs;

    const { users = [], chats = [], dialogs: dlgs = [] } = (dialogs || {}) as any;

    const userMap = new Map<number, any>();
    const chatMap = new Map<number, any>();
    users.forEach((u: any) => userMap.set(u.id, u));
    chats.forEach((c: any) => chatMap.set(c.id, c));

    const items: DialogItem[] = (dlgs || []).map((d: any) => {
      const peer = d?.peer;
      let title = 'Unknown';
      if (!peer) return { title };
      switch (peer._) {
        case 'peerUser': {
          const u = userMap.get(peer.user_id);
          title = (u?.first_name || '') + (u?.last_name ? ' ' + u.last_name : '') || u?.username || 'User';
          break;
        }
        case 'peerChat': {
          const c = chatMap.get(peer.chat_id);
          title = c?.title || 'Chat';
          break;
        }
        case 'peerChannel': {
          const c = chatMap.get(peer.channel_id);
          title = c?.title || 'Channel';
          break;
        }
      }
      return { title } as DialogItem;
    });

    res.render('chats', { items, errors: [] });
  } catch (err: any) {
    logger.debug({ err }, 'get chats failed');
    pushUiError(req, formatTelegramError(err));
    res.redirect('/');
  }
});

app.listen(PORT, () => {
  logger.debug(`Server started on http://localhost:${PORT}`);
});
