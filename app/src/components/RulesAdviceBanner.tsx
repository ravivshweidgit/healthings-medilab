import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WellnessColors } from '../theme/wellness';

type Props = {
  advice: string;
  rtl?: boolean;
  title?: string;
};

export function RulesAdviceBanner({ advice, rtl, title }: Props) {
  const heading = title ?? (rtl ? 'הכללים שלי — מומלץ לעדכן' : 'My Rules — suggested update');
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, rtl && styles.rtl]}>{heading}</Text>
      <Text style={[styles.body, rtl && styles.rtl]}>{advice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  title: { fontSize: 12, fontWeight: '700', color: '#E65100', marginBottom: 4 },
  body: { fontSize: 13, lineHeight: 18, color: WellnessColors.textPrimary },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
});
