# Crowd Dispersal Zones - Design Document

## Architecture Overview

### Component Changes

**New Files:**
- `crowd/lib/zones.ts` - Zone management logic
- `crowd/hooks/useZones.ts` - React hook for zone state
- `crowd/components/ZoneControls.tsx` - UI panel for zone management
- `crowd/components/MapView.tsx` - Updated to render zones

**Modified Files:**
- `crowd/lib/simulation.ts` - Integrate zone influence into agent movement
- `crowd/lib/pathfinding.ts` - Add direction preference to algorithms
- `crowd/hooks/useSimulation.ts` - Expose zone methods
- `crowd/app/page.tsx` - Add zone control panel

---

## Implementation Details

### 1. Zone Data Structure (zones.ts)

```typescript
// Direction types
export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// Direction to angle in radians (clockwise from North)
export const DIRECTION_ANGLES: Record<CardinalDirection, number> = {
  N: 0, NE: Math.PI / 4, E: Math.PI / 2, SE: (3 * Math.PI) / 4,
  S: Math.PI, SW: (5 * Math.PI) / 4, W: (3 * Math.PI) / 2, NW: (7 * Math.PI) / 4,
};

export interface CrowdZone {
  id: string;
  type: 'attract' | 'repel';
  center: [number, number]; // [lng, lat]
  vertices?: [number, number][]; // Polygon vertices
  isPolygon: boolean;
  radius: number; // For point zones (meters)
  strength: number; // 0-100
}

export interface DirectionPreference {
  enabled: boolean;
  directions: CardinalDirection[];
  weight: number; // 0-1, how strongly to favor
}

// Direction helper functions
export function directionFromAngle(angle: number): CardinalDirection;
export function getBearing(from: [number, number], to: [number, number]): number;
export function directionMatches(direction: CardinalDirection, bearing: number, tolerance: number): boolean;
```

### 2. Zone Influence on Agents (simulation.ts)

**Modified: `#spawnAgent`**
- Before computing path, check for nearby attraction zones
- If agent spawns near attraction zone, add zone center as intermediate waypoint
- Apply attraction strength to influence spawn position selection

**Modified: `#moveAgents`**
- Calculate repulsion force from nearby repulsion zones
- Apply direction preference to path selection
- Agent path can be modified in real-time based on zone changes

### 3. Direction-Aware Pathfinding (pathfinding.ts)

**Modified: All pathfinding functions**
- Accept optional `directionPreference` parameter
- Add directional cost bonus/penalty to edge weights
- Algorithm: `dijkstra(graph, startId, endIds, options?)`

```typescript
interface PathfindingOptions {
  directionPreference?: DirectionPreference;
  avoidZones?: string[]; // Zone IDs to avoid
  attractZones?: string[]; // Zone IDs to attract toward
}
```

**Direction Cost Calculation:**
```
For each edge in path:
  edgeBearing = getBearing(edge.source, edge.target)
  directionMatch = directions.some(d => directionMatches(d, edgeBearing, 45°))
  if (directionMatch):
    cost *= (1 - directionWeight)  // Reduce cost
  else:
    cost *= (1 + directionWeight)  // Increase cost
```

### 4. Zone Rendering (MapView.tsx)

**New Layers:**

1. **Zone Polygon Layer** - For drawn polygon zones
   - Fill: semi-transparent (attract: purple, repel: red)
   - Stroke: solid border

2. **Zone Marker Layer** - For point/circle zones
   - Circle with glow effect
   - Size based on radius and strength
   - Pulsing animation for active zones

3. **Zone Influence Radius** - Visualize zone effect area
   - Dashed circle around zone center

### 5. UI Components (ZoneControls.tsx)

**Panel Sections:**

1. **Zone Mode Selector**
   - Buttons: Point Zone | Draw Zone | View
   - Active mode highlighted

2. **Zone Type Toggle**
   - Attract (green) / Repel (red) toggle

3. **Zone Properties**
   - Radius slider (50-500m)
   - Strength slider (0-100)

4. **Random Zone Generator**
   - Count slider (1-10)
   - Generate button

5. **Direction Preference**
   - 8-direction compass buttons
   - Multi-select enabled
   - Weight slider

6. **Zone List**
   - Editable list of all zones
   - Delete button per zone

---

## State Management

### SimulationSnapshot Changes

```typescript
interface SimulationSnapshot {
  // ... existing fields
  zones: CrowdZone[];
  directionPreference: DirectionPreference;
  drawMode: 'view' | 'draw-point' | 'draw-polygon' | 'add-repel';
  drawingVertices: [number, number][];
}
```

### useSimulation Hook Changes

```typescript
// New methods
addZone(zone: Omit<CrowdZone, 'id'>): void
updateZone(id: string, updates: Partial<CrowdZone>): void
removeZone(id: string): void
setDirectionPreference(pref: DirectionPreference): void
setDrawMode(mode: DrawMode): void
addDrawVertex(coord: [number, number]): void
clearDrawing(): void
generateRandomZones(count: number): void
```

---

## Edge Cases

1. **Zone overlaps exit** - Agent pathfinding prioritizes exit over attraction
2. **Repulsion blocks all paths** - Fallback to standard routing with warning
3. **Drawing polygon with < 3 points** - Show validation message
4. **Zone outside venue bounds** - Clamp to venue bbox
5. **No directions selected** - Ignore direction preference
6. **All zones deleted** - Reset to baseline behavior

---

## Testing Strategy

### Unit Tests (zones.ts)
- Direction angle calculations
- Bearing calculation between points
- Point-in-polygon detection
- Random zone generation bounds

### Integration Tests
- Zone creation through UI
- Agent pathfinding with zones
- Direction preference effects
- Random zone generation

### Property-Based Tests
- Path cost monotonicity with direction weight
- Zone influence range correctness
- Polygon area calculation