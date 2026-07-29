/**
 * iOS date/time picker in a modal with an explicit Done control.
 *
 * Inline `@react-native-community/datetimepicker` spinners have no confirm
 * affordance and often sit below the fold inside ScrollViews (Quick Start birth
 * date, meal edit datetime). Profile already used this pattern; this shares it.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

type Props = {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  doneLabel?: string;
  onDone: (next: Date) => void;
  onCancel: () => void;
};

export function IosDateTimePickerSheet({
  visible,
  value,
  mode,
  minimumDate,
  maximumDate,
  doneLabel = 'Done',
  onDone,
  onCancel,
}: Props): React.ReactElement | null {
  const { colors, isDark } = useTheme();
  const [draft, setDraft] = useState(value);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  if (Platform.OS !== 'ios') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button">
        <View style={styles.card}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_e, date) => {
              if (date) setDraft(date);
            }}
            style={styles.picker}
          />
          <Pressable
            style={styles.doneBtn}
            onPress={() => onDone(draft)}
            accessibilityRole="button"
            accessibilityLabel={doneLabel}
          >
            <Text style={styles.doneBtnText}>{doneLabel}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    picker: {
      alignSelf: 'stretch',
    },
    doneBtn: {
      marginTop: 8,
      backgroundColor: colors.accentBlue,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    doneBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
  });
}
