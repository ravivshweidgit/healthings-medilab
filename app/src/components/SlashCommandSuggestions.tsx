import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SlashCommandOption } from '../logic/chatSlashCommands';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

type Option = SlashCommandOption & { hint: string };

type Props = {
  options: Option[];
  onSelect: (insert: string) => void;
  rtl?: boolean;
};

export function SlashCommandSuggestions({ options, onSelect, rtl }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (options.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        style={styles.scroll}
        contentContainerStyle={[styles.list, rtl && styles.listRtl]}
      >
        {options.map((opt) => (
          <Pressable
            key={opt.match}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => onSelect(opt.insert)}
            accessibilityRole="button"
            accessibilityLabel={`${opt.match} ${opt.hint}`}
          >
            <Text style={[styles.cmd, rtl && styles.rtlText]}>{opt.match}</Text>
            <Text style={[styles.hint, rtl && styles.rtlText]} numberOfLines={1}>
              {opt.hint}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gridLine,
    backgroundColor: c.surface,
    maxHeight: 200,
  },
  scroll: {
    maxHeight: 200,
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  listRtl: {
    alignItems: 'flex-end',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: c.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.gridLine,
  },
  chipPressed: {
    opacity: 0.75,
    backgroundColor: c.noticeSoftBg,
  },
  cmd: {
    fontSize: 14,
    fontWeight: '700',
    color: c.accentBlue,
    minWidth: 72,
  },
  hint: {
    flex: 1,
    fontSize: 13,
    color: c.textSecondary,
  },
  rtlText: {
    textAlign: 'right',
  },
});
