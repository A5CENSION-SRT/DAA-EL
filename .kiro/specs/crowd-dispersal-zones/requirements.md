# Crowd Dispersal Zones - Requirements

## Project Overview

**Feature Name:** crowd-dispersal-zones  
**Type:** Enhancement to existing H3 Crowd Control simulation  
**Core Functionality:** Enable users to create custom crowd zones, manually define zones, randomly generate zones, and route agents in 8 directions for effective crowd dispersal  
**Target Users:** Urban planners, event organizers, emergency response coordinators

---

## User Stories

### 1. Custom Attraction Zones
**As a** user,  
**I want to** create custom points where crowds naturally gather,  
**So that** I can simulate realistic crowd behavior at landmarks, shops, or event venues.

- User can click to place attraction zone markers on the map
- Each attraction zone has a configurable attraction strength (0-100)
- Agents within range of attraction zones are pulled toward them before proceeding to exit

### 2. Manual Zone Definition
**As a** user,  
**I want to** manually draw custom zones by clicking multiple points,  
**So that** I can define irregularly shaped gathering areas.

- User enters "draw zone" mode
- Click multiple points on map to define polygon vertices
- Double-click or press Enter to close the polygon
- Zone becomes active for crowd behavior

### 3. Random Zone Generation
**As a** user,  
**I want to** generate random zones with one click,  
**So that** I can quickly set up various dispersal scenarios.

- Button to generate N random attraction zones within venue bounds
- Configurable zone count (1-10)
- Zones have random attraction strength and size

### 4. 8-Direction Routing
**As a** user,  
**I want to** specify preferred movement directions for agents,  
**So that** I can test which dispersal directions work best.

- 8 direction buttons: N, NE, E, SE, S, SW, W, NW
- User can select one or multiple preferred directions
- Agents favor paths that align with selected directions
- Direction preference affects pathfinding heuristic

### 5. Zone Type: Repulsion Zones
**As a** user,  
**I want to** create zones that agents avoid,  
**So that** I can simulate hazards, construction areas, or blocked paths.

- Toggle zone type between "attract" and "repel"
- Repulsion zones have negative attraction strength
- Agents route around repulsion zones

---

## Acceptance Criteria

### AC1: Attraction Zones
- [ ] User can click map to place attraction zone marker
- [ ] Zones display with distinct visual (purple glow)
- [ ] Agents within zone radius are influenced by attraction
- [ ] Attraction strength slider (0-100) controls pull strength

### AC2: Manual Zone Drawing
- [ ] "Draw Zone" mode available in Crowd Zone panel
- [ ] Click to add polygon vertices (min 3 points)
- [ ] Visual feedback shows polygon being drawn
- [ ] Double-click closes polygon and creates zone

### AC3: Random Zone Generation
- [ ] "Random Zones" button in Crowd Zone panel
- [ ] Slider to select number of zones (1-10)
- [ ] Zones appear randomly within venue bounds
- [ ] Each zone has random attraction strength

### AC4: 8-Direction Routing
- [ ] Direction selector UI with 8 compass directions
- [ ] Single or multi-select directions
- [ ] Pathfinding considers direction preference
- [ ] Visual indicator shows active direction preference

### AC5: Repulsion Zones
- [ ] Toggle switch for zone type (Attract/Repel)
- [ ] Repulsion zones render in different color (red)
- [ ] Agents avoid repulsion zones in pathfinding
- [ ] Repulsion strength configurable

---

## Technical Notes

### Data Structures

```typescript
interface CrowdZone {
  id: string;
  type: 'attract' | 'repel';
  center: [number, number]; // [lng, lat]
  vertices?: [number, number][]; // For polygon zones
  radius: number; // For point/circle zones
  strength: number; // 0-100 attraction/repulsion strength
  color: string;
}

type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

interface DirectionPreference {
  enabled: boolean;
  directions: Direction[];
  weight: number; // How strongly to favor this direction (0-1)
}
```

### UI Components

- Zone mode buttons: Add Attraction | Draw Zone | Add Repulsion
- Random Zones button with count slider
- 8-direction compass selector
- Zone list with edit/delete capabilities

### Pathfinding Integration

- Modify pathfinding to accept direction preference
- Attraction zones add waypoints to agent paths
- Repulsion zones add penalty weights to nearby edges