# Crowd Dispersal Zones - Implementation Tasks

## Task List

### Phase 1: Core Zone Infrastructure

- [ ] 1.1 Create `crowd/lib/zones.ts` - Zone types and helper functions
- [ ] 1.2 Implement direction utilities (CardinalDirection, bearing calculation)
- [ ] 1.3 Implement point-in-polygon detection
- [ ] 1.4 Add zone type definitions to simulation.ts (interface changes)

### Phase 2: Zone Management in Simulation

- [ ] 2.1 Add zones array to SimulationSnapshot
- [ ] 2.2 Add directionPreference to SimulationSnapshot  
- [ ] 2.3 Implement addZone, updateZone, removeZone methods in SimulationEngine
- [ ] 2.4 Implement setDirectionPreference method
- [ ] 2.5 Add zone influence to agent spawn (attraction affects spawn position)
- [ ] 2.6 Add direction preference cost modifier to pathfinding

### Phase 3: Pathfinding Updates

- [ ] 3.1 Modify pathfinding.ts to accept direction preference option
- [ ] 3.2 Add directional cost calculation to edge weights
- [ ] 3.3 Add zone avoidance (repulsion) to edge weights

### Phase 4: React Hook Updates

- [ ] 4.1 Update useSimulation hook with zone methods
- [ ] 4.2 Add addZone, updateZone, removeZone callbacks
- [ ] 4.3 Add setDirectionPreference callback
- [ ] 4.4 Add random zone generation method

### Phase 5: UI Components

- [ ] 5.1 Create ZoneControls component for sidebar
- [ ] 5.2 Add zone mode selector (Point Zone, Draw Zone, View)
- [ ] 5.3 Add zone type toggle (Attract/Repel)
- [ ] 5.4 Add radius and strength sliders
- [ ] 5.5 Add random zone generator with count slider
- [ ] 5.6 Add 8-direction compass selector
- [ ] 5.7 Add zone list with edit/delete

### Phase 6: Map Rendering

- [ ] 6.1 Update MapView to render zones
- [ ] 6.2 Add zone polygon layer for drawn zones
- [ ] 6.3 Add zone marker layer for point zones
- [ ] 6.4 Add zone influence radius visualization
- [ ] 6.5 Handle click events for zone placement
- [ ] 6.6 Handle polygon drawing mode

### Phase 7: Integration & Testing

- [ ] 7.1 Integrate ZoneControls into main page
- [ ] 7.2 Wire up all callbacks
- [ ] 7.3 Test zone creation works
- [ ] 7.4 Test direction routing works
- [ ] 7.5 Test random zone generation
- [ ] 7.6 Test repulsion zones

---

## Task Dependencies

```
1.1 → 1.2 → 1.3 → 1.4
           ↓
2.1 ← 2.2 ← 2.3 ← 1.4
 ↓     ↓     ↓
2.4 → 2.5 → 2.6 → 3.1 → 3.2 → 3.3
                        ↓
4.1 ← 4.2 ← 4.3 ← 4.4 ← 2.6
 ↓     ↓     ↓
5.1 ← 5.2 ← 5.3 ← 5.4 ← 5.5 ← 5.6 ← 5.7 ← 4.4
                       ↓
6.1 ← 6.2 ← 6.3 ← 6.4 ← 6.5 ← 6.6 ← 5.1
                       ↓
7.1 ← 7.2 ← 7.3 ← 7.4 ← 7.5 ← 7.6 ← 7.7
```

---

## Implementation Priority

1. Core zone types and direction math (most fundamental)
2. Simulation engine integration (affects core behavior)
3. Pathfinding modifications (affects routing)
4. Map visualization (user feedback)
5. UI controls (user interaction)
6. Integration testing (end-to-end)