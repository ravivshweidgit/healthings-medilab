/**
 * PROFILE & SETTINGS — device gear (Your setup): scale / watch / CGM + CareSens import + Quick Start again.
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCareSensImportCopy } from '../i18n/careSensImportCopy';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { getYourSetupCopy } from '../i18n/yourSetupCopy';
import {
  caresensStoreUrl,
  withingsStoreUrl,
  xdripHealthingsUrl,
} from '../services/companionAppUrls';
import type { PhoneHealthSyncSummary } from '../services/phoneHealthSyncTypes';
import type { SetupToggles } from '../services/SourceConfigService';
import type { UserLanguage } from '../services/TargetService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { keepMountedCollapsedStyles, useKeepMountedExpand } from '../hooks/useKeepMountedExpand';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { PhoneHealthActivityStrip } from './PhoneHealthActivityStrip';
import { SetupToggleRow } from './SetupToggleRow';

const CARESENS_LOGO = require('../../assets/CareScenseAirLogo.jpeg');

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
  setupToggles: SetupToggles | null;
  onPersistToggles: (next: SetupToggles) => void;
  withingsLinked: boolean;
  linkBusy: boolean;
  linkError: string | null;
  showLinkError: boolean;
  onWithingsAccountPress: () => void;
  onPhoneHealthPermissionGranted: () => void;
  onPhoneHealthSync: (deep: boolean) => void | Promise<PhoneHealthSyncSummary | void>;
  onQuickStartAgain: () => void;
  careSensImportBusy?: boolean;
  /** Localized import result — ok vs error chip (prompt106). */
  careSensImportResult?: { kind: 'ok' | 'error'; text: string } | null;
  onCareSensImport?: () => void;
};

export function GearSetupStrip({
  expanded,
  onToggleExpand,
  lang,
  setupToggles,
  onPersistToggles,
  withingsLinked,
  linkBusy,
  linkError,
  showLinkError,
  onWithingsAccountPress,
  onPhoneHealthPermissionGranted,
  onPhoneHealthSync,
  onQuickStartAgain,
  careSensImportBusy = false,
  careSensImportResult = null,
  onCareSensImport,
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const bodyMounted = useKeepMountedExpand(expanded);
  const titles = getProfileSettingsStripCopy(lang?.code);
  const setup = getYourSetupCopy(lang?.code);
  const careSensCopy = getCareSensImportCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const headerSub = useMemo(() => {
    if (!setupToggles) return setup.title;
    const yn = (v: boolean) => (v ? setup.yes : setup.no);
    return `${setup.scaleShort} ${yn(setupToggles.withingsScale)} · ${setup.watchShort} ${yn(setupToggles.withingsWatch)} · CGM ${yn(setupToggles.cgm)}`;
  }, [setupToggles, setup]);

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={titles.gear}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel={`Collapse ${titles.gear}`}
        expandLabel={`Expand ${titles.gear}`}
        subtitleNumberOfLines={2}
      />

      {bodyMounted ? (
        <View
          style={[styles.body, !expanded && keepMountedCollapsedStyles.bodyCollapsed]}
          pointerEvents={expanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
        >
          {setupToggles ? (
            <>
              <SetupToggleRow
                label={setup.withingsScale}
                value={setupToggles.withingsScale}
                yesLabel={setup.yes}
                noLabel={setup.no}
                onChange={(v) => onPersistToggles({ ...setupToggles, withingsScale: v })}
                hint={
                  setupToggles.withingsScale && !withingsLinked
                    ? setup.hintScaleLink
                    : undefined
                }
              />
              <SetupToggleRow
                label={setup.withingsWatch}
                value={setupToggles.withingsWatch}
                yesLabel={setup.yes}
                noLabel={setup.no}
                onChange={(v) => onPersistToggles({ ...setupToggles, withingsWatch: v })}
                hint={
                  setupToggles.withingsWatch && !setupToggles.withingsScale && !withingsLinked
                    ? setup.hintWatchLink
                    : !setupToggles.withingsWatch
                      ? Platform.OS === 'ios'
                        ? setup.hintWatchOffIos
                        : setup.hintWatchOffAndroid
                      : undefined
                }
              />
              {setupToggles.withingsWatch && !setupToggles.withingsScale ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    withingsLinked
                      ? 'Withings sync options or re-link account'
                      : 'Link Withings account'
                  }
                  style={[styles.withingsLinkButton, linkBusy && styles.withingsLinkButtonDisabled]}
                  onPress={onWithingsAccountPress}
                  disabled={linkBusy}
                >
                  {linkBusy ? (
                    <ActivityIndicator color={colors.accentBlue} size="small" />
                  ) : (
                    <Text style={styles.withingsLinkButtonText}>
                      {withingsLinked ? setup.relinkWithings : setup.linkWithings}
                    </Text>
                  )}
                </Pressable>
              ) : null}
              {showLinkError && linkError ? (
                <Text style={styles.linkErrorText}>{linkError}</Text>
              ) : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={setup.getWithings}
                style={styles.appLink}
                onPress={() => void Linking.openURL(withingsStoreUrl())}
                hitSlop={8}
              >
                <Text style={[styles.appLinkText, rtl && styles.appLinkRtl]}>
                  {setup.getWithings}
                </Text>
              </Pressable>
              {!setupToggles.withingsWatch ? (
                <PhoneHealthActivityStrip
                  onPermissionGranted={onPhoneHealthPermissionGranted}
                  onSync={onPhoneHealthSync}
                  langCode={lang?.code}
                />
              ) : null}
              <SetupToggleRow
                label={setup.cgm}
                value={setupToggles.cgm}
                yesLabel={setup.yes}
                noLabel={setup.no}
                onChange={(v) => onPersistToggles({ ...setupToggles, cgm: v })}
                hint={
                  setupToggles.cgm
                    ? Platform.OS === 'ios'
                      ? setup.hintCgmIos
                      : setup.hintCgmAndroid
                    : undefined
                }
              />
              {setupToggles.cgm && onCareSensImport ? (
                <View style={styles.careSensImportSection}>
                  <Pressable
                    style={[
                      styles.careSensImportButton,
                      careSensImportBusy && styles.careSensImportButtonDisabled,
                    ]}
                    onPress={onCareSensImport}
                    disabled={careSensImportBusy}
                    accessibilityRole="button"
                    accessibilityLabel={careSensCopy.a11yImport}
                    accessibilityState={{ busy: careSensImportBusy, disabled: careSensImportBusy }}
                  >
                    {careSensImportBusy ? (
                      <ActivityIndicator color={colors.accentBlue} />
                    ) : (
                      <View style={styles.careSensImportButtonRow}>
                        <View style={styles.careSensImportLogoWrap}>
                          <Image
                            source={CARESENS_LOGO}
                            style={styles.careSensImportButtonLogo}
                            resizeMode="contain"
                            accessibilityIgnoresInvertColors
                          />
                        </View>
                        <Text style={styles.careSensImportButtonLabel}>{setup.careSensImport}</Text>
                      </View>
                    )}
                  </Pressable>
                  {careSensImportResult ? (
                    <View
                      style={[
                        styles.importResultChip,
                        careSensImportResult.kind === 'error' && styles.importResultChipError,
                      ]}
                      accessibilityLiveRegion="polite"
                      accessibilityRole="text"
                    >
                      <Text
                        style={[
                          styles.importResultText,
                          careSensImportResult.kind === 'error' && styles.importResultTextError,
                          rtl && styles.importResultRtl,
                        ]}
                      >
                        {careSensImportResult.text}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={setup.getCaresens}
                style={styles.appLink}
                onPress={() => void Linking.openURL(caresensStoreUrl())}
                hitSlop={8}
              >
                <Text style={[styles.appLinkText, rtl && styles.appLinkRtl]}>
                  {setup.getCaresens}
                </Text>
              </Pressable>
              {Platform.OS === 'android' ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={setup.getXdrip}
                  style={styles.appLink}
                  onPress={() => void Linking.openURL(xdripHealthingsUrl(lang?.code))}
                  hitSlop={8}
                >
                  <Text style={[styles.appLinkText, rtl && styles.appLinkRtl]}>
                    {setup.getXdrip}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          <Pressable style={styles.quickStartAgainBtn} onPress={onQuickStartAgain}>
            <Text style={styles.quickStartAgainText}>{setup.quickStartAgain}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    body: {
      marginTop: 8,
      gap: 4,
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    quickStartAgainBtn: {
      marginTop: 12,
      paddingVertical: 8,
      alignItems: 'center',
    },
    quickStartAgainText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.accentBlue,
    },
    withingsLinkButton: {
      alignSelf: 'stretch',
      marginBottom: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.accentBlue,
      backgroundColor: c.accentBlue + '12',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
    },
    withingsLinkButtonDisabled: {
      opacity: 0.6,
    },
    withingsLinkButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.accentBlue,
    },
    linkErrorText: {
      fontSize: 12,
      color: c.accentRed,
      marginBottom: 8,
    },
    appLink: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    appLinkText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.accentBlue,
    },
    appLinkRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    careSensImportSection: {
      gap: 6,
      marginTop: 8,
      marginBottom: 4,
    },
    careSensImportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.accentBlue,
      borderRadius: 24,
      paddingVertical: 12,
      paddingHorizontal: 18,
      backgroundColor: isDark ? c.background : c.surface,
      minHeight: 56,
    },
    careSensImportButtonDisabled: {
      opacity: 0.65,
    },
    careSensImportButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 4,
    },
    careSensImportLogoWrap: {
      flex: 1,
      height: 40,
      minWidth: 0,
      marginRight: 12,
      justifyContent: 'center',
      // Brand asset is an opaque JPEG — on black it becomes a rounded white plate
      // instead of a raw white rectangle.
      backgroundColor: isDark ? '#FFFFFF' : undefined,
      borderRadius: isDark ? 10 : 0,
      paddingHorizontal: isDark ? 6 : 0,
      overflow: 'hidden',
    },
    careSensImportButtonLogo: {
      width: '100%',
      height: '100%',
    },
    careSensImportButtonLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: c.accentBlue,
      letterSpacing: 0.3,
    },
    // Informational status — not an action pill (dark: white ink, soft surface, no accent border).
    importResultChip: {
      marginTop: 4,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: isDark ? 0 : 1,
      borderColor: isDark ? 'transparent' : 'rgba(31, 61, 92, 0.2)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(31, 61, 92, 0.06)',
    },
    importResultChipError: {
      borderWidth: isDark ? 0 : 1,
      borderColor: isDark ? 'transparent' : 'rgba(198, 40, 40, 0.35)',
      backgroundColor: isDark ? 'rgba(239, 83, 80, 0.15)' : 'rgba(198, 40, 40, 0.08)',
    },
    importResultText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? c.textPrimary : '#1F3D5C',
      textAlign: 'center',
      lineHeight: 19,
    },
    importResultTextError: {
      color: isDark ? '#FFCDD2' : '#C62828',
    },
    importResultRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
