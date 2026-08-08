/**
 * Add / edit activity session + favorites + from-past picker (prompt104).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Calculator, Sparkles } from 'lucide-react-native';
import { PERF_WARN_AI_MS, PERF_WARN_MEAL_MS, timeAsync } from '../services/AppDailyLogService';
import {
  activityDayKeyToMs,
  activityLogDayKey,
  deleteActivity,
  deleteFavorite,
  estimateActivityKcal,
  getActivitiesForDay,
  getFavorites,
  resolvePastActivityBrowseDayKey,
  saveActivity,
  saveFavorite,
  type ActivityEntry,
  type ActivityFavorite,
} from '../services/ActivityLogService';
import {
  estimateActivityKcalFromYoutube,
  fetchYoutubeVideoTitle,
} from '../services/GeminiService';
import { getHelpStripCopy } from '../i18n/helpStripCopy';
import { OutOfCreditsError } from '../services/UsageQueueService';
import { getActivityLogUiCopy } from '../i18n/activityLogUiCopy';
import { formatFoodLogDayLabel } from '../i18n/dateLocale';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import type { UserLanguage } from '../services/TargetService';
import { DEFAULT_LANGUAGE } from '../services/TargetService';
import {
  displayToKcal,
  formatEnergy,
  kcalToDisplay,
  type EnergyUnit,
} from '../logic/unitConvert';

/** Small YouTube mark (lucide has no Youtube glyph in this package). */
function YouTubeMark({ size = 22, muted = false }: { size?: number; muted?: boolean }) {
  const play = Math.round(size * 0.32);
  return (
    <View
      style={{
        width: size,
        height: Math.round(size * 0.72),
        borderRadius: Math.round(size * 0.22),
        backgroundColor: muted ? '#9E9E9E' : '#FF0000',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: Math.round(play * 0.15),
          borderTopWidth: play * 0.55,
          borderBottomWidth: play * 0.55,
          borderLeftWidth: play,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: '#fff',
        }}
      />
    </View>
  );
}

type Mode = 'form' | 'pickPast';

export type ActivityBodyProfile = {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: string | null;
  fatMassKg: number | null;
  muscleMassKg: number | null;
  bmrKcal: number | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  initialTimestamp: number;
  editEntry?: ActivityEntry;
  lang?: UserLanguage | null;
  energyUnit?: EnergyUnit;
  bodyProfile?: ActivityBodyProfile | null;
};

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addLocalDays(ms: number, delta: number): number {
  const d = new Date(startOfLocalDay(ms));
  d.setDate(d.getDate() + delta);
  return d.getTime();
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function ActivityLogModal({
  visible,
  onClose,
  onSaved,
  initialTimestamp,
  editEntry,
  lang = DEFAULT_LANGUAGE,
  energyUnit = 'kcal',
  bodyProfile = null,
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const ui = useMemo(() => getActivityLogUiCopy(lang?.code), [lang?.code]);
  const helpCopy = useMemo(() => getHelpStripCopy(lang?.code), [lang?.code]);

  const [mode, setMode] = useState<Mode>('form');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [equipmentKg, setEquipmentKg] = useState('');
  const [kcalInput, setKcalInput] = useState('');
  const [saveAsFav, setSaveAsFav] = useState(false);
  const [favorites, setFavorites] = useState<ActivityFavorite[]>([]);
  const [favoriteId, setFavoriteId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState<{ kind: 'busy' | 'ok' | 'error'; text: string } | null>(
    null,
  );
  const [managingFavs, setManagingFavs] = useState(false);
  const [minutesOrigin, setMinutesOrigin] = useState(30);
  const kcalPerMinRef = useRef(5);

  const [browseDayMs, setBrowseDayMs] = useState(() => startOfLocalDay(Date.now()));
  const [pastDayEntries, setPastDayEntries] = useState<ActivityEntry[]>([]);
  const [pastDayLoading, setPastDayLoading] = useState(false);

  const reloadFavs = useCallback(async () => {
    setFavorites(await getFavorites());
  }, []);

  const seedMinutesAndKcal = useCallback(
    (mins: number, activityKcal: number) => {
      const m = Math.max(1, Math.round(Number.isFinite(mins) ? mins : 30));
      const kcal = Number.isFinite(activityKcal) ? activityKcal : estimateActivityKcal(m);
      setMinutes(String(m));
      setMinutesOrigin(m);
      kcalPerMinRef.current = kcal / m;
      setKcalInput(String(Math.round(kcalToDisplay(kcal, energyUnit))));
    },
    [energyUnit],
  );

  useEffect(() => {
    if (!visible) return;
    void reloadFavs();
    setMode('form');
    setAiHint(null);
    if (editEntry) {
      setName(editEntry.name);
      setYoutubeUrl(editEntry.youtubeUrl ?? '');
      setEquipmentKg(
        editEntry.equipmentWeightKg != null && editEntry.equipmentWeightKg > 0
          ? String(editEntry.equipmentWeightKg)
          : '',
      );
      seedMinutesAndKcal(editEntry.minutes, editEntry.activityKcal);
      setFavoriteId(editEntry.favoriteId);
      setSaveAsFav(false);
    } else {
      setName('');
      setYoutubeUrl('');
      setEquipmentKg('');
      seedMinutesAndKcal(30, estimateActivityKcal(30));
      setFavoriteId(undefined);
      setSaveAsFav(false);
    }
    setManagingFavs(false);
  }, [visible, editEntry, energyUnit, reloadFavs, seedMinutesAndKcal]);

  useEffect(() => {
    if (!visible || mode !== 'pickPast') return;
    let cancelled = false;
    const dk = activityLogDayKey(browseDayMs);
    setPastDayLoading(true);
    void getActivitiesForDay(dk).then((list) => {
      if (cancelled) return;
      setPastDayEntries([...list].sort((a, b) => a.timestamp - b.timestamp));
      setPastDayLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, mode, browseDayMs]);

  const applyFavorite = useCallback(
    (fav: ActivityFavorite) => {
      setName(fav.name);
      setYoutubeUrl(fav.youtubeUrl ?? '');
      setEquipmentKg(
        fav.equipmentWeightKg != null && fav.equipmentWeightKg > 0
          ? String(fav.equipmentWeightKg)
          : '',
      );
      setFavoriteId(fav.id);
      const kcal =
        fav.defaultKcal != null && Number.isFinite(fav.defaultKcal) && fav.defaultKcal > 0
          ? fav.defaultKcal
          : estimateActivityKcal(fav.defaultMinutes);
      seedMinutesAndKcal(fav.defaultMinutes, kcal);
      setSaveAsFav(false);
      setAiHint(null);
    },
    [seedMinutesAndKcal],
  );

  const applyMinutes = useCallback(
    (mins: number) => {
      const m = Math.max(0, Math.round(mins));
      setMinutes(String(m));
      const kcal = Math.round(kcalPerMinRef.current * m);
      setKcalInput(String(Math.round(kcalToDisplay(kcal, energyUnit))));
    },
    [energyUnit],
  );

  const onMinutesChange = useCallback(
    (text: string) => {
      setMinutes(text);
      const m = parseInt(text, 10);
      if (Number.isFinite(m) && m >= 0) {
        const kcal = Math.round(kcalPerMinRef.current * m);
        setKcalInput(String(Math.round(kcalToDisplay(kcal, energyUnit))));
      }
    },
    [energyUnit],
  );

  const onKcalChange = useCallback(
    (text: string) => {
      setKcalInput(text);
      const displayKcal = parseFloat(text);
      const mins = parseInt(minutes, 10);
      if (Number.isFinite(displayKcal) && Number.isFinite(mins) && mins > 0) {
        kcalPerMinRef.current = displayToKcal(displayKcal, energyUnit) / mins;
      }
    },
    [minutes, energyUnit],
  );

  const minutesSliderMax = Math.max(1, minutesOrigin * 2);
  const minutesSliderValue = useMemo(() => {
    const m = parseInt(minutes, 10);
    if (!Number.isFinite(m)) return minutesOrigin;
    return Math.min(minutesSliderMax, Math.max(0, m));
  }, [minutes, minutesOrigin, minutesSliderMax]);

  const openPastPicker = useCallback(() => {
    setPastDayEntries([]);
    setPastDayLoading(true);
    void (async () => {
      const dk = await resolvePastActivityBrowseDayKey();
      setBrowseDayMs(activityDayKeyToMs(dk));
      setMode('pickPast');
    })();
  }, []);

  const shiftBrowseDay = useCallback((delta: number) => {
    setBrowseDayMs((prev) => {
      const next = addLocalDays(prev, delta);
      const todayStart = startOfLocalDay(Date.now());
      return next > todayStart ? todayStart : next;
    });
  }, []);

  const applyPastAsNew = useCallback(
    (entry: ActivityEntry) => {
      setName(entry.name);
      setYoutubeUrl(entry.youtubeUrl ?? '');
      setEquipmentKg(
        entry.equipmentWeightKg != null && entry.equipmentWeightKg > 0
          ? String(entry.equipmentWeightKg)
          : '',
      );
      setFavoriteId(entry.favoriteId);
      seedMinutesAndKcal(entry.minutes, entry.activityKcal);
      setSaveAsFav(false);
      setAiHint(null);
      setMode('form');
    },
    [seedMinutesAndKcal],
  );

  const parseEquipmentKg = useCallback((): number | undefined => {
    const raw = parseFloat(equipmentKg.replace(',', '.'));
    if (!Number.isFinite(raw) || raw <= 0) return undefined;
    return Math.round(raw * 10) / 10;
  }, [equipmentKg]);

  const runAiCalc = useCallback(async () => {
    const mins = parseInt(minutes, 10);
    const hasLink = Boolean(youtubeUrl.trim());
    const hasName = Boolean(name.trim());
    if (!hasLink && !hasName) {
      Alert.alert(ui.aiCalcNeedLink);
      return;
    }
    const weightKg = bodyProfile?.weightKg;
    if (weightKg == null || !(weightKg > 0)) {
      Alert.alert(ui.aiCalcNeedWeight);
      return;
    }
    // Video mode reads length from the film; name-only needs minutes first.
    if (!hasLink && (!Number.isFinite(mins) || mins <= 0)) {
      Alert.alert(ui.minutesRequired);
      return;
    }

    setAiBusy(true);
    const watching = hasLink;
    setAiHint({
      kind: 'busy',
      text: watching ? ui.aiCalcBusyVideo : ui.aiCalcBusy,
    });
    try {
      const urlTrim = youtubeUrl.trim();
      const needTitle = !name.trim() && Boolean(urlTrim);
      // oEmbed for the real YouTube title (Gemini often omits suggestedName).
      const [result, ytTitle] = await Promise.all([
        timeAsync(
          'estimateActivityKcalFromYoutube',
          () =>
            estimateActivityKcalFromYoutube({
              youtubeUrl: urlTrim,
              minutes: Number.isFinite(mins) && mins > 0 ? mins : 30,
              activityName: name.trim() || undefined,
              equipmentWeightKg: parseEquipmentKg() ?? null,
              weightKg,
              heightCm: bodyProfile?.heightCm ?? null,
              age: bodyProfile?.age ?? null,
              gender: bodyProfile?.gender ?? null,
              fatMassKg: bodyProfile?.fatMassKg ?? null,
              muscleMassKg: bodyProfile?.muscleMassKg ?? null,
              bmrKcal: bodyProfile?.bmrKcal ?? null,
            }),
          { video: watching },
          PERF_WARN_AI_MS,
        ),
        needTitle ? fetchYoutubeVideoTitle(urlTrim) : Promise.resolve(null),
      ]);
      const applyMins =
        result.usedVideo && result.durationMinutes != null && result.durationMinutes > 0
          ? result.durationMinutes
          : Number.isFinite(mins) && mins > 0
            ? mins
            : result.durationMinutes ?? 30;
      seedMinutesAndKcal(applyMins, result.activityKcal);
      // Prefill name only when blank — prefer real YouTube title, then Gemini label.
      if (!name.trim()) {
        const fill = (ytTitle ?? result.suggestedName ?? '').trim();
        if (fill) setName(fill);
      }
      const modeTag = result.usedVideo ? 'video' : 'name';
      const durTag =
        result.usedVideo && result.durationMinutes != null
          ? `${result.durationMinutes} min · `
          : '';
      const loadTag =
        result.equipmentLoadKgUsed != null && result.equipmentLoadKgUsed > 0
          ? `@ ${result.equipmentLoadKgUsed} kg · `
          : '';
      setAiHint({
        kind: 'ok',
        text: `${ui.aiCalcDone(formatEnergy(result.activityKcal, energyUnit))} · ${durTag}${loadTag}${modeTag} · ${result.reason}`,
      });
    } catch (e: unknown) {
      const text =
        e instanceof OutOfCreditsError ? helpCopy.outOfCredits : ui.aiCalcFailed;
      setAiHint({ kind: 'error', text });
    } finally {
      setAiBusy(false);
    }
  }, [
    minutes,
    youtubeUrl,
    name,
    bodyProfile,
    ui,
    helpCopy.outOfCredits,
    energyUnit,
    seedMinutesAndKcal,
    parseEquipmentKg,
  ]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(ui.nameRequired);
      return;
    }
    const mins = parseInt(minutes, 10);
    if (!Number.isFinite(mins) || mins <= 0) {
      Alert.alert(ui.minutesRequired);
      return;
    }
    const displayKcal = parseFloat(kcalInput);
    const activityKcal = Number.isFinite(displayKcal)
      ? Math.round(displayToKcal(displayKcal, energyUnit))
      : estimateActivityKcal(mins);

    setBusy(true);
    try {
      await timeAsync(
        'ActivityLogModal.save',
        async () => {
          const equipmentWeightKg = parseEquipmentKg();
          let favId = favoriteId;
          if (saveAsFav) {
            const fav = await saveFavorite({
              id: favoriteId,
              name: trimmed,
              defaultMinutes: mins,
              defaultKcal: activityKcal,
              equipmentWeightKg,
              youtubeUrl: youtubeUrl.trim() || undefined,
            });
            favId = fav.id;
          }
          await saveActivity({
            id: editEntry?.id,
            timestamp: editEntry?.timestamp ?? initialTimestamp,
            name: trimmed,
            minutes: mins,
            note: editEntry?.note,
            youtubeUrl: youtubeUrl.trim() || undefined,
            equipmentWeightKg,
            activityKcal,
            source: favId ? 'favorite' : 'manual',
            favoriteId: favId,
          });
          await onSaved();
          onClose();
        },
        { edit: Boolean(editEntry?.id) },
        PERF_WARN_MEAL_MS,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Save failed', msg);
    } finally {
      setBusy(false);
    }
  }, [
    name,
    minutes,
    youtubeUrl,
    kcalInput,
    energyUnit,
    favoriteId,
    saveAsFav,
    editEntry,
    initialTimestamp,
    onSaved,
    onClose,
    ui,
    parseEquipmentKg,
  ]);

  const handleDelete = useCallback(() => {
    if (!editEntry) return;
    Alert.alert(ui.deleteTitle, ui.deleteMessage, [
      { text: ui.cancel, style: 'cancel' },
      {
        text: ui.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteActivity(editEntry.id, editEntry.timestamp);
            await onSaved();
            onClose();
          })();
        },
      },
    ]);
  }, [editEntry, ui, onSaved, onClose]);

  const handleDeleteFavorite = useCallback(
    (fav: ActivityFavorite) => {
      Alert.alert(ui.deleteTitle, fav.name, [
        { text: ui.cancel, style: 'cancel' },
        {
          text: ui.delete,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteFavorite(fav.id);
              await reloadFavs();
            })();
          },
        },
      ]);
    },
    [ui, reloadFavs],
  );

  const browseDayKey = activityLogDayKey(browseDayMs);
  const todayKey = activityLogDayKey(Date.now());
  const browseLabel = formatFoodLogDayLabel(browseDayMs, lang?.code, {
    todayDayKey: todayKey,
    dayKey: browseDayKey,
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title} numberOfLines={1}>
              {mode === 'pickPast'
                ? ui.fromPastTitle
                : editEntry
                  ? ui.editActivity
                  : ui.addActivity}
            </Text>

            {mode === 'pickPast' ? (
              <View style={styles.pickPastWrap}>
                <View style={styles.browseDayNav}>
                  <Pressable
                    style={styles.browseDayBtn}
                    onPress={() => shiftBrowseDay(-1)}
                    hitSlop={8}
                  >
                    <Text style={styles.browseDayBtnText}>‹</Text>
                  </Pressable>
                  <Text style={styles.browseDayLabel} numberOfLines={1}>
                    {browseLabel}
                  </Text>
                  <Pressable
                    style={[
                      styles.browseDayBtn,
                      browseDayKey === todayKey && styles.browseDayBtnDisabled,
                    ]}
                    onPress={() => shiftBrowseDay(1)}
                    disabled={browseDayKey === todayKey}
                    hitSlop={8}
                  >
                    <Text style={styles.browseDayBtnText}>›</Text>
                  </Pressable>
                </View>

                <View style={styles.pastListFlex}>
                  {pastDayLoading ? (
                    <ActivityIndicator color={colors.accentBlue} style={{ marginTop: 16 }} />
                  ) : pastDayEntries.length === 0 ? (
                    <Text style={styles.emptyPast}>{ui.noSessionsThatDay}</Text>
                  ) : (
                    <ScrollView
                      style={styles.pastScroll}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {pastDayEntries.map((entry) => (
                        <Pressable
                          key={entry.id}
                          style={({ pressed }) => [
                            styles.pastRow,
                            pressed && styles.pastRowPressed,
                          ]}
                          onPress={() => applyPastAsNew(entry)}
                        >
                          <View style={styles.pastMain}>
                            <Text style={styles.pastTime}>{formatTime(entry.timestamp)}</Text>
                            <Text style={styles.pastName} numberOfLines={1}>
                              {entry.name}
                            </Text>
                            <Text style={styles.pastMeta}>
                              {entry.minutes} min · {formatEnergy(entry.activityKcal, energyUnit)}
                            </Text>
                          </View>
                          <Text style={styles.pastCta}>{ui.useAsNewActivity}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <Pressable style={styles.pastBackBtn} onPress={() => setMode('form')}>
                  <Text style={styles.pastBackBtnText}>{ui.back}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.formWrap}>
                <ScrollView
                  style={styles.formScroll}
                  contentContainerStyle={styles.formBody}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {!editEntry ? (
                    <View style={styles.fromPastRow}>
                      <Pressable style={styles.fromPastBtn} onPress={openPastPicker}>
                        <Text style={styles.fromPastBtnText}>{ui.fromPastActivity}</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {favorites.length > 0 ? (
                    <View style={styles.favSection}>
                      <View style={styles.favHeader}>
                        <Text style={styles.sectionLabel}>{ui.favorites}</Text>
                        <Pressable onPress={() => setManagingFavs((v) => !v)} hitSlop={6}>
                          <Text style={styles.link}>{ui.manageFavorites}</Text>
                        </Pressable>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.favScroll}
                        keyboardShouldPersistTaps="handled"
                      >
                        {favorites.map((fav) => (
                          <Pressable
                            key={fav.id}
                            style={[
                              styles.favChip,
                              favoriteId === fav.id && styles.favChipActive,
                            ]}
                            onPress={() =>
                              managingFavs ? handleDeleteFavorite(fav) : applyFavorite(fav)
                            }
                            onLongPress={() => handleDeleteFavorite(fav)}
                          >
                            <Text
                              style={[
                                styles.favChipText,
                                favoriteId === fav.id && styles.favChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {managingFavs ? `⌫ ${fav.name}` : fav.name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder={ui.favoriteName}
                    placeholderTextColor={colors.textSecondary}
                  />

                  <View style={styles.minsKcalRow}>
                    <View style={styles.minsCol}>
                      <Text style={styles.inlineLabel}>{ui.minutes}</Text>
                      <TextInput
                        style={styles.inputCompact}
                        value={minutes}
                        onChangeText={onMinutesChange}
                        keyboardType="number-pad"
                        placeholder="30"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={styles.kcalCol}>
                      <Text style={styles.inlineLabel}>{ui.kcal}</Text>
                      <TextInput
                        style={styles.inputCompact}
                        value={kcalInput}
                        onChangeText={onKcalChange}
                        keyboardType="numbers-and-punctuation"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={styles.loadCol}>
                      <Text style={styles.inlineLabel}>{ui.equipmentWeightKg}</Text>
                      <TextInput
                        style={styles.inputCompact}
                        value={equipmentKg}
                        onChangeText={setEquipmentKg}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                  <Text style={styles.loadHint}>{ui.equipmentWeightHint}</Text>

                  {minutesOrigin > 0 ? (
                    <View style={styles.minutesSliderWrap}>
                      <Slider
                        style={styles.minutesSlider}
                        minimumValue={0}
                        maximumValue={minutesSliderMax}
                        step={1}
                        value={minutesSliderValue}
                        onValueChange={applyMinutes}
                        minimumTrackTintColor={colors.accentBlue}
                        maximumTrackTintColor={colors.gridLine}
                        thumbTintColor={colors.accentBlue}
                        accessibilityLabel={ui.minutes}
                      />
                      <View style={styles.minutesSliderLabels}>
                        <Text style={styles.minutesSliderLabel}>0</Text>
                        <Text style={styles.minutesSliderLabelMid}>
                          {Math.round(minutesOrigin)}
                        </Text>
                        <Text style={styles.minutesSliderLabel}>
                          {Math.round(minutesSliderMax)}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.youtubeRow}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.youtubeInput,
                        !youtubeUrl.trim() && styles.youtubePlaceholder,
                      ]}
                      value={youtubeUrl}
                      onChangeText={setYoutubeUrl}
                      placeholder={ui.youtubeUrl}
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus={!editEntry}
                    />
                    <Pressable
                      style={[
                        styles.youtubeOpen,
                        !youtubeUrl.trim() && styles.youtubeOpenDisabled,
                      ]}
                      disabled={!youtubeUrl.trim()}
                      onPress={() => {
                        const url = youtubeUrl.trim();
                        if (url) void Linking.openURL(url);
                      }}
                      accessibilityLabel="Open YouTube"
                      hitSlop={6}
                    >
                      <YouTubeMark size={22} muted={!youtubeUrl.trim()} />
                    </Pressable>
                  </View>

                  <Pressable
                    style={[styles.aiCalcBtn, aiBusy && styles.aiCalcBtnBusy]}
                    onPress={() => void runAiCalc()}
                    disabled={aiBusy || busy}
                    accessibilityLabel={ui.aiCalc}
                    accessibilityState={{ busy: aiBusy, disabled: aiBusy || busy }}
                  >
                    {aiBusy ? (
                      <ActivityIndicator color={colors.accentBlue} size="small" />
                    ) : (
                      <>
                        <Sparkles size={16} color={colors.accentBlue} strokeWidth={2.2} />
                        <YouTubeMark size={16} />
                        <Calculator size={16} color={colors.textPrimary} strokeWidth={2.2} />
                      </>
                    )}
                    <Text style={styles.aiCalcBtnText}>
                      {aiBusy
                        ? youtubeUrl.trim()
                          ? ui.aiCalcBusyVideo
                          : ui.aiCalcBusy
                        : ui.aiCalc}
                    </Text>
                  </Pressable>
                  {aiHint ? (
                    <Text
                      style={[
                        styles.aiHint,
                        aiHint.kind === 'error' && styles.aiHintError,
                        aiHint.kind === 'busy' && styles.aiHintBusy,
                      ]}
                      numberOfLines={aiHint.kind === 'error' ? 4 : 3}
                      accessibilityLiveRegion="polite"
                    >
                      {aiHint.text}
                    </Text>
                  ) : null}

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel} numberOfLines={1}>
                      {ui.saveAsFavorite}
                    </Text>
                    <Switch
                      value={saveAsFav}
                      onValueChange={setSaveAsFav}
                      style={styles.switchCompact}
                    />
                  </View>
                </ScrollView>

                <View style={styles.btns}>
                  {editEntry ? (
                    <Pressable style={styles.btnClear} onPress={handleDelete} disabled={busy}>
                      <Text style={styles.btnClearText}>{ui.delete}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.btnCancel} onPress={onClose} disabled={busy}>
                    <Text style={styles.btnCancelText}>{ui.cancel}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnSave}
                    onPress={() => void handleSave()}
                    disabled={busy}
                  >
                    <Text style={styles.btnSaveText}>{ui.save}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    kav: { flex: 1 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      width: '100%',
      maxWidth: 400,
      maxHeight: '92%',
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 8,
    },
    formWrap: {
      gap: 0,
      maxHeight: '100%',
    },
    formScroll: {
      flexGrow: 0,
      maxHeight: 420,
    },
    formBody: {
      gap: 6,
      paddingBottom: 4,
    },
    fromPastRow: { marginBottom: 2 },
    fromPastBtn: {
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.gridLine,
      alignItems: 'center',
    },
    fromPastBtnText: { fontSize: 13, fontWeight: '700', color: c.textPrimary },
    pickPastWrap: { minHeight: 220, maxHeight: 420 },
    browseDayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 8,
    },
    browseDayBtn: { paddingHorizontal: 8, paddingVertical: 2 },
    browseDayBtnDisabled: { opacity: 0.3 },
    browseDayBtnText: { fontSize: 20, fontWeight: '600', color: c.textPrimary },
    browseDayLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      color: c.textPrimary,
    },
    pastListFlex: { flexGrow: 1, minHeight: 120, maxHeight: 300 },
    pastScroll: { flexGrow: 0 },
    emptyPast: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    pastRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.gridLine,
      backgroundColor: isDark ? c.background : '#FAFAFA',
      marginBottom: 6,
    },
    pastRowPressed: { opacity: 0.75 },
    pastMain: { flex: 1, marginRight: 8 },
    pastTime: { fontSize: 10, color: c.textSecondary },
    pastName: { fontSize: 13, fontWeight: '700', color: c.textPrimary },
    pastMeta: { fontSize: 11, color: c.textSecondary, marginTop: 1 },
    pastCta: { fontSize: 11, fontWeight: '700', color: isDark ? c.accentBlue : '#1E88E5' },
    pastBackBtn: {
      marginTop: 8,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.gridLine,
    },
    pastBackBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
    },
    favSection: { marginBottom: 2 },
    favHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    favScroll: { maxHeight: 36 },
    favChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.gridLine,
      marginRight: 6,
      maxWidth: 120,
      justifyContent: 'center',
      backgroundColor: isDark ? c.background : '#F5F5F5',
    },
    favChipActive: {
      borderColor: isDark ? c.accentGreen : '#43A047',
      backgroundColor: isDark ? 'rgba(67,160,71,0.15)' : '#E8F5E9',
    },
    favChipText: { fontSize: 12, fontWeight: '600', color: c.textPrimary },
    favChipTextActive: { color: isDark ? c.accentGreen : '#2E7D32' },
    inlineLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: c.textSecondary,
      marginBottom: 2,
    },
    input: {
      borderWidth: 1.5,
      borderColor: c.gridLine,
      borderRadius: 12,
      backgroundColor: isDark ? c.background : c.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 15,
      color: c.textPrimary,
    },
    inputCompact: {
      borderWidth: 1.5,
      borderColor: c.gridLine,
      borderRadius: 12,
      backgroundColor: isDark ? c.background : c.surface,
      paddingVertical: 10,
      paddingHorizontal: 10,
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      textAlign: 'center',
    },
    minsKcalRow: {
      flexDirection: 'row',
      gap: 8,
    },
    minsCol: { flex: 1 },
    kcalCol: { flex: 1 },
    loadCol: { flex: 1 },
    loadHint: {
      fontSize: 11,
      color: c.textSecondary,
      marginTop: -2,
      marginBottom: 4,
      lineHeight: 14,
    },
    minutesSliderWrap: { marginTop: -2, marginBottom: -2 },
    minutesSlider: { width: '100%', height: 28 },
    minutesSliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginTop: -4,
    },
    minutesSliderLabel: { fontSize: 10, color: c.textSecondary },
    minutesSliderLabelMid: { fontSize: 10, color: c.textSecondary, fontWeight: '700' },
    youtubeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    youtubeInput: { flex: 1 },
    youtubePlaceholder: { fontStyle: 'italic' },
    youtubeOpen: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,0,0,0.12)' : '#FFEBEE',
    },
    youtubeOpenDisabled: {
      backgroundColor: isDark ? c.background : '#F0F0F0',
      opacity: 0.7,
    },
    aiCalcBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.accentBlue,
      backgroundColor: isDark ? 'rgba(142,155,255,0.12)' : '#EEF2FF',
    },
    aiCalcBtnBusy: { opacity: 0.65 },
    aiCalcBtnText: { fontSize: 13, fontWeight: '700', color: c.textPrimary },
    // Informational status under AI calc — not an action pill.
    aiHint: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? c.textPrimary : c.textSecondary,
      marginTop: 4,
      lineHeight: 17,
    },
    aiHintBusy: {
      color: isDark ? c.textSecondary : c.textSecondary,
    },
    aiHintError: {
      color: isDark ? '#FFCDD2' : '#C62828',
    },
    link: { fontSize: 14, color: isDark ? c.accentBlue : '#1E88E5', fontWeight: '700' },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
      minHeight: 28,
    },
    switchLabel: { flex: 1, fontSize: 13, color: c.textPrimary, fontWeight: '600', marginRight: 8 },
    switchCompact: { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] },
    btns: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.gridLine,
    },
    btnClear: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.accentRed,
      backgroundColor: isDark ? c.background : 'transparent',
      alignItems: 'center',
    },
    btnClearText: { fontSize: 13, color: c.accentRed, fontWeight: '600' },
    btnCancel: {
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.gridLine,
      backgroundColor: isDark ? c.background : 'transparent',
      alignItems: 'center',
    },
    btnCancelText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
    btnSave: {
      paddingVertical: 11,
      paddingHorizontal: 20,
      borderRadius: 14,
      borderWidth: isDark ? 1.5 : 0,
      borderColor: isDark ? c.accentBlue : 'transparent',
      backgroundColor: isDark ? c.background : c.accentBlue,
      alignItems: 'center',
    },
    btnSaveText: { fontSize: 13, fontWeight: '700', color: isDark ? c.accentBlue : '#fff' },
  });
