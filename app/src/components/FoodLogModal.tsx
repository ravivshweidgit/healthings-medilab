/**
 * Food Log Modal — camera / text → Gemini AI → correction chat → save.
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  analyzeFood,
  computeTotals,
  SYSTEM_PROMPT,
  type FoodItem,
  type GeminiTurn,
} from '../services/GeminiService';
import { saveMeal, deleteMeal, type FoodEntry } from '../services/FoodLogService';
import { type UserLanguage } from '../services/TargetService';
import { WellnessColors, cardShadow } from '../theme/wellness';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = 'idle' | 'analyzing' | 'result' | 'saving';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pre-fill timestamp (e.g. when editing an existing entry). */
  initialTimestamp?: number;
  /** Pass an existing entry to open directly in edit/result mode. */
  editEntry?: FoodEntry;
  /** User's preferred language — AI will respond in this language. */
  lang?: UserLanguage | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return '#2E7D32';
  if (c === 'medium') return '#E65100';
  return '#C62828';
}

function macroSummary(items: FoodItem[]): string {
  const t = computeTotals(items);
  return `${Math.round(t.totalKcal)} kcal · P ${t.totalProtein_g.toFixed(0)}g · C ${t.totalCarb_g.toFixed(0)}g · F ${t.totalFat_g.toFixed(0)}g`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FoodLogModal({ visible, onClose, onSaved, initialTimestamp, editEntry, lang }: Props) {
  const [screen, setScreen] = useState<Screen>(() => editEntry ? 'result' : 'idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [afterPhotoBase64, setAfterPhotoBase64] = useState<string | null>(null);
  const [items, setItems] = useState<FoodItem[]>(() => editEntry?.items ?? []);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const [description, setDescription] = useState(() => editEntry ? 'Editing saved meal' : '');
  const [suggestion, setSuggestion] = useState<string | undefined>();
  const [history, setHistory] = useState<GeminiTurn[]>([]);
  const [chatText, setChatText] = useState('');
  const [mealTime, setMealTime] = useState(() => editEntry?.timestamp ?? initialTimestamp ?? Date.now());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>(() => editEntry?.id);
  const chatInputRef = useRef<TextInput>(null);

  // Re-initialise when editEntry changes (e.g. user taps a different chip).
  React.useEffect(() => {
    if (editEntry) {
      setScreen('result');
      setItems(editEntry.items);
      setMealTime(editEntry.timestamp);
      setDescription('Editing saved meal — use the chat to make corrections');
      setEditingId(editEntry.id);
      setChatText('');
      setError(null);
      // Seed history with the existing meal so corrections have full context.
      const seedJson = JSON.stringify({
        items: editEntry.items,
        confidence: 'high',
        description: 'Previously saved meal.',
      });
      setHistory([
        { role: 'user', text: `INSTRUCTIONS:\n${SYSTEM_PROMPT}\n\nConfirm you understand.` },
        { role: 'model', text: '{"items":[],"confidence":"high","description":"Ready to analyze food."}' },
        { role: 'user', text: 'Here is the current meal I already saved. I may want to correct it.' },
        { role: 'model', text: seedJson },
      ]);
    }
  }, [editEntry]);

  const reset = useCallback(() => {
    setScreen('idle');
    setPhotoUri(null);
    setPhotoBase64(null);
    setAfterPhotoUri(null);
    setAfterPhotoBase64(null);
    setItems([]);
    setHistory([]);
    setChatText('');
    setTextPrompt('');
    setError(null);
    setEditingId(undefined);
    setMealTime(initialTimestamp ?? Date.now());
    setShowTimePicker(false);
  }, [initialTimestamp]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const runAnalysis = useCallback(async (
    imageBase64: string | null,
    userText: string,
    hist: GeminiTurn[],
    afterBase64?: string | null,
  ) => {
    setScreen('analyzing');
    setError(null);
    try {
      const { result, updatedHistory } = await analyzeFood(imageBase64, userText, hist, afterBase64, lang);
      setItems(result.items);
      setConfidence(result.confidence);
      setDescription(result.description);
      setSuggestion(result.suggestion);
      setHistory(updatedHistory);
      setScreen('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI analysis failed. Please try again.');
      setScreen('idle');
    }
  }, []);

  const handleCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    const b64 = asset.base64 ?? null;
    setPhotoBase64(b64);
    await runAnalysis(b64, 'What food is in this photo? Give me the macros.', []);
  }, [runAnalysis]);

  const handleGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Gallery permission required', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,   // lower quality for gallery — originals can be very large
      base64: true,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    // Warn if base64 is extremely large (>4MB encoded ≈ ~3MB image) — Gemini has a ~20MB limit
    // but large payloads slow things down significantly.
    const b64 = asset.base64 ?? null;
    if (b64 && b64.length > 4_000_000) {
      Alert.alert('Image too large', 'This photo is very large and may fail. Try a smaller image or use the camera instead.');
    }
    setPhotoUri(asset.uri);
    setPhotoBase64(b64);
    await runAnalysis(b64, 'What food is in this photo? Give me the macros.', []);
  }, [runAnalysis]);

  const handleAfterPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', `Please allow ${source} access in Settings.`);
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const b64 = asset.base64 ?? null;
    setAfterPhotoUri(asset.uri);
    setAfterPhotoBase64(b64);
    await runAnalysis(photoBase64, '', history, b64);
  }, [runAnalysis, photoBase64, history]);

  const handleTextSubmit = useCallback(async () => {
    const text = textPrompt.trim();
    if (!text) return;
    await runAnalysis(null, text, []);
  }, [textPrompt, runAnalysis]);

  const handleCorrection = useCallback(async () => {
    const text = chatText.trim();
    if (!text || screen !== 'result') return;
    setChatText('');
    await runAnalysis(null, text, history);
  }, [chatText, history, screen, runAnalysis]);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    Alert.alert('Delete meal', 'Remove this meal from your log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setScreen('saving');
          await deleteMeal(editingId, mealTime);
          reset();
          onSaved();
        },
      },
    ]);
  }, [editingId, mealTime, reset, onSaved]);

  const handleSave = useCallback(async () => {
    if (items.length === 0) return;
    setScreen('saving');
    const totals = computeTotals(items);
    try {
      await saveMeal({
        id: editingId,
        timestamp: mealTime,
        items,
        totalKcal: Math.round(totals.totalKcal),
        totalProtein_g: Math.round(totals.totalProtein_g * 10) / 10,
        totalCarb_g: Math.round(totals.totalCarb_g * 10) / 10,
        totalFat_g: Math.round(totals.totalFat_g * 10) / 10,
        source: photoBase64 ? 'camera-ai' : history.length > 0 ? 'text-ai' : 'manual',
      });
      reset();
      onSaved();
    } catch (e) {
      setError('Failed to save. Please try again.');
      setScreen('result');
    }
  }, [items, mealTime, photoBase64, history, reset, onSaved]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{editingId ? 'Edit Meal' : 'Log Meal'}</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

            {/* ── IDLE screen ── */}
            {screen === 'idle' && (
              <View style={styles.idleWrap}>
                <View style={styles.photoRow}>
                  <Pressable style={styles.cameraBtn} onPress={handleCamera}>
                    <Text style={styles.cameraBtnIcon}>📷</Text>
                    <Text style={styles.cameraBtnLabel}>Camera</Text>
                  </Pressable>
                  <Pressable style={[styles.cameraBtn, styles.galleryBtn]} onPress={handleGallery}>
                    <Text style={styles.cameraBtnIcon}>🖼</Text>
                    <Text style={styles.cameraBtnLabel}>Gallery</Text>
                  </Pressable>
                </View>

                <Text style={styles.orDivider}>— or describe it —</Text>

                <View style={styles.textInputRow}>
                  <TextInput
                    style={styles.describeInput}
                    placeholder='e.g. "shakshuka with pita" or "100g almonds"'
                    placeholderTextColor={WellnessColors.textSecondary}
                    value={textPrompt}
                    onChangeText={setTextPrompt}
                    onSubmitEditing={handleTextSubmit}
                    returnKeyType="done"
                    multiline={false}
                  />
                  <Pressable
                    style={[styles.sendBtn, !textPrompt.trim() && styles.sendBtnDisabled]}
                    onPress={handleTextSubmit}
                    disabled={!textPrompt.trim()}
                  >
                    <Text style={styles.sendBtnText}>→</Text>
                  </Pressable>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}

            {/* ── ANALYZING screen ── */}
            {screen === 'analyzing' && (
              <View style={styles.analyzingWrap}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
                ) : null}
                <ActivityIndicator color={WellnessColors.accentBlue} size="large" style={{ marginTop: 24 }} />
                <Text style={styles.analyzingLabel}>Analyzing with Gemini AI…</Text>
              </View>
            )}

            {/* ── RESULT screen ── */}
            {(screen === 'result' || screen === 'saving') && (
              <View style={styles.resultWrap}>

                {/* Photo thumbnails */}
                <View style={styles.thumbRow}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoThumbSmall} resizeMode="cover" />
                  ) : null}
                  {afterPhotoUri ? (
                    <Image source={{ uri: afterPhotoUri }} style={styles.photoThumbSmall} resizeMode="cover" />
                  ) : null}
                </View>

                {/* After-meal photo buttons — only if first photo exists and no after photo yet */}
                {photoUri && !afterPhotoUri && screen === 'result' ? (
                  <View style={styles.afterPhotoRow}>
                    <Text style={styles.afterPhotoLabel}>Add after-meal photo to adjust portions:</Text>
                    <View style={styles.afterPhotoBtns}>
                      <Pressable style={styles.afterPhotoBtn} onPress={() => handleAfterPhoto('camera')}>
                        <Text style={styles.afterPhotoBtnText}>📷 Camera</Text>
                      </Pressable>
                      <Pressable style={styles.afterPhotoBtn} onPress={() => handleAfterPhoto('gallery')}>
                        <Text style={styles.afterPhotoBtnText}>🖼 Gallery</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {/* Confidence badge */}
                <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor(confidence) + '20', borderColor: confidenceColor(confidence) + '60' }]}>
                  <Text style={[styles.confidenceText, { color: confidenceColor(confidence) }]}>
                    {confidence === 'high' ? '✓ High confidence' : confidence === 'medium' ? '⚠ Medium confidence' : '⚠ Low confidence'}
                  </Text>
                </View>

                {/* Description */}
                {description ? <Text style={styles.descriptionText}>{description}</Text> : null}

                {/* Food items list */}
                <View style={[styles.itemsCard, cardShadow]}>
                  {items.map((item, i) => (
                    <View key={`item-${i}`} style={[styles.itemRow, i > 0 && styles.itemRowBorder]}>
                      <View style={styles.itemLeft}>
                        <Text style={styles.itemName}>{item.name_local ?? item.name}</Text>
                        <Text style={styles.itemGrams}>{item.grams}g</Text>
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={styles.itemKcal}>{item.kcal} kcal</Text>
                        <Text style={styles.itemMacros}>P {item.protein_g}g · C {item.carb_g}g · F {item.fat_g}g</Text>
                      </View>
                    </View>
                  ))}

                  {/* Total row */}
                  <View style={[styles.itemRow, styles.totalRow]}>
                  <Text style={styles.totalValue}>{macroSummary(items)}</Text>
                  </View>
                </View>

                {/* Suggestion */}
                {suggestion ? (
                  <View style={styles.suggestionBox}>
                    <Text style={styles.suggestionText}>💡 {suggestion}</Text>
                  </View>
                ) : null}

                {/* Chat correction input */}
                <View style={styles.chatRow}>
                  <TextInput
                    ref={chatInputRef}
                    style={styles.chatInput}
                    placeholder='Correct it: "it was bigger", "add a coffee"…'
                    placeholderTextColor={WellnessColors.textSecondary}
                    value={chatText}
                    onChangeText={setChatText}
                    onSubmitEditing={handleCorrection}
                    returnKeyType="send"
                    editable={screen === 'result'}
                  />
                  <Pressable
                    style={[styles.sendBtn, (!chatText.trim() || screen !== 'result') && styles.sendBtnDisabled]}
                    onPress={handleCorrection}
                    disabled={!chatText.trim() || screen !== 'result'}
                  >
                    <Text style={styles.sendBtnText}>→</Text>
                  </Pressable>
                </View>

                {/* Time editor */}
                <Pressable style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.timeLabel}>🕐 Meal time:</Text>
                  <Text style={styles.timeValue}>{formatTime(mealTime)}</Text>
                  <Text style={styles.timeEdit}>Edit</Text>
                </Pressable>
                {showTimePicker && (
                  <DateTimePicker
                    value={new Date(mealTime)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, date) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (date) setMealTime(date.getTime());
                    }}
                  />
                )}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}

          </ScrollView>

          {/* Bottom actions */}
          {(screen === 'result' || screen === 'saving') && (
            <View style={styles.actions}>
              {editingId ? (
                <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={screen === 'saving'}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.saveBtn, screen === 'saving' && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={screen === 'saving'}
              >
                {screen === 'saving'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>✓ Save meal</Text>}
              </Pressable>
              {editingId ? (
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kav: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: WellnessColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: WellnessColors.textSecondary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Idle
  idleWrap: { alignItems: 'center', paddingTop: 16 },
  photoRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cameraBtn: {
    flex: 1,
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    ...cardShadow,
  },
  galleryBtn: {
    backgroundColor: '#7B1FA2',
  },
  cameraBtnIcon: { fontSize: 36 },
  cameraBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  orDivider: {
    color: WellnessColors.textSecondary,
    fontSize: 13,
    marginVertical: 20,
  },
  textInputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  describeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: WellnessColors.surface,
    color: WellnessColors.textPrimary,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: WellnessColors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  // Analyzing
  analyzingWrap: { alignItems: 'center', paddingTop: 24 },
  photoThumb: { width: '100%', height: 200, borderRadius: 16 },
  analyzingLabel: {
    marginTop: 16,
    color: WellnessColors.textSecondary,
    fontSize: 14,
  },

  // Result
  resultWrap: { gap: 12 },
  thumbRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  photoThumbSmall: { width: 72, height: 72, borderRadius: 12 },
  afterPhotoRow: { marginBottom: 10 },
  afterPhotoLabel: { fontSize: 12, color: WellnessColors.textSecondary, marginBottom: 6 },
  afterPhotoBtns: { flexDirection: 'row', gap: 8 },
  afterPhotoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: WellnessColors.progressTrack,
  },
  afterPhotoBtnText: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary },
  confidenceBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confidenceText: { fontSize: 12, fontWeight: '600' },
  descriptionText: {
    color: WellnessColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  itemsCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
  },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: WellnessColors.textPrimary },
  itemGrams: { fontSize: 12, color: WellnessColors.textSecondary },
  itemRight: { alignItems: 'flex-end' },
  itemKcal: { fontSize: 14, fontWeight: '700', color: WellnessColors.textPrimary },
  itemMacros: { fontSize: 11, color: WellnessColors.textSecondary },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: WellnessColors.accentBlue + '40',
    backgroundColor: WellnessColors.iconTintBlue,
  },
  totalLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: WellnessColors.accentBlue },
  totalValue: { fontSize: 13, fontWeight: '700', color: WellnessColors.accentBlue },
  suggestionBox: {
    backgroundColor: WellnessColors.noticeSoftBg,
    borderWidth: 1,
    borderColor: WellnessColors.noticeSoftBorder,
    borderRadius: 12,
    padding: 12,
  },
  suggestionText: { fontSize: 13, color: '#5D4037', lineHeight: 18 },
  chatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: WellnessColors.surface,
    color: WellnessColors.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  timeLabel: { fontSize: 13, color: WellnessColors.textSecondary },
  timeValue: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary },
  timeEdit: { fontSize: 12, color: WellnessColors.accentBlue, marginLeft: 4 },

  // Error
  errorText: {
    color: WellnessColors.accentRed,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },

  // Actions bar
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: WellnessColors.textSecondary },
  deleteBtn: {
    width: 52,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18 },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: WellnessColors.accentGreen,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
