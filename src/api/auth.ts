import { requestJson } from "./http";

export interface AuthUser {
  id: string;
  githubId: string;
  githubLogin: string;
  githubAvatarUrl: string | null;
  githubHtmlUrl: string | null;
  role: "visitor" | "admin";
  isAdmin: boolean;
}

interface MeResponse {
  user: AuthUser | null;
}

const GITHUB_LOGIN_URL = "/api/auth/github/start";

export async function getMe(): Promise<AuthUser | null> {
  const response = await requestJson<MeResponse>("/api/me");
  return response.user;
}

export async function logout(): Promise<void> {
  await requestJson<unknown>("/api/auth/logout", {
    method: "POST",
  });
}

export function getGitHubLoginUrl(): string {
  return GITHUB_LOGIN_URL;
}

export function loginWithGitHub(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(getGitHubLoginUrl());
}
