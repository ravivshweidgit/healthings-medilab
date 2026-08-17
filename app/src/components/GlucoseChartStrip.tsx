/**
 * Glucose chart strip — expand/collapse isolated from DashboardScreen so toggling
 * does not reconcile the whole dashboard. Collapse flips chrome first, then
 * unmounts the SVG after interactions (full unmount on a settled chart was laggy).
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
import { InteractionManager, StyleSheet, View } from 'react-native';
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
      glucoseDisplayUnit,
      energyDisplayUnit,
      langCode,
    },
    ref,
  ) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [expanded, setExpanded] = useState(false);
    /** Chart fiber/native tree — cleared after collapse paints so unmount is off the tap path. */
    const [chartAlive, setChartAlive] = useState(false);
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    const unmountTask = useRef<{ cancel?: () => void } | null>(null);

    const cancelDeferredUnmount = useCallback(() => {
      unmountTask.current?.cancel?.();
      unmountTask.current = null;
    }, []);

    const collapse = useCallback(() => {
      setExpanded(false);
      cancelDeferredUnmount();
      const task = InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          setChartAlive(false);
          unmountTask.current = null;
        });
      });
      unmountTask.current = task;
    }, [cancelDeferredUnmount]);

    const expand = useCallback(() => {
      cancelDeferredUnmount();
      setChartAlive(true);
      setExpanded(true);
    }, [cancelDeferredUnmount]);

    useImperativeHandle(ref, () => ({ expand, collapse }), [expand, collapse]);

    useEffect(() => {
      void AsyncStorage.getItem(DASH_GLUCOSE_EXPANDED_KEY).then((v) => {
        if (v === 'true') {
          setChartAlive(true);
          setExpanded(true);
        }
        setPrefsLoaded(true);
      });
    }, []);

    useEffect(() => {
      if (!prefsLoaded) return;
      void AsyncStorage.setItem(DASH_GLUCOSE_EXPANDED_KEY, expanded ? 'true' : 'false');
    }, [expanded, prefsLoaded]);

    useEffect(() => () => cancelDeferredUnmount(), [cancelDeferredUnmount]);

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
          {chartAlive ? (
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
                glucoseDisplayUnit={glucoseDisplayUnit}
                energyDisplayUnit={energyDisplayUnit}
                langCode={langCode}
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
      minHeight: 328,
      overflow: 'visible',
    },
    chartCardBleedCollapsed: {
      minHeight: 0,
      paddingTop: 14,
      paddingBottom: 12,
      paddingHorizontal: 18,
    },
    /** Brief hide before deferred unmount — skip SVG layout on the collapse tap. */
    chartBodyCollapsed: {
      display: 'none',
    },
  });
