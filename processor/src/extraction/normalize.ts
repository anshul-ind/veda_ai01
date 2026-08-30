import type { Coordinates } from "../types.js";

function clampCoord(c: Coordinates): Coordinates {
  const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
  return { xmin: clamp(c.xmin), ymin: clamp(c.ymin), xmax: clamp(c.xmax), ymax: clamp(c.ymax) };
}

export function normalizeCoordinates(c?: Coordinates): Coordinates | undefined {
  if (!c) return undefined;
  const n = clampCoord(c);
  // ensure xmin<=xmax, ymin<=ymax
  if (n.xmin > n.xmax) [n.xmin, n.xmax] = [n.xmax, n.xmin];
  if (n.ymin > n.ymax) [n.ymin, n.ymax] = [n.ymax, n.ymin];
  return n;
}

export function normalizeText(s?: string | null): string | undefined {
  if (s == null) return undefined;
  const t = s.trim().replace(/\s+/g, " ");
  return t || undefined;
}

export function normalizeId(id: string, fallback: string): string {
  const t = id.trim();
  return t || fallback;
}
