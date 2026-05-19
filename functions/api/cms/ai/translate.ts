import {
  executeAiTaskWithAudit,
  readAiTranslateInput,
  translateContent,
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
      task: "translate",
      readInput: readAiTranslateInput,
      run: (input) => translateContent(env, input),
      mapSuccess: (output) => ({
        model: output.model,
        outputJson: {
          title: output.title,
          summary: output.summary,
          contentText: output.contentText,
          contentJson: output.contentJson,
        },
        outputText: output.contentText,
      }),
    });

    return json(result);
  });
