export interface Env {
  DB?: D1Database;
  ADMIN_GITHUB_IDS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  SITE_URL?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL_SUMMARY?: string;
  AI_MODEL_FORMAT?: string;
  AI_MODEL_POLISH?: string;
  AI_MODEL_TAGS?: string;
  AI_MODEL_TRANSLATE?: string;
  AI_ALLOW_UNAUTHENTICATED_DEV?: string;
  AI_DEBUG_LOG_RESPONSE?: string;
  DEV_AUTH_ENABLED?: string;
  DEV_GITHUB_ID?: string;
  DEV_GITHUB_LOGIN?: string;
  DEV_GITHUB_AVATAR_URL?: string;
}
