/**
 * Crowd Dispersal Zones - Core data types and utility functions
 *
 * This module provides:
 * - Zone data structures (attraction and repulsion zones)
 * - Direction preferences for 8-compass routing
 * - Geographic utility functions (bearing, direction matching)
 * - Point-in-polygon detection for zone membership
 */

// ─── Direction Types ──────────────────────────────────────────────────────────

export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Direction to angle mapping (in radians, clockwise from North)
 * N = 0, NE = π/4, E = π/2, SE = 3π/4, S = π, SW = 5π/4, W = 3π/2, NW = 7π/4
 */
export const DIRECTION_ANGLES: Record<CardinalDirection, number> = {
    N: 0,
    NE: Math.PI / 4,
    E: Math.PI / 2,
    SE: (3 * Math.PI) / 4,
    S: Math.PI,
    SW: (5 * Math.PI) / 4,
    W: (3 * Math.PI) / 2,
    NW: (7 * Math.PI) / 4,
};

// ─── Zone Types ───────────────────────────────────────────────────────────────

/**
 * Represents a crowd zone (attraction or repulsion)
 */
export interface CrowdZone {
    id: string;
    type: 'attract' | 'repel';
    center: [number, number]; // [lng, lat]
    vertices?: [number, number][]; // Optional polygon vertices for polygon-type zones
    isPolygon: boolean;
    radius: number; // metres (for point zones)
    strength: number; // 0-100 (attraction or repulsion strength)
}

/**
 * Represents directional preference for agent routing
 */
export interface DirectionPreference {
    enabled: boolean;
    directions: CardinalDirection[];
    weight: number; // 0-1, how strongly to favor these directions
}

// ─── Direction Utility Functions ──────────────────────────────────────────────

/**
 * Convert an angle in radians to the nearest cardinal direction
 *
 * @param angle - Angle in radians (0 = North, π/2 = East, π = South, 3π/2 = West)
 * @returns The nearest cardinal direction
 */
export function directionFromAngle(angle: number): CardinalDirection {
    // Normalize angle to [0, 2π)
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Each direction covers a 45° wedge, with N centered at 0
    const octant = Math.round((normalized * 8) / (2 * Math.PI)) % 8;
    const directions: CardinalDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[octant];
}

/**
 * Calculate the bearing (angle) from one coordinate to another
 * Uses the haversine formula to compute initial bearing
 *
 * @param from - Starting coordinate [lng, lat]
 * @param to - Ending coordinate [lng, lat]
 * @returns Bearing in radians (0 = North, clockwise)
 */
export function getBearing(from: [number, number], to: [number, number]): number {
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;

    // Convert to radians
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    // Forward azimuth formula
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const bearing = Math.atan2(y, x);

    // Normalize to [0, 2π)
    return ((bearing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Check if a bearing matches a given cardinal direction within a tolerance
 *
 * @param direction - The cardinal direction to check against
 * @param bearing - The bearing in radians
 * @param tolerance - Tolerance in radians (default: π/4 = 45°)
 * @returns True if bearing is within tolerance of the direction
 */
export function directionMatches(
    direction: CardinalDirection,
    bearing: number,
    tolerance: number = Math.PI / 4,
): boolean {
    const dirAngle = DIRECTION_ANGLES[direction];
    let diff = Math.abs(bearing - dirAngle);

    // Handle wraparound at 2π
    if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
    }

    return diff <= tolerance;
}

// ─── Geometric Utility Functions ──────────────────────────────────────────────

/**
 * Point-in-polygon detection using the ray casting algorithm
 * Works for both convex and concave polygons
 *
 * @param point - Point to test [lng, lat]
 * @param polygon - Polygon vertices in order [[lng, lat], ...]
 * @returns True if point is inside or on the polygon boundary
 */
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;

    if (polygon.length < 3) return false;

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        const intersect =
            yi > y !== yj > y &&
            x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Calculate the distance between two coordinates (metres)
 * Uses the haversine formula
 *
 * @param from - Starting coordinate [lng, lat]
 * @param to - Ending coordinate [lng, lat]
 * @returns Distance in metres
 */
export function distance(from: [number, number], to: [number, number]): number {
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;

    const R = 6_371_000; // Earth radius in metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate the centroid of a polygon
 *
 * @param polygon - Polygon vertices [[lng, lat], ...]
 * @returns Centroid coordinate [lng, lat]
 */
export function polygonCentroid(polygon: [number, number][]): [number, number] {
    if (polygon.length === 0) return [0, 0];

    let sumLng = 0;
    let sumLat = 0;

    for (const [lng, lat] of polygon) {
        sumLng += lng;
        sumLat += lat;
    }

    return [sumLng / polygon.length, sumLat / polygon.length];
}

/**
 * Calculate the area of a polygon in square metres
 * Uses the shoelace formula with haversine distance approximation
 *
 * @param polygon - Polygon vertices [[lng, lat], ...]
 * @returns Area in square metres
 */
export function polygonArea(polygon: [number, number][]): number {
    if (polygon.length < 3) return 0;

    // Shoelace formula for lat/lng
    let sum = 0;
    for (let i = 0; i < polygon.length; i++) {
        const [lng1, lat1] = polygon[i];
        const [lng2, lat2] = polygon[(i + 1) % polygon.length];
        sum += (lng2 - lng1) * (lat2 + lat1);
    }

    // Rough conversion to square metres (at equator, 1 degree ≈ 111 km)
    // This is approximate and improves near equator
    const latAvg = polygon.reduce((sum, [, lat]) => sum + lat, 0) / polygon.length;
    const metersPerDegreeLng = 111_000 * Math.cos((latAvg * Math.PI) / 180);
    const metersPerDegreeLat = 111_000;

    return Math.abs((sum * metersPerDegreeLng * metersPerDegreeLat) / 2);
}

/**
 * Generate a unique zone ID
 * Format: "zone_<timestamp>_<randomSuffix>"
 */
export function generateZoneId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `zone_${timestamp}_${random}`;
}

/**
 * Create a new attraction zone
 */
export function createAttractionZone(
    center: [number, number],
    radius: number = 100,
    strength: number = 50,
): CrowdZone {
    return {
        id: generateZoneId(),
        type: 'attract',
        center,
        isPolygon: false,
        radius,
        strength: Math.max(0, Math.min(100, strength)),
    };
}

/**
 * Create a new repulsion zone
 */
export function createRepulsionZone(
    center: [number, number],
    radius: number = 100,
    strength: number = 50,
): CrowdZone {
    return {
        id: generateZoneId(),
        type: 'repel',
        center,
        isPolygon: false,
        radius,
        strength: Math.max(0, Math.min(100, strength)),
    };
}

/**
 * Create a polygon-type zone
 */
export function createPolygonZone(
    vertices: [number, number][],
    type: 'attract' | 'repel' = 'attract',
    strength: number = 50,
): CrowdZone {
    const center = polygonCentroid(vertices);
    return {
        id: generateZoneId(),
        type,
        center,
        vertices: [...vertices],
        isPolygon: true,
        radius: 0,
        strength: Math.max(0, Math.min(100, strength)),
    };
}
