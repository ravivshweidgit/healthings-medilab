/**
 * Patient data-share whitelist (AI sponsorship is mentor-side, read-only badge here).
 * UI strings are English only (see .cursor/rules/language-policy.mdc).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthUser } from '../services/AuthApiService';
import { shareSnapshotIfAnyConsumer, shareSnapshotNow } from '../services/ClinicSyncService';
import {
  addTokenPack,
  approveShare,
  clinicDisplayLabel,
  fetchWallet,
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
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import type { UserLanguage } from '../services/TargetService';

type Props = {
  user: AuthUser;
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
};

const L = {
  title: 'Data sharing',
  subtitle: 'Optional whitelist — who may access your data',
  clinicSyncHint:
    'Your clinic can collect from the server after you tap Share — even if you close the app. Opening the app also auto-uploads when the clinic requests an update.',
  emailPh: 'clinic@example.com',
  send: 'Send request',
  waiting: 'Waiting for approval',
  invited: 'invited you to share data',
  approve: 'Approve',
  reject: 'Reject',
  sharesWith: 'Shares data with',
  share: 'Share',
  shareOk: 'Snapshot uploaded — your clinic can collect it from their portal.',
  revoke: 'Revoke access',
  noShares: 'No accounts whitelisted — app works fully without sharing',
  mentorWeb: 'Mentor account: manage patients and AI sponsorship at healthings.ai/clinic',
  lastShared: 'Last shared',
  neverShared: 'No upload yet — tap Share or wait for clinic to request an update',
  sponsored: 'AI sponsored by',
  sponsoredUntil: 'until',
  sponsorshipExpired: 'AI sponsorship expired',
  addAccount: 'Request access for account',
  addPack: 'Add AI token pack',
  addPackOk: 'Token pack added.',
} as const;

export function ClinicLinkStrip({ user, expanded, onToggleExpand, lang }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const [busy, setBusy] = useState(false);
  const [mentorEmail, setMentorEmail] = useState('');
  const [pending, setPending] = useState<AccountShare[]>([]);
  const [approved, setApproved] = useState<AccountShare[]>([]);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [lastSync, setLastSync] = useState<PublicSyncBlob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (user.role !== 'patient') return;
    try {
      const [pendingRows, approvedRows, walletView, syncMeta] = await Promise.all([
        listPendingSharesForMe(),
        listShares('approved'),
        fetchWallet(),
        fetchMyLatestSyncMeta().catch(() => null),
      ]);
      setPending(pendingRows);
      setApproved(approvedRows);
      await saveCachedApprovedShares(approvedRows);
      setWallet(walletView);
      await adoptWalletCredits(walletView);
      setLastSync(syncMeta);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load sharing settings';
      setError(msg);
    }
  }, [user.role]);

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

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [refresh],
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

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.dataSharing}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={lang?.code === 'he' || lang?.code === 'ar'}
        collapseLabel="Collapse data sharing"
        expandLabel="Expand data sharing"
        subtitleNumberOfLines={2}
      />

      {expanded && (
        <View style={styles.body}>
          {wallet ? (
            <View style={styles.creditBlock}>
              <Text style={styles.creditLine}>
                AI credits: {wallet.balanceTokens}
                {wallet.sponsored ? ' (clinic payer)' : ''}
                {wallet.autoReload ? ' · auto-reload on' : ''}
              </Text>
              {!wallet.sponsored ? (
                <Pressable
                  style={[styles.secondaryBtn, busy && styles.btnDisabled]}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const result = await addTokenPack();
                      Alert.alert(L.addPackOk, `+${result.added} credits · balance ${result.balanceTokens}`);
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
                      await shareSnapshotNow();
                      Alert.alert(L.share, L.shareOk);
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
                    Alert.alert(L.revoke, 'Remove this account from your whitelist?', [
                      { text: 'Cancel', style: 'cancel' },
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
            style={styles.input}
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
      )}
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
