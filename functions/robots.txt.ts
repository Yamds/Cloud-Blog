import type { Env } from "./_shared/env";
import { buildRobots, getSiteOrigin } from "./_shared/seo";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  new Response(buildRobots(getSiteOrigin(request, env)), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
