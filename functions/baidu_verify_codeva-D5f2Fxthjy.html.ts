interface BaiduVerifyEnv {
  ASSETS: Fetcher;
}

// Cloudflare Pages redirects .html requests to the extensionless path with 308.
// Baidu verifies the exact file URL, so this function serves it with 200.
const VERIFY_ASSET_PATH = "/baidu_verify_codeva-D5f2Fxthjy";

export const onRequestGet: PagesFunction<BaiduVerifyEnv> = async ({ request, env }) => {
  const assetUrl = new URL(VERIFY_ASSET_PATH, request.url);
  const response = await env.ASSETS.fetch(assetUrl.toString());

  if (!response.ok) {
    return new Response("Verification file not found.", { status: 404 });
  }

  return new Response(await response.text(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
