import type { Env } from "./env";
import { ApiError } from "./http";

export function requireDb(env: Env): D1Database {
  if (!env.DB || typeof env.DB.prepare !== "function") {
    throw new ApiError(500, "DB_NOT_CONFIGURED", 'D1 binding "DB" is not configured.');
  }

  return env.DB;
}

export async function queryAll<T>(statement: D1PreparedStatement): Promise<T[]> {
  try {
    const result = await statement.all<T>();
    return result.results ?? [];
  } catch (error) {
    console.error("D1 query failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database query failed.");
  }
}

export async function queryFirst<T>(statement: D1PreparedStatement): Promise<T | null> {
  try {
    return await statement.first<T>();
  } catch (error) {
    console.error("D1 query failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database query failed.");
  }
}
