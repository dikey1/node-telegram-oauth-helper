// Shared application types and interfaces
// NOTE: The issue requires that all types/interfaces live here.
// Keep this file as the single source of truth for shapes used across the app.

export interface SessionData {
  api_id?: number; // Telegram app api_id
  api_hash?: string; // Telegram app api_hash
  phone?: string; // Phone number in international format
  phone_code_hash?: string; // Hash returned by auth.sendCode
  uiErrors?: string[]; // Errors to show in UI
}

export interface DialogItem {
  // Normalized UI item for chats list
  title: string;
}

export interface SendCodeResult {
  phone_code_hash: string;
}

export interface TelegramDialogs {
  // Partial shape we actually use from messages.getDialogs
  dialogs: Array<any>;
  users: Array<any>;
  chats: Array<any>;
}
