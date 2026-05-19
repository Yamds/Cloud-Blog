import {
  executeAiTaskWithAudit,
  generateTags,
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
      task: "tags",
      run: (input) => generateTags(env, input),
      mapSuccess: (output) => ({
        model: output.model,
        outputJson: output.tags,
      }),
    });
    return json(result);
  });
