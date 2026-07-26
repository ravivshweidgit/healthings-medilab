/**
 * Profile completeness + Quick Start onboarding flag.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCachedAuthUser } from './AuthTokenStore';
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

function hasPatientNames(user: { firstName?: string | null; lastName?: string | null } | null): boolean {
  if (!user) return false;
  const first = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const last = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  return Boolean(first && last);
}

/** Gender, height, birthdate — enough to leave Quick Start. */
export async function isBodyBasicsComplete(): Promise<boolean> {
  const [gender, height, birthdate] = await Promise.all([getGender(), getCachedHeightCm(), getBirthdate()]);
  return Boolean(gender && height && height > 0 && birthdate);
}

/**
 * Body basics plus patient first+last name (be-27).
 * Used for Quick Start exit gate and Profile completeness.
 */
export async function isProfileBasicsComplete(): Promise<boolean> {
  const [bodyOk, cachedUser] = await Promise.all([isBodyBasicsComplete(), loadCachedAuthUser()]);
  return bodyOk && hasPatientNames(cachedUser);
}

/**
 * Show Welcome & Quick Start when profile basics (body + names) incomplete
 * or onboarding never finished. Names are collected in the wizard (be-27).
 */
export async function shouldShowQuickStart(): Promise<boolean> {
  const [profileOk, completedAt] = await Promise.all([
    isProfileBasicsComplete(),
    getOnboardingCompletedAt(),
  ]);
  if (profileOk && completedAt) return false;
  return true;
}
