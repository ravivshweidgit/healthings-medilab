/**
 * PROFILE & SETTINGS — coach & meals language picker.
 * Persists immediately on chip press (not via Profile Save).
 */

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import {
  SUPPORTED_LANGUAGES,
  setLanguage,
  ensureQuickQuestionsForLanguage,
  type UserLanguage,
} from '../services/TargetService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { keepMountedCollapsedStyles, useKeepMountedExpand } from '../hooks/useKeepMountedExpand';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  language: UserLanguage;
  onLanguageChanged: (lang: UserLanguage) => void;
  /** Regenerate coach card after language persist. */
  onAfterLanguagePersist?: () => Promise<void>;
};

export function LanguageStrip({
  expanded,
  onToggleExpand,
  language,
  onLanguageChanged,
  onAfterLanguagePersist,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bodyMounted = useKeepMountedExpand(expanded);
  const t = getProfileSettingsStripCopy(language.code);
  const rtl = language.code === 'he' || language.code === 'ar';
  const [busy, setBusy] = useState(false);

  const headerSub = useMemo(() => language.label, [language.label]);

  const pick = async (lang: UserLanguage) => {
    if (lang.code === language.code || busy) return;
    setBusy(true);
    try {
      onLanguageChanged(lang);
      await setLanguage(lang);
      await ensureQuickQuestionsForLanguage(lang);
      await onAfterLanguagePersist?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={t.language}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel={`Collapse ${t.language}`}
        expandLabel={`Expand ${t.language}`}
      />

      {bodyMounted ? (
        <View
          style={[styles.body, !expanded && keepMountedCollapsedStyles.bodyCollapsed]}
          pointerEvents={expanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
        >
          <View style={styles.langRow}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                style={[styles.langBtn, language.code === lang.code && styles.langBtnSelected]}
                onPress={() => void pick(lang)}
                disabled={busy}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    language.code === lang.code && styles.langBtnTextSelected,
                  ]}
                >
                  {lang.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {busy ? <ActivityIndicator color={colors.accentBlue} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    body: {
      marginTop: 8,
      gap: 10,
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    langRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      width: '100%',
    },
    langBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.gridLine,
      alignItems: 'center',
      backgroundColor: c.background,
    },
    langBtnSelected: {
      borderColor: c.accentBlue,
      backgroundColor: c.accentBlue + '15',
    },
    langBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    langBtnTextSelected: {
      color: c.accentBlue,
    },
  });
