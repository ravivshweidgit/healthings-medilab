/**
 * Yes / No toggle row — Quick Start step 2 and My Profile Your setup.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WellnessColors } from '../theme/wellness';

type Props = {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  hint?: string;
};

export function SetupToggleRow({ label, value, onChange, hint }: Props) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, value === true && styles.btnOn]}
          onPress={() => onChange(true)}
        >
          <Text style={[styles.text, value === true && styles.textOn]}>Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, value === false && styles.btnOn]}
          onPress={() => onChange(false)}
        >
          <Text style={[styles.text, value === false && styles.textOn]}>No</Text>
        </Pressable>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  btnOn: { backgroundColor: '#2E7D5A', borderColor: '#2E7D5A' },
  text: { fontWeight: '700', color: WellnessColors.textSecondary },
  textOn: { color: '#fff' },
  hint: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
});
