/**
 * Capture and export the exact Gemini macro-revision prompt from the phone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  buildMacroRevisionBundle,
  type MacroRevisionTrigger,
} from '../logic/macroAutoAdjust';
import { buildMacroRevisionGeminiPrompt } from './GeminiService';
import { getLanguage, type UserLanguage } from './TargetService';

const LAST_PROMPT_KEY = 'healthings:lastMacroGeminiPrompt';

export type SavedMacroGeminiPrompt = {
  exportedAt: string;
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
  charCount: number;
  prompt: string;
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getLastMacroGeminiPrompt(): Promise<SavedMacroGeminiPrompt | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedMacroGeminiPrompt;
  } catch {
    return null;
  }
}

/** Build prompt from live app data and persist locally (no Gemini call). */
export async function captureMacroGeminiPrompt(opts: {
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
  lang?: UserLanguage | null;
  contextText?: string;
}): Promise<SavedMacroGeminiPrompt> {
  const lang = opts.lang ?? (await getLanguage());
  const contextText =
    opts.contextText ??
    (await buildMacroRevisionBundle({ trigger: opts.trigger, triggerDetail: opts.triggerDetail }))
      .contextText;
  const prompt = buildMacroRevisionGeminiPrompt(contextText, lang);
  const saved: SavedMacroGeminiPrompt = {
    exportedAt: new Date().toISOString(),
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    charCount: prompt.length,
    prompt,
  };
  await AsyncStorage.setItem(LAST_PROMPT_KEY, JSON.stringify(saved));
  return saved;
}

/** Write prompt text to user-picked folder (Downloads, etc.). */
export async function exportMacroGeminiPromptFile(prompt: string): Promise<boolean> {
  const filename = `macro-gemini-prompt_${todayKey()}.txt`;
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return false;

  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    filename,
    'text/plain',
  );
  await FileSystem.writeAsStringAsync(fileUri, prompt, { encoding: 'utf8' });
  return true;
}

/** Rebuild from live data, save locally, and export .txt for sharing/debug. */
export async function buildAndExportMacroPrompt(opts: {
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
  lang?: UserLanguage | null;
}): Promise<{ ok: boolean; charCount: number; exportedAt: string }> {
  const saved = await captureMacroGeminiPrompt(opts);
  const ok = await exportMacroGeminiPromptFile(saved.prompt);
  return { ok, charCount: saved.charCount, exportedAt: saved.exportedAt };
}
