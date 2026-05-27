'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { SimulationSnapshot, TrackedPath } from '@/lib/simulation';
import type { GeoEdge, GeoNode } from '@/lib/graph';
import { getCongestionLevel } from '@/lib/graph';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InteractionMode = 'view' | 'add-entry' | 'add-exit' | 'block-road';

interface MapViewProps {
  snapshot:     SimulationSnapshot | null;
  center:       [number, number];
  zoom:         number;
  venueKey:     string;
  mode:         InteractionMode;
  is3D:         boolean;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

// Free CARTO dark-matter style — no API key needed
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Blue (empty) → Yellow → Orange → Red (jammed) */
function roadColor(level: number): [number, number, number, number] {
  const c = Math.min(1, Math.max(0, level));
  if (c < 0.25) {
    const t = c / 0.25;
    return [Math.round(30 + 220 * t), Math.round(100 + 104 * t), Math.round(230 - 209 * t), 200];
  }
  if (c < 0.6) {
    const t = (c - 0.25) / 0.35;
    return [250, Math.round(204 - 89 * t), 21, 210];
  }
  const t = (c - 0.6) / 0.4;
  return [225, Math.round(115 - 90 * t), 20, 230];
}

function highwayWidth(hw: string): number {
  if (hw === 'primary' || hw === 'trunk') return 7;
  if (hw === 'secondary') return 5;
  if (hw === 'tertiary')  return 3.5;
  return 2;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapView({
  snapshot, center, zoom, venueKey, mode, is3D,
  onNodeClick, onEdgeClick,
}: MapViewProps) {
  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude:  center[1],
    zoom,
    pitch:     is3D ? 45 : 0,
    bearing:   0,
  });

  // Fly to new venue when it changes, respect 3D toggle
  useEffect(() => {
    setViewState(v => ({
      ...v,
      longitude: center[0],
      latitude:  center[1],
      zoom,
      pitch: is3D ? 45 : 0,
    }));
  }, [center, zoom, is3D]);

  const layers = useMemo(() => {
    if (!snapshot) return [];
    const { graph, agents, recentPaths, entryNodeIds, exitNodeIds, spawnRadius } = snapshot;

    const allEdges   = [...graph.edges.values()];
    const openRoads  = allEdges.filter(e => !e.blocked);
    const closedRoad = allEdges.filter(e => e.blocked);
    const allNodes   = [...graph.nodes.values()];
    const moving     = agents.filter(a => a.status === 'moving');

    // ── 1. Base roads (congestion colour) ─────────────────────────────────
    const roadsLayer = new PathLayer<GeoEdge>({
      id: 'roads',
      data: openRoads,
      getPath:  (e: GeoEdge) => e.coordinates as [number, number][],
      getColor: (e: GeoEdge) => roadColor(getCongestionLevel(e)),
      getWidth: (e: GeoEdge) => highwayWidth(e.highway),
      widthMinPixels: 1.5,
      widthMaxPixels: 12,
      pickable: mode === 'block-road',
      onClick: (info: PickingInfo) => {
        const obj = info.object as GeoEdge | undefined;
        if (obj && onEdgeClick) onEdgeClick(obj.id);
        return true;
      },
      updateTriggers: { getColor: [snapshot.tick] },
    });

    // ── 2. Blocked roads (solid red, thicker) ─────────────────────────────
    const blockedLayer = new PathLayer<GeoEdge>({
      id: 'blocked',
      data: closedRoad,
      getPath:  (e: GeoEdge) => e.coordinates as [number, number][],
      getColor: (): [number, number, number, number] => [255, 40, 40, 240],
      getWidth: () => 6,
      widthMinPixels: 3,
    });

    // ── 3. Recent evacuation paths (glowing trail) ─────────────────────────
    // Newest path is brightest; older ones fade to transparent
    const pathsLayer = new PathLayer<TrackedPath>({
      id: 'evac-paths',
      data: recentPaths,
      getPath:  (p: TrackedPath) => p.coords as [number, number][],
      getColor: (p: TrackedPath): [number, number, number, number] => {
        const alpha = Math.max(0, 220 - p.age * 18);
        return [255, 230, 60, alpha];
      },
      getWidth: () => 3.5,
      widthMinPixels: 2,
      widthMaxPixels: 8,
      updateTriggers: { getColor: [snapshot.tick] },
    });

    // ── 4. Spawn zone — transparent circle around entry nodes ──────────────
    const entryNodes = allNodes.filter(n => entryNodeIds.includes(n.id));
    const spawnZoneLayer = new ScatterplotLayer<GeoNode>({
      id: 'spawn-zone',
      data: entryNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius:   () => spawnRadius,   // deck.gl radius is in metres
      getFillColor:    (): [number, number, number, number] => [0, 230, 120, 18],
      getLineColor:    (): [number, number, number, number] => [0, 230, 120, 160],
      stroked: true,
      filled:  true,
      lineWidthMinPixels: 2,
      radiusUnits: 'meters',
    });

    // ── 5. Exit zones (yellow ring) ────────────────────────────────────────
    const exitNodes = allNodes.filter(n => exitNodeIds.includes(n.id));
    const exitZoneLayer = new ScatterplotLayer<GeoNode>({
      id: 'exit-zone',
      data: exitNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius:   () => 40,
      getFillColor:    (): [number, number, number, number] => [255, 200, 30, 20],
      getLineColor:    (): [number, number, number, number] => [255, 200, 30, 180],
      stroked: true,
      filled:  true,
      lineWidthMinPixels: 2,
      radiusUnits: 'meters',
    });

    // ── 6. Intersection nodes (dim, small) ────────────────────────────────
    const intersections = allNodes.filter(
      n => n.type === 'intersection' || n.type === 'waypoint',
    );
    const interLayer = new ScatterplotLayer<GeoNode>({
      id: 'intersections',
      data: intersections,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => 2.5,
      getFillColor: (): [number, number, number, number] => [200, 200, 200, 50],
      radiusMinPixels: 1.5,
      radiusMaxPixels: 5,
      pickable: mode === 'add-entry' || mode === 'add-exit',
      onClick: (info: PickingInfo) => {
        const obj = info.object as GeoNode | undefined;
        if (obj && onNodeClick) onNodeClick(obj.id);
        return true;
      },
    });

    // ── 7. Entry marker — bright green pin ────────────────────────────────
    const entryMarkerLayer = new ScatterplotLayer<GeoNode>({
      id: 'entry-markers',
      data: entryNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => 12,
      getFillColor:  (): [number, number, number, number] => [0, 255, 120, 255],
      getLineColor:  (): [number, number, number, number] => [0, 180, 80,  255],
      stroked: true,
      filled:  true,
      lineWidthMinPixels: 3,
      radiusMinPixels: 7,
      radiusMaxPixels: 18,
    });

    // ── 8. Exit markers — amber pin ───────────────────────────────────────
    const exitMarkerLayer = new ScatterplotLayer<GeoNode>({
      id: 'exit-markers',
      data: exitNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => 12,
      getFillColor:  (): [number, number, number, number] => [255, 200, 30, 255],
      getLineColor:  (): [number, number, number, number] => [200, 140,  0, 255],
      stroked: true,
      filled:  true,
      lineWidthMinPixels: 3,
      radiusMinPixels: 7,
      radiusMaxPixels: 18,
    });

    // ── 9. Crowd agents ───────────────────────────────────────────────────
    type MA = typeof moving[0];
    const agentsLayer = new ScatterplotLayer<MA>({
      id: 'agents',
      data: moving,
      getPosition: (a: MA): [number, number, number] => [a.position[0], a.position[1], 0],
      getRadius:   () => 5,
      getFillColor:(a: MA): [number, number, number, number] => [...a.color, 230] as [number, number, number, number],
      getLineColor:(): [number, number, number, number] => [255, 255, 255, 60],
      stroked: true,
      lineWidthMinPixels: 0.5,
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      updateTriggers: { getPosition: [snapshot.tick] },
    });

    return [
      roadsLayer, blockedLayer, pathsLayer,
      spawnZoneLayer, exitZoneLayer,
      interLayer,
      entryMarkerLayer, exitMarkerLayer,
      agentsLayer,
    ];
  }, [snapshot, mode, onNodeClick, onEdgeClick]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onVSC = useCallback(({ viewState: vs }: any) => setViewState(vs), []);

  return (
    <DeckGL
      key={venueKey}
      viewState={viewState}
      onViewStateChange={onVSC}
      controller={true}
      layers={layers}
      getCursor={() => (mode === 'view' ? 'grab' : 'crosshair')}
      style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
    >
      <Map mapStyle={MAP_STYLE} reuseMaps />
    </DeckGL>
  );
}
