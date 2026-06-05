/**
 * ChatScreen — full-screen chat modal with mentor AI.
 * First bubble shows the active coach message + action items checklist.
 * FAQ quick questions open from the coach footer (or header when no coach message).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type CoachMessage,
  type ChatMessage,
  type QuickQuestion,
  type MentorType,
  type UserLanguage,
  getCoachMessage,
  saveCoachMessage,
  getChatHistory,
  appendChatMessage,
  clearChatHistory,
  getYesterdaySummary,
  saveYesterdaySummary,
  getQuickQuestions,
  saveQuickQuestions,
  getMacroTarget,
  getUserRules,
} from '../services/TargetService';
import { chatWithMentors, summariseChatDay, isYesterdayQuery, type CoachContext } from '../services/GeminiService';
import { runAutoChecksAndPersist, refreshCoachReview } from '../services/CoachService';
import { getTodayMeals, getMealsForDay, buildMealsAiContext, foodLogDayKey } from '../services/FoodLogService';
import { WellnessColors } from '../theme/wellness';

type Props = {
  visible: boolean;
  onClose: () => void;
  context: CoachContext;
  onCoachMessageUpdated?: (msg: CoachMessage | null) => void;
};

/** Local calendar day — must match FoodLogService day keys (not UTC toISOString). */
function todayKey(): string {
  return foodLogDayKey(Date.now());
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return foodLogDayKey(d.getTime());
}

function actionItemsHeader(done: number, total: number, lang?: UserLanguage | null): string {
  if (lang?.code === 'he') return `משימות · ${done}/${total} הושלמו`;
  if (lang?.code === 'es') return `Tareas · ${done}/${total} hechas`;
  if (lang?.code === 'fr') return `Actions · ${done}/${total} faites`;
  if (lang?.code === 'de') return `Aufgaben · ${done}/${total} erledigt`;
  if (lang?.code === 'ar') return `مهام · ${done}/${total} منجزة`;
  if (lang?.code === 'ru') return `Задачи · ${done}/${total} выполнено`;
  return `Action items · ${done}/${total} done`;
}

function chatBottomInset(bottom: number): number {
  if (bottom > 0) return bottom;
  // Full-screen Modal + edge-to-edge often reports 0 on Samsung; nav bar ~48dp
  return Platform.OS === 'android' ? 48 : 12;
}

async function withYesterdayFoodContext(
  base: CoachContext,
  message: string,
): Promise<CoachContext> {
  const yKey = yesterdayKey();
  const yMeals = await getMealsForDay(yKey);
  const yTotals = yMeals.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.totalKcal,
      protein_g: acc.protein_g + e.totalProtein_g,
      carb_g: acc.carb_g + e.totalCarb_g,
      fat_g: acc.fat_g + e.totalFat_g,
    }),
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
  );
  const includeMealDetail = isYesterdayQuery(message);
  const yMealsCtx = includeMealDetail ? buildMealsAiContext(yMeals) : null;

  return {
    ...base,
    yesterdayDate: yKey,
    yesterdayEaten: yTotals.kcal,
    yesterdayProtein_g: yTotals.protein_g,
    yesterdayCarb_g: yTotals.carb_g,
    yesterdayFat_g: yTotals.fat_g,
    yesterdayMealCount: yMeals.length,
    yesterdayMealsDetail: includeMealDetail ? yMealsCtx?.todayMealsDetail ?? null : null,
  };
}

function refreshBlockedMessage(waitHours: number, minGapHours: number, lang?: UserLanguage | null): string {
  if (lang?.code === 'he') {
    return `ניתן לרענן כל ${minGapHours} שעות. נסו/י שוב בעוד כ-${waitHours} שעות.`;
  }
  return `Reviews are limited to once every ${minGapHours}h. Try again in about ${waitHours}h.`;
}

function chatUiStrings(lang?: UserLanguage | null) {
  if (lang?.code === 'he') {
    return {
      header: '💬 המנטורים שלי',
      placeholder: 'שאל/י את המנטורים…',
      send: 'שלח',
      empty: 'שאל/י את המנטורים על יעדים, ארוחות או התקדמות.',
      thinking: 'המנטורים חושבים…',
      faq: 'שאלות',
      refresh: '↻ רענן',
      refreshTitle: 'מרענן משימות…',
      refreshBlockedTitle: 'עוד מוקדם לרענון',
      clearChat: 'נקה',
      clearTitle: 'לנקות את השיחה?',
      clearMessage: 'כל הודעות היום יימחקו. המשימות למעלה נשארות.',
      cancel: 'ביטול',
      faqTitle: 'שאלות נפוצות',
      faqHint: 'ערכ/י שאלה, לחצ/י → למילוי בשדה, ואז שלח/י. סיום = שמירה.',
      faqAdd: '＋ הוסף שאלה',
      faqDone: 'סיום',
      faqNew: 'שאלה חדשה',
      expand: 'פתח',
      collapse: 'סגור',
      rtl: true,
    };
  }
  return {
    header: '💬 My Mentors',
    placeholder: 'Ask your mentors…',
    send: 'Send',
    empty: 'Ask your mentors anything about your health goals, meals, or progress.',
    thinking: 'Mentors are thinking…',
    faq: 'FAQ',
    refresh: '↻ Refresh',
    refreshTitle: 'Refreshing tasks…',
    refreshBlockedTitle: 'Too soon to refresh',
    clearChat: 'Clear',
    clearTitle: 'Clear today\'s chat?',
    clearMessage: 'All messages from today will be deleted. Action items above stay.',
    cancel: 'Cancel',
    faqTitle: 'Quick questions',
    faqHint: 'Edit a question, tap → to fill the box, then Send. Done saves.',
    faqAdd: '＋ Add question',
    faqDone: 'Done',
    faqNew: 'New question',
    expand: 'Expand',
    collapse: 'Collapse',
    rtl: false,
  };
}

function coachPanelSummary(msg: CoachMessage, lang?: UserLanguage | null): string {
  if (msg.actionItems.length > 0) {
    const done = msg.actionItems.filter((i) => i.done).length;
    return actionItemsHeader(done, msg.actionItems.length, lang);
  }
  const t = msg.text.trim();
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

// ─── Collapsible coach panel (pinned above chat) ─────────────────────────────

function CollapsibleCoachPanel({
  msg,
  lang,
  ui,
  expanded,
  hasChatHistory,
  refreshing,
  onToggleExpanded,
  onToggleItem,
  onRefreshCoach,
  onClearChat,
}: {
  msg: CoachMessage;
  lang?: UserLanguage | null;
  ui: ReturnType<typeof chatUiStrings>;
  expanded: boolean;
  hasChatHistory: boolean;
  refreshing: boolean;
  onToggleExpanded: () => void;
  onToggleItem: (itemId: string) => void;
  onRefreshCoach: () => void;
  onClearChat: () => void;
}) {
  const doneCount = msg.actionItems.filter((i) => i.done).length;
  const total = msg.actionItems.length;
  const summary = coachPanelSummary(msg, lang);

  return (
    <View style={styles.coachPanel}>
      <Pressable style={styles.coachPanelHeader} onPress={onToggleExpanded}>
        <Text style={styles.coachPanelChevron}>{expanded ? '▲' : '▼'}</Text>
        <Text style={[styles.coachPanelSummary, ui.rtl && styles.rtlText]} numberOfLines={1}>
          {summary}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.coachPanelBody}>
          <Text style={[styles.coachBubbleText, ui.rtl && styles.rtlText]}>{msg.text}</Text>
          {msg.actionItems.length > 0 && (
            <View style={styles.actionItemsWrap}>
              <Text style={styles.actionItemsHeader}>
                {actionItemsHeader(doneCount, total, lang)}
              </Text>
              {msg.actionItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.actionItemRow}
                  onPress={() => onToggleItem(item.id)}
                >
                  <Text style={styles.actionItemCheck}>{item.done ? '☑' : '☐'}</Text>
                  <Text
                    style={[styles.actionItemText, item.done && styles.actionItemTextDone, ui.rtl && styles.rtlText]}
                  >
                    {item.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.coachBubbleFooter}>
        <Pressable
          style={styles.coachBubbleAction}
          onPress={onRefreshCoach}
          hitSlop={8}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={WellnessColors.accentBlue} />
          ) : (
            <Text style={styles.coachBubbleActionText}>{ui.refresh}</Text>
          )}
        </Pressable>
        {hasChatHistory ? (
          <Pressable style={styles.coachBubbleAction} onPress={onClearChat} hitSlop={8}>
            <Text style={styles.coachBubbleClearText}>{ui.clearChat}</Text>
          </Pressable>
        ) : (
          <View style={styles.coachBubbleActionSpacer} />
        )}
        <Pressable style={styles.coachBubbleAction} onPress={onToggleExpanded} hitSlop={8}>
          <Text style={styles.coachBubbleActionText}>{expanded ? ui.collapse : ui.expand}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Quick-question bar (tap chip → fills input; Send still required) ────────

function QuickQuestionBar({
  questions,
  ui,
  onPick,
  onEdit,
}: {
  questions: QuickQuestion[];
  ui: ReturnType<typeof chatUiStrings>;
  onPick: (label: string) => void;
  onEdit: () => void;
}) {
  return (
    <View style={styles.quickBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.quickBarScroll}
        style={styles.quickBarList}
      >
        {questions.map((q) => (
          <Pressable
            key={q.id}
            style={styles.quickChip}
            onPress={() => onPick(q.label)}
          >
            <Text style={[styles.quickChipText, ui.rtl && styles.rtlText]} numberOfLines={1}>
              {q.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        style={styles.quickEditBtn}
        onPress={onEdit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={ui.faqTitle}
      >
        <Text style={styles.quickEditBtnText}>{ui.faq}</Text>
      </Pressable>
    </View>
  );
}

// ─── FAQ modal (editable quick questions) ────────────────────────────────────

function FaqModal({
  visible,
  ui,
  questions,
  onClose,
  onSave,
  onPick,
}: {
  visible: boolean;
  ui: ReturnType<typeof chatUiStrings>;
  questions: QuickQuestion[];
  onClose: () => void;
  onSave: (qs: QuickQuestion[]) => void;
  onPick: (label: string) => void;
}) {
  const [draft, setDraft] = useState<QuickQuestion[]>(questions);

  useEffect(() => {
    if (visible) setDraft(questions);
  }, [visible, questions]);

  const updateLabel = (id: string, label: string) => {
    setDraft((prev) => prev.map((q) => (q.id === id ? { ...q, label } : q)));
  };

  const deleteRow = (id: string) => {
    setDraft((prev) => prev.filter((q) => q.id !== id));
  };

  const addRow = () => {
    if (draft.length >= 5) return;
    setDraft((prev) => [...prev, { id: `qq-${Date.now()}`, label: ui.faqNew }]);
  };

  const handlePick = (q: QuickQuestion) => {
    const trimmed = q.label.trim();
    if (!trimmed) return;
    const saved = draft.map((row) => (row.id === q.id ? { ...row, label: trimmed } : row));
    onSave(saved);
    onPick(trimmed);
    onClose();
  };

  const handleDone = () => {
    const cleaned = draft
      .map((q) => ({ ...q, label: q.label.trim() }))
      .filter((q) => q.label.length > 0);
    onSave(cleaned.length > 0 ? cleaned : questions);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.faqOverlay} onPress={onClose}>
        <Pressable style={styles.faqCard} onPress={() => {}}>
          <Text style={[styles.faqTitle, ui.rtl && styles.rtlText]}>{ui.faqTitle}</Text>
          <Text style={[styles.faqHint, ui.rtl && styles.rtlText]}>{ui.faqHint}</Text>
          <ScrollView style={styles.faqList} keyboardShouldPersistTaps="handled">
            {draft.map((q) => (
              <View key={q.id} style={styles.faqRow}>
                <TextInput
                  style={[styles.faqInput, ui.rtl && styles.rtlInput]}
                  value={q.label}
                  onChangeText={(text) => updateLabel(q.id, text)}
                  multiline
                  textAlign={ui.rtl ? 'right' : 'left'}
                />
                <Pressable style={styles.faqSendBtn} onPress={() => handlePick(q)} hitSlop={6}>
                  <Text style={styles.faqSendBtnText}>→</Text>
                </Pressable>
                <Pressable style={styles.faqDeleteBtn} onPress={() => deleteRow(q.id)} hitSlop={6}>
                  <Text style={styles.faqDeleteBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
            {draft.length < 5 ? (
              <Pressable style={styles.faqAddBtn} onPress={addRow}>
                <Text style={styles.faqAddBtnText}>{ui.faqAdd}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          <Pressable style={styles.faqDoneBtn} onPress={handleDone}>
            <Text style={styles.faqDoneBtnText}>{ui.faqDone}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.msgWrap, isUser ? styles.msgWrapUser : styles.msgWrapAI]}>
      <View style={[styles.msgBubble, isUser ? styles.msgBubbleUser : styles.msgBubbleAI]}>
        <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAI]}>
          {msg.text}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ChatScreen({ visible, onClose, context, onCoachMessageUpdated }: Props) {
  const insets = useSafeAreaInsets();
  const [coachMsg, setCoachMsg] = useState<CoachMessage | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<QuickQuestion[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [refreshingCoach, setRefreshingCoach] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const mentorEmojis = context.mentors
    .map((m) => ({ doctor: '🩺', nutritionist: '🥗', coach: '💪' }[m] ?? ''))
    .join('');
  const ui = chatUiStrings(context.lang);

  const loadData = useCallback(async () => {
    const today = todayKey();
    const yesterday = yesterdayKey();

    // Load today's chat history
    const h = await getChatHistory(today);
    setHistory(h);

    // Load coach message and run auto-checks
    const msg = await getCoachMessage();
    const msgLang = msg?.generatedLangCode ?? 'en';
    const userLang = context.lang?.code ?? 'en';
    if (msg && !msg.dismissedAt && msgLang === userLang) {
      const data = {
        todayCarb_g: context.todayCarb_g,
        todayProtein_g: context.todayProtein_g,
        todayEaten: context.todayEaten,
        todayBurn: context.todayBurn,
        mealCount: context.mealCount,
        macroTargetCarb_g: context.macroTarget?.carb_g ?? null,
        macroTargetProtein_g: context.macroTarget?.protein_g ?? null,
      };
      const updated = await runAutoChecksAndPersist(msg, data);
      setCoachMsg(updated);
      onCoachMessageUpdated?.(updated);
    } else {
      setCoachMsg(null);
    }

    // Load quick questions (language-aware defaults)
    const qs = await getQuickQuestions(context.lang);
    setQuestions(qs);

    // Yesterday summary: generate on first open of a new day if needed
    const existingSummary = await getYesterdaySummary();
    if (!existingSummary) {
      const yesterdayHistory = await getChatHistory(yesterday);
      if (yesterdayHistory.length > 0) {
        try {
          const summary = await summariseChatDay(yesterdayHistory);
          if (summary) await saveYesterdaySummary(summary);
        } catch {
          // Non-fatal
        }
      }
    }
  }, [context, onCoachMessageUpdated]);

  useEffect(() => {
    if (visible) {
      void loadData();
    }
  }, [visible, loadData]);

  /** Collapsed when resuming chat; expanded on first open with no messages yet. */
  useEffect(() => {
    if (!visible) return;
    setCoachExpanded(history.length === 0);
  }, [visible, history.length, coachMsg?.id]);

  /** Chat opens at latest message when there is history. */
  useEffect(() => {
    if (!visible || history.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, [visible, history.length, coachMsg?.id]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleClearChat = useCallback(() => {
    Alert.alert(ui.clearTitle, ui.clearMessage, [
      { text: ui.cancel, style: 'cancel' },
      {
        text: ui.clearChat,
        style: 'destructive',
        onPress: async () => {
          await clearChatHistory(todayKey());
          setHistory([]);
        },
      },
    ]);
  }, [ui]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const today = todayKey();
      const userMsg: ChatMessage = { role: 'user', text: trimmed, sentAt: new Date().toISOString() };

      setHistory((prev) => [...prev, userMsg]);
      await appendChatMessage(today, userMsg);
      setInputText('');
      setSending(true);
      scrollToBottom();

      try {
        const yesterdaySummary = await getYesterdaySummary();
        const currentHistory = await getChatHistory(today);

        // Fresh meal log on every send — avoids stale dashboard context
        const meals = await getTodayMeals();
        const mealsCtx = buildMealsAiContext(meals);
        const mealTotals = meals.reduce(
          (acc, e) => ({
            kcal: acc.kcal + e.totalKcal,
            protein_g: acc.protein_g + e.totalProtein_g,
            carb_g: acc.carb_g + e.totalCarb_g,
            fat_g: acc.fat_g + e.totalFat_g,
          }),
          { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
        );
        const freshContext: CoachContext = await withYesterdayFoodContext(
          {
            ...context,
            mealCount: meals.length,
            todayEaten: meals.length > 0 ? mealTotals.kcal : context.todayEaten,
            todayProtein_g: meals.length > 0 ? mealTotals.protein_g : context.todayProtein_g,
            todayCarb_g: meals.length > 0 ? mealTotals.carb_g : context.todayCarb_g,
            todayFat_g: meals.length > 0 ? mealTotals.fat_g : context.todayFat_g,
            lastMealSummary: mealsCtx.lastMealSummary,
            todayMealsDetail: mealsCtx.todayMealsDetail,
          },
          trimmed,
        );

        const replyText = await chatWithMentors(
          trimmed,
          currentHistory.slice(0, -1),
          freshContext,
          yesterdaySummary,
        );
        const aiMsg: ChatMessage = { role: 'assistant', text: replyText, sentAt: new Date().toISOString() };
        setHistory((prev) => [...prev, aiMsg]);
        await appendChatMessage(today, aiMsg);
        scrollToBottom();
      } catch (err) {
        const errMsg: ChatMessage = {
          role: 'assistant',
          text: err instanceof Error ? `Error: ${err.message}` : 'Could not get a response. Try again.',
          sentAt: new Date().toISOString(),
        };
        setHistory((prev) => [...prev, errMsg]);
      } finally {
        setSending(false);
      }
    },
    [sending, context, scrollToBottom]
  );

  const handleToggleActionItem = useCallback(
    async (itemId: string) => {
      if (!coachMsg) return;
      const updated = {
        ...coachMsg,
        actionItems: coachMsg.actionItems.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        ),
      };
      await saveCoachMessage(updated);
      setCoachMsg(updated);
      onCoachMessageUpdated?.(updated);
    },
    [coachMsg, onCoachMessageUpdated]
  );

  const handleSaveQuestions = useCallback(async (qs: QuickQuestion[]) => {
    setQuestions(qs);
    await saveQuickQuestions(qs, context.lang);
  }, [context.lang]);

  const pickQuestion = useCallback((label: string) => {
    setInputText(label.trim());
  }, []);

  const buildFreshContext = useCallback(async (): Promise<CoachContext> => {
    const [meals, macroTarget, userRules] = await Promise.all([
      getTodayMeals(),
      getMacroTarget(),
      getUserRules(),
    ]);
    const mealsCtx = buildMealsAiContext(meals);
    const mealTotals = meals.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.totalKcal,
        protein_g: acc.protein_g + e.totalProtein_g,
        carb_g: acc.carb_g + e.totalCarb_g,
        fat_g: acc.fat_g + e.totalFat_g,
      }),
      { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
    );
    return {
      ...context,
      macroTarget: macroTarget ?? context.macroTarget,
      userRules: userRules ?? context.userRules,
      mealCount: meals.length,
      todayEaten: meals.length > 0 ? mealTotals.kcal : context.todayEaten,
      todayProtein_g: meals.length > 0 ? mealTotals.protein_g : context.todayProtein_g,
      todayCarb_g: meals.length > 0 ? mealTotals.carb_g : context.todayCarb_g,
      todayFat_g: meals.length > 0 ? mealTotals.fat_g : context.todayFat_g,
      lastMealSummary: mealsCtx.lastMealSummary,
      todayMealsDetail: mealsCtx.todayMealsDetail,
    };
  }, [context]);

  const handleRefreshCoach = useCallback(async () => {
    if (refreshingCoach) return;
    setRefreshingCoach(true);
    try {
      const freshContext = await buildFreshContext();
      const event = coachMsg?.triggerEvent ?? 'day-close';
      const result = await refreshCoachReview({ ...freshContext, event }, event);
      if (!result.ok) {
        Alert.alert(
          ui.refreshBlockedTitle,
          refreshBlockedMessage(result.waitHours, result.minGapHours, context.lang),
        );
        return;
      }
      setCoachMsg(result.message);
      setCoachExpanded(true);
      onCoachMessageUpdated?.(result.message);
    } catch (err) {
      Alert.alert(
        ui.refreshBlockedTitle,
        err instanceof Error ? err.message : 'Could not refresh coach message.',
      );
    } finally {
      setRefreshingCoach(false);
    }
  }, [
    refreshingCoach,
    buildFreshContext,
    coachMsg?.triggerEvent,
    ui.refreshBlockedTitle,
    context.lang,
    onCoachMessageUpdated,
  ]);

  if (!visible) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{ui.header}  {mentorEmojis}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {coachMsg ? (
          <CollapsibleCoachPanel
            msg={coachMsg}
            lang={context.lang}
            ui={ui}
            expanded={coachExpanded}
            hasChatHistory={history.length > 0}
            refreshing={refreshingCoach}
            onToggleExpanded={() => setCoachExpanded((v) => !v)}
            onToggleItem={handleToggleActionItem}
            onRefreshCoach={handleRefreshCoach}
            onClearChat={handleClearChat}
          />
        ) : null}

        <FlatList
          ref={listRef}
          style={styles.chatList}
          data={history}
          keyExtractor={(_, index) => `msg-${index}`}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.emptyText, ui.rtl && styles.rtlText]}>{ui.empty}</Text>
          }
        />

        {/* Sending indicator */}
        {sending && (
          <View style={styles.sendingRow}>
            <ActivityIndicator size="small" color={WellnessColors.accentBlue} />
            <Text style={styles.sendingText}>{ui.thinking}</Text>
          </View>
        )}

        {/* Bottom input — pad above system nav bar (Modal often reports inset 0) */}
        <View style={[styles.inputArea, { paddingBottom: chatBottomInset(insets.bottom) }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, ui.rtl && styles.rtlInput]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={ui.placeholder}
              placeholderTextColor={WellnessColors.textSecondary}
              multiline
              maxLength={500}
              returnKeyType="default"
              textAlign={ui.rtl ? 'right' : 'left'}
            />
            <Pressable
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || sending}
            >
              <Text style={styles.sendBtnText}>{ui.send}</Text>
            </Pressable>
          </View>
          <QuickQuestionBar
            questions={questions}
            ui={ui}
            onPick={pickQuestion}
            onEdit={() => setFaqVisible(true)}
          />
        </View>
      </KeyboardAvoidingView>

      <FaqModal
        visible={faqVisible}
        ui={ui}
        questions={questions}
        onClose={() => setFaqVisible(false)}
        onSave={handleSaveQuestions}
        onPick={pickQuestion}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: WellnessColors.background,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
  },
  backBtn: { width: 40 },
  backBtnText: { fontSize: 22, color: WellnessColors.accentBlue },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },

  // Message list
  chatList: { flex: 1 },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyText: {
    color: WellnessColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  rtlText: { writingDirection: 'rtl' },
  rtlInput: { writingDirection: 'rtl' },

  // Coach panel (pinned above chat)
  coachPanel: {
    backgroundColor: '#EAF4FB',
    borderBottomWidth: 1,
    borderBottomColor: '#B3D9F0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  coachPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  coachPanelChevron: {
    fontSize: 12,
    color: WellnessColors.accentBlue,
    fontWeight: '700',
  },
  coachPanelSummary: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  coachPanelBody: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  coachBubbleText: {
    fontSize: 14,
    lineHeight: 21,
    color: WellnessColors.textPrimary,
    fontWeight: '500',
  },
  actionItemsWrap: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#B3D9F0',
    paddingTop: 10,
    gap: 8,
  },
  actionItemsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: WellnessColors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  actionItemCheck: { fontSize: 18, lineHeight: 22 },
  actionItemText: { flex: 1, fontSize: 14, lineHeight: 21, color: WellnessColors.textPrimary },
  actionItemTextDone: { color: WellnessColors.textSecondary, textDecorationLine: 'line-through' },

  coachBubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#B3D9F0',
  },
  coachBubbleAction: { paddingVertical: 4, paddingHorizontal: 2, minWidth: 52 },
  coachBubbleActionSpacer: { minWidth: 52 },
  coachBubbleActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: WellnessColors.accentBlue,
  },
  coachBubbleClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },

  // Chat bubbles
  msgWrap: { marginBottom: 8, flexDirection: 'row' },
  msgWrapUser: { justifyContent: 'flex-end' },
  msgWrapAI: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleUser: { backgroundColor: WellnessColors.accentBlue, borderBottomRightRadius: 4 },
  msgBubbleAI: { backgroundColor: WellnessColors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: WellnessColors.gridLine },
  msgText: { fontSize: 14, lineHeight: 21 },
  msgTextUser: { color: '#fff' },
  msgTextAI: { color: WellnessColors.textPrimary },

  // Sending indicator
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  sendingText: { fontSize: 12, color: WellnessColors.textSecondary },

  // Input area
  inputArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
    paddingTop: 10,
  },

  // FAQ modal
  faqOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  faqCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 16,
    padding: 18,
    maxHeight: '75%',
  },
  faqTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    marginBottom: 6,
  },
  faqHint: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  faqList: { maxHeight: 320 },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  faqInput: {
    flex: 1,
    minHeight: 40,
    backgroundColor: WellnessColors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: WellnessColors.textPrimary,
  },
  faqSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: WellnessColors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqSendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  faqDeleteBtn: { paddingHorizontal: 6, paddingVertical: 8 },
  faqDeleteBtnText: { fontSize: 16, color: WellnessColors.accentRed },
  faqAddBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  faqAddBtnText: { fontSize: 14, fontWeight: '600', color: WellnessColors.accentBlue },
  faqDoneBtn: {
    marginTop: 14,
    backgroundColor: WellnessColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    paddingVertical: 12,
    alignItems: 'center',
  },
  faqDoneBtnText: { fontSize: 15, fontWeight: '700', color: WellnessColors.textPrimary },

  // Text input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: WellnessColors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: WellnessColors.textPrimary,
  },
  sendBtn: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  quickBarList: { flex: 1 },
  quickBarScroll: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  quickChip: {
    maxWidth: 168,
    backgroundColor: WellnessColors.background,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  quickChipText: { fontSize: 12, color: WellnessColors.textPrimary, fontWeight: '500' },
  quickEditBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: WellnessColors.accentBlue,
    backgroundColor: WellnessColors.surface,
  },
  quickEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: WellnessColors.accentBlue,
  },
});
