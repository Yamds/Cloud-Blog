import {
  buildGitHubAuthorizeUrl,
  createOAuthStateCookie,
  randomToken,
} from "../../../_shared/auth";
import type { Env } from "../../../_shared/env";
import { handleRequest } from "../../../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const state = randomToken();
    const headers = new Headers({
      "Location": buildGitHubAuthorizeUrl(request, env, state),
      "Set-Cookie": createOAuthStateCookie(request, state),
    });

    return new Response(null, {
      status: 302,
      headers,
    });
  });
