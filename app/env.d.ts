declare module '@env' {
  export const NODE_ENV: string;
  export const WITHINGS_CLIENT_ID: string;
  /** Must match Withings portal; default in code is `healthings-medilab://oauth` if unset. */
  export const WITHINGS_CALLBACK_URL: string;
  /** Healthings backend; defaults to https://api.healthings.ai if unset. */
  export const HEALTHINGS_API_URL: string;
}
