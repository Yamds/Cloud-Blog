import {
  readAnalyticsPageViewInput,
  readJsonBody,
  recordPageView,
} from "../../_shared/analytics";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { handleRequest, json } from "../../_shared/http";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const input = readAnalyticsPageViewInput(await readJsonBody(request));

    await recordPageView(db, request, input);

    return json(
      {
        recorded: true,
      },
      {
        status: 201,
      },
    );
  });
