/**
 * Glucose chart strip — expand/collapse isolated from DashboardScreen so toggling
 * does not reconcile the whole dashboard.
 *
 * After first expand the SVG stays mounted (expand stays cheap). Collapse only
 * hides it — never unmounts. Prefer height:0 + overflow:hidden over display:none
 * so Android does not tear down the native SVG tree on every collapse.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityZone } from '../logic/MetabolicLogic';
import type { FoodEntry } from '../services/FoodLogService';
import type { WithingsCaloriePoint, WorkoutSession } from '../services/WithingsApiService';
import type { EnergyUnit } from '../logic/unitConvert';
import { cardShadow } from '../theme/wellness';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { StripIcons } from '../theme/icons';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { MetabolicChart } from './MetabolicChart';

const DASH_GLUCOSE_EXPANDED_KEY = 'dash_glucose_chart_expanded';

export type GlucoseChartStripHandle = {
  expand: () => void;
  collapse: () => void;
};

type SeriesPoint = { timestamp: string; value: number };

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  collapseLabel: string;
  expandLabel: string;
  titleRtl?: boolean;
  glucose: SeriesPoint[];
  heartRate: SeriesPoint[];
  activityZones: ActivityZone[];
  calorieBurns: WithingsCaloriePoint[];
  workoutSessions: WorkoutSession[];
  bmrKcalDay?: number | null;
  foodEntries: FoodEntry[];
  onMealPress?: (entry: FoodEntry) => void;
  glucoseDisplayUnit: 'mgdl' | 'mmol';
  energyDisplayUnit: EnergyUnit;
  langCode?: string | null;
};

export const GlucoseChartStrip = forwardRef<GlucoseChartStripHandle, Props>(
  function GlucoseChartStrip(
    {
      title,
      subtitle,
      collapseLabel,
      expandLabel,
      titleRtl,
      glucose,
      heartRate,
      activityZones,
      calorieBurns,
      workoutSessions,
      bmrKcalDay,
      foodEntries,
      onMealPress,
      glucoseDisplayUnit,
      energyDisplayUnit,
      langCode,
    },
    ref,
  ) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [expanded, setExpanded] = useState(false);
    /** Keep chart mounted after first expand — collapse only hides it. */
    const [chartMounted, setChartMounted] = useState(false);
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const collapse = useCallback(() => {
      setExpanded(false);
    }, []);

    const expand = useCallback(() => {
      setChartMounted(true);
      setExpanded(true);
    }, []);

    useImperativeHandle(ref, () => ({ expand, collapse }), [expand, collapse]);

    useEffect(() => {
      void AsyncStorage.getItem(DASH_GLUCOSE_EXPANDED_KEY).then((v) => {
        if (v === 'true') {
          setChartMounted(true);
          setExpanded(true);
        }
        setPrefsLoaded(true);
      });
    }, []);

    useEffect(() => {
      if (!prefsLoaded) return;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void AsyncStorage.setItem(DASH_GLUCOSE_EXPANDED_KEY, expanded ? 'true' : 'false');
      }, 300);
      return () => {
        if (persistTimer.current) clearTimeout(persistTimer.current);
      };
    }, [expanded, prefsLoaded]);

    return (
      <View style={styles.chartBleed}>
        <View
          style={[styles.chartCardBleed, !expanded && styles.chartCardBleedCollapsed, cardShadow]}
        >
          <DashboardCollapseHeader
            title={title}
            subtitle={subtitle}
            expanded={expanded}
            onToggle={() => {
              if (expanded) collapse();
              else expand();
            }}
            titleRtl={titleRtl}
            collapseLabel={collapseLabel}
            expandLabel={expandLabel}
            icon={StripIcons.glucose}
            perfTag="MetabolicChart"
          />
          {chartMounted ? (
            <View
              style={!expanded ? styles.chartBodyCollapsed : undefined}
              pointerEvents={expanded ? 'auto' : 'none'}
              accessibilityElementsHidden={!expanded}
              importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
            >
              <MetabolicChart
                glucose={glucose}
                heartRate={heartRate}
                activityZones={activityZones}
                calorieBurns={calorieBurns}
                workoutSessions={workoutSessions}
                bmrKcalDay={bmrKcalDay ?? undefined}
                foodEntries={foodEntries}
                onMealPress={onMealPress}
                glucoseDisplayUnit={glucoseDisplayUnit}
                energyDisplayUnit={energyDisplayUnit}
                langCode={langCode}
                collapsed={!expanded}
              />
            </View>
          ) : null}
        </View>
      </View>
    );
  },
);

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    chartBleed: {
      alignSelf: 'stretch',
      width: '100%',
    },
    chartCardBleed: {
      backgroundColor: c.surface,
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 4,
      // No fixed minHeight — a 328→0 jump on collapse reflows the whole dashboard ScrollView.
      overflow: 'visible',
    },
    chartCardBleedCollapsed: {
      paddingTop: 14,
      paddingBottom: 12,
      paddingHorizontal: 18,
    },
    /**
     * Hide without display:'none' — that tears down native SVG children on Android
     * and feels like an unmount. height:0 keeps the fiber + native views alive.
     */
    chartBodyCollapsed: {
      height: 0,
      overflow: 'hidden',
      opacity: 0,
    },
  });
