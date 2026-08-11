/**
 * Dashboard Help strip — product Q&A (prompt98).
 * Answers in appLocale; separate from mentor chat.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getHelpStripCopy } from '../i18n/helpStripCopy';
import { getExplainerCopy } from '../i18n/explainerCopy';
import { EXPLAINER_CATALOG, explainerWatchUrl } from '../i18n/explainerUrls';
import { helpUrl, type HelpSlug } from '../i18n/helpUrls';
import { askAppHelp } from '../services/GeminiService';
import { OutOfCreditsError } from '../services/UsageQueueService';
import type { UserLanguage } from '../services/TargetService';
import { dashNavLabel, type DashNavTarget } from '../logic/dashboardNav';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { StripIcons } from '../theme/icons';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  lang: UserLanguage;
  onNavigate?: (target: DashNavTarget) => void;
};

const TOPIC_CHIPS: { slug: HelpSlug; labelEn: string }[] = [
  { slug: 'withings-scale', labelEn: 'Scale' },
  { slug: 'meal-logging', labelEn: 'Meals' },
  { slug: 'phone-health-activity', labelEn: 'Phone health' },
  { slug: 'withings-link', labelEn: 'Withings' },
];

export function HelpStrip({ expanded, onToggleExpand, lang, onNavigate }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const t = getHelpStripCopy(lang.code);
  const explainer = useMemo(() => getExplainerCopy(lang.code), [lang.code]);
  const rtl = lang.code === 'he' || lang.code === 'ar';

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [navTargets, setNavTargets] = useState<DashNavTarget[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    setNavTargets([]);
    try {
      const result = await askAppHelp(q, lang);
      setAnswer(result.text);
      setNavTargets(result.targets);
    } catch (e) {
      if (e instanceof OutOfCreditsError) {
        setError(t.outOfCredits);
      } else {
        setError(t.errorGeneric);
      }
    } finally {
      setBusy(false);
    }
  }, [question, busy, lang, t.outOfCredits, t.errorGeneric]);

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={t.title}
        subtitle={t.subtitle}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel={`Collapse ${t.title}`}
        expandLabel={`Expand ${t.title}`}
        icon={StripIcons.help}
      />

      {expanded ? (
        <View style={styles.body}>
          <Text style={[styles.hint, rtl && styles.textRtl]}>{t.emptyHint}</Text>
          <TextInput
            style={[styles.input, rtl && styles.textRtl]}
            value={question}
            onChangeText={setQuestion}
            placeholder={t.placeholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            editable={!busy}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.askBtn, (!question.trim() || busy) && styles.askBtnDisabled]}
            onPress={() => void ask()}
            disabled={!question.trim() || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.askBtnText}>{t.ask}</Text>
            )}
          </Pressable>

          {error ? <Text style={[styles.error, rtl && styles.textRtl]}>{error}</Text> : null}
          {answer ? (
            <View style={styles.answerCard}>
              <Text style={[styles.answerText, rtl && styles.textRtl]}>{answer}</Text>
              {onNavigate && navTargets.length > 0 ? (
                <View style={styles.navChipRow}>
                  {navTargets.map((target) => (
                    <Pressable
                      key={target}
                      style={styles.navChip}
                      onPress={() => onNavigate(target)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.openPrefix} ${dashNavLabel(target, lang.code)}`}
                    >
                      <Text style={[styles.navChipText, rtl && styles.textRtl]}>
                        {t.openPrefix} {dashNavLabel(target, lang.code)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.chipRow}>
            {TOPIC_CHIPS.map((chip) => (
              <Pressable
                key={chip.slug}
                style={styles.chip}
                onPress={() => void Linking.openURL(helpUrl(lang.code, chip.slug))}
              >
                <Text style={styles.chipText}>{chip.labelEn}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.watchHeading, rtl && styles.textRtl]}>{t.watchSection}</Text>
          <View style={styles.watchList}>
            {EXPLAINER_CATALOG.map((id) => (
              <Pressable
                key={id}
                style={styles.watchRow}
                onPress={() => void Linking.openURL(explainerWatchUrl(lang.code, id))}
                accessibilityRole="link"
                accessibilityLabel={`${explainer.watchCta}: ${explainer.titles[id]}`}
              >
                <Text style={[styles.watchRowText, rtl && styles.textRtl]}>
                  {explainer.watchCta}: {explainer.titles[id]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    body: {
      marginTop: 8,
      gap: 10,
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    hint: {
      fontSize: 12,
      color: c.textSecondary,
      lineHeight: 17,
    },
    input: {
      minHeight: 72,
      borderWidth: 1.5,
      borderColor: c.gridLine,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: c.textPrimary,
      backgroundColor: isDark ? c.background : c.surface,
    },
    askBtn: {
      borderRadius: 12,
      backgroundColor: c.accentBlue,
      paddingVertical: 12,
      alignItems: 'center',
    },
    askBtnDisabled: {
      opacity: 0.5,
    },
    askBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    error: {
      fontSize: 13,
      color: c.warningAmber,
      lineHeight: 18,
    },
    answerCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.gridLine,
      padding: 12,
      backgroundColor: isDark ? c.background : c.surface,
    },
    navChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    navChip: {
      borderRadius: 10,
      backgroundColor: c.accentBlue,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    navChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    answerText: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textPrimary,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.accentBlue,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.accentBlue,
    },
    watchHeading: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '700',
      color: c.textSecondary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    watchList: {
      gap: 6,
    },
    watchRow: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.gridLine,
      backgroundColor: isDark ? c.background : c.surface,
    },
    watchRowText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.accentBlue,
      lineHeight: 18,
    },
    textRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
