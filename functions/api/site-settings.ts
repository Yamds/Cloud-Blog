import { requireDb } from "../_shared/d1";
import type { Env } from "../_shared/env";
import { handleRequest, json } from "../_shared/http";
import { getSiteSettings } from "../_shared/settings";

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const settings = await getSiteSettings(db);

    return json({ settings });
  });
