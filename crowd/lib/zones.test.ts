import {
    directionFromAngle,
    getBearing,
    directionMatches,
    pointInPolygon,
    distance,
    polygonCentroid,
    polygonArea,
    generateZoneId,
    createAttractionZone,
    createRepulsionZone,
    createPolygonZone,
    DIRECTION_ANGLES,
    type CardinalDirection,
} from './zones';

describe('Zone Direction Utilities', () => {
    describe('directionFromAngle', () => {
        it('should map 0 radians to North', () => {
            expect(directionFromAngle(0)).toBe('N');
        });

        it('should map π/4 radians to Northeast', () => {
            expect(directionFromAngle(Math.PI / 4)).toBe('NE');
        });

        it('should map π/2 radians to East', () => {
            expect(directionFromAngle(Math.PI / 2)).toBe('E');
        });

        it('should map π radians to South', () => {
            expect(directionFromAngle(Math.PI)).toBe('S');
        });

        it('should handle angles greater than 2π', () => {
            expect(directionFromAngle(2 * Math.PI + Math.PI / 4)).toBe('NE');
        });

        it('should handle negative angles', () => {
            expect(directionFromAngle(-Math.PI / 2)).toBe('W');
        });
    });

    describe('getBearing', () => {
        it('should return 0 (North) for coordinate directly north', () => {
            const bearing = getBearing([0, 0], [0, 1]);
            expect(bearing).toBeCloseTo(0, 2);
        });

        it('should return π/2 (East) for coordinate directly east', () => {
            const bearing = getBearing([0, 0], [1, 0]);
            expect(bearing).toBeCloseTo(Math.PI / 2, 2);
        });

        it('should return π (South) for coordinate directly south', () => {
            const bearing = getBearing([0, 1], [0, 0]);
            expect(bearing).toBeCloseTo(Math.PI, 2);
        });

        it('should return 3π/2 (West) for coordinate directly west', () => {
            const bearing = getBearing([1, 0], [0, 0]);
            expect(Math.abs(bearing - (3 * Math.PI) / 2)).toBeLessThan(0.1);
        });

        it('should return same bearing for parallel vectors', () => {
            const b1 = getBearing([0, 0], [1, 1]);
            const b2 = getBearing([10, 10], [11, 11]);
            expect(Math.abs(b1 - b2)).toBeLessThan(0.01);
        });
    });

    describe('directionMatches', () => {
        it('should match exact direction', () => {
            const northAngle = DIRECTION_ANGLES['N'];
            expect(directionMatches('N', northAngle)).toBe(true);
        });

        it('should match direction within default tolerance (45°)', () => {
            const northAngle = DIRECTION_ANGLES['N'];
            const withinTolerance = northAngle + Math.PI / 8; // 22.5° from N
            expect(directionMatches('N', withinTolerance)).toBe(true);
        });

        it('should not match direction outside default tolerance', () => {
            const northAngle = DIRECTION_ANGLES['N'];
            const outsideTolerance = northAngle + Math.PI / 3; // 60° from N
            expect(directionMatches('N', outsideTolerance)).toBe(false);
        });

        it('should respect custom tolerance', () => {
            const northAngle = DIRECTION_ANGLES['N'];
            const angle = northAngle + Math.PI / 6; // 30° from N
            expect(directionMatches('N', angle, Math.PI / 4)).toBe(true); // 45° tolerance
            expect(directionMatches('N', angle, Math.PI / 8)).toBe(false); // 22.5° tolerance
        });

        it('should handle wraparound at 2π', () => {
            // 355° should match North (5° away)
            const almostNorth = (2 * Math.PI) - (Math.PI / 36); // 355°
            expect(directionMatches('N', almostNorth, Math.PI / 6)).toBe(true);
        });
    });
});

describe('Zone Geometric Utilities', () => {
    describe('pointInPolygon', () => {
        it('should detect point inside simple square', () => {
            const square: [number, number][] = [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
            ];
            expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
        });

        it('should detect point outside simple square', () => {
            const square: [number, number][] = [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
            ];
            expect(pointInPolygon([2, 0.5], square)).toBe(false);
        });

        it('should handle triangle', () => {
            const triangle: [number, number][] = [
                [0, 0],
                [2, 0],
                [1, 2],
            ];
            expect(pointInPolygon([1, 1], triangle)).toBe(true);
            expect(pointInPolygon([0, 2], triangle)).toBe(false);
        });

        it('should handle concave polygon', () => {
            // L-shaped polygon
            const lShape: [number, number][] = [
                [0, 0],
                [2, 0],
                [2, 1],
                [1, 1],
                [1, 2],
                [0, 2],
            ];
            expect(pointInPolygon([0.5, 0.5], lShape)).toBe(true);
            expect(pointInPolygon([1.5, 1.5], lShape)).toBe(false);
        });

        it('should return false for polygon with less than 3 vertices', () => {
            expect(pointInPolygon([0, 0], [[0, 0], [1, 1]])).toBe(false);
            expect(pointInPolygon([0, 0], [[0, 0]])).toBe(false);
        });
    });

    describe('distance', () => {
        it('should return 0 for identical points', () => {
            expect(distance([0, 0], [0, 0])).toBeCloseTo(0, 2);
        });

        it('should calculate distance correctly for known coordinates', () => {
            // Bangalore to a point ~1km away (approximately)
            const dist = distance([77.6, 12.9], [77.61, 12.9]);
            expect(dist).toBeGreaterThan(500); // At least 500m
            expect(dist).toBeLessThan(2000); // But less than 2km
        });

        it('should be symmetric', () => {
            const d1 = distance([0, 0], [1, 1]);
            const d2 = distance([1, 1], [0, 0]);
            expect(Math.abs(d1 - d2)).toBeLessThan(0.01);
        });
    });

    describe('polygonCentroid', () => {
        it('should calculate centroid of square', () => {
            const square: [number, number][] = [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 2],
            ];
            const [lng, lat] = polygonCentroid(square);
            expect(lng).toBeCloseTo(1, 2);
            expect(lat).toBeCloseTo(1, 2);
        });

        it('should calculate centroid of triangle', () => {
            const triangle: [number, number][] = [
                [0, 0],
                [3, 0],
                [0, 3],
            ];
            const [lng, lat] = polygonCentroid(triangle);
            expect(lng).toBeCloseTo(1, 2);
            expect(lat).toBeCloseTo(1, 2);
        });

        it('should return [0, 0] for empty polygon', () => {
            const [lng, lat] = polygonCentroid([]);
            expect(lng).toBe(0);
            expect(lat).toBe(0);
        });
    });

    describe('polygonArea', () => {
        it('should return 0 for polygon with less than 3 vertices', () => {
            expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
            expect(polygonArea([[0, 0]])).toBe(0);
        });

        it('should calculate area of square (in approximate square metres)', () => {
            // Small square near equator
            const square: [number, number][] = [
                [0, 0],
                [0.01, 0],
                [0.01, 0.01],
                [0, 0.01],
            ];
            const area = polygonArea(square);
            expect(area).toBeGreaterThan(1000); // Should be roughly 1km²
            expect(area).toBeLessThan(20000); // But not huge
        });
    });
});

describe('Zone Factory Functions', () => {
    describe('generateZoneId', () => {
        it('should generate unique IDs', () => {
            const id1 = generateZoneId();
            const id2 = generateZoneId();
            expect(id1).not.toBe(id2);
        });

        it('should start with zone_ prefix', () => {
            const id = generateZoneId();
            expect(id).toMatch(/^zone_/);
        });
    });

    describe('createAttractionZone', () => {
        it('should create zone with correct defaults', () => {
            const zone = createAttractionZone([77.6, 12.9]);
            expect(zone.type).toBe('attract');
            expect(zone.center).toEqual([77.6, 12.9]);
            expect(zone.radius).toBe(100);
            expect(zone.strength).toBe(50);
            expect(zone.isPolygon).toBe(false);
        });

        it('should cap strength at 100', () => {
            const zone = createAttractionZone([77.6, 12.9], 100, 150);
            expect(zone.strength).toBe(100);
        });

        it('should clamp strength to 0', () => {
            const zone = createAttractionZone([77.6, 12.9], 100, -50);
            expect(zone.strength).toBe(0);
        });
    });

    describe('createRepulsionZone', () => {
        it('should create zone with repel type', () => {
            const zone = createRepulsionZone([77.6, 12.9]);
            expect(zone.type).toBe('repel');
        });

        it('should have same interface as attraction zone', () => {
            const repel = createRepulsionZone([77.6, 12.9], 150, 80);
            expect(repel.type).toBe('repel');
            expect(repel.radius).toBe(150);
            expect(repel.strength).toBe(80);
        });
    });

    describe('createPolygonZone', () => {
        it('should create polygon zone with centroid', () => {
            const vertices: [number, number][] = [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
            ];
            const zone = createPolygonZone(vertices);
            expect(zone.isPolygon).toBe(true);
            expect(zone.vertices).toEqual(vertices);
            expect(zone.center).toEqual([0.5, 0.5]);
        });

        it('should default to attraction type', () => {
            const vertices: [number, number][] = [[0, 0], [1, 0], [0, 1]];
            const zone = createPolygonZone(vertices);
            expect(zone.type).toBe('attract');
        });

        it('should support repulsion type', () => {
            const vertices: [number, number][] = [[0, 0], [1, 0], [0, 1]];
            const zone = createPolygonZone(vertices, 'repel', 75);
            expect(zone.type).toBe('repel');
            expect(zone.strength).toBe(75);
        });
    });
});
