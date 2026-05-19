import { requestJson } from "@/api/http";
import type { CmsDeleteMediaResponse, CmsStorageObject } from "@/types/cms";

interface CmsMediaObjectsResponse {
  objects: CmsStorageObject[];
}

export function getCmsMediaObjects(): Promise<CmsMediaObjectsResponse> {
  return requestJson<CmsMediaObjectsResponse>("/api/cms/media");
}

export function deleteCmsMediaObject(
  id: string,
  options: { force?: boolean } = {},
): Promise<CmsDeleteMediaResponse> {
  const search = options.force ? "?force=true" : "";

  return requestJson<CmsDeleteMediaResponse>(`/api/cms/media/${encodeURIComponent(id)}${search}`, {
    method: "DELETE",
  });
}
