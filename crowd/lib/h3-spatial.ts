/**
 * H3 Spatial Crowd Analysis
 * ─────────────────────────
 * Uber's H3 hexagonal hierarchical spatial index is used here to:
 *   1. Discretise agent positions into equal-area hexagonal cells
 *   2. Compute crowd density (agents / cell) in real-time
 *   3. Flag hotspot cells that exceed a safe-density threshold
 *   4. Track pressure corridors — cells that appear repeatedly in evac paths
 *   5. Render the full H3 grid overlay on the map (ghost cells)
 *
 * Resolution guide (avg edge length):
 *   Res 8  ≈ 461 m  → city-district scale
 *   Res 9  ≈ 174 m  → neighbourhood scale
 *   Res 10 ≈  66 m  → block scale          ← default
 *   Res 11 ≈  25 m  → building scale
 */

import { latLngToCell, polygonToCells } from 'h3-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HexCell {
  hex:        string;  // H3 cell index
  count:      number;  // agents currently in this cell
  normalized: number;  // 0–1 relative to session peak (for colour mapping)
}

export interface H3DensityResult {
  cells:        HexCell[];
  maxCount:     number;  // peak density in any single cell this tick
  hotspots:     HexCell[]; // cells above the critical threshold
  totalCovered: number;  // number of distinct cells occupied
}

export const DEFAULT_RESOLUTION  = 10;
export const CRITICAL_THRESHOLD  = 8;   // agents / cell before alert
export const WARNING_THRESHOLD   = 4;

// ─── Core density function ────────────────────────────────────────────────────

/**
 * Map an array of agent [lng, lat] positions to H3 hexagonal density cells.
 * Returns normalised cells ready for deck.gl's H3HexagonLayer.
 *
 * Efficiency notes:
 *  - Avoids Math.max(...spread) which blows the call stack at scale; uses a
 *    running-max loop instead.
 *  - Returns early if no agents are present.
 */
export function buildH3Density(
  positions:  [number, number][], // agent [lng, lat] positions
  resolution: number = DEFAULT_RESOLUTION,
  sessionPeak = 1,                 // running max across ticks (passed from engine)
): H3DensityResult {
  if (!positions.length) {
    return { cells: [], maxCount: 0, hotspots: [], totalCovered: 0 };
  }

  const density = new Map<string, number>();
  let maxCount = 0;

  for (const [lng, lat] of positions) {
    const cell  = latLngToCell(lat, lng, resolution);
    const count = (density.get(cell) ?? 0) + 1;
    density.set(cell, count);
    if (count > maxCount) maxCount = count;
  }

  const norm = Math.max(maxCount, sessionPeak);

  const cells: HexCell[] = [];
  const hotspots: HexCell[] = [];

  for (const [hex, count] of density) {
    const cell: HexCell = { hex, count, normalized: count / norm };
    cells.push(cell);
    if (count >= CRITICAL_THRESHOLD) hotspots.push(cell);
  }

  return { cells, maxCount, hotspots, totalCovered: density.size };
}

// ─── Venue grid cells ──────────────────────────────────────────────────────────

/**
 * Return ALL H3 cells that cover a venue bounding box at the given resolution.
 * Used to draw the static hexagonal grid overlay on the map.
 *
 * @param bbox  [south, west, north, east] in decimal degrees
 * @param resolution  H3 resolution (8–11)
 */
export function getVenueGridCells(
  bbox:       [number, number, number, number],
  resolution: number,
): string[] {
  const [south, west, north, east] = bbox;
  try {
    // h3-js v4: polygonToCells(coordinates: [lat,lng][], res, isGeoJson?)
    // Pass [lat, lng] pairs (h3-js native ordering) with isGeoJson = false
    const cells = polygonToCells(
      [
        [south, west],
        [south, east],
        [north, east],
        [north, west],
        [south, west], // close the ring
      ],
      resolution,
      false, // [lat, lng] ordering (not GeoJSON)
    );
    return cells ?? [];
  } catch {
    return [];
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Approximate cell edge-length in metres for display purposes */
export function h3ResolutionLabel(res: number): string {
  const lengths: Record<number, string> = {
    8: '~461 m / cell',
    9: '~174 m / cell',
    10: '~66 m / cell',
    11: '~25 m / cell',
  };
  return lengths[res] ?? `res ${res}`;
}

/** Hex-cell density → RGBA colour (cool blue → warm yellow → alarm red) */
export function densityColor(normalized: number): [number, number, number, number] {
  const c = Math.min(1, Math.max(0, normalized));
  if (c < 0.3) {
    const t = c / 0.3;
    // transparent dark-blue → electric purple
    return [Math.round(60 + 120 * t), Math.round(0 + 20 * t), Math.round(180 + 60 * t), Math.round(100 + 80 * t)];
  }
  if (c < 0.65) {
    const t = (c - 0.3) / 0.35;
    // purple → amber
    return [Math.round(180 + 75 * t), Math.round(20 + 160 * t), Math.round(240 - 220 * t), Math.round(180 + 30 * t)];
  }
  // amber → alarm red
  const t = (c - 0.65) / 0.35;
  return [255, Math.round(180 - 170 * t), Math.round(20 - 15 * t), 230];
}
