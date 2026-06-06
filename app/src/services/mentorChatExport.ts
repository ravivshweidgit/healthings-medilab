/**
 * Save mentor chat export as HTML (UTF-8, RTL for Hebrew).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { formatMentorChatExport, formatMentorChatExportHtml } from '../logic/mentorChatExport';
import type { ChatMessage, CoachMessage, Gender, MentorType, UserLanguage } from './TargetService';

export { formatMentorChatExport, formatMentorChatExportHtml };

export async function exportMentorChat(params: {
  dayKey: string;
  mentors: MentorType[];
  coachMsg: CoachMessage | null;
  historyByMentor: Partial<Record<MentorType, ChatMessage[]>>;
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
}): Promise<boolean> {
  const html = formatMentorChatExportHtml(params);
  const filename = `mentor_chat_${params.dayKey}.html`;

  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return false;

  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    filename,
    'text/html',
  );
  await FileSystem.writeAsStringAsync(fileUri, html, { encoding: 'utf8' });
  return true;
}
