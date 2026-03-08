export function formatCompactNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value && value < 1000 ? 0 : 1,
  }).format(value ?? 0);
}

export function formatInteger(value: number | null | undefined) {
  return new Intl.NumberFormat("en").format(value ?? 0);
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value: number | null | undefined, digits = 0) {
  const safeValue = value ?? 0;
  const prefix = safeValue > 0 ? "+" : "";
  return `${prefix}${safeValue.toFixed(digits)}%`;
}

export function formatSignedRatio(value: number | null | undefined, digits = 0) {
  return formatSignedPercent((value ?? 0) * 100, digits);
}

export function formatDuration(seconds: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatUploadDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatRelativeDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffDays) < 30) {
    return formatter.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return formatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffMonths / 12);
  return formatter.format(diffYears, "year");
}

export function initialsFromName(value: string | null | undefined) {
  return (value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "YT";
}

export function humanizeTier(value: string | null | undefined) {
  return (value ?? "average").replace(/_/g, " ").toUpperCase();
}

export function formatWeeklyRate(value: number | null | undefined, digits = 1) {
  return `${(value ?? 0).toFixed(digits)}/wk`;
}
