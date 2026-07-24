import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

type Props = {
  advice: string;
  rtl?: boolean;
  title?: string;
};

export function RulesAdviceBanner({ advice, rtl, title }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const heading = title ?? (rtl ? '×”×›×œ×œ×™× ×©×œ×™ â€” ×ž×•×ž×œ×¥ ×œ×¢×“×›×Ÿ' : 'My Rules â€” suggested update');
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, rtl && styles.rtl]}>{heading}</Text>
      <Text style={[styles.body, rtl && styles.rtl]}>{advice}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  title: { fontSize: 12, fontWeight: '700', color: '#E65100', marginBottom: 4 },
  body: { fontSize: 13, lineHeight: 18, color: c.textPrimary },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
});
