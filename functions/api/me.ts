import { getCurrentUser, serializeUser } from "../_shared/auth";
import { requireDb } from "../_shared/d1";
import type { Env } from "../_shared/env";
import { handleRequest, json } from "../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const user = await getCurrentUser(request, env, db);
    return json(serializeUser(user));
  });
