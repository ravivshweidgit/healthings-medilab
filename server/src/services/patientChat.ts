/**
 * Patient /account/ AI chat — Gemini reply + append to sync-blob chat_history_*
 * (same keys as the app). Clinic never receives these keys (be-24 mentor strip).
 */
import type { PublicUser } from './jwt.js';
import { mentorChatReplyForPatient, type MentorType } from './geminiClinic.js';
import {
  SyncError,
  appendPatientAppChatMessages,
  loadPatientAppChatThread,
  type AppChatMessage,
} from './sync.js';

export async function sendPatientAppChat(
  user: PublicUser,
  mentorType: MentorType,
  message: string,
  dayKey: string,
  locale?: string | null,
): Promise<{ reply: string; thread: AppChatMessage[] }> {
  if (user.role !== 'patient') {
    throw new SyncError('Only patients can use account AI chat', 403);
  }
  const text = message.trim();
  if (!text) throw new SyncError('Message is required', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    throw new SyncError('Invalid dayKey', 400);
  }

  const { priorThread, replyLocale } = await loadPatientAppChatThread(user, mentorType, dayKey);

  const replyText = await mentorChatReplyForPatient(
    mentorType,
    text,
    priorThread,
    user.id,
    locale || replyLocale,
  );

  const userMsg: AppChatMessage = {
    role: 'user',
    text,
    sentAt: new Date().toISOString(),
  };
  const assistantMsg: AppChatMessage = {
    role: 'assistant',
    text: replyText,
    sentAt: new Date().toISOString(),
  };

  const thread = await appendPatientAppChatMessages(
    user,
    mentorType,
    dayKey,
    userMsg,
    assistantMsg,
  );

  return { reply: replyText, thread };
}
