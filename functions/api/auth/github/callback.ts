import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { ApiError, handleRequest } from "../../../_shared/http";
import {
  clearOAuthStateCookie,
  createSession,
  createSessionCookie,
  exchangeGitHubCode,
  fetchGitHubUser,
  getCookie,
  getOAuthStateCookieName,
  upsertGitHubUser,
} from "../../../_shared/auth";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    console.log("GitHub OAuth callback: start");
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const savedState = getCookie(request, getOAuthStateCookieName());

    if (!code || !state || !savedState || state !== savedState) {
      throw new ApiError(400, "OAUTH_STATE_INVALID", "GitHub OAuth state is invalid.");
    }

    const db = requireDb(env);
    console.log("GitHub OAuth callback: exchanging code");
    const accessToken = await exchangeGitHubCode(request, env, code);
    console.log("GitHub OAuth callback: fetching user");
    const githubUser = await fetchGitHubUser(accessToken);
    console.log("GitHub OAuth callback: saving user");
    const user = await upsertGitHubUser(db, env, githubUser);
    console.log("GitHub OAuth callback: creating session");
    const session = await createSession(db, env, user.id, request.headers.get("user-agent"));
    const redirectUrl = new URL(user.isAdmin ? "/cms" : "/", url.origin);
    const headers = new Headers({
      "Location": redirectUrl.toString(),
    });

    headers.append("Set-Cookie", createSessionCookie(request, session.token, session.expiresAt));
    headers.append("Set-Cookie", clearOAuthStateCookie(request));

    return new Response(null, {
      status: 302,
      headers,
    });
  });
