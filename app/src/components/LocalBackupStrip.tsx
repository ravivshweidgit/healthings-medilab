/**
 * PROFILE & SETTINGS — local phone backup (export / import).
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import type { UserLanguage } from '../services/TargetService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  busy: boolean;
  message: string | null;
  onExport: () => void;
  onImport: () => void;
  lang?: UserLanguage | null;
};

export function LocalBackupStrip({
  expanded,
  onToggleExpand,
  busy,
  message,
  onExport,
  onImport,
  lang,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = getProfileSettingsStripCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  const headerSub = `${t.exportBackup} · ${t.importBackup}`;

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={t.appBackup}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel="Collapse app backup"
        expandLabel="Expand app backup"
      />

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={onExport}
              disabled={busy}
            >
              <Text style={styles.buttonText}>{t.exportBackup}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={onImport}
              disabled={busy}
            >
              <Text style={styles.buttonText}>{t.importBackup}</Text>
            </Pressable>
          </View>
          {busy ? (
            <ActivityIndicator color={colors.accentBlue} style={styles.spinner} />
          ) : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
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
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    button: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.accentBlue,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: c.surface,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.accentBlue,
    },
    spinner: {
      marginTop: 2,
    },
    message: {
      fontSize: 12,
      lineHeight: 18,
      color: c.textSecondary,
    },
  });
