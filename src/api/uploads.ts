import { requestJson } from "@/api/http";
import type { CmsImageUploadResult } from "@/types/cms";

export async function uploadCmsImage(
  file: File,
  options: {
    articleId?: string | null;
  } = {},
): Promise<CmsImageUploadResult> {
  const formData = new FormData();
  formData.set("file", file);

  if (options.articleId) {
    formData.set("articleId", options.articleId);
  }

  return requestJson<CmsImageUploadResult>("/api/cms/uploads/images", {
    method: "POST",
    body: formData,
  });
}
