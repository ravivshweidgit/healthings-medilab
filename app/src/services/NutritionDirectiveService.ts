/**
 * Nutritionist session PDF imports — verbatim plain text on device (unbounded; user deletes).
 */

import { formatShortDate } from '../i18n/dateLocale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatActiveDirectiveBlock } from '../logic/nutritionDirectiveContext';

export const NUTRITION_DIRECTIVES_KEY = 'nutrition_directives_v1';

export type NutritionDirectiveLang = 'he' | 'en' | 'mixed' | null;

export type NutritionDirective = {
  id: string;
  importedAt: string;
  sessionDate: string | null;
  title: string;
  sourceFileName: string | null;
  fullText: string;
  lang: NutritionDirectiveLang;
};

export type ParsedNutritionDirectiveDraft = Omit<
  NutritionDirective,
  'id' | 'importedAt' | 'sourceFileName'
>;

type NutritionDirectivesStore = {
  activeId: string | null;
  entries: NutritionDirective[];
};

/** Legacy structured fields — migrated to fullText on read. */
type LegacyDirectiveFields = {
  goals?: string[];
  menuTargets?: string[];
  sampleMenu?: string;
  macroSummary?: string | null;
  guidelines?: string[];
  tasks?: string[];
  providerContact?: string | null;
};

function newId(): string {
  return `nd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t) return t;
  }
  return null;
}

function reconstructLegacyText(raw: LegacyDirectiveFields): string {
  const blocks: string[] = [];
  const pushSection = (heading: string, lines: string[]) => {
    if (!lines.length) return;
    blocks.push(heading, ...lines.map((l) => `- ${l}`));
  };
  pushSection('Goals', raw.goals ?? []);
  pushSection('Menu targets', raw.menuTargets ?? []);
  if (raw.macroSummary?.trim()) blocks.push(raw.macroSummary.trim());
  if (raw.sampleMenu?.trim()) blocks.push('', raw.sampleMenu.trim());
  pushSection('Guidelines', raw.guidelines ?? []);
  pushSection('Tasks', raw.tasks ?? []);
  if (raw.providerContact?.trim()) blocks.push('', raw.providerContact.trim());
  return blocks.join('\n').trim();
}

function normalizeEntry(raw: NutritionDirective & LegacyDirectiveFields): NutritionDirective {
  let fullText = String(raw.fullText ?? '').trim();
  if (!fullText) fullText = reconstructLegacyText(raw);
  const title =
    String(raw.title ?? '').trim() ||
    firstNonEmptyLine(fullText)?.slice(0, 80) ||
    'Nutritionist report';
  return {
    id: raw.id,
    importedAt: raw.importedAt,
    sessionDate: raw.sessionDate ?? null,
    title,
    sourceFileName: raw.sourceFileName ?? null,
    fullText,
    lang: raw.lang ?? null,
  };
}

async function readStore(): Promise<NutritionDirectivesStore> {
  const raw = await AsyncStorage.getItem(NUTRITION_DIRECTIVES_KEY);
  if (!raw) return { activeId: null, entries: [] };
  try {
    const parsed = JSON.parse(raw) as NutritionDirectivesStore;
    return {
      activeId: parsed.activeId ?? null,
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map((e) => normalizeEntry(e as NutritionDirective & LegacyDirectiveFields))
        : [],
    };
  } catch {
    return { activeId: null, entries: [] };
  }
}

async function writeStore(store: NutritionDirectivesStore): Promise<void> {
  await AsyncStorage.setItem(NUTRITION_DIRECTIVES_KEY, JSON.stringify(store));
}

export async function listNutritionDirectives(): Promise<NutritionDirective[]> {
  const store = await readStore();
  return store.entries;
}

export async function getActiveNutritionDirective(): Promise<NutritionDirective | null> {
  const store = await readStore();
  if (!store.activeId) return store.entries[0] ?? null;
  return store.entries.find((e) => e.id === store.activeId) ?? store.entries[0] ?? null;
}

export async function saveNutritionDirective(
  draft: ParsedNutritionDirectiveDraft,
  sourceFileName: string | null,
): Promise<NutritionDirective> {
  const store = await readStore();
  const fullText = draft.fullText.trim();
  const title =
    draft.title.trim() ||
    firstNonEmptyLine(fullText)?.slice(0, 80) ||
    sourceFileName?.replace(/\.pdf$/i, '') ||
    'Nutritionist report';
  const entry: NutritionDirective = {
    id: newId(),
    importedAt: new Date().toISOString(),
    sessionDate: draft.sessionDate,
    title,
    sourceFileName,
    fullText,
    lang: draft.lang,
  };
  const entries = [entry, ...store.entries];
  await writeStore({ activeId: entry.id, entries });
  return entry;
}

export async function setActiveNutritionDirective(id: string): Promise<NutritionDirective | null> {
  const store = await readStore();
  const entry = store.entries.find((e) => e.id === id);
  if (!entry) return null;
  await writeStore({ ...store, activeId: id });
  return entry;
}

export async function deleteNutritionDirective(id: string): Promise<void> {
  const store = await readStore();
  const entries = store.entries.filter((e) => e.id !== id);
  let activeId = store.activeId;
  if (activeId === id) activeId = entries[0]?.id ?? null;
  await writeStore({ activeId, entries });
}

export async function getNutritionDirectiveAiContext(): Promise<string | null> {
  const active = await getActiveNutritionDirective();
  if (!active?.fullText.trim()) return null;
  return formatActiveDirectiveBlock(active);
}

export function formatDirectiveDate(d: NutritionDirective, langCode?: string | null): string {
  const iso = d.sessionDate ?? d.importedAt;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return formatShortDate(t, langCode);
}

export function directivePreviewLine(d: NutritionDirective): string | null {
  const lines = d.fullText.split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length <= 1) return null;
  return lines[1]?.slice(0, 80) ?? null;
}

export function directiveSubtitle(d: NutritionDirective | null, count: number): string {
  if (!d && count === 0) return 'Import nutritionist report (PDF)';
  if (d) return `${d.title} · ${formatDirectiveDate(d)}`;
  return `${count} reports — tap to view`;
}
