import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MetabolicChart } from '../components/MetabolicChart';
import { MetabolicTrendChart7d } from '../components/MetabolicTrendChart7d';
import { CONFIG } from '../config/env';
import { useHealthData } from '../hooks/useHealthData';
import { buildMetabolicTrend7dFromWithings, type WeightVisceralTrendDay } from '../logic/metabolicTrend7d';
import { awsDataService } from '../services/AwsDataService';
import { parseCareSensAirExportCsv } from '../services/careSensCsv';
import {
  buildAuthorizationUrl,
  fetchWeightMetrics,
  fetchWeightVisceralTrend7d,
  handleOAuthCallback,
  loadWithingsTokens,
  type WeightMetricsForDashboard,
} from '../services/WithingsApiService';
import { WellnessColors, cardShadow } from '../theme/wellness';
import {
  demoNoticeCopy,
  glucoseHeadline,
  heartRateHeadline,
  metabolicScoreLine,
} from '../utils/wellnessCopy';

/** Caps logo height so it stays within the screen; image uses `contain` inside this box. */
const BRAND_HEADER_HEIGHT = 152;
/** Pulls the demo notice up into the letterbox below the bitmap (fixed bar + `contain`). */
const NOTICE_OVERLAP_UNDER_LOGO = 36;

function formatKg(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)} kg`;
}

function formatIndex(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(1);
}

function formatGlucoseMgDl(value: number): string {
  if (!value || Number.isNaN(value)) return '—';
  return `${Math.round(value)} mg/dL`;
}

function formatMeasuredAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  try {
    return new Date(t).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export const DashboardScreen = () => {
  const {
    glucoseData,
    heartRateData,
    efficiencyScore,
    activityZones,
    isLoading,
    error,
    refetch,
    applyImportedGlucose,
    dataSource,
  } = useHealthData();

  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [bodyScan, setBodyScan] = useState<WeightMetricsForDashboard | null>(null);
  const [bodyScanLoading, setBodyScanLoading] = useState(true);
  const [bodyScanError, setBodyScanError] = useState<string | null>(null);

  const [withingsTrend7d, setWithingsTrend7d] = useState<WeightVisceralTrendDay[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  const [withingsLinked, setWithingsLinked] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const refreshWithingsLinkState = useCallback(async () => {
    const t = await loadWithingsTokens();
    setWithingsLinked(Boolean(t?.refreshToken));
  }, []);

  const trend7dMerged = useMemo(() => {
    if (withingsTrend7d.length !== 7) return null;
    return buildMetabolicTrend7dFromWithings(withingsTrend7d, glucoseData);
  }, [glucoseData, withingsTrend7d]);

  const loadBodyScan = useCallback(async () => {
    setBodyScanError(null);
    setBodyScanLoading(true);
    try {
      const metrics = await fetchWeightMetrics();
      setBodyScan(metrics);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load body scan.';
      setBodyScanError(message);
    } finally {
      setBodyScanLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    setTrendError(null);
    setTrendLoading(true);
    try {
      const series = await fetchWeightVisceralTrend7d();
      setWithingsTrend7d(series);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load 7-day trend.';
      setTrendError(message);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBodyScan();
  }, [loadBodyScan]);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    void refreshWithingsLinkState();
  }, [refreshWithingsLinkState]);

  const handleLinkWithings = useCallback(async () => {
    setLinkError(null);
    setLinkBusy(true);
    try {
      const state = `st-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const authUrl = buildAuthorizationUrl(state);
      // Same string as authorize2 `redirect_uri` (default `healthings-medilab://oauth` via .env). Not AuthSession.makeRedirectUri() / not exp://.
      const result = await WebBrowser.openAuthSessionAsync(authUrl, CONFIG.withingsCallbackUrl, {
        preferEphemeralSession: false,
        showInRecents: false,
        createTask: false,
      });
      if (result.type === 'success' && result.url) {
        await handleOAuthCallback(result.url);
        await refreshWithingsLinkState();
        await Promise.all([loadBodyScan(), loadTrend()]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withings link failed.';
      setLinkError(message);
    } finally {
      setLinkBusy(false);
    }
  }, [loadBodyScan, loadTrend, refreshWithingsLinkState]);

  const latestGlucose = glucoseData.at(-1)?.value ?? 0;
  const latestHeartRate = heartRateData.at(-1)?.value ?? 0;

  /** Health Connect path (dev build) where CareSens / CGM typically syncs. */
  const hasHealthConnectGlucose = dataSource === 'health-connect' && glucoseData.length > 0;

  const safeScore = Math.max(0, Math.min(100, efficiencyScore));
  const progressWidth = `${safeScore}%` as `${number}%`;

  const handleSync = async () => {
    const [, , result] = await Promise.all([loadBodyScan(), loadTrend(), refetch()]);
    if (!result) return;
    await awsDataService.persistData({
      syncedAt: new Date().toISOString(),
      glucose: result.metrics.glucose,
      steps: result.metrics.steps,
      heartRate: result.metrics.heartRate ?? [],
      efficiencyScore: result.efficiencyScore,
      insight: result.insight,
      activityZones: result.activityZones,
    });
  };

  const handleImportCareSensCsv = useCallback(async () => {
    setImportMessage(null);
    setImportBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        setImportMessage('No file was selected.');
        return;
      }
      const text = await FileSystem.readAsStringAsync(uri);
      const points = parseCareSensAirExportCsv(text);
      applyImportedGlucose(points);
      setImportMessage(`Imported ${points.length} glucose readings from CareSens CSV.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not import CSV.';
      setImportMessage(message);
    } finally {
      setImportBusy(false);
    }
  }, [applyImportedGlucose]);

  const demoNotice = demoNoticeCopy(dataSource);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.brandHeader} accessibilityRole="header">
          <Image
            source={require('../../assets/brand-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Healthings Medilab"
          />
        </View>

        {demoNotice ? (
          <View style={[styles.notice, { marginTop: -NOTICE_OVERLAP_UNDER_LOGO }]}>
            <Text style={styles.noticeText}>{demoNotice}</Text>
          </View>
        ) : null}

        <View style={styles.glucoseHistorySection}>
          <View style={styles.chartBleed}>
            <View style={[styles.chartCardBleed, cardShadow]}>
              <MetabolicChart
                glucose={glucoseData}
                heartRate={heartRateData}
                activityZones={activityZones}
                withingsSnapshot={
                  bodyScan
                    ? {
                        muscleMassKg: bodyScan.muscleMassKg,
                        fatMassKg: bodyScan.fatMassKg,
                        weightKg: bodyScan.weightKg,
                      }
                    : null
                }
              />
            </View>
          </View>
        </View>

        <View style={[styles.bodyScanCard, cardShadow]}>
          <View style={styles.bodyScanHeader}>
            <View style={styles.withingsLogoWrap}>
              <Image
                source={require('../../assets/WithingsLogo.jpeg')}
                style={styles.withingsHeaderLogo}
                resizeMode="contain"
                accessibilityLabel="Withings"
              />
            </View>
            <View style={styles.withingsHeaderMiddle}>
              <View
                style={[
                  styles.withingsStatusBadge,
                  withingsLinked ? styles.withingsStatusBadgeOn : styles.withingsStatusBadgeOff,
                ]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={
                  withingsLinked ? 'Withings connected, signed in' : 'Withings disconnected, signed out'
                }
              >
                <Text
                  accessible={false}
                  importantForAccessibility="no"
                  style={[
                    styles.withingsStatusLine,
                    Platform.OS === 'android' && styles.withingsStatusLineAndroid,
                    withingsLinked ? styles.withingsStatusLineOn : styles.withingsStatusLineOff,
                  ]}
                  numberOfLines={1}
                >
                  {withingsLinked ? 'OK' : 'X'}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={withingsLinked ? 'Re-link Withings account' : 'Link Withings account'}
              style={[
                styles.withingsLinkButtonCompact,
                (linkBusy || bodyScanLoading) && styles.withingsLinkButtonDisabled,
              ]}
              onPress={handleLinkWithings}
              disabled={linkBusy || bodyScanLoading}
            >
              {linkBusy ? (
                <ActivityIndicator color={WellnessColors.accentBlue} size="small" />
              ) : (
                <Text style={styles.withingsLinkButtonTextCompact}>
                  {withingsLinked ? 'Re-link' : 'Link'}
                </Text>
              )}
            </Pressable>
            {bodyScanLoading ? <ActivityIndicator color={WellnessColors.accentBlue} style={styles.bodyScanHeaderSpinner} /> : null}
          </View>

          {linkError ? <Text style={styles.linkErrorText}>{linkError}</Text> : null}

          {bodyScanError ? <Text style={styles.bodyScanErrorText}>{bodyScanError}</Text> : null}

          {bodyScan && !bodyScanLoading ? (
            <>
              <View style={[styles.bodyScanRow, styles.bodyScanTripleRow]}>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Weight ${formatKg(bodyScan.weightKg)}`}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    Weight
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(bodyScan.weightKg)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Muscle mass ${formatKg(bodyScan.muscleMassKg)}`}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    Muscle
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(bodyScan.muscleMassKg)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Fat mass ${formatKg(bodyScan.fatMassKg)}`}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    Fat
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(bodyScan.fatMassKg)}
                  </Text>
                </View>
              </View>

              {formatMeasuredAt(bodyScan.measuredAt) ? (
                <Text style={styles.bodyScanMeasured}>
                  Last measurement · {formatMeasuredAt(bodyScan.measuredAt)}
                </Text>
              ) : null}

              {hasHealthConnectGlucose ? (
                <View style={styles.metabolicPair}>
                  <Text style={styles.metabolicPairCaption}>Medilab lens · metabolic context</Text>
                  <View style={styles.metabolicPairRow}>
                    <View style={styles.metabolicPairHalf}>
                      <Text style={styles.metabolicPairLabel}>Visceral fat index</Text>
                      <Text style={styles.metabolicPairValueLarge}>{formatIndex(bodyScan.visceralFatIndex)}</Text>
                    </View>
                    <View style={styles.metabolicPairDivider} />
                    <View style={styles.metabolicPairHalf}>
                      <Text style={styles.metabolicPairLabel}>Glucose (CareSens · latest)</Text>
                      <Text style={[styles.metabolicPairValueLarge, styles.metabolicPairGlucose]}>
                        {formatGlucoseMgDl(latestGlucose)}
                      </Text>
                      <Text style={styles.metabolicPairSub} numberOfLines={2}>
                        {glucoseHeadline(latestGlucose)}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.visceralSolo}>
                  <Text style={styles.bodyScanMetricLabel}>Visceral fat index</Text>
                  <Text style={styles.visceralSoloValue}>{formatIndex(bodyScan.visceralFatIndex)}</Text>
                  <Text style={styles.visceralSoloHint}>
                    On Android with Health Connect (e.g. CareSens), your latest glucose appears here next to visceral
                    fat.
                  </Text>
                </View>
              )}
            </>
          ) : !bodyScanLoading && !bodyScan && !bodyScanError ? (
            <Text style={styles.bodyScanEmpty}>No body scan data yet.</Text>
          ) : null}
        </View>

        {dataSource === 'health-connect' ? (
          <View style={styles.careSensImportSection}>
            <Pressable
              style={[styles.careSensImportButton, importBusy && styles.careSensImportButtonDisabled]}
              onPress={handleImportCareSensCsv}
              disabled={importBusy}
              accessibilityRole="button"
              accessibilityLabel="Import CareSens Air CSV"
            >
              {importBusy ? (
                <ActivityIndicator color={WellnessColors.accentBlue} />
              ) : (
                <View style={styles.careSensImportButtonRow}>
                  <View style={styles.careSensImportLogoWrap}>
                    <Image
                      source={require('../../assets/CareScenseAirLogo.jpeg')}
                      style={styles.careSensImportButtonLogo}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                  </View>
                  <Text style={styles.careSensImportButtonLabel}>Import</Text>
                </View>
              )}
            </Pressable>
            {importMessage ? <Text style={styles.importMessageText}>{importMessage}</Text> : null}
          </View>
        ) : null}

        <View style={[styles.heroCard, cardShadow]}>
          <Text style={styles.heroLabel}>METABOLIC SCORE</Text>
          <Text style={styles.heroNumber}>{Math.round(safeScore)}</Text>
          <View style={styles.heroProgressTrack}>
            <View style={[styles.heroProgressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.heroSub}>{metabolicScoreLine(efficiencyScore)}</Text>
        </View>

        <View style={styles.gridRow}>
          <View style={[styles.metricCard, cardShadow]}>
            <View style={[styles.iconCircle, { backgroundColor: WellnessColors.iconTintGreen }]}>
              <Feather name="droplet" size={20} color={WellnessColors.accentGreen} />
            </View>
            <Text style={styles.metricLabel}>GLUCOSE</Text>
            <Text style={styles.metricHeadline}>{glucoseHeadline(latestGlucose)}</Text>
          </View>
          <View style={[styles.metricCard, cardShadow]}>
            <View style={[styles.iconCircle, { backgroundColor: WellnessColors.iconTintBlue }]}>
              <Feather name="heart" size={20} color={WellnessColors.accentBlue} />
            </View>
            <Text style={styles.metricLabel}>HEART RATE</Text>
            <Text style={styles.metricHeadline}>{heartRateHeadline(latestHeartRate)}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, (isLoading || bodyScanLoading || trendLoading) && styles.primaryButtonDisabled]}
          onPress={handleSync}
          disabled={isLoading || bodyScanLoading || trendLoading}
        >
          {(isLoading || bodyScanLoading || trendLoading) ? (
            <ActivityIndicator color={WellnessColors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>Refresh my data</Text>
          )}
        </Pressable>

        <View style={styles.trendBleed}>
          <View style={[styles.trendCardBleed, cardShadow]}>
            {trendError ? <Text style={styles.trendErrorText}>{trendError}</Text> : null}
            {trendLoading && !trend7dMerged ? (
              <View style={styles.trendLoadingOnly}>
                <ActivityIndicator color={WellnessColors.accentBlue} />
                <Text style={styles.trendLoadingLabel}>Loading trend analysis…</Text>
              </View>
            ) : null}
            {trend7dMerged ? <MetabolicTrendChart7d days={trend7dMerged} /> : null}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>We couldn't refresh just now. Try again shortly.</Text> : null}

        {dataSource !== 'health-connect' ? (
          <Text style={styles.previewFoot}>Preview · sample wellness data</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: WellnessColors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  brandHeader: {
    marginBottom: 0,
    width: '100%',
    height: BRAND_HEADER_HEIGHT,
    alignSelf: 'stretch',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  notice: {
    backgroundColor: WellnessColors.noticeSoftBg,
    borderWidth: 1,
    borderColor: WellnessColors.noticeSoftBorder,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  noticeText: {
    color: WellnessColors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  heroCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  heroNumber: {
    fontSize: 64,
    fontWeight: '200',
    color: WellnessColors.textPrimary,
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  heroProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: WellnessColors.progressTrack,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: WellnessColors.accentGreen,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '400',
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  bodyScanCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  bodyScanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bodyScanHeaderSpinner: {
    marginLeft: 8,
  },
  withingsLogoWrap: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  withingsHeaderLogo: {
    width: '100%',
    height: '100%',
  },
  withingsHeaderMiddle: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  withingsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    minWidth: 40,
    minHeight: 34,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  withingsStatusBadgeOn: {
    backgroundColor: WellnessColors.iconTintGreen,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.35)',
  },
  withingsStatusBadgeOff: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.35)',
  },
  withingsStatusLine: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  withingsStatusLineOn: {
    color: '#2E7D32',
  },
  withingsStatusLineOff: {
    color: '#C62828',
  },
  withingsStatusLineAndroid: {
    includeFontPadding: false,
  },
  withingsLinkButtonCompact: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: WellnessColors.accentBlue,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 72,
  },
  withingsLinkButtonDisabled: {
    opacity: 0.55,
  },
  withingsLinkButtonTextCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.accentBlue,
  },
  linkErrorText: {
    color: WellnessColors.accentRed,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  bodyScanErrorText: {
    color: WellnessColors.accentRed,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  bodyScanMeasured: {
    fontSize: 10,
    lineHeight: 14,
    color: WellnessColors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  bodyScanRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  bodyScanTripleRow: {
    gap: 6,
  },
  bodyScanMetricThird: {
    flex: 1,
    minWidth: 0,
  },
  bodyScanMetricLabelTriple: {
    fontSize: 10,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  bodyScanMetricValueTriple: {
    fontSize: 16,
    fontWeight: '500',
    color: WellnessColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bodyScanMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metabolicPair: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: WellnessColors.metabolicPairBg,
    borderWidth: 1,
    borderColor: WellnessColors.metabolicPairBorder,
  },
  metabolicPairCaption: {
    fontSize: 10,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  metabolicPairRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metabolicPairHalf: {
    flex: 1,
    minWidth: 0,
  },
  metabolicPairDivider: {
    width: 1,
    backgroundColor: WellnessColors.metabolicPairBorder,
    marginHorizontal: 12,
  },
  metabolicPairLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  metabolicPairValueLarge: {
    fontSize: 28,
    fontWeight: '300',
    color: WellnessColors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  metabolicPairGlucose: {
    color: WellnessColors.accentGreen,
  },
  metabolicPairSub: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 16,
  },
  visceralSolo: {
    marginTop: 4,
    paddingTop: 4,
  },
  visceralSoloValue: {
    fontSize: 32,
    fontWeight: '200',
    color: WellnessColors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  visceralSoloHint: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 18,
  },
  bodyScanEmpty: {
    fontSize: 14,
    color: WellnessColors.textSecondary,
    marginTop: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    padding: 24,
    minHeight: 160,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  metricHeadline: {
    fontSize: 15,
    fontWeight: '400',
    color: WellnessColors.textPrimary,
    lineHeight: 22,
  },
  /** Same horizontal gutter as hero/metric cards (scroll padding + card inner padding). */
  chartBleed: {
    marginBottom: 6,
    alignSelf: 'stretch',
    width: '100%',
  },
  chartCardBleed: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    minHeight: 328,
    overflow: 'visible',
  },
  trendBleed: {
    marginBottom: 20,
    alignSelf: 'stretch',
    width: '100%',
  },
  trendCardBleed: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 320,
    overflow: 'visible',
  },
  trendErrorText: {
    color: WellnessColors.accentRed,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 19,
  },
  trendLoadingOnly: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  trendLoadingLabel: {
    marginTop: 10,
    fontSize: 13,
    color: WellnessColors.textSecondary,
  },
  careSensImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: WellnessColors.accentBlue,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: WellnessColors.surface,
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
  },
  careSensImportButtonLogo: {
    width: '100%',
    height: '100%',
  },
  careSensImportButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: WellnessColors.accentBlue,
    letterSpacing: 0.3,
  },
  glucoseHistorySection: {
    marginBottom: 6,
  },
  careSensImportSection: {
    gap: 6,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: WellnessColors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  importMessageText: {
    fontSize: 14,
    color: WellnessColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  errorText: {
    color: WellnessColors.accentRed,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  previewFoot: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
