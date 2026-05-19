import type { ArticleComment } from "../types/article";
import { ApiError, requestJson } from "./http";

type JsonRecord = Record<string, unknown>;
type CommentResponse =
  | {
      comment?: unknown;
      data?: unknown;
    }
  | unknown;

type CommentsResponse =
  | {
      comments?: unknown;
      data?: unknown;
    }
  | unknown;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null;

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeNullableString = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

const normalizeComment = (value: unknown): ArticleComment | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const authorName = normalizeString(value.authorName);
  const content = typeof value.content === "string" ? value.content : "";
  const createdAt = normalizeString(value.createdAt);

  if (!id || !authorName || !createdAt) {
    return null;
  }

  const replies = Array.isArray(value.replies)
    ? value.replies
        .map((reply) => normalizeComment(reply))
        .filter((reply): reply is ArticleComment => reply !== null)
    : undefined;

  return {
    id,
    articleId: normalizeNullableString(value.articleId),
    parentId: normalizeNullableString(value.parentId),
    authorId: normalizeNullableString(value.authorId),
    authorName,
    authorAvatar: normalizeNullableString(value.authorAvatar),
    authorHtmlUrl: normalizeNullableString(value.authorHtmlUrl),
    createdAt,
    updatedAt: normalizeNullableString(value.updatedAt),
    content,
    replies: replies?.length ? replies : undefined,
  };
};

const unwrapComments = (payload: CommentsResponse): unknown => {
  if (isRecord(payload) && "comments" in payload) {
    return payload.comments;
  }

  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
};

const unwrapComment = (payload: CommentResponse): unknown => {
  if (isRecord(payload) && "comment" in payload) {
    return payload.comment;
  }

  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
};

export async function getArticleComments(slug: string): Promise<ArticleComment[]> {
  const payload = await requestJson<CommentsResponse>(`/api/articles/${encodeURIComponent(slug)}/comments`);
  const comments = unwrapComments(payload);

  if (!Array.isArray(comments)) {
    throw new ApiError({
      code: "INVALID_DATA",
      message: "评论列表数据格式不正确。",
    });
  }

  return comments
    .map((comment) => normalizeComment(comment))
    .filter((comment): comment is ArticleComment => comment !== null);
}

export async function createArticleComment(slug: string, content: string): Promise<ArticleComment> {
  const payload = await requestJson<CommentResponse>(`/api/articles/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    body: {
      content,
    },
  });
  const comment = normalizeComment(unwrapComment(payload));

  if (!comment) {
    throw new ApiError({
      code: "INVALID_DATA",
      message: "服务返回了无效的评论数据。",
    });
  }

  return comment;
}

export async function createCommentReply(commentId: string, content: string): Promise<ArticleComment> {
  const payload = await requestJson<CommentResponse>(`/api/comments/${encodeURIComponent(commentId)}/replies`, {
    method: "POST",
    body: {
      content,
    },
  });
  const comment = normalizeComment(unwrapComment(payload));

  if (!comment) {
    throw new ApiError({
      code: "INVALID_DATA",
      message: "服务返回了无效的回复数据。",
    });
  }

  return comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  await requestJson<{ success?: boolean }>(`/api/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
  });
}
