import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SlashCommandOption } from '../logic/chatSlashCommands';
import { WellnessColors } from '../theme/wellness';

type Option = SlashCommandOption & { hint: string };

type Props = {
  options: Option[];
  onSelect: (insert: string) => void;
  rtl?: boolean;
};

export function SlashCommandSuggestions({ options, onSelect, rtl }: Props) {
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

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
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
    backgroundColor: WellnessColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: WellnessColors.gridLine,
  },
  chipPressed: {
    opacity: 0.75,
    backgroundColor: WellnessColors.noticeSoftBg,
  },
  cmd: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.accentBlue,
    minWidth: 72,
  },
  hint: {
    flex: 1,
    fontSize: 13,
    color: WellnessColors.textSecondary,
  },
  rtlText: {
    textAlign: 'right',
  },
});
