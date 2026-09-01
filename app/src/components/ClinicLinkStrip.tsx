/**
 * Patient data-share list (AI sponsorship is mentor-side, read-only badge here).
 * Chrome is appLocale (`clinicLinkCopy` + profile strip titles).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthUser } from '../services/AuthApiService';
import {
  pushDailyClinicSnapshot,
  resetDailyPushThrottle,
  shareSnapshotIfAnyConsumer,
  shareSnapshotNow,
} from '../services/ClinicSyncService';
import {
  clearClinicDailyShareDay,
  isClinicDailyShareOn,
  setClinicDailyShareOn,
} from '../services/ClinicDailyShareService';
import {
  addTokenPack,
  approveShare,
  clinicDisplayLabel,
  fetchClinicShareEmail,
  fetchWallet,
  isHealthingsClinicShare,
  listPendingSharesForMe,
  listShares,
  rejectShare,
  requestClinicLink,
  revokeShare,
  type AccountShare,
  type WalletView,
} from '../services/ShareApiService';
import { adoptWalletCredits } from '../services/UsageQueueService';
import { fetchMyLatestSyncMeta, type PublicSyncBlob } from '../services/SyncApiService';
import { loadCachedApprovedShares, saveCachedApprovedShares } from '../services/ShareCacheService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { getClinicLinkCopy } from '../i18n/clinicLinkCopy';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { keepMountedCollapsedStyles, useKeepMountedExpand } from '../hooks/useKeepMountedExpand';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import type { UserLanguage } from '../services/TargetService';

type Props = {
  user: AuthUser;
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
};

export function ClinicLinkStrip({ user, expanded, onToggleExpand, lang }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const bodyMounted = useKeepMountedExpand(expanded);
  const L = useMemo(() => getClinicLinkCopy(lang?.code), [lang?.code]);
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  const [busy, setBusy] = useState(false);
  const [mentorEmail, setMentorEmail] = useState('');
  const [pending, setPending] = useState<AccountShare[]>([]);
  const [approved, setApproved] = useState<AccountShare[]>([]);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [lastSync, setLastSync] = useState<PublicSyncBlob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clinicShareEmail, setClinicShareEmail] = useState('');
  const [dailyShareOn, setDailyShareOn] = useState(true);
  const [dailyShareBusy, setDailyShareBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (user.role !== 'patient') return;
    try {
      const [pendingRows, approvedRows, walletView, syncMeta, clinicEmail] = await Promise.all([
        listPendingSharesForMe(),
        listShares('approved'),
        fetchWallet(),
        fetchMyLatestSyncMeta().catch(() => null),
        fetchClinicShareEmail(),
      ]);
      setClinicShareEmail(clinicEmail);
      setPending(pendingRows);
      setApproved(approvedRows);
      await saveCachedApprovedShares(approvedRows);
      setWallet(walletView);
      await adoptWalletCredits(walletView);
      setLastSync(syncMeta);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : L.loadFailed;
      setError(msg);
    }
  }, [user.role, L.loadFailed]);

  useEffect(() => {
    if (user.role !== 'patient') return;
    void loadCachedApprovedShares().then((cached) => {
      if (cached.length) setApproved(cached);
    });
    void refresh();
  }, [user.role, refresh]);

  useEffect(() => {
    if (expanded) void refresh();
  }, [expanded, refresh]);

  useEffect(() => {
    if (user.role !== 'patient') return;
    void isClinicDailyShareOn().then(setDailyShareOn);
  }, [user.role]);

  const handleDailyShareToggle = useCallback((next: boolean) => {
    setDailyShareBusy(true);
    setDailyShareOn(next);
    void (async () => {
      try {
        await setClinicDailyShareOn(next);
        if (next) {
          // Do not make the clinic wait for tomorrow's first open.
          await clearClinicDailyShareDay();
          resetDailyPushThrottle();
          await pushDailyClinicSnapshot();
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : L.actionFailed);
      } finally {
        setDailyShareBusy(false);
      }
    })();
  }, [L.actionFailed]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : L.actionFailed);
      } finally {
        setBusy(false);
      }
    },
    [refresh, L.actionFailed],
  );

  const headerSub = useMemo(() => {
    if (approved.length === 0) {
      return pending.length > 0
        ? profileTitles.waitingApproval
        : profileTitles.noAccountsWhitelisted;
    }
    if (approved.length === 1) {
      return `${profileTitles.sharesWith} ${clinicDisplayLabel(approved[0])}`;
    }
    return profileTitles.accountsWhitelisted(approved.length);
  }, [approved, pending.length, profileTitles]);

  if (user.role === 'mentor') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.mentorNote}>{L.mentorWeb}</Text>
      </View>
    );
  }

  const incoming = pending.filter((s) => s.initiatedBy === 'mentor');
  const outgoing = pending.filter((s) => s.initiatedBy === 'patient');
  const healthingsApproved = approved.some((s) => isHealthingsClinicShare(s, clinicShareEmail));
  const healthingsPending = pending.some((s) => isHealthingsClinicShare(s, clinicShareEmail));

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.dataSharing}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel={L.collapse}
        expandLabel={L.expand}
        subtitleNumberOfLines={2}
      />

      {bodyMounted ? (
        <View
          style={[styles.body, !expanded && keepMountedCollapsedStyles.bodyCollapsed]}
          pointerEvents={expanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
        >
          {clinicShareEmail ? (
          <View style={styles.healthingsBlock}>
            {healthingsPending && !healthingsApproved ? (
              <Text style={styles.healthingsStatus}>{L.healthingsClinicWaiting}</Text>
            ) : (
              <Pressable
                style={[styles.healthingsBtn, busy && styles.btnDisabled]}
                onPress={() =>
                  void run(async () => {
                    if (healthingsApproved) {
                      const shared = await shareSnapshotNow();
                      const photos = shared.mealPhotos;
                      const photoLine =
                        photos && photos.candidates > 0
                          ? photos.uploaded > 0
                            ? `\nPlates uploaded: ${photos.uploaded}`
                            : photos.failed > 0
                              ? `\nPlates not uploaded: ${photos.failed} (tap Share again)`
                              : '\nPlates already on server'
                          : '\nNo meal plates found on phone';
                      Alert.alert(L.share, `${L.shareOk}${photoLine}`);
                      return;
                    }
                    await requestClinicLink(clinicShareEmail);
                    Alert.alert(L.healthingsClinicBtn, L.healthingsClinicSent);
                  })
                }
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={L.healthingsClinicBtn}
              >
                {busy ? (
                  <ActivityIndicator color={isDark ? colors.accentBlue : '#fff'} />
                ) : (
                  <Text style={styles.healthingsBtnText}>{L.healthingsClinicBtn}</Text>
                )}
              </Pressable>
            )}
            <Text style={styles.hint}>
              {healthingsApproved
                ? L.healthingsClinicAlready
                : healthingsPending
                  ? L.healthingsClinicWaiting
                  : L.healthingsClinicHint}
            </Text>
          </View>
          ) : null}

          {wallet ? (
            <View style={styles.creditBlock}>
              <Text style={styles.creditLine}>
                {L.creditsLine(wallet.balanceTokens, Boolean(wallet.sponsored), Boolean(wallet.autoReload))}
              </Text>
              {!wallet.sponsored ? (
                <Pressable
                  style={[styles.secondaryBtn, busy && styles.btnDisabled]}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const result = await addTokenPack();
                      Alert.alert(L.addPackOk, L.packAdded(result.added, result.balanceTokens));
                    })
                  }
                >
                  <Text style={styles.secondaryBtnText}>{L.addPack}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {wallet?.sponsored && wallet.sponsoredBy ? (
            <Text style={styles.sponsorBadge}>
              {L.sponsored} {wallet.sponsoredBy}
              {wallet.sponsorshipExpiresAt
                ? ` ${L.sponsoredUntil} ${new Date(wallet.sponsorshipExpiresAt).toLocaleDateString()}`
                : ''}
            </Text>
          ) : wallet?.sponsorshipExpiresAt && !wallet.sponsorshipActive ? (
            <Text style={styles.expiredBadge}>{L.sponsorshipExpired}</Text>
          ) : null}

          {approved.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardText}>
                {lastSync
                  ? `${L.lastShared}: ${new Date(lastSync.createdAt).toLocaleString()} (v${lastSync.version})`
                  : L.neverShared}
              </Text>
              <Text style={styles.hint}>{L.clinicSyncHint}</Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.cardText}>{L.dailyShareTitle}</Text>
                  <Text style={styles.hint}>{L.dailyShareHint}</Text>
                </View>
                <Switch
                  value={dailyShareOn}
                  onValueChange={handleDailyShareToggle}
                  disabled={dailyShareBusy}
                  trackColor={{ false: colors.gridLine, true: colors.accentGreen }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          ) : null}

          {incoming.map((share) => (
            <View key={share.id} style={styles.card}>
              <Text style={styles.cardText}>
                {clinicDisplayLabel(share)} {L.invited}
              </Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.btnPrimary, busy && styles.btnDisabled]}
                  onPress={() =>
                    void run(async () => {
                      await approveShare(share.id);
                      await shareSnapshotIfAnyConsumer();
                    })
                  }
                  disabled={busy}
                >
                  <Text style={styles.btnPrimaryText}>{L.approve}</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnGhost, busy && styles.btnDisabled]}
                  onPress={() => void run(async () => { await rejectShare(share.id); })}
                  disabled={busy}
                >
                  <Text style={styles.btnGhostText}>{L.reject}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {outgoing.map((share) => (
            <View key={share.id} style={styles.card}>
              <Text style={styles.cardText}>
                {L.waiting}: {clinicDisplayLabel(share)}
              </Text>
            </View>
          ))}

          {approved.map((share) => (
            <View key={share.id} style={styles.card}>
              <Text style={styles.cardText}>
                {L.sharesWith} {clinicDisplayLabel(share)}
              </Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.btnPrimary, busy && styles.btnDisabled]}
                  onPress={() =>
                    void run(async () => {
                      const shared = await shareSnapshotNow();
                      const photos = shared.mealPhotos;
                      const photoLine =
                        photos && photos.candidates > 0
                          ? photos.uploaded > 0
                            ? `\nPlates uploaded: ${photos.uploaded}`
                            : photos.failed > 0
                              ? `\nPlates not uploaded: ${photos.failed} (tap Share again)`
                              : '\nPlates already on server'
                          : '\nNo meal plates found on phone';
                      Alert.alert(L.share, `${L.shareOk}${photoLine}`);
                    })
                  }
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={isDark ? colors.accentGreen : '#fff'} size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>{L.share}</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.btnGhost, busy && styles.btnDisabled]}
                  onPress={() => {
                    Alert.alert(L.revoke, L.revokeConfirm, [
                      { text: L.cancel, style: 'cancel' },
                      {
                        text: L.revoke,
                        style: 'destructive',
                        onPress: () => void run(async () => { await revokeShare(share.id); }),
                      },
                    ]);
                  }}
                  disabled={busy}
                >
                  <Text style={styles.btnGhostText}>{L.revoke}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {(approved.length > 0 || pending.length > 0) && (
            <Text style={styles.sectionLabel}>{L.addAccount}</Text>
          )}

          <Text style={styles.hint}>{L.subtitle}</Text>
          <TextInput
            style={[styles.input, { writingDirection: 'ltr', textAlign: 'left' }]}
            value={mentorEmail}
            onChangeText={setMentorEmail}
            placeholder={L.emailPh}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!busy}
          />
          <Pressable
            style={[styles.btnPrimary, (!mentorEmail.trim() || busy) && styles.btnDisabled]}
            onPress={() =>
              void run(async () => {
                await requestClinicLink(mentorEmail);
                setMentorEmail('');
              })
            }
            disabled={!mentorEmail.trim() || busy}
          >
            {busy ? (
              <ActivityIndicator color={isDark ? colors.accentGreen : '#fff'} />
            ) : (
              <Text style={styles.btnPrimaryText}>{L.send}</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
    body: { marginTop: 4, gap: 10, paddingHorizontal: 4 },
    hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    sectionLabel: { fontSize: 14, fontWeight: '600', color: c.textPrimary, marginTop: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.gridLine,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.textPrimary,
      backgroundColor: isDark ? c.background : c.surface,
    },
    card: {
      backgroundColor: isDark ? c.background : c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.gridLine,
      padding: 12,
      gap: 8,
    },
    cardText: { fontSize: 14, color: c.textPrimary },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: c.gridLine,
      paddingTop: 10,
    },
    toggleText: { flex: 1, gap: 2 },
    btnPrimary: {
      backgroundColor: isDark ? c.background : '#2E7D5A',
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? c.accentGreen : 'transparent',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      minWidth: 88,
    },
    btnPrimaryText: { color: isDark ? c.accentGreen : '#fff', fontWeight: '700', fontSize: 14 },
    healthingsBlock: { gap: 6 },
    healthingsStatus: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textPrimary,
      lineHeight: 20,
    },
    healthingsBtn: {
      alignSelf: 'stretch',
      minWidth: 0,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: isDark ? 1.5 : 0,
      borderColor: isDark ? c.accentBlue : 'transparent',
      backgroundColor: isDark ? c.background : c.accentBlue,
    },
    healthingsBtnText: {
      color: isDark ? c.accentBlue : '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    btnGhost: {
      borderWidth: 1,
      borderColor: c.textSecondary,
      backgroundColor: isDark ? c.background : undefined,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    btnGhostText: { color: c.textSecondary, fontWeight: '600', fontSize: 14 },
    btnDisabled: { opacity: 0.5 },
    creditBlock: { gap: 8 },
    creditLine: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
    },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: isDark ? c.accentGreen : '#2E7D5A',
      backgroundColor: isDark ? c.background : c.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    secondaryBtnText: {
      color: isDark ? c.accentGreen : '#2E7D5A',
      fontWeight: '600',
      fontSize: 14,
    },
    sponsorBadge: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? c.accentGreen : '#2E7D5A',
      lineHeight: 18,
    },
    expiredBadge: {
      fontSize: 13,
      fontWeight: '600',
      color: '#c0392b',
      lineHeight: 18,
    },
    mentorNote: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
      paddingHorizontal: 4,
    },
    errorText: { fontSize: 13, color: '#c0392b' },
  });
