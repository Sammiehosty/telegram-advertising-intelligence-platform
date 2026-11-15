export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function fmtNum(n?: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function fmtPct(n?: number | null, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtMoney(cents?: number | null, currency = "USD"): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function timeAgo(date?: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDate(date?: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function qualityLabel(score?: number | null) {
  if (score === null || score === undefined) return { label: "Unknown", tone: "muted" as const };
  if (score >= 90) return { label: "Excellent", tone: "green" as const };
  if (score >= 75) return { label: "Very Good", tone: "teal" as const };
  if (score >= 60) return { label: "Average", tone: "amber" as const };
  if (score >= 40) return { label: "Poor", tone: "orange" as const };
  return { label: "High Risk", tone: "red" as const };
}

export function adLabel(score?: number | null) {
  if (score === null || score === undefined) return { label: "Not scored", tone: "muted" as const };
  if (score >= 90) return { label: "Excellent Advertising Opportunity", tone: "green" as const };
  if (score >= 75) return { label: "Very Good Advertising Opportunity", tone: "teal" as const };
  if (score >= 60) return { label: "Good Advertising Opportunity", tone: "amber" as const };
  if (score >= 40) return { label: "Average Advertising Opportunity", tone: "orange" as const };
  return { label: "Poor Advertising Opportunity", tone: "red" as const };
}

export const CATEGORIES = [
  "Crypto & Finance",
  "Trading & Forex",
  "Sports & Betting",
  "Business & Investing",
  "Technology",
  "Education",
  "News & Politics",
  "Entertainment",
  "Gaming",
  "Lifestyle",
  "Marketing",
  "Other",
];

export const AD_FORMATS = [
  { value: "sponsored_post", label: "Sponsored post" },
  { value: "pinned", label: "Pinned advertisement" },
  { value: "24h", label: "24-hour advertisement" },
  { value: "48h", label: "48-hour advertisement" },
  { value: "permanent", label: "Permanent advertisement" },
  { value: "forward", label: "Forwarded advertisement" },
  { value: "package", label: "Multiple-post package" },
];
