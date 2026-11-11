import crypto from "crypto";
import type { Collection } from "./contracts/document-store";
import { getDocumentStore } from "./storage/db";
import { externalizeAttachments } from "./file-storage";
import type {
  ChatListItem,
  ChatMessageData,
  ChatSession,
  ChatUpdates,
} from "./chat/chat-types";
import {
  addUsageToChat,
  appendToChat,
  applyChatUpdates,
  removeFromChat,
} from "./chat/chat-mutations";

export type {
  ChatAttachment,
  ChatMessageData,
  ChatUsageTotals,
  ChatSession,
  ChatListItem,
} from "./chat/chat-types";
export { autoTitle } from "./chat/chat-mutations";

// ─── Helpers ─────────────────────────────────────────────────────────

/** Chats of all users in one collection; the owner is a field, not a folder */
type StoredChat = ChatSession & { userId: string };

function chats(): Collection<StoredChat> {
  return getDocumentStore().collection<StoredChat>("chats", {
    indexes: [{ fields: ["userId"] }],
  });
}

function toSession(doc: StoredChat): ChatSession {
  const chat: Partial<StoredChat> = { ...doc };
  delete chat.userId;
  return chat as ChatSession;
}

async function loadOwned(userId: string, chatId: string): Promise<StoredChat | null> {
  const doc = await chats().get(chatId);
  return doc?.userId === userId ? doc : null;
}

/** Read-modify-write of one chat, isolated from concurrent writers */
function modifyChat(
  userId: string,
  chatId: string,
  change: (chat: ChatSession) => void
): Promise<ChatSession | null> {
  return getDocumentStore().transaction(async () => {
    const doc = await loadOwned(userId, chatId);
    if (!doc) return null;
    const chat = toSession(doc);
    change(chat);
    externalizeAttachments(chat.messages, userId);
    await chats().upsert({ ...chat, userId });
    return chat;
  });
}

function hasInlineAttachments(messages: ChatMessageData[]): boolean {
  return messages.some((m) => m.attachments?.some((a) => a.url.startsWith("data:")));
}

// ─── CRUD Operations ─────────────────────────────────────────────────

/** Get list of all chats for a user (most recent message first) */
export async function getUserChats(userId: string): Promise<ChatListItem[]> {
  const list: ChatListItem[] = (await chats().find({ userId })).map((chat) => ({
    id: chat.id,
    title: chat.title,
    modelId: chat.modelId,
    systemPrompt: chat.systemPrompt,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    lastMessageAt: chat.lastMessageAt || chat.updatedAt,
    messageCount: chat.messages.length,
  }));

  return list.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

/** Get full chat session by ID */
export async function getChat(userId: string, chatId: string): Promise<ChatSession | null> {
  const doc = await loadOwned(userId, chatId);
  if (!doc) return null;
  // Older chats carry inline base64 images that push requests past the body limit
  if (hasInlineAttachments(doc.messages)) return modifyChat(userId, chatId, () => {});
  return toSession(doc);
}

/** Create a new chat session */
export async function createChat(
  userId: string,
  modelId: string,
  title?: string,
  systemPrompt?: string
): Promise<ChatSession> {
  const now = new Date().toISOString();
  const chat: ChatSession = {
    id: crypto.randomUUID(),
    title: title || "Новый чат",
    modelId,
    systemPrompt,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    revision: 0,
    messages: [],
  };
  await chats().insert({ ...chat, userId });
  return chat;
}

/** Update chat (messages, title, etc.) */
export function updateChat(
  userId: string,
  chatId: string,
  updates: ChatUpdates
): Promise<ChatSession | null> {
  return modifyChat(userId, chatId, (chat) => applyChatUpdates(chat, updates));
}

/** Append messages to a chat and auto-title if needed */
export function appendMessages(
  userId: string,
  chatId: string,
  newMessages: ChatMessageData[]
): Promise<ChatSession | null> {
  return modifyChat(userId, chatId, (chat) => appendToChat(chat, newMessages));
}

/** Delete a specific message from a chat */
export function deleteMessage(
  userId: string,
  chatId: string,
  messageId: string
): Promise<ChatSession | null> {
  return modifyChat(userId, chatId, (chat) => removeFromChat(chat, messageId));
}

/** Add one request to the chat token aggregate */
export async function recordChatUsage(
  userId: string,
  chatId: string,
  usage: { promptTokens: number; completionTokens: number },
  webSearchQueries = 0,
  contextUsage: { promptTokens: number; completionTokens: number } = usage
): Promise<void> {
  await modifyChat(userId, chatId, (chat) => addUsageToChat(chat, usage, webSearchQueries, contextUsage));
}

/** Delete a chat session */
export async function deleteChat(userId: string, chatId: string): Promise<boolean> {
  if (!(await loadOwned(userId, chatId))) return false;
  return chats().delete(chatId);
}
