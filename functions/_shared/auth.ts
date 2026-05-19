import { queryFirst } from "./d1";
import type { Env } from "./env";
import { ApiError } from "./http";

export interface CurrentUser {
  id: string;
  githubId: string;
  githubLogin: string;
  githubAvatarUrl: string | null;
  githubHtmlUrl: string | null;
  role: "visitor" | "admin";
  isAdmin: boolean;
}

interface SessionUserRow {
  id: string;
  github_id: string;
  github_login: string;
  github_avatar_url: string | null;
  github_html_url: string | null;
  role: "visitor" | "admin";
}

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id?: number;
  login?: string;
  avatar_url?: string;
  html_url?: string;
}

const SESSION_COOKIE = "cloud_blog_session";
const OAUTH_STATE_COOKIE = "cloud_blog_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getOAuthStateCookieName(): string {
  return OAUTH_STATE_COOKIE;
}

export function buildGitHubAuthorizeUrl(request: Request, env: Env, state: string): string {
  const clientId = requireEnv(env.GITHUB_CLIENT_ID, "GITHUB_CLIENT_ID");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getOAuthRedirectUri(request, env));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "read:user");
  return url.toString();
}

export async function exchangeGitHubCode(
  request: Request,
  env: Env,
  code: string,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "cloud-blog",
      },
      body: JSON.stringify({
        client_id: requireEnv(env.GITHUB_CLIENT_ID, "GITHUB_CLIENT_ID"),
        client_secret: requireEnv(env.GITHUB_CLIENT_SECRET, "GITHUB_CLIENT_SECRET"),
        code,
        redirect_uri: getOAuthRedirectUri(request, env),
      }),
    });
  } catch (error) {
    console.error("GitHub token fetch failed", error);
    throw new ApiError(502, "OAUTH_FETCH_FAILED", "Failed to connect to GitHub OAuth token API.");
  }

  const payload = (await response.json().catch(() => null)) as GitHubTokenResponse | null;

  if (!response.ok || !payload?.access_token) {
    throw new ApiError(
      401,
      "OAUTH_FAILED",
      payload?.error_description || payload?.error || "GitHub OAuth token exchange failed.",
    );
  }

  return payload.access_token;
}

export async function fetchGitHubUser(accessToken: string): Promise<Required<GitHubUserResponse>> {
  let response: Response;

  try {
    response = await fetch("https://api.github.com/user", {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${accessToken}`,
        "User-Agent": "cloud-blog",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (error) {
    console.error("GitHub user fetch failed", error);
    throw new ApiError(502, "OAUTH_FETCH_FAILED", "Failed to connect to GitHub user API.");
  }

  const payload = (await response.json().catch(() => null)) as GitHubUserResponse | null;

  if (!response.ok || !payload?.id || !payload.login) {
    throw new ApiError(401, "OAUTH_FAILED", "Failed to read GitHub user.");
  }

  return {
    id: payload.id,
    login: payload.login,
    avatar_url: payload.avatar_url ?? "",
    html_url: payload.html_url ?? `https://github.com/${payload.login}`,
  };
}

export async function upsertGitHubUser(
  db: D1Database,
  env: Env,
  githubUser: Required<GitHubUserResponse>,
): Promise<CurrentUser> {
  const now = new Date().toISOString();
  const githubId = String(githubUser.id);
  const userId = `github_${githubId}`;
  const role = isConfiguredAdmin(env, githubId) ? "admin" : "visitor";

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO users (
            id,
            github_id,
            github_login,
            github_avatar_url,
            github_html_url,
            role,
            created_at,
            updated_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(github_id) DO UPDATE SET
            github_login = excluded.github_login,
            github_avatar_url = excluded.github_avatar_url,
            github_html_url = excluded.github_html_url,
            role = CASE
              WHEN excluded.role = 'admin' THEN 'admin'
              ELSE users.role
            END,
            updated_at = excluded.updated_at,
            last_login_at = excluded.last_login_at
        `,
      )
      .bind(
        userId,
        githubId,
        githubUser.login,
        githubUser.avatar_url,
        githubUser.html_url,
        role,
        now,
        now,
        now,
      ),
  );

  const row = await queryFirst<SessionUserRow>(
    db.prepare(
      `
        SELECT id, github_id, github_login, github_avatar_url, github_html_url, role
        FROM users
        WHERE github_id = ?
        LIMIT 1
      `,
    ).bind(githubId),
  );

  if (!row) {
    throw new ApiError(500, "DATABASE_ERROR", "Failed to read saved user.");
  }

  return mapCurrentUser(row, env);
}

export async function createSession(
  db: D1Database,
  env: Env,
  userId: string,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const tokenHash = await hashSessionToken(token, env);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO sessions (
            id,
            user_id,
            token_hash,
            expires_at,
            created_at,
            last_seen_at,
            user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        userId,
        tokenHash,
        expiresAt.toISOString(),
        now.toISOString(),
        now.toISOString(),
        userAgent?.slice(0, 500) ?? null,
      ),
  );

  return { token, expiresAt };
}

export async function getCurrentUser(
  request: Request,
  env: Env,
  db: D1Database,
): Promise<CurrentUser | null> {
  const token = getCookie(request, SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const tokenHash = await hashSessionToken(token, env);
  const now = new Date().toISOString();
  const row = await queryFirst<SessionUserRow>(
    db
      .prepare(
        `
          SELECT
            u.id,
            u.github_id,
            u.github_login,
            u.github_avatar_url,
            u.github_html_url,
            u.role
          FROM sessions AS s
          INNER JOIN users AS u ON u.id = s.user_id
          WHERE s.token_hash = ?
            AND s.expires_at > ?
          LIMIT 1
        `,
      )
      .bind(tokenHash, now),
  );

  if (!row) {
    return null;
  }

  await runStatement(
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").bind(now, tokenHash),
  );

  return mapCurrentUser(row, env);
}

export async function requireCurrentUser(
  request: Request,
  env: Env,
  db: D1Database,
): Promise<CurrentUser> {
  const user = await getCurrentUser(request, env, db);

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Login is required.");
  }

  return user;
}

export async function requireAdmin(
  request: Request,
  env: Env,
  db: D1Database,
): Promise<CurrentUser> {
  const user = await requireCurrentUser(request, env, db);

  if (!user.isAdmin) {
    throw new ApiError(403, "FORBIDDEN", "Admin permission is required.");
  }

  return user;
}

export async function destroySession(request: Request, env: Env, db: D1Database): Promise<void> {
  const token = getCookie(request, SESSION_COOKIE);

  if (!token) {
    return;
  }

  await runStatement(
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashSessionToken(token, env)),
  );
}

export function serializeUser(user: CurrentUser | null): { user: CurrentUser | null } {
  return { user };
}

export function createSessionCookie(request: Request, token: string, expiresAt: Date): string {
  return serializeCookie(SESSION_COOKIE, token, {
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "Lax",
    path: "/",
  });
}

export function createOAuthStateCookie(request: Request, state: string): string {
  return serializeCookie(OAUTH_STATE_COOKIE, state, {
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "Lax",
    path: "/api/auth/github",
  });
}

export function clearSessionCookie(request: Request): string {
  return serializeCookie(SESSION_COOKIE, "", {
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "Lax",
    path: "/",
  });
}

export function clearOAuthStateCookie(request: Request): string {
  return serializeCookie(OAUTH_STATE_COOKIE, "", {
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "Lax",
    path: "/api/auth/github",
  });
}

export function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export function randomToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function mapCurrentUser(row: SessionUserRow, env: Env): CurrentUser {
  const isAdmin = isConfiguredAdmin(env, row.github_id) || row.role === "admin";

  return {
    id: row.id,
    githubId: row.github_id,
    githubLogin: row.github_login,
    githubAvatarUrl: row.github_avatar_url,
    githubHtmlUrl: row.github_html_url,
    role: isAdmin ? "admin" : row.role,
    isAdmin,
  };
}

function isConfiguredAdmin(env: Env, githubId: string): boolean {
  return (env.ADMIN_GITHUB_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(githubId);
}

function getOAuthRedirectUri(request: Request, env: Env): string {
  const siteUrl = env.SITE_URL?.trim();
  const origin = siteUrl ? new URL(siteUrl).origin : new URL(request.url).origin;
  return `${origin}/api/auth/github/callback`;
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new ApiError(500, "CONFIG_MISSING", `${name} is not configured.`);
  }

  return value;
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashSessionToken(token: string, env: Env): Promise<string> {
  try {
    const secret = env.SESSION_SECRET?.trim() || "cloud-blog-local-session-secret";
    return await sha256Hex(`${secret}:${token}`);
  } catch (error) {
    console.error("Session token hashing failed", error);
    throw new ApiError(500, "SESSION_HASH_FAILED", "Failed to hash session token.");
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("D1 statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    expires?: Date;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
  },
): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }
  if (options.expires) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.path) {
    segments.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    segments.push("HttpOnly");
  }
  if (options.secure) {
    segments.push("Secure");
  }
  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join("; ");
}

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}
