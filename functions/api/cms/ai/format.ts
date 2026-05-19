import {
  executeAiTaskWithAudit,
  formatContent,
} from "../../../_shared/ai";
import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { handleRequest, json } from "../../../_shared/http";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const result = await executeAiTaskWithAudit({
      request,
      env,
      db,
      task: "format",
      run: (input) => formatContent(env, input),
      mapSuccess: (output) => ({
        model: output.model,
        outputJson: output.contentJson,
      }),
    });
    return json(result);
  });
