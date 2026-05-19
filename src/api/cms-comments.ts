import { requestJson } from "@/api/http";
import type { CmsComment } from "@/types/cms";

interface CmsCommentsResponse {
  comments: CmsComment[];
}

interface CmsCommentResponse {
  comment: CmsComment;
}

export async function getCmsComments(): Promise<CmsComment[]> {
  const response = await requestJson<CmsCommentsResponse>("/api/cms/comments");
  return response.comments;
}

export async function hideCmsComment(id: string): Promise<CmsComment> {
  const response = await requestJson<CmsCommentResponse>(`/api/cms/comments/${encodeURIComponent(id)}/hide`, {
    method: "POST",
  });
  return response.comment;
}

export async function restoreCmsComment(id: string): Promise<CmsComment> {
  const response = await requestJson<CmsCommentResponse>(`/api/cms/comments/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
  return response.comment;
}

export async function deleteCmsComment(id: string): Promise<CmsComment> {
  const response = await requestJson<CmsCommentResponse>(`/api/cms/comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return response.comment;
}
