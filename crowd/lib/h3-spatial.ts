// H3 spatial analysis

import { latLngToCell, polygonToCells } from 'h3-js';

// H3 types

export interface HexCell {
  hex:        string;  // Cell index
  count:      number;  // Agent count
  normalized: number;  // Normalized value
}

export interface H3DensityResult {
  cells:        HexCell[];
  maxCount:     number;  // Peak density
  hotspots:     HexCell[]; // Hotspot cells
  totalCovered: number;  // Covered count
}

export const DEFAULT_RESOLUTION  = 10;
export const CRITICAL_THRESHOLD  = 8;   // Alert threshold
export const WARNING_THRESHOLD   = 4;

// Density calculation

// Build density metrics
export function buildH3Density(
  positions:  [number, number][], // Agent coordinates
  resolution: number = DEFAULT_RESOLUTION,
  sessionPeak = 1,                 // Peak count
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

// Grid overlay

// Bounding box cells
export function getVenueGridCells(
  bbox:       [number, number, number, number],
  resolution: number,
): string[] {
  const [south, west, north, east] = bbox;
  try {
    // Polygon to cells
    // Ordering: lat, lng
    const cells = polygonToCells(
      [
        [south, west],
        [south, east],
        [north, east],
        [north, west],
        [south, west], // Close ring
      ],
      resolution,
      false, // Native order
    );
    return cells ?? [];
  } catch {
    return [];
  }
}

// Helpers

// Resolution label
export function h3ResolutionLabel(res: number): string {
  const lengths: Record<number, string> = {
    8: '~461 m / cell',
    9: '~174 m / cell',
    10: '~66 m / cell',
    11: '~25 m / cell',
  };
  return lengths[res] ?? `res ${res}`;
}

// Color mapping
export function densityColor(normalized: number): [number, number, number, number] {
  const c = Math.min(1, Math.max(0, normalized));
  if (c < 0.3) {
    const t = c / 0.3;
    // Blue to purple
    return [Math.round(60 + 120 * t), Math.round(0 + 20 * t), Math.round(180 + 60 * t), Math.round(100 + 80 * t)];
  }
  if (c < 0.65) {
    const t = (c - 0.3) / 0.35;
    // Purple to amber
    return [Math.round(180 + 75 * t), Math.round(20 + 160 * t), Math.round(240 - 220 * t), Math.round(180 + 30 * t)];
  }
  // Amber to red
  const t = (c - 0.65) / 0.35;
  return [255, Math.round(180 - 170 * t), Math.round(20 - 15 * t), 230];
}
