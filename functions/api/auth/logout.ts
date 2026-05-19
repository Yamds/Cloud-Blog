import { clearSessionCookie, destroySession } from "../../_shared/auth";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { handleRequest, json } from "../../_shared/http";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await destroySession(request, env, db);

    return json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": clearSessionCookie(request),
        },
      },
    );
  });
