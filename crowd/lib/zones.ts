// Zones library

// Direction types

export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// Angles in radians
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

// Zone types

// Crowd zone interface
export interface CrowdZone {
    id: string;
    type: 'attract' | 'repel';
    center: [number, number]; // Coordinates
    vertices?: [number, number][]; // Polygon vertices
    isPolygon: boolean;
    radius: number; // Radius metres
    strength: number; // Zone strength
}

// Route preferences
export interface DirectionPreference {
    enabled: boolean;
    directions: CardinalDirection[];
    weight: number; // Preference weight
}

// Direction helpers

// Angle to direction
export function directionFromAngle(angle: number): CardinalDirection {
    // Normalize angle
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // 45 degree wedges
    const octant = Math.round((normalized * 8) / (2 * Math.PI)) % 8;
    const directions: CardinalDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[octant];
}

// Calculate bearing
export function getBearing(from: [number, number], to: [number, number]): number {
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;

    // To radians
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    // Azimuth formula
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const bearing = Math.atan2(y, x);

    // Normalize bearing
    return ((bearing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

// Match direction
export function directionMatches(
    direction: CardinalDirection,
    bearing: number,
    tolerance: number = Math.PI / 4,
): boolean {
    const dirAngle = DIRECTION_ANGLES[direction];
    let diff = Math.abs(bearing - dirAngle);

    // Wrap 2pi
    if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
    }

    return diff <= tolerance;
}

// Geometry helpers

// Point inside polygon
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

// Coordinate distance
export function distance(from: [number, number], to: [number, number]): number {
    const [lng1, lat1] = from;
    const [lng2, lat2] = to;

    const R = 6_371_000; // Earth radius
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Polygon centroid
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

// Polygon area
export function polygonArea(polygon: [number, number][]): number {
    if (polygon.length < 3) return 0;

    // Shoelace formula
    let sum = 0;
    for (let i = 0; i < polygon.length; i++) {
        const [lng1, lat1] = polygon[i];
        const [lng2, lat2] = polygon[(i + 1) % polygon.length];
        sum += (lng2 - lng1) * (lat2 + lat1);
    }

    // Approximate scaling
    const latAvg = polygon.reduce((sum, [, lat]) => sum + lat, 0) / polygon.length;
    const metersPerDegreeLng = 111_000 * Math.cos((latAvg * Math.PI) / 180);
    const metersPerDegreeLat = 111_000;

    return Math.abs((sum * metersPerDegreeLng * metersPerDegreeLat) / 2);
}

// Generate ID
export function generateZoneId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `zone_${timestamp}_${random}`;
}

// Attraction zone
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

// Repulsion zone
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

// Polygon zone
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
