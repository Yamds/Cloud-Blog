import {
  createSession,
  createSessionCookie,
  upsertGitHubUser,
} from "../../_shared/auth";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { ApiError, handleRequest } from "../../_shared/http";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const url = new URL(request.url);

    if (env.DEV_AUTH_ENABLED !== "true" || !LOCAL_HOSTS.has(url.hostname)) {
      throw new ApiError(404, "NOT_FOUND", "Not found.");
    }

    if (!env.DEV_GITHUB_ID || !env.DEV_GITHUB_LOGIN) {
      throw new ApiError(
        500,
        "CONFIG_MISSING",
        "DEV_GITHUB_ID and DEV_GITHUB_LOGIN are required for dev login.",
      );
    }

    const db = requireDb(env);
    const user = await upsertGitHubUser(db, env, {
      id: Number(env.DEV_GITHUB_ID),
      login: env.DEV_GITHUB_LOGIN,
      avatar_url: env.DEV_GITHUB_AVATAR_URL || "",
      html_url: `https://github.com/${env.DEV_GITHUB_LOGIN}`,
    });
    const session = await createSession(db, env, user.id, request.headers.get("user-agent"));
    const redirectUrl = new URL(user.isAdmin ? "/cms" : "/", url.origin);

    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl.toString(),
        "Set-Cookie": createSessionCookie(request, session.token, session.expiresAt),
      },
    });
  });
