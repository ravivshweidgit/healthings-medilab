/**
 * Original lab PDFs on disk — one file per panel. JSON keeps only pdfFileId.
 * Sidecar map is injected at share/backup export, never stored in AsyncStorage at rest.
 */

import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const LAB_PDFS_SIDECAR_KEY = 'healthings:labPdfs';

const DIR_NAME = 'healthings-lab-pdfs';

function rootDir(): string {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('No document directory for lab PDFs');
  return `${base}${DIR_NAME}/`;
}

function fileUri(pdfFileId: string): string {
  const id = pdfFileId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${rootDir()}${id}.pdf`;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(rootDir());
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(rootDir(), { intermediates: true });
  }
}

export async function writeLabPdf(pdfFileId: string, base64: string): Promise<void> {
  const trimmed = base64.trim();
  if (!trimmed) return;
  await ensureDir();
  await FileSystem.writeAsStringAsync(fileUri(pdfFileId), trimmed, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function labPdfExists(pdfFileId: string | undefined): Promise<boolean> {
  if (!pdfFileId) return false;
  const info = await FileSystem.getInfoAsync(fileUri(pdfFileId));
  return info.exists;
}

export async function readLabPdfBase64(pdfFileId: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(fileUri(pdfFileId));
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(fileUri(pdfFileId), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function deleteLabPdf(pdfFileId: string | undefined): Promise<void> {
  if (!pdfFileId) return;
  const uri = fileUri(pdfFileId);
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function deleteLabPdfs(ids: Array<string | undefined>): Promise<void> {
  for (const id of ids) await deleteLabPdf(id);
}

export async function exportLabPdfsMap(): Promise<Record<string, string>> {
  const dirInfo = await FileSystem.getInfoAsync(rootDir());
  if (!dirInfo.exists) return {};
  const names = await FileSystem.readDirectoryAsync(rootDir());
  const out: Record<string, string> = {};
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.pdf')) continue;
    const id = name.slice(0, -4);
    const b64 = await FileSystem.readAsStringAsync(`${rootDir()}${name}`, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (b64) out[id] = b64;
  }
  return out;
}

export async function restoreLabPdfsMap(map: Record<string, string> | null | undefined): Promise<void> {
  if (!map || typeof map !== 'object') return;
  for (const [id, b64] of Object.entries(map)) {
    if (typeof b64 === 'string' && b64.trim()) await writeLabPdf(id, b64);
  }
}

/** Inject sidecar into an export payload; skip if no files. */
export async function injectLabPdfsSidecar(asyncStorage: Record<string, string>): Promise<void> {
  const map = await exportLabPdfsMap();
  if (Object.keys(map).length === 0) {
    delete asyncStorage[LAB_PDFS_SIDECAR_KEY];
    return;
  }
  asyncStorage[LAB_PDFS_SIDECAR_KEY] = JSON.stringify(map);
}

export async function restoreLabPdfsSidecarFromAsyncStorage(
  asyncStorage: Record<string, string>,
): Promise<void> {
  const raw = asyncStorage[LAB_PDFS_SIDECAR_KEY];
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      await restoreLabPdfsMap(parsed as Record<string, string>);
    }
  } catch {
    /* ignore bad sidecar */
  }
}

export async function openLabPdf(pdfFileId: string): Promise<void> {
  const src = fileUri(pdfFileId);
  const info = await FileSystem.getInfoAsync(src);
  if (!info.exists) throw new Error('Original PDF is not on this phone');

  // Android: content:// + VIEW opens Chrome / Drive / the PDF app — not the share sheet.
  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(src);
      await Linking.openURL(contentUri);
      return;
    } catch {
      /* fall through to share sheet */
    }
  }

  const can = await Sharing.isAvailableAsync();
  if (!can) throw new Error('Cannot open PDF on this device');
  const dest = `${FileSystem.cacheDirectory ?? src}lab-${pdfFileId}.pdf`;
  await FileSystem.copyAsync({ from: src, to: dest });
  await Sharing.shareAsync(dest, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
