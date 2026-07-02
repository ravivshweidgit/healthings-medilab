/**
 * ChatScreen — full-screen chat modal with mentor AI.
 * First bubble shows the active coach message + action items checklist.
 * FAQ quick questions open from the coach footer (or header when no coach message).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
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
import { getLabsAiContextForHeader } from '../services/LabLogService';
import { getNutritionDirectiveAiContext } from '../services/NutritionDirectiveService';
import { chatWithMentor, summariseChatDay, isYesterdayQuery, type CoachContext, type MacroSuggestion } from '../services/GeminiService';
import {
  isMacroChatRequest,
  isMacroSlashCommand,
  isMealPlanSlashCommand,
  isMenuSlashCommand,
  isRecipePlanChatRequest,
  macroSlashIntro,
  macroSlashWrongTabHint,
  menuSlashDeferredHint,
  mealPlanSlashWrongTabHint,
  parseMealSlashCommand,
  recipePlanIntro,
  resolveRecipePlanMode,
} from '../logic/chatIntent';
import { suggestMacroTargets } from '../logic/macroAutoAdjust';
import { MacroProposalCard } from '../components/MacroProposalCard';
import { RecipeCard } from '../components/RecipeCard';
import { SlashCommandSuggestions } from '../components/SlashCommandSuggestions';
import { filterSlashCommandSuggestions } from '../logic/chatSlashCommands';
import { RecipeViewerModal } from '../components/RecipeViewerModal';
import { FoodLogModal } from '../components/FoodLogModal';
import { recipePlanToFoodItems, type RecipePlan } from '../logic/mealPlanTypes';
import { generateRecipePlan } from '../logic/recipePlanService';
import type { FoodItem } from '../services/GeminiService';
import type { DailyMacroTarget } from '../services/TargetService';
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
  onMacroTargetUpdated?: (target: DailyMacroTarget) => void;
  /** Dashboard food list + coach refresh after log-from-recipe in chat. */
  onFoodLogSaved?: () => void;
};

/** Local calendar day — must match FoodLogService day keys (not UTC toISOString). */
function todayKey(): string {
  return foodLogDayKey(Date.now());
}

/** HH:MM for a chat bubble, from the message's ISO sentAt. */
function formatBubbleTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return foodLogDayKey(d.getTime());
}

/** In-memory only — preview URI and macro proposal are never written to AsyncStorage. */
type ChatMessageUI = ChatMessage & {
  previewUri?: string;
  macroProposal?: MacroSuggestion;
  macroDismissed?: boolean;
  recipePlan?: RecipePlan;
  recipeDismissed?: boolean;
};

type PendingChatImage = { uri: string; base64: string; mimeType: string };

function defaultImagePrompt(lang?: UserLanguage | null): string {
  if (lang?.code === 'he') {
    return 'צירפתי תמונה. מה את/ה ממליצ/ה לי, לפי היעדים והכללים שלי?';
  }
  if (lang?.code === 'ar') {
    return 'أرفقت صورة. ماذا تنصحني وفق أهدافي وقواعدي؟';
  }
  return 'I attached a photo. What do you recommend for me based on my goals and dietary rules?';
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
      attachPhoto: 'צרף',
      attachTitle: 'צרף תמונה',
      attachCamera: 'מצלמה',
      attachGallery: 'גלריה',
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
      attachPhoto: 'صورة',
      attachTitle: 'إرفاق صورة',
      attachCamera: 'كاميرا',
      attachGallery: 'معرض',
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
    attachPhoto: 'Photo',
    attachTitle: 'Attach photo',
    attachCamera: 'Camera',
    attachGallery: 'Gallery',
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
  lang,
  onMacroApplied,
  onMacroDismiss,
  onRecipeOpen,
  onRecipeLog,
  onRecipeDismiss,
}: {
  msg: ChatMessageUI;
  mentor: MentorType;
  rtl?: boolean;
  lang?: UserLanguage | null;
  onMacroApplied?: (target: DailyMacroTarget) => void;
  onMacroDismiss?: () => void;
  onRecipeOpen?: (plan: RecipePlan) => void;
  onRecipeLog?: (plan: RecipePlan) => void;
  onRecipeDismiss?: () => void;
}) {
  const isUser = msg.role === 'user';
  const colors = mentorBubbleColors(mentor);

  const time = formatBubbleTime(msg.sentAt);

  if (isUser) {
    return (
      <View style={[styles.msgWrap, styles.msgWrapUser]}>
        <View style={[styles.msgBubble, styles.msgBubbleUser]}>
          {msg.previewUri ? (
            <Image source={{ uri: msg.previewUri }} style={styles.msgAttachedImage} resizeMode="cover" />
          ) : null}
          <Text style={[styles.msgText, styles.msgTextUser, rtl && styles.rtlText]}>{msg.text}</Text>
          {time ? (
            <Text style={[styles.msgTime, styles.msgTimeUser, rtl && styles.rtlText]}>{time}</Text>
          ) : null}
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
        {!msg.macroDismissed && msg.macroProposal ? (
          <MacroProposalCard
            proposal={msg.macroProposal}
            lang={lang}
            onApplied={onMacroApplied}
            onDismiss={onMacroDismiss}
          />
        ) : null}
        {!msg.recipeDismissed && msg.recipePlan && onRecipeOpen && onRecipeLog ? (
          <RecipeCard
            plan={msg.recipePlan}
            lang={lang}
            onOpen={() => onRecipeOpen(msg.recipePlan!)}
            onLogMeal={() => onRecipeLog(msg.recipePlan!)}
            onDismiss={onRecipeDismiss}
          />
        ) : null}
        {time ? (
          <Text style={[styles.msgTime, styles.msgTimeAI, rtl && styles.rtlText]}>{time}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ChatScreen({ visible, onClose, context, onCoachMessageUpdated, onMacroTargetUpdated, onFoodLogSaved }: Props) {
  const insets = useSafeAreaInsets();
  const mentorTabs = useMemo(() => orderedActiveMentors(context.mentors), [context.mentors]);
  const [activeMentor, setActiveMentor] = useState<MentorType>(mentorTabs[0] ?? 'coach');
  const [coachMsg, setCoachMsg] = useState<CoachMessage | null>(null);
  const [history, setHistory] = useState<ChatMessageUI[]>([]);
  const [questions, setQuestions] = useState<QuickQuestion[]>([]);
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingChatImage | null>(null);
  const [sending, setSending] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [refreshingCoach, setRefreshingCoach] = useState(false);
  const [anyChatHistory, setAnyChatHistory] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [recipeViewerPlan, setRecipeViewerPlan] = useState<RecipePlan | null>(null);
  const [foodLogVisible, setFoodLogVisible] = useState(false);
  const [foodLogPrefill, setFoodLogPrefill] = useState<{
    items: FoodItem[];
    description: string;
  } | null>(null);
  const listRef = useRef<FlatList<ChatMessageUI>>(null);
  /** Guards the one-shot coach auto-regen per chat open (avoids API spam on repeated failures). */
  const coachAutoRegenRef = useRef(false);

  const ui = chatUiStrings(context);
  const tabUi = mentorTabStrings(activeMentor, context);

  const slashSuggestions = useMemo(
    () => filterSlashCommandSuggestions(inputText, activeMentor, context.lang?.code),
    [inputText, activeMentor, context.lang?.code],
  );

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

  /** Opening chat from dashboard: expand coach panel and scroll to top so review is visible. */
  useEffect(() => {
    if (!visible) return;
    setCoachExpanded(true);
    coachAutoRegenRef.current = false; // allow one auto-regen attempt per open
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, [visible]);

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

  const pickChatImage = useCallback(async (source: 'camera' | 'gallery') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission required',
        `Please allow ${source === 'camera' ? 'camera' : 'photo library'} access in Settings.`,
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.5,
            base64: true,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.4,
            base64: true,
            allowsEditing: false,
            exif: false,
          });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) {
      Alert.alert('Photo error', 'Could not read this image. Try another photo.');
      return;
    }
    if (base64.length > 4_000_000) {
      Alert.alert('Image too large', 'This photo is too large. Try a smaller image or use the camera.');
      return;
    }
    const mimeType = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
    setPendingImage({ uri: asset.uri, base64, mimeType });
  }, []);

  const handleAttachPhoto = useCallback(() => {
    Alert.alert(ui.attachTitle, undefined, [
      { text: ui.cancel, style: 'cancel' },
      { text: ui.attachCamera, onPress: () => void pickChatImage('camera') },
      { text: ui.attachGallery, onPress: () => void pickChatImage('gallery') },
    ]);
  }, [ui, pickChatImage]);

  const buildFreshContext = useCallback(async (): Promise<CoachContext> => {
    const [meals, macroTarget, userRules, labsAiContext, nutritionDirectiveContext] = await Promise.all([
      getTodayMeals(),
      getMacroTarget(),
      getUserRules(),
      getLabsAiContextForHeader(),
      getNutritionDirectiveAiContext(),
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
      labsAiContext: labsAiContext ?? context.labsAiContext,
      nutritionDirectiveContext: nutritionDirectiveContext ?? context.nutritionDirectiveContext,
      mealCount: meals.length,
      todayEaten: meals.length > 0 ? mealTotals.kcal : context.todayEaten,
      todayProtein_g: meals.length > 0 ? mealTotals.protein_g : context.todayProtein_g,
      todayCarb_g: meals.length > 0 ? mealTotals.carb_g : context.todayCarb_g,
      todayFat_g: meals.length > 0 ? mealTotals.fat_g : context.todayFat_g,
      lastMealSummary: mealsCtx.lastMealSummary,
      todayMealsDetail: mealsCtx.todayMealsDetail,
    };
  }, [context]);

  const sendMessage = useCallback(
    async (text: string, attachment?: PendingChatImage | null) => {
      const trimmed = text.trim();
      const image = attachment ?? null;
      if ((!trimmed && !image) || sending) return;

      const promptText = trimmed || defaultImagePrompt(context.lang);
      const today = todayKey();
      const sentAt = new Date().toISOString();
      const storedMsg: ChatMessage = { role: 'user', text: promptText, sentAt };
      const displayMsg: ChatMessageUI = {
        ...storedMsg,
        previewUri: image?.uri,
      };

      setHistory((prev) => [...prev, displayMsg]);
      await appendChatMessage(today, activeMentor, storedMsg);
      setAnyChatHistory(true);
      setInputText('');
      setPendingImage(null);
      setSending(true);
      scrollToBottom();

      try {
        const [yesterdaySummary, currentHistory, baseFresh] = await Promise.all([
          getYesterdaySummary(),
          getChatHistory(today, activeMentor),
          buildFreshContext(),
        ]);
        const freshContext: CoachContext = await withYesterdayFoodContext(baseFresh, promptText);

        if (isMacroSlashCommand(promptText) && activeMentor !== 'nutritionist') {
          const aiMsg: ChatMessageUI = {
            role: 'assistant',
            text: macroSlashWrongTabHint(freshContext.lang?.code),
            sentAt: new Date().toISOString(),
          };
          setHistory((prev) => [...prev, aiMsg]);
          await appendChatMessage(today, activeMentor, {
            role: 'assistant',
            text: aiMsg.text,
            sentAt: aiMsg.sentAt,
          });
          scrollToBottom();
          return;
        }

        if (isMealPlanSlashCommand(promptText) && activeMentor !== 'nutritionist') {
          const aiMsg: ChatMessageUI = {
            role: 'assistant',
            text: mealPlanSlashWrongTabHint(freshContext.lang?.code),
            sentAt: new Date().toISOString(),
          };
          setHistory((prev) => [...prev, aiMsg]);
          await appendChatMessage(today, activeMentor, {
            role: 'assistant',
            text: aiMsg.text,
            sentAt: aiMsg.sentAt,
          });
          scrollToBottom();
          return;
        }

        const mealSlash = parseMealSlashCommand(promptText);
        if (
          mealSlash &&
          activeMentor === 'nutritionist' &&
          isMenuSlashCommand(mealSlash.command)
        ) {
          const aiMsg: ChatMessageUI = {
            role: 'assistant',
            text: menuSlashDeferredHint(mealSlash.command, freshContext.lang?.code),
            sentAt: new Date().toISOString(),
          };
          setHistory((prev) => [...prev, aiMsg]);
          await appendChatMessage(today, activeMentor, {
            role: 'assistant',
            text: aiMsg.text,
            sentAt: aiMsg.sentAt,
          });
          scrollToBottom();
          return;
        }

        const wantsMacro = activeMentor === 'nutritionist' && isMacroChatRequest(promptText);
        const wantsRecipe =
          activeMentor === 'nutritionist' &&
          !image &&
          isRecipePlanChatRequest(promptText) &&
          !wantsMacro;

        let replyText: string;
        let macroResult: Awaited<ReturnType<typeof suggestMacroTargets>> | null = null;
        let recipeResult: RecipePlan | null = null;

        if (wantsMacro) {
          macroResult = await suggestMacroTargets({
            trigger: 'chat-proposal',
            triggerDetail: promptText,
            lang: freshContext.lang,
          });
          replyText = macroSlashIntro(freshContext.lang?.code);
        } else if (wantsRecipe) {
          const { mode, hint } = resolveRecipePlanMode(promptText);
          recipeResult = await generateRecipePlan({
            userMessage: promptText,
            hint,
            mode,
            command: mealSlash?.command,
            lang: freshContext.lang,
          });
          replyText = recipePlanIntro(freshContext.lang?.code);
        } else {
          replyText = await chatWithMentor(
            activeMentor,
            promptText,
            currentHistory.slice(0, -1),
            freshContext,
            yesterdaySummary,
            image?.base64 ?? null,
            image?.mimeType,
          );
        }

        const aiMsg: ChatMessageUI = {
          role: 'assistant',
          text: replyText,
          sentAt: new Date().toISOString(),
          macroProposal: macroResult?.suggestion,
          recipePlan: recipeResult ?? undefined,
        };
        setHistory((prev) => [...prev, aiMsg]);
        await appendChatMessage(today, activeMentor, {
          role: 'assistant',
          text: replyText,
          sentAt: aiMsg.sentAt,
        });
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
    [sending, activeMentor, scrollToBottom, buildFreshContext, context.lang],
  );

  const handleMacroApplied = useCallback(
    (target: DailyMacroTarget) => {
      onMacroTargetUpdated?.(target);
    },
    [onMacroTargetUpdated],
  );

  const handleMacroDismiss = useCallback((sentAt: string) => {
    setHistory((prev) =>
      prev.map((m) => (m.sentAt === sentAt ? { ...m, macroDismissed: true } : m)),
    );
  }, []);

  const handleRecipeDismiss = useCallback((sentAt: string) => {
    setHistory((prev) =>
      prev.map((m) => (m.sentAt === sentAt ? { ...m, recipeDismissed: true } : m)),
    );
  }, []);

  const openRecipeLog = useCallback((plan: RecipePlan) => {
    setFoodLogPrefill({
      items: recipePlanToFoodItems(plan),
      description: plan.source_note || plan.title,
    });
    setFoodLogVisible(true);
  }, []);

  const handleFoodLogSaved = useCallback(() => {
    setFoodLogVisible(false);
    setFoodLogPrefill(null);
    onFoodLogSaved?.();
  }, [onFoodLogSaved]);

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
          <FlatList<ChatMessageUI>
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
              <MessageBubble
                msg={item}
                mentor={activeMentor}
                rtl={ui.rtl}
                lang={context.lang}
                onMacroApplied={handleMacroApplied}
                onMacroDismiss={
                  item.macroProposal && !item.macroDismissed
                    ? () => handleMacroDismiss(item.sentAt)
                    : undefined
                }
                onRecipeOpen={item.recipePlan && !item.recipeDismissed ? setRecipeViewerPlan : undefined}
                onRecipeLog={
                  item.recipePlan && !item.recipeDismissed ? openRecipeLog : undefined
                }
                onRecipeDismiss={
                  item.recipePlan && !item.recipeDismissed
                    ? () => handleRecipeDismiss(item.sentAt)
                    : undefined
                }
              />
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
              {pendingImage ? (
                <View style={[styles.attachPreviewRow, ui.rtl && styles.attachPreviewRowRtl]}>
                  <Image source={{ uri: pendingImage.uri }} style={styles.attachPreviewThumb} resizeMode="cover" />
                  <Pressable style={styles.attachPreviewClear} onPress={() => setPendingImage(null)} hitSlop={8}>
                    <Text style={styles.attachPreviewClearText}>✕</Text>
                  </Pressable>
                </View>
              ) : null}
              <SlashCommandSuggestions
                options={slashSuggestions}
                rtl={ui.rtl}
                onSelect={(insert) => setInputText(insert)}
              />
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
                    style={styles.attachBtn}
                    onPress={handleAttachPhoto}
                    disabled={sending}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={ui.attachTitle}
                  >
                    <Text style={styles.attachBtnIcon}>📷</Text>
                  </Pressable>
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
                  style={[
                    styles.sendBtn,
                    ((!inputText.trim() && !pendingImage) || sending) && styles.sendBtnDisabled,
                  ]}
                  onPress={() => void sendMessage(inputText, pendingImage)}
                  disabled={(!inputText.trim() && !pendingImage) || sending}
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

      <RecipeViewerModal
        visible={recipeViewerPlan != null}
        plan={recipeViewerPlan}
        lang={context.lang}
        onClose={() => setRecipeViewerPlan(null)}
        onLogMeal={
          recipeViewerPlan
            ? () => {
                openRecipeLog(recipeViewerPlan);
                setRecipeViewerPlan(null);
              }
            : undefined
        }
      />

      <FoodLogModal
        visible={foodLogVisible}
        onClose={() => {
          setFoodLogVisible(false);
          setFoodLogPrefill(null);
        }}
        onSaved={handleFoodLogSaved}
        prefillItems={foodLogPrefill?.items}
        prefillDescription={foodLogPrefill?.description}
        lang={context.lang}
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
  msgAttachedImage: {
    width: 160,
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  msgTextAI: { color: WellnessColors.textPrimary },
  attachPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  attachPreviewRowRtl: { flexDirection: 'row-reverse' },
  attachPreviewThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  attachPreviewClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: WellnessColors.background,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachPreviewClearText: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textSecondary,
  },
  attachBtn: {
    width: 36,
    height: 40,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  attachBtnIcon: { fontSize: 18, lineHeight: 22 },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeUser: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  msgTimeAI: { color: WellnessColors.textSecondary, textAlign: 'right' },

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
