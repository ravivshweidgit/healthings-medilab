/**
 * Central chrome icon registry — prompt94 / UI audit F7.
 *
 * One place for Lucide icon imports + app defaults so strips and screens stay
 * consistent. These are CHROME icons only: they augment (never replace) clinical
 * labels/units, and they must NOT touch emoji that is chat/coach content or
 * exports (see prompt94 "Do NOT touch" list).
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Activity,
  CalendarClock,
  Camera,
  Droplet,
  Dumbbell,
  FlaskConical,
  Image as ImageIcon,
  ListChecks,
  MoreHorizontal,
  Salad,
  Settings,
  Share2,
  Stethoscope,
  Trash2,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { WellnessColors } from './wellness';

export type { LucideIcon };

export type MentorIconKey = 'doctor' | 'nutritionist' | 'coach';

const MENTOR_ICON_ORDER: MentorIconKey[] = ['doctor', 'nutritionist', 'coach'];

/** Leading icon for each top-level dashboard strip. */
export const StripIcons = {
  foodLog: UtensilsCrossed,
  glucose: Activity,
  trend: TrendingUp,
  profile: Settings,
  labs: FlaskConical,
  sessions: CalendarClock,
  rules: ListChecks,
  water: Droplet,
} as const;

/** Action-button glyphs (chrome) — replaces emoji on tiles/toolbars. */
export const ActionIcons = {
  meal: Utensils,
  water: Droplet,
  camera: Camera,
  gallery: ImageIcon,
  overflow: MoreHorizontal,
  share: Share2,
  clear: Trash2,
} as const;

/** Mentor marks for UI chrome only — chat bodies/exports keep MENTOR_EMOJI. */
export const MentorIcons = {
  doctor: Stethoscope,
  nutritionist: Salad,
  coach: Dumbbell,
} as const;

/** Standard chrome icon renderer with app defaults (size, stroke, color token). */
export function DashIcon({
  icon: Icon,
  size = 18,
  color = WellnessColors.textSecondary,
}: {
  icon: LucideIcon;
  size?: number;
  color?: string;
}) {
  return <Icon size={size} color={color} strokeWidth={2} />;
}

/** Single mentor mark for chrome (tabs, chips, AI entry) — not chat/export text. */
export function MentorIcon({
  mentor,
  size = 18,
  color = WellnessColors.textSecondary,
}: {
  mentor: MentorIconKey;
  size?: number;
  color?: string;
}) {
  return <DashIcon icon={MentorIcons[mentor]} size={size} color={color} />;
}

/** Ordered row of active mentor marks (doctor → nutritionist → coach). */
export function ActiveMentorIcons({
  mentors,
  size = 18,
  color = WellnessColors.textSecondary,
  gap = 4,
  style,
}: {
  mentors: MentorIconKey[];
  size?: number;
  color?: string;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const active = MENTOR_ICON_ORDER.filter((m) => mentors.includes(m));
  if (active.length === 0) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {active.map((m) => (
        <MentorIcon key={m} mentor={m} size={size} color={color} />
      ))}
    </View>
  );
}
