/**
 * Profile completeness + Quick Start onboarding flag.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBirthdate, getCachedHeightCm, getGender } from './TargetService';

export const ONBOARDING_COMPLETE_KEY = 'onboarding_complete_v1';

export async function getOnboardingCompletedAt(): Promise<string | null> {
  return AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
}

export async function setOnboardingCompletedAt(iso: string = new Date().toISOString()): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, iso);
}

export async function clearOnboardingCompletedAt(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
}

/** Gender, height, birthdate all set. */
export async function isProfileBasicsComplete(): Promise<boolean> {
  const [gender, height, birthdate] = await Promise.all([getGender(), getCachedHeightCm(), getBirthdate()]);
  return Boolean(gender && height && height > 0 && birthdate);
}

/** Show Welcome & Quick Start when profile incomplete or onboarding never finished. */
export async function shouldShowQuickStart(): Promise<boolean> {
  const [profileOk, completedAt] = await Promise.all([isProfileBasicsComplete(), getOnboardingCompletedAt()]);
  if (profileOk && completedAt) return false;
  return true;
}
