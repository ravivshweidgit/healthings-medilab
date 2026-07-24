/**
 * Detected-script text direction for USER-authored content (audit F13).
 *
 * Presentation only: we look at the text's own script to right-align Hebrew/Arabic
 * content even when the app chrome is English (and vice-versa). This never parses the
 * MEANING of rules/directives (see ai-judgment-not-regex rule) — it only picks
 * `textAlign` / `writingDirection` for display.
 */
import type { TextStyle } from 'react-native';

// Hebrew, Arabic (+ supplements), and Arabic presentation forms.
const RTL_CHAR =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** True when the string contains any RTL-script (Hebrew/Arabic) character. */
export function isRtlText(s?: string | null): boolean {
  if (!s) return false;
  return RTL_CHAR.test(s);
}

export const RTL_TEXT_STYLE: TextStyle = { textAlign: 'right', writingDirection: 'rtl' };
export const LTR_TEXT_STYLE: TextStyle = { textAlign: 'left', writingDirection: 'ltr' };

/**
 * Alignment style for user-authored content, chosen by the text's own script.
 * Returns `undefined` for empty input so callers can fall back to their default style.
 */
export function contentAlignStyle(s?: string | null): TextStyle | undefined {
  if (!s) return undefined;
  return isRtlText(s) ? RTL_TEXT_STYLE : LTR_TEXT_STYLE;
}
