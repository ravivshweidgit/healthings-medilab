import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MetabolicChart } from '../components/MetabolicChart';
import { useHealthData } from '../hooks/useHealthData';
import { awsDataService } from '../services/AwsDataService';
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

export const DashboardScreen = () => {
  const {
    glucoseData,
    heartRateData,
    efficiencyScore,
    activityZones,
    isLoading,
    error,
    refetch,
    dataSource,
  } = useHealthData();

  const latestGlucose = glucoseData.at(-1)?.value ?? 0;
  const latestHeartRate = heartRateData.at(-1)?.value ?? 0;

  const safeScore = Math.max(0, Math.min(100, efficiencyScore));
  const progressWidth = `${safeScore}%` as `${number}%`;

  const handleSync = async () => {
    const result = await refetch();
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

        <View style={styles.chartBleed}>
          <View style={[styles.chartCardBleed, cardShadow]}>
            <MetabolicChart glucose={glucoseData} heartRate={heartRateData} activityZones={activityZones} />
          </View>
        </View>

        <Pressable style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]} onPress={handleSync} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color={WellnessColors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>Refresh my data</Text>
          )}
        </Pressable>

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
    paddingTop: 8,
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
    marginBottom: 16,
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
    marginBottom: 20,
    alignSelf: 'stretch',
    width: '100%',
  },
  chartCardBleed: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 12,
    minHeight: 360,
    overflow: 'visible',
  },
  primaryButton: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: WellnessColors.surface,
    fontSize: 16,
    fontWeight: '600',
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
