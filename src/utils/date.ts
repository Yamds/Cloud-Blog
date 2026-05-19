const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWithParts(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = "--",
): string {
  const date = parseDate(value);

  if (!date) {
    return value || fallback;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI_TIME_ZONE,
    ...options,
  }).format(date).replace(/\//g, ".");
}

export function formatShanghaiDate(value: string | null | undefined): string {
  return formatWithParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatShanghaiDateTime(value: string | null | undefined): string {
  return formatWithParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatShanghaiTime(value: string | null | undefined): string {
  return formatWithParts(
    value,
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
    "",
  );
}
