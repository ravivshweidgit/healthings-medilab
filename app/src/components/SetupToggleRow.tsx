/**
 * Yes / No toggle row — Quick Start step 2 and My Profile Your setup.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

type Props = {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  hint?: string;
  yesLabel?: string;
  noLabel?: string;
};

export function SetupToggleRow({
  label,
  value,
  onChange,
  hint,
  yesLabel = 'Yes',
  noLabel = 'No',
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, value === true && styles.btnOn]}
          onPress={() => onChange(true)}
        >
          <Text style={[styles.text, value === true && styles.textOn]}>{yesLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, value === false && styles.btnOn]}
          onPress={() => onChange(false)}
        >
          <Text style={[styles.text, value === false && styles.textOn]}>{noLabel}</Text>
        </Pressable>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    block: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600', color: c.textPrimary, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 10 },
    btn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.gridLine,
      alignItems: 'center',
    },
    btnOn: {
      backgroundColor: c.accentBlue,
      borderColor: c.accentBlue,
    },
    text: { fontWeight: '700', color: c.textSecondary },
    textOn: { color: '#fff' },
    hint: {
      fontSize: 11,
      color: c.textSecondary,
      marginTop: 6,
      lineHeight: 16,
    },
  });
