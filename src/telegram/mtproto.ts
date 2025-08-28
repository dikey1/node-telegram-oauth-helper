// MTProto wrapper around @mtproto/core
// Encapsulates the client creation, API calls and authorization flows.
// Session is persisted to ../data/1.json relative to compiled dist/telegram directory.

import path from 'node:path';
import fs from 'node:fs';
import MTProto from '@mtproto/core';
import { logger } from '../logger/logger';

export class TelegramClient {
  private mtproto: any;
  private api_id: number;
  private api_hash: string;

  constructor(api_id: number, api_hash: string) {
    this.api_id = api_id;
    this.api_hash = api_hash;

    // After build, __dirname -> dist/telegram
    const sessionPath = path.resolve(__dirname, '../data/1.json');

    // Ensure data folder exists to avoid ENOENT
    try {
      fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    } catch (e) {
      logger.debug({ e }, 'Failed to ensure data directory, continuing…');
    }

    logger.debug({ sessionPath }, 'Initializing MTProto with storage path');

    this.mtproto = new MTProto({
      api_id: this.api_id,
      api_hash: this.api_hash,
      storageOptions: { path: sessionPath }
    });
  }

  // Generic invoke with unified error logging
  async invoke<T = any>(method: string, params: Record<string, any>, opts?: Record<string, any>): Promise<T> {
    logger.debug({ method, params, opts }, 'MTProto call');
    try {
      const result = await this.mtproto.call(method, params, opts);
      logger.debug({ method, ok: true }, 'MTProto call success');
      return result as T;
    } catch (err: any) {
      this.handleTelegramError(err, method);
      throw err;
    }
  }

  private handleTelegramError(err: any, method?: string) {
    const { error_code, error_message } = err || {};
    logger.debug({ method, error_code, error_message, err }, 'Telegram API error (debug)');
  }

  // Step 1: Send login code to the phone number
  async sendCode(phone: string) {
    return this.invoke('auth.sendCode', {
      phone_number: phone,
      settings: { _: 'codeSettings' }
    });
  }

  // Step 2: Sign in using the received code
  async signIn(phone: string, code: string, phone_code_hash: string) {
    return this.invoke('auth.signIn', {
      phone_number: phone,
      phone_code: code,
      phone_code_hash
    });
  }

  // Optional: Check 2FA cloud password via SRP
  async checkPassword(password: string) {
    // Fetch password parameters
    const pwdInfo = await this.invoke('account.getPassword', {});

    const crypto = this.mtproto?.crypto;
    if (!crypto || typeof crypto.getSRPParams !== 'function') {
      // If your @mtproto/core distribution lacks SRP helper, you must add an external helper.
      // See https://core.telegram.org/api/srp for details.
      throw new Error('SESSION_PASSWORD_NEEDED: SRP helper is missing in your @mtproto/core. Please add SRP password helper.');
    }

    const { srp_id, current_algo, srp_B } = pwdInfo;
    const { g, p, salt1, salt2 } = current_algo;

    // Compute SRP A and M1 proof using helper
    const { A, M1 } = await crypto.getSRPParams({ g, p, salt1, salt2, gB: srp_B, password });

    return this.invoke('auth.checkPassword', {
      password: { _: 'inputCheckPasswordSRP', srp_id, A, M1 }
    });
  }

  // Fetch dialogs/chats
  async getDialogs(limit = 50) {
    return this.invoke('messages.getDialogs', {
      offset_date: 0,
      offset_id: 0,
      offset_peer: { _: 'inputPeerEmpty' },
      limit,
      hash: 0
    });
  }
}

export default TelegramClient;
