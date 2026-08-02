/** Result shown after phone-health (HC / Apple Health) sync completes. */
export type PhoneHealthSyncSummary = {
  deep: boolean;
  lookbackDays: number;
  /** Calendar days with step totals > 0 from the phone pull. */
  stepDays: number;
  /** Trend days with activity kcal > 0 after merge. */
  activityDays: number;
  hrSamples: number;
  workouts: number;
};
