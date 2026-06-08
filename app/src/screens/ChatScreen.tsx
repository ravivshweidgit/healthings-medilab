/**
 * ChatScreen — full-screen chat modal with mentor AI.
 * First bubble shows the active coach message + action items checklist.
 * FAQ quick questions open from the coach footer (or header when no coach message).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type CoachMessage,
  type CoachActionItem,
  type ChatMessage,
  type Gender,
  type QuickQuestion,
  type MentorType,
  type UserLanguage,
  getCoachMessage,
  saveCoachMessage,
  getChatHistory,
  getAllChatHistories,
  hasAnyChatHistory,
  appendChatMessage,
  clearChatHistory,
  getYesterdaySummary,
  saveYesterdaySummary,
  getQuickQuestions,
  saveQuickQuestions,
  getMacroTarget,
  getUserRules,
  MENTOR_CHAT_TAB_ORDER,
} from '../services/TargetService';
import { chatWithMentor, summariseChatDay, isYesterdayQuery, type CoachContext } from '../services/GeminiService';
import { runAutoChecksAndPersist, refreshCoachReview, forceCoachReview } from '../services/CoachService';
import { exportMentorChat } from '../services/mentorChatExport';
import { normalizeMentorChatText, buildMentorDisplaySegments, mentorBubbleColors, hasSeparateMentorVoices } from '../logic/mentorChatText';
import type { MentorLines } from '../logic/mentorChatText';
import { activeMentorEmojis, mentorPossessiveLabel, mentorsCollectiveLabel, MENTOR_EMOJI } from '../logic/mentorLabels';
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

function actionItemsHeader(done: number, total: number, _lang?: UserLanguage | null): string {
  return `${done}/${total}`;
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

function chatUiStrings(context: CoachContext) {
  const { lang, mentors, mentorGender, gender: userGender } = context;
  const collective = mentorsCollectiveLabel(lang, mentorGender, userGender as Gender | null);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  if (lang?.code === 'he') {
    return {
      header: collective,
      placeholder: `שאל/י את ${collective}…`,
      send: 'שלח',
      empty: `שאל/י את ${collective} על יעדים, ארוחות או התקדמות.`,
      thinking: `${collective} חושבים…`,
      faq: 'שאלות',
      refresh: '↻ רענן',
      refreshTitle: 'מרענן משימות…',
      refreshBlockedTitle: 'עוד מוקדם לרענון',
      clearChat: 'נקה',
      clearTitle: 'לנקות את השיחה?',
      clearMessage: 'כל הודעות היום יימחקו. המשימות למעלה נשארות.',
      cancel: 'ביטול',
      faqTitle: 'שאלות מהירות',
      faqHint: 'ערכ/י, הוסף/י או מחק/י שאלות. לחצ/י → לשליחה מיידית.',
      faqAdd: 'הוסף שאלה',
      faqDone: 'סיום',
      faqSave: 'שמירה',
      faqNew: '',
      winsLabel: 'מה הולך טוב',
      improveLabel: 'מה לשפר',
      expand: 'פתח',
      collapse: 'סגור',
      exportChat: 'ייצוא',
      exportEmptyTitle: 'אין מה לייצא',
      exportEmptyMessage: 'אין משימות או הודעות שיחה להיום.',
      exportDoneTitle: 'נשמר',
      exportDoneMessage: 'קובץ HTML נשמר בתיקייה שבחרת — פתח/י בדפדפן לעברית נכונה.',
      scrollTop: 'גלול למעלה',
      scrollBottom: 'גלול למטה',
      rtl,
    };
  }
  if (lang?.code === 'ar') {
    return {
      header: collective,
      placeholder: `اسأل ${collective}…`,
      send: 'إرسال',
      empty: `اسأل ${collective} عن أهدافك أو وجباتك أو تقدمك.`,
      thinking: `${collective} يفكرون…`,
      faq: 'أسئلة',
      refresh: '↻ تحديث',
      refreshTitle: 'جاري تحديث المهام…',
      refreshBlockedTitle: 'مبكر للتحديث',
      clearChat: 'مسح',
      clearTitle: 'مسح محادثة اليوم؟',
      clearMessage: 'ستُحذف جميع رسائل اليوم. المهام أعلاه تبقى.',
      cancel: 'إلغاء',
      faqTitle: 'أسئلة سريعة',
      faqHint: 'حرّر أو أضف أو احذف الأسئلة. اضغط → للإرسال فوراً.',
      faqAdd: 'إضافة سؤال',
      faqDone: 'تم',
      faqSave: 'حفظ',
      faqNew: '',
      winsLabel: 'ما يسير جيداً',
      improveLabel: 'ما يمكن تحسينه',
      expand: 'فتح',
      collapse: 'إغلاق',
      exportChat: 'تصدير',
      exportEmptyTitle: 'لا يوجد ما يُصدَّر',
      exportEmptyMessage: 'لا مهام أو رسائل لليوم بعد.',
      exportDoneTitle: 'تم الحفظ',
      exportDoneMessage: 'تم حفظ HTML — افتح في المتصفح.',
      scrollTop: 'الانتقال للأعلى',
      scrollBottom: 'الانتقال للأسفل',
      rtl: true,
    };
  }
  return {
    header: collective,
    placeholder: `Ask ${collective.toLowerCase()}…`,
    send: 'Send',
    empty: `Ask ${collective.toLowerCase()} anything about your health goals, meals, or progress.`,
    thinking: `${collective} are thinking…`,
    faq: 'FAQ',
    refresh: '↻ Refresh',
    refreshTitle: 'Refreshing tasks…',
    refreshBlockedTitle: 'Too soon to refresh',
    clearChat: 'Clear',
    clearTitle: 'Clear today\'s chat?',
    clearMessage: 'All messages from today will be deleted. Action items above stay.',
    cancel: 'Cancel',
    faqTitle: 'Quick questions',
    faqHint: 'Edit, add, or delete questions. Tap → to send one now.',
    faqAdd: 'Add question',
    faqDone: 'Done',
    faqSave: 'Save',
    faqNew: '',
    winsLabel: 'What\'s going well',
    improveLabel: 'What to improve',
    expand: 'Expand',
    collapse: 'Collapse',
    exportChat: 'Export',
    exportEmptyTitle: 'Nothing to export',
    exportEmptyMessage: 'No action items or chat messages for today yet.',
    exportDoneTitle: 'Saved',
    exportDoneMessage: 'HTML file saved — open in a browser for proper layout.',
    scrollTop: 'Scroll to top',
    scrollBottom: 'Scroll to bottom',
    rtl,
  };
}

function mentorTabStrings(mentor: MentorType, context: CoachContext) {
  const label = mentorPossessiveLabel(
    mentor,
    context.lang,
    context.mentorGender,
    context.gender as Gender | null,
  );
  const code = context.lang?.code ?? 'en';
  if (code === 'he') {
    return {
      placeholder: `שאל/י את ${label}…`,
      empty: `שאל/י את ${label} על יעדים, ארוחות או התקדמות.`,
      thinking: `${label} חושב/ת…`,
      clearMessage: `כל הודעות ${label} להיום יימחקו. המשימות למעלה נשארות.`,
    };
  }
  if (code === 'ar') {
    return {
      placeholder: `اسأل ${label}…`,
      empty: `اسأل ${label} عن أهدافك أو وجباتك أو تقدمك.`,
      thinking: `${label} يفكر…`,
      clearMessage: `ستُحذف جميع رسائل ${label} لليوم. المهام أعلاه تبقى.`,
    };
  }
  return {
    placeholder: `Ask ${label}…`,
    empty: `Ask ${label} about your goals, meals, or progress.`,
    thinking: `${label} is thinking…`,
    clearMessage: `All messages with ${label} today will be deleted. Action items above stay.`,
  };
}

function orderedActiveMentors(mentors: MentorType[]): MentorType[] {
  return MENTOR_CHAT_TAB_ORDER.filter((m) => mentors.includes(m));
}

function coachPanelSummary(msg: CoachMessage, lang?: UserLanguage | null): string {
  if (msg.actionItems.length > 0) {
    const done = msg.actionItems.filter((i) => i.done).length;
    return actionItemsHeader(done, msg.actionItems.length, lang);
  }
  const t = msg.text.trim();
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

/** prompt25 — a coach message uses the new structured layout if it carries any structured field. */
function isStructuredCoach(msg: CoachMessage): boolean {
  return Boolean(
    msg.summary?.trim() ||
    (msg.wins && Object.keys(msg.wins).length > 0) ||
    (msg.improve && Object.keys(msg.improve).length > 0) ||
    msg.actionItems.some((i) => i.mentor),
  );
}

function truncateOneLine(text: string, max = 72): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** prompt25 — one mentor's block: header, wins, improve, action items. */
function CoachMentorSection({
  mentor,
  wins,
  improve,
  items,
  lang,
  mentorGender,
  userGender,
  ui,
  onToggleItem,
}: {
  mentor: MentorType;
  wins?: string[];
  improve?: string[];
  items: CoachActionItem[];
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
  userGender?: Gender | null;
  ui: ReturnType<typeof chatUiStrings>;
  onToggleItem: (itemId: string) => void;
}) {
  const hasWins = (wins?.length ?? 0) > 0;
  const hasImprove = (improve?.length ?? 0) > 0;
  if (!hasWins && !hasImprove && items.length === 0) return null;

  return (
    <View style={styles.coachMentorSection}>
      <Text style={[styles.coachMentorHeader, ui.rtl && styles.rtlText]}>
        {`${MENTOR_EMOJI[mentor]} ${mentorPossessiveLabel(mentor, lang, mentorGender, userGender)}`}
      </Text>

      {hasWins ? (
        <View style={styles.coachSubBlock}>
          <Text style={[styles.coachSubLabel, ui.rtl && styles.rtlText]}>{ui.winsLabel}</Text>
          {wins!.map((w, i) => (
            <View key={`w-${i}`} style={[styles.coachBulletRow, ui.rtl && styles.coachBulletRowRtl]}>
              <Text style={styles.coachBulletWin}>✓</Text>
              <Text style={[styles.coachBulletText, ui.rtl && styles.rtlText]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {hasImprove ? (
        <View style={styles.coachSubBlock}>
          <Text style={[styles.coachSubLabel, ui.rtl && styles.rtlText]}>{ui.improveLabel}</Text>
          {improve!.map((w, i) => (
            <View key={`i-${i}`} style={[styles.coachBulletRow, ui.rtl && styles.coachBulletRowRtl]}>
              <Text style={styles.coachBulletImprove}>↑</Text>
              <Text style={[styles.coachBulletText, ui.rtl && styles.rtlText]}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {items.map((item) => (
        <Pressable key={item.id} style={styles.actionItemRow} onPress={() => onToggleItem(item.id)}>
          <Text style={styles.actionItemCheck}>{item.done ? '☑' : '☐'}</Text>
          <Text style={[styles.actionItemText, item.done && styles.actionItemTextDone, ui.rtl && styles.rtlText]}>
            {item.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Collapsible coach panel (pinned above chat) ─────────────────────────────

function CollapsibleCoachPanel({
  msg,
  lang,
  mentorGender,
  userGender,
  activeMentors,
  ui,
  expanded,
  refreshing,
  onToggleExpanded,
  onToggleItem,
  onRefreshCoach,
}: {
  msg: CoachMessage;
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
  userGender?: Gender | null;
  activeMentors: MentorType[];
  ui: ReturnType<typeof chatUiStrings>;
  expanded: boolean;
  refreshing: boolean;
  onToggleExpanded: () => void;
  onToggleItem: (itemId: string) => void;
  onRefreshCoach: () => void;
}) {
  const doneCount = msg.actionItems.filter((i) => i.done).length;
  const total = msg.actionItems.length;
  const structured = isStructuredCoach(msg);
  const headerText = msg.summary?.trim() ? truncateOneLine(msg.summary) : coachPanelSummary(msg, lang);
  const untaggedItems = msg.actionItems.filter((i) => !i.mentor || !activeMentors.includes(i.mentor));

  return (
    <View style={styles.coachPanel}>
      <Pressable style={styles.coachPanelHeader} onPress={onToggleExpanded}>
        <Text style={styles.coachPanelChevron}>{expanded ? '▲' : '▼'}</Text>
        <Text style={[styles.coachPanelSummary, ui.rtl && styles.rtlText]} numberOfLines={1}>
          {headerText}
        </Text>
        {total > 0 ? (
          <View style={styles.coachPanelCountBadge}>
            <Text style={styles.coachPanelCountText}>{`${doneCount}/${total}`}</Text>
          </View>
        ) : null}
      </Pressable>

      {expanded ? (
        <ScrollView
          style={styles.coachPanelScroll}
          contentContainerStyle={styles.coachPanelBody}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {structured ? (
            <>
              {msg.summary?.trim() ? (
                <Text style={[styles.coachSummaryText, ui.rtl && styles.rtlText]}>{msg.summary.trim()}</Text>
              ) : null}
              {activeMentors.map((m) => (
                <CoachMentorSection
                  key={m}
                  mentor={m}
                  wins={msg.wins?.[m]}
                  improve={msg.improve?.[m]}
                  items={msg.actionItems.filter((i) => i.mentor === m)}
                  lang={lang}
                  mentorGender={mentorGender}
                  userGender={userGender}
                  ui={ui}
                  onToggleItem={onToggleItem}
                />
              ))}
              {untaggedItems.length > 0 ? (
                <View style={styles.coachMentorSection}>
                  {untaggedItems.map((item) => (
                    <Pressable key={item.id} style={styles.actionItemRow} onPress={() => onToggleItem(item.id)}>
                      <Text style={styles.actionItemCheck}>{item.done ? '☑' : '☐'}</Text>
                      <Text style={[styles.actionItemText, item.done && styles.actionItemTextDone, ui.rtl && styles.rtlText]}>
                        {item.text}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <MentorVoiceSegments
                text={msg.text}
                mentorLines={msg.mentorLines}
                activeMentors={activeMentors}
                lang={lang}
                mentorGender={mentorGender}
                userGender={userGender}
                rtl={ui.rtl}
                variant="coach"
              />
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
            </>
          )}
        </ScrollView>
      ) : null}

      <View style={styles.coachBubbleFooter}>
        <Pressable
          style={styles.coachBubbleActionFlex}
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
        <Pressable style={styles.coachBubbleActionFlex} onPress={onToggleExpanded} hitSlop={8}>
          <Text style={styles.coachBubbleActionText}>{expanded ? ui.collapse : ui.expand}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MentorTabBar({
  mentors,
  active,
  onSelect,
  lang,
  mentorGender,
  userGender,
  rtl,
}: {
  mentors: MentorType[];
  active: MentorType;
  onSelect: (m: MentorType) => void;
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
  userGender?: Gender | null;
  rtl?: boolean;
}) {
  const tabs = orderedActiveMentors(mentors);
  if (tabs.length === 0) return null;

  return (
    <View style={styles.tabBarPinned}>
      {tabs.map((m, index) => {
        const selected = m === active;
        const colors = mentorBubbleColors(m);
        return (
          <Pressable
            key={m}
            style={[
              styles.tabBtnPinned,
              index > 0 && styles.tabBtnPinnedGap,
              selected && {
                backgroundColor: colors.backgroundColor,
                borderColor: colors.borderColor,
              },
            ]}
            onPress={() => onSelect(m)}
            disabled={tabs.length === 1}
          >
            <Text
              style={[styles.tabBtnText, selected && styles.tabBtnTextActive, rtl && styles.rtlText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {`${MENTOR_EMOJI[m]} ${mentorPossessiveLabel(m, lang, mentorGender, userGender)}`}
            </Text>
          </Pressable>
        );
      })}
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

const MAX_QUICK_QUESTIONS = 5;

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
  // Rows hold the structure (ids); live text lives in a ref so re-renders never revert
  // what the user types. Inputs are uncontrolled (defaultValue) keyed by id.
  const [rows, setRows] = useState<QuickQuestion[]>(questions);
  const textRef = useRef<Record<string, string>>({});
  const seededRef = useRef(false);
  const [kbHeight, setKbHeight] = useState(0);

  // Seed once on open (rising edge of visible) — never re-sync while editing.
  useEffect(() => {
    if (visible && !seededRef.current) {
      setRows(questions);
      textRef.current = Object.fromEntries(questions.map((q) => [q.id, q.label]));
      seededRef.current = true;
    } else if (!visible) {
      seededRef.current = false;
    }
  }, [visible, questions]);

  useEffect(() => {
    if (!visible) {
      setKbHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => setKbHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKbHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      backSub.remove();
    };
  }, [visible, onClose]);

  const setText = (id: string, text: string) => {
    textRef.current[id] = text;
  };

  const deleteRow = (id: string) => {
    delete textRef.current[id];
    setRows((prev) => prev.filter((q) => q.id !== id));
  };

  const addRow = () => {
    setRows((prev) => {
      if (prev.length >= MAX_QUICK_QUESTIONS) return prev;
      const id = `qq-${Date.now()}`;
      textRef.current[id] = '';
      return [...prev, { id, label: '' }];
    });
  };

  const collect = (): QuickQuestion[] =>
    rows
      .map((r) => ({ id: r.id, label: (textRef.current[r.id] ?? '').trim() }))
      .filter((r) => r.label.length > 0);

  const handlePick = (id: string) => {
    const trimmed = (textRef.current[id] ?? '').trim();
    if (!trimmed) return;
    onSave(collect());
    onPick(trimmed);
    onClose();
  };

  const handleDone = () => {
    const cleaned = collect();
    onSave(cleaned.length > 0 ? cleaned : questions);
    onClose();
  };

  if (!visible) return null;

  // Overlay inside the chat screen — NOT a nested <Modal>. Chat already lives in a
  // full-screen Modal on Dashboard; a second Modal breaks TextInput / Pressable on Android.
  return (
    <View style={styles.faqOverlayRoot} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
      <View
        style={[styles.faqOverlayInner, kbHeight > 0 && { paddingBottom: kbHeight + 12 }]}
        pointerEvents="box-none"
      >
        <View style={styles.faqCard}>
          <View style={[styles.faqHeader, ui.rtl && styles.faqHeaderRtl]}>
            <Text style={[styles.faqTitle, ui.rtl && styles.rtlText]}>{ui.faqTitle}</Text>
            <View style={styles.faqCountBadge}>
              <Text style={styles.faqCountText}>{`${rows.length}/${MAX_QUICK_QUESTIONS}`}</Text>
            </View>
          </View>
          <Text style={[styles.faqHint, ui.rtl && styles.rtlText]}>{ui.faqHint}</Text>

          <ScrollView
            style={styles.faqList}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            nestedScrollEnabled
          >
            {rows.map((q, idx) => (
              <View key={q.id} style={[styles.faqRow, ui.rtl && styles.faqRowRtl]}>
                <View style={styles.faqNumber}>
                  <Text style={styles.faqNumberText}>{idx + 1}</Text>
                </View>
                <TextInput
                  style={[styles.faqInput, ui.rtl && styles.rtlInput]}
                  defaultValue={q.label}
                  onChangeText={(text) => setText(q.id, text)}
                  placeholder={ui.faqAdd}
                  placeholderTextColor={WellnessColors.textSecondary}
                  multiline
                  textAlign={ui.rtl ? 'right' : 'left'}
                />
                <Pressable
                  style={styles.faqSendBtn}
                  onPress={() => handlePick(q.id)}
                  hitSlop={8}
                  accessibilityLabel={ui.send}
                >
                  <Text style={styles.faqSendBtnText}>{ui.rtl ? '←' : '→'}</Text>
                </Pressable>
                <Pressable
                  style={styles.faqDeleteBtn}
                  onPress={() => deleteRow(q.id)}
                  hitSlop={8}
                  accessibilityLabel="Delete"
                >
                  <Text style={styles.faqDeleteBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
            {rows.length < MAX_QUICK_QUESTIONS ? (
              <Pressable style={styles.faqAddBtn} onPress={addRow}>
                <Text style={styles.faqAddPlus}>＋</Text>
                <Text style={styles.faqAddBtnText}>{ui.faqAdd}</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={[styles.faqFooter, ui.rtl && styles.faqHeaderRtl]}>
            <Pressable style={styles.faqCancelBtn} onPress={onClose} hitSlop={6}>
              <Text style={styles.faqCancelBtnText}>{ui.cancel}</Text>
            </Pressable>
            <Pressable style={styles.faqSaveBtn} onPress={handleDone} hitSlop={6}>
              <Text style={styles.faqSaveBtnText}>{ui.faqSave}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function MentorVoiceSegments({
  text,
  mentorLines,
  activeMentors,
  lang,
  mentorGender,
  userGender,
  rtl,
  variant,
}: {
  text: string;
  mentorLines?: MentorLines;
  activeMentors: MentorType[];
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
  userGender?: Gender | null;
  rtl?: boolean;
  variant: 'chat' | 'coach';
}) {
  const segments = buildMentorDisplaySegments(text, mentorLines, activeMentors);
  const multiVoice = hasSeparateMentorVoices(text, mentorLines, activeMentors);
  const textStyle = variant === 'chat' ? styles.msgTextAI : styles.coachBubbleText;
  const labelStyle = variant === 'chat' ? styles.mentorSegmentLabel : styles.mentorSegmentLabelCoach;

  if (!multiVoice) {
    return (
      <Text style={[textStyle, rtl && styles.rtlText]}>
        {segments[0]?.text ?? normalizeMentorChatText(text)}
      </Text>
    );
  }

  return (
    <View style={variant === 'chat' ? styles.mentorVoiceStack : undefined}>
      {segments.map((seg, i) => {
        const colors = mentorBubbleColors(seg.mentor);
        const cardStyle = variant === 'chat' ? styles.msgBubble : styles.coachSegmentCard;
        return (
          <View
            key={`seg-${i}`}
            style={[
              cardStyle,
              {
                backgroundColor: colors.backgroundColor,
                borderColor: colors.borderColor,
                borderWidth: 1,
              },
              variant === 'chat' && styles.msgBubbleAI,
            ]}
          >
            {seg.mentor ? (
              <Text style={[labelStyle, rtl && styles.rtlText]}>
                {`${seg.emoji ?? ''} ${mentorPossessiveLabel(seg.mentor, lang, mentorGender, userGender)}`.trim()}
              </Text>
            ) : null}
            <Text style={[textStyle, rtl && styles.rtlText]}>{seg.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  mentor,
  rtl,
}: {
  msg: ChatMessage;
  mentor: MentorType;
  rtl?: boolean;
}) {
  const isUser = msg.role === 'user';
  const colors = mentorBubbleColors(mentor);

  if (isUser) {
    return (
      <View style={[styles.msgWrap, styles.msgWrapUser]}>
        <View style={[styles.msgBubble, styles.msgBubbleUser]}>
          <Text style={[styles.msgText, styles.msgTextUser, rtl && styles.rtlText]}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.msgWrap, styles.msgWrapAI]}>
      <View
        style={[
          styles.msgBubble,
          styles.msgBubbleAI,
          { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor },
        ]}
      >
        <Text style={[styles.msgTextAI, rtl && styles.rtlText]}>{msg.text}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ChatScreen({ visible, onClose, context, onCoachMessageUpdated }: Props) {
  const insets = useSafeAreaInsets();
  const mentorTabs = useMemo(() => orderedActiveMentors(context.mentors), [context.mentors]);
  const [activeMentor, setActiveMentor] = useState<MentorType>(mentorTabs[0] ?? 'coach');
  const [coachMsg, setCoachMsg] = useState<CoachMessage | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<QuickQuestion[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [refreshingCoach, setRefreshingCoach] = useState(false);
  const [anyChatHistory, setAnyChatHistory] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  /** Guards the one-shot coach auto-regen per chat open (avoids API spam on repeated failures). */
  const coachAutoRegenRef = useRef(false);

  const ui = chatUiStrings(context);
  const tabUi = mentorTabStrings(activeMentor, context);

  useEffect(() => {
    if (mentorTabs.length > 0 && !mentorTabs.includes(activeMentor)) {
      setActiveMentor(mentorTabs[0]!);
    }
  }, [mentorTabs, activeMentor]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    };
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const loadHistoryForMentor = useCallback(async (mentor: MentorType) => {
    const h = await getChatHistory(todayKey(), mentor);
    setHistory(h);
    return h;
  }, []);

  const refreshAnyChatFlag = useCallback(async () => {
    setAnyChatHistory(await hasAnyChatHistory(todayKey(), context.mentors));
  }, [context.mentors]);

  const loadData = useCallback(async () => {
    const today = todayKey();
    const yesterday = yesterdayKey();

    await refreshAnyChatFlag();

    // Load coach message and run auto-checks
    const msg = await getCoachMessage();
    const msgLang = msg?.generatedLangCode ?? 'en';
    const userLang = context.lang?.code ?? 'en';
    if (msg && msgLang === userLang) {
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
      // Auto-recover: a transient generation failure (e.g. a failed day-close
      // regen after midnight, or a stale-language message that was cleared but
      // not replaced) can leave no valid coach message — so the panel + action
      // items vanish until the next trigger. Regenerate once per open so they
      // come back without needing an app restart. forceCoachReview bypasses the
      // min-gap gate because there is currently nothing to show.
      if (!coachAutoRegenRef.current) {
        coachAutoRegenRef.current = true;
        try {
          const event = msg?.triggerEvent ?? 'day-close';
          const regenerated = await forceCoachReview({ ...context, event });
          setCoachMsg(regenerated);
          onCoachMessageUpdated?.(regenerated);
        } catch {
          // Non-fatal: leave the panel empty; manual ↻ refresh stays available.
        }
      }
    }

    // Load quick questions (language-aware defaults)
    const qs = await getQuickQuestions(context.lang);
    setQuestions(qs);

    // Yesterday summary: generate on first open of a new day if needed
    const existingSummary = await getYesterdaySummary();
    if (!existingSummary) {
      const yesterdayHistories = await getAllChatHistories(yesterday, context.mentors);
      const yesterdayHistory = Object.values(yesterdayHistories).flat();
      if (yesterdayHistory.length > 0) {
        try {
          const summary = await summariseChatDay(yesterdayHistory);
          if (summary) await saveYesterdaySummary(summary);
        } catch {
          // Non-fatal
        }
      }
    }
  }, [context, onCoachMessageUpdated, refreshAnyChatFlag]);

  useEffect(() => {
    if (visible) {
      void loadData();
    }
  }, [visible, loadData]);

  useEffect(() => {
    if (!visible) return;
    void loadHistoryForMentor(activeMentor);
  }, [visible, activeMentor, loadHistoryForMentor]);

  /** Coach panel starts collapsed so bottom tabs/input stay visible. */
  useEffect(() => {
    if (!visible) return;
    setCoachExpanded(false);
    coachAutoRegenRef.current = false; // allow one auto-regen attempt per open
  }, [visible]);

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

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const canScrollChat = history.length > 0 || coachMsg != null;
  const canClearChat = history.length > 0;
  const canExportChat = anyChatHistory || coachMsg != null;

  const handleClearChat = useCallback(() => {
    Alert.alert(ui.clearTitle, tabUi.clearMessage, [
      { text: ui.cancel, style: 'cancel' },
      {
        text: ui.clearChat,
        style: 'destructive',
        onPress: async () => {
          await clearChatHistory(todayKey(), context.mentors, activeMentor);
          setHistory([]);
          await refreshAnyChatFlag();
        },
      },
    ]);
  }, [ui, tabUi.clearMessage, context.mentors, activeMentor, refreshAnyChatFlag]);

  const handleExportChat = useCallback(async () => {
    const historyByMentor = await getAllChatHistories(todayKey(), context.mentors);
    const hasHistory = Object.values(historyByMentor).some((h) => (h?.length ?? 0) > 0);
    if (!coachMsg && !hasHistory) {
      Alert.alert(ui.exportEmptyTitle, ui.exportEmptyMessage);
      return;
    }
    try {
      const saved = await exportMentorChat({
        dayKey: todayKey(),
        mentors: context.mentors,
        coachMsg,
        historyByMentor,
        lang: context.lang,
        mentorGender: context.mentorGender,
      });
      if (saved) {
        Alert.alert(ui.exportDoneTitle, ui.exportDoneMessage);
      }
    } catch (err) {
      Alert.alert(
        ui.exportEmptyTitle,
        err instanceof Error ? err.message : 'Export failed',
      );
    }
  }, [coachMsg, context.mentors, context.lang, context.mentorGender, ui]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const today = todayKey();
      const userMsg: ChatMessage = { role: 'user', text: trimmed, sentAt: new Date().toISOString() };

      setHistory((prev) => [...prev, userMsg]);
      await appendChatMessage(today, activeMentor, userMsg);
      setAnyChatHistory(true);
      setInputText('');
      setSending(true);
      scrollToBottom();

      try {
        const yesterdaySummary = await getYesterdaySummary();
        const currentHistory = await getChatHistory(today, activeMentor);

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

        const replyText = await chatWithMentor(
          activeMentor,
          trimmed,
          currentHistory.slice(0, -1),
          freshContext,
          yesterdaySummary,
        );
        const aiMsg: ChatMessage = {
          role: 'assistant',
          text: replyText,
          sentAt: new Date().toISOString(),
        };
        setHistory((prev) => [...prev, aiMsg]);
        await appendChatMessage(today, activeMentor, aiMsg);
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
    [sending, context, activeMentor, scrollToBottom]
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
        <Text style={[styles.headerTitle, ui.rtl && styles.rtlText]} numberOfLines={1}>
          {`${activeMentorEmojis(context.mentors)} ${ui.header}`}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.flex, styles.minHeight0]}>
        <View style={[styles.flex, styles.minHeight0]}>
          <FlatList
            ref={listRef}
            style={[styles.chatList, styles.minHeight0]}
            data={history}
            keyExtractor={(_, index) => `msg-${index}`}
            ListHeaderComponent={
              coachMsg ? (
                <CollapsibleCoachPanel
                  msg={coachMsg}
                  lang={context.lang}
                  mentorGender={context.mentorGender}
                  userGender={context.gender as Gender | null}
                  activeMentors={context.mentors}
                  ui={ui}
                  expanded={coachExpanded}
                  refreshing={refreshingCoach}
                  onToggleExpanded={() => setCoachExpanded((v) => !v)}
                  onToggleItem={handleToggleActionItem}
                  onRefreshCoach={handleRefreshCoach}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <MessageBubble msg={item} mentor={activeMentor} rtl={ui.rtl} />
            )}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.emptyText, ui.rtl && styles.rtlText]}>{tabUi.empty}</Text>
            }
          />

          <View
            style={[
              styles.bottomChrome,
              keyboardHeight > 0 && { marginBottom: keyboardHeight },
            ]}
          >
            {sending ? (
              <View style={styles.sendingRow}>
                <ActivityIndicator size="small" color={WellnessColors.accentBlue} />
                <Text style={styles.sendingText}>{tabUi.thinking}</Text>
              </View>
            ) : null}

            <MentorTabBar
              mentors={context.mentors}
              active={activeMentor}
              onSelect={setActiveMentor}
              lang={context.lang}
              mentorGender={context.mentorGender}
              userGender={context.gender as Gender | null}
              rtl={ui.rtl}
            />

            <View
              style={[
                styles.inputArea,
                {
                  paddingBottom:
                    keyboardHeight > 0 ? 8 : chatBottomInset(insets.bottom),
                },
              ]}
            >
              <TextInput
                style={[styles.textInput, ui.rtl && styles.rtlInput]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={tabUi.placeholder}
                placeholderTextColor={WellnessColors.textSecondary}
                multiline
                maxLength={500}
                returnKeyType="default"
                textAlign={ui.rtl ? 'right' : 'left'}
                onFocus={() => {
                  requestAnimationFrame(() => {
                    listRef.current?.scrollToEnd({ animated: true });
                  });
                }}
              />
              <View style={[styles.inputToolbar, ui.rtl && styles.inputToolbarRtl]}>
                <View style={styles.inputToolbarActions}>
                  <Pressable
                    style={[styles.scrollBtn, !canScrollChat && styles.toolbarBtnDisabled]}
                    onPress={scrollToTop}
                    disabled={!canScrollChat}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={ui.scrollTop}
                  >
                    <Text style={styles.scrollBtnText}>↑</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.scrollBtn, !canScrollChat && styles.toolbarBtnDisabled]}
                    onPress={scrollToBottom}
                    disabled={!canScrollChat}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={ui.scrollBottom}
                  >
                    <Text style={styles.scrollBtnText}>↓</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.clearBtn, !canClearChat && styles.toolbarBtnDisabled]}
                    onPress={handleClearChat}
                    disabled={!canClearChat}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={ui.clearChat}
                  >
                    <Text style={[styles.clearBtnText, ui.rtl && styles.rtlText]}>{ui.clearChat}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.exportBtn, !canExportChat && styles.toolbarBtnDisabled]}
                    onPress={() => void handleExportChat()}
                    disabled={!canExportChat}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={ui.exportChat}
                  >
                    <Text style={styles.exportBtnIcon}>↗</Text>
                  </Pressable>
                </View>
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
          </View>
        </View>
      </View>

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
  minHeight0: { minHeight: 0 },

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
  chatList: { flex: 1, minHeight: 0 },
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

  // Coach panel (scrolls with chat via FlatList header)
  coachPanel: {
    backgroundColor: '#EAF4FB',
    borderBottomWidth: 1,
    borderBottomColor: '#B3D9F0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    marginBottom: 8,
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
  coachPanelCountBadge: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B3D9F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coachPanelCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: WellnessColors.accentBlue,
  },
  coachSummaryText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    marginBottom: 6,
  },
  coachMentorSection: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#B3D9F0',
    paddingTop: 10,
    gap: 6,
  },
  coachMentorHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2E7D5A',
  },
  coachSubBlock: { gap: 3 },
  coachSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: WellnessColors.textSecondary,
    letterSpacing: 0.3,
  },
  coachBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  coachBulletRowRtl: { flexDirection: 'row-reverse' },
  coachBulletWin: { fontSize: 13, lineHeight: 21, color: '#2E7D5A', fontWeight: '700' },
  coachBulletImprove: { fontSize: 13, lineHeight: 21, color: WellnessColors.accentBlue, fontWeight: '700' },
  coachBulletText: { flex: 1, fontSize: 13, lineHeight: 20, color: WellnessColors.textPrimary },
  coachPanelBody: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  coachPanelScroll: {
    maxHeight: 220,
  },
  coachBubbleText: {
    fontSize: 14,
    lineHeight: 21,
    color: WellnessColors.textPrimary,
    fontWeight: '500',
  },
  mentorSegmentGap: { marginTop: 10 },
  mentorSegmentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: WellnessColors.accentBlue,
    marginBottom: 4,
  },
  mentorSegmentLabelCoach: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D5A',
    marginBottom: 4,
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
    gap: 4,
  },
  coachBubbleActionFlex: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
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

  tabBarPinned: {
    flexDirection: 'row',
    backgroundColor: WellnessColors.surface,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tabBtnPinned: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  tabBtnPinnedGap: {
    marginLeft: 8,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
  tabBtnTextActive: {
    color: WellnessColors.textPrimary,
    fontWeight: '700',
  },

  // Chat bubbles
  msgWrap: { marginBottom: 8, flexDirection: 'row' },
  msgWrapUser: { justifyContent: 'flex-end' },
  msgWrapAI: { justifyContent: 'flex-start' },
  mentorVoiceStackWrap: { flexDirection: 'column', alignItems: 'flex-start', maxWidth: '85%' },
  mentorVoiceStack: { gap: 6, width: '100%' },
  coachSegmentCard: { borderRadius: 10, padding: 10, marginBottom: 6 },
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

  bottomChrome: {
    flexShrink: 0,
    backgroundColor: WellnessColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WellnessColors.gridLine,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    zIndex: 10,
  },

  // Input area
  inputArea: {
    backgroundColor: WellnessColors.surface,
    paddingTop: 6,
  },

  // FAQ overlay (absolute — not a nested Modal)
  faqOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    elevation: 300,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  faqOverlayInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  faqCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    elevation: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  faqHeaderRtl: { flexDirection: 'row-reverse' },
  faqTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: WellnessColors.textPrimary,
  },
  faqCountBadge: {
    backgroundColor: WellnessColors.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  faqCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: WellnessColors.textSecondary,
  },
  faqHint: {
    fontSize: 12.5,
    color: WellnessColors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  faqList: { maxHeight: 360 },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  faqRowRtl: { flexDirection: 'row-reverse' },
  faqNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: WellnessColors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqNumberText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  faqInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: WellnessColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: WellnessColors.textPrimary,
  },
  faqSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WellnessColors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqSendBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  faqDeleteBtn: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqDeleteBtnText: { fontSize: 17, color: WellnessColors.accentRed, fontWeight: '700' },
  faqAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: WellnessColors.accentBlue,
    borderStyle: 'dashed',
  },
  faqAddPlus: { fontSize: 16, fontWeight: '800', color: WellnessColors.accentBlue },
  faqAddBtnText: { fontSize: 14, fontWeight: '700', color: WellnessColors.accentBlue },
  faqFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  faqCancelBtn: {
    flex: 1,
    backgroundColor: WellnessColors.background,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  faqCancelBtnText: { fontSize: 15, fontWeight: '700', color: WellnessColors.textSecondary },
  faqSaveBtn: {
    flex: 2,
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  faqSaveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Text input + toolbar
  textInput: {
    minHeight: 40,
    maxHeight: 100,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: WellnessColors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: WellnessColors.textPrimary,
  },
  inputToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 6,
  },
  inputToolbarRtl: {
    flexDirection: 'row-reverse',
  },
  inputToolbarActions: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  scrollBtn: {
    width: 36,
    height: 40,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnDisabled: { opacity: 0.4 },
  scrollBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: WellnessColors.accentBlue,
    lineHeight: 22,
  },
  clearBtn: {
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EF9A9A',
    backgroundColor: '#FCEEF0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: WellnessColors.accentRed,
  },
  exportBtn: {
    width: 36,
    height: 40,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#42A5F5',
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exportBtnIcon: {
    fontSize: 17,
    fontWeight: '800',
    color: WellnessColors.accentBlue,
    lineHeight: 20,
  },
  sendBtn: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
