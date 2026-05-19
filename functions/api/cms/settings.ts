import { requireAdmin } from "../../_shared/auth";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { handleRequest, json } from "../../_shared/http";
import {
  getSiteSettings,
  readJsonBody,
  readSiteSettingsInput,
  updateSiteSettings,
} from "../../_shared/settings";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);
    const settings = await getSiteSettings(db);

    return json({ settings });
  });

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);
    const settings = await updateSiteSettings(db, readSiteSettingsInput(await readJsonBody(request)));

    return json({ settings });
  });
