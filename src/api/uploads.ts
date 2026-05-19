import { requestJson } from "@/api/http";
import type { CmsImageUploadOptions, CmsImageUploadResult } from "@/types/cms";

export async function uploadCmsImage(
  file: File,
  options: CmsImageUploadOptions = {},
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

export async function uploadCmsImageFromUrl(
  imageUrl: string,
  options: CmsImageUploadOptions = {},
): Promise<CmsImageUploadResult> {
  return requestJson<CmsImageUploadResult>("/api/cms/uploads/images", {
    method: "POST",
    body: {
      imageUrl,
      articleId: options.articleId ?? null,
    },
  });
}
