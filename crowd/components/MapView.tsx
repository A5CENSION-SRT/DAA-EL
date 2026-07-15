'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer, TextLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { cellToLatLng } from 'h3-js';
import type { PickingInfo } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { SimulationSnapshot, TrackedPath } from '@/lib/simulation';
import type { GeoEdge, GeoNode } from '@/lib/graph';
import { getCongestionLevel } from '@/lib/graph';
import { densityColor, getVenueGridCells, type HexCell } from '@/lib/h3-spatial';
import type { CrowdZone } from '@/lib/zones';

// Types

export type InteractionMode = 'view' | 'add-entry' | 'add-exit' | 'block-road' | 'pick-location';

interface MapViewProps {
  snapshot: SimulationSnapshot | null;
  center: [number, number];
  zoom: number;
  venueKey: string;
  bbox?: [number, number, number, number]; // Bounding box
  mode: InteractionMode;
  is3D: boolean;
  showH3Layer: boolean;
  showH3Counts: boolean;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onLocationPick?: (lng: number, lat: number) => void;
  onViewChange?: (center: [number, number], zoom: number) => void;
}

// Map style
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Congestion color

function roadRGBA(level: number): [number, number, number, number] {
  const c = Math.min(1, Math.max(0, level));
  if (c < 0.25) {
    const t = c / 0.25;
    return [Math.round(30 + 220 * t), Math.round(100 + 104 * t), Math.round(230 - 210 * t), 190];
  }
  if (c < 0.6) {
    const t = (c - 0.25) / 0.35;
    return [250, Math.round(204 - 90 * t), 20, 210];
  }
  const t = (c - 0.6) / 0.4;
  return [225, Math.round(114 - 95 * t), 20, 230];
}

function hwWidth(hw: string): number {
  if (hw === 'primary' || hw === 'trunk') return 7;
  if (hw === 'secondary') return 5;
  if (hw === 'tertiary') return 3.5;
  return 2;
}

// MapView component

export function MapView({
  snapshot, center, zoom, venueKey, bbox, mode, is3D, showH3Layer, showH3Counts,
  onNodeClick, onEdgeClick, onLocationPick, onViewChange,
}: MapViewProps) {
  const [viewState, setViewState] = useState({
    longitude: center[0], latitude: center[1],
    zoom, pitch: is3D ? 45 : 0, bearing: 0,
  });

  useEffect(() => {
    setViewState(v => ({
      ...v,
      longitude: center[0], latitude: center[1],
      zoom, pitch: is3D ? 45 : 0,
    }));
  }, [center, zoom, is3D]);

  // Static grid
  const h3Resolution = snapshot?.h3Resolution ?? 10;

  const gridCells = useMemo<string[]>(() => {
    if (!showH3Layer || !bbox) return [];
    return getVenueGridCells(bbox, h3Resolution);
  }, [showH3Layer, bbox, h3Resolution]);

  // Layer stack
  const layers = useMemo(() => {
    if (!snapshot) return [];
    const { graph, agents, recentPaths, entryNodeIds, exitNodeIds, spawnRadius, h3Cells } = snapshot;

    const allEdges = [...graph.edges.values()];
    const openEdges = allEdges.filter(e => !e.blocked);
    const blkEdges = allEdges.filter(e => e.blocked);
    const allNodes = [...graph.nodes.values()];
    const moving = agents.filter(a => a.status === 'moving');

    const entryNodes = allNodes.filter(n => entryNodeIds.includes(n.id));
    const exitNodes = allNodes.filter(n => exitNodeIds.includes(n.id));
    const interNodes = allNodes.filter(n => n.type === 'intersection' || n.type === 'waypoint');

    // Ghost grid
    const h3GridLayer = showH3Layer && gridCells.length > 0 ? new H3HexagonLayer<string>({
      id: 'h3-grid',
      data: gridCells,
      getHexagon: (d: string) => d,
      getFillColor: (): [number, number, number, number] => [70, 100, 220, 14],
      getElevation: () => 0,
      elevationScale: 0,
      extruded: false,
      opacity: 1,
      coverage: 0.96,   // slight gap between hexes → visible grid seams
      pickable: false,
      updateTriggers: {},
    }) : null;

    // Road network
    const roadsLayer = new PathLayer<GeoEdge>({
      id: 'roads',
      data: openEdges,
      getPath: (e: GeoEdge) => e.coordinates as [number, number][],
      getColor: (e: GeoEdge) => roadRGBA(getCongestionLevel(e)),
      getWidth: (e: GeoEdge) => hwWidth(e.highway),
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

    // Blocked roads
    const blockedLayer = new PathLayer<GeoEdge>({
      id: 'blocked',
      data: blkEdges,
      getPath: (e: GeoEdge) => e.coordinates as [number, number][],
      getColor: (): [number, number, number, number] => [255, 40, 40, 240],
      getWidth: () => 7,
      widthMinPixels: 3,
    });

    // Density layer
    const h3DensityLayer = showH3Layer && h3Cells.length > 0 ? new H3HexagonLayer<HexCell>({
      id: 'h3-density',
      data: h3Cells,
      getHexagon: (d: HexCell) => d.hex,
      getFillColor: (d: HexCell) => densityColor(d.normalized),
      getElevation: (d: HexCell) => d.count * 12,
      elevationScale: is3D ? 3 : 0,
      extruded: is3D,
      opacity: 0.82,
      coverage: 0.92,
      material: { ambient: 0.55, diffuse: 0.7, shininess: 30 },
      updateTriggers: {
        getFillColor: [snapshot.tick],
        getElevation: [snapshot.tick, is3D],
      },
    }) : null;

    // H3 counts
    const h3CountsLayer = showH3Counts && h3Cells.length > 0 ? new TextLayer<HexCell>({
      id: 'h3-counts',
      data: h3Cells,
      getPosition: (d: HexCell): [number, number, number] => {
        const [lat, lng] = cellToLatLng(d.hex);
        return [lng, lat, is3D ? ((d.count * 12 * 3) + 5) : 0];
      },
      getText: (d: HexCell) => d.count.toString(),
      getSize: 16,
      getColor: [255, 255, 255, 255],
      getAlignmentBaseline: 'center',
      getTextAnchor: 'middle',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      updateTriggers: {
        getPosition: [snapshot.tick, is3D],
        getText: [snapshot.tick],
      },
    }) : null;

    // Evacuation trails
    const pathsLayer = new PathLayer<TrackedPath>({
      id: 'evac-paths',
      data: recentPaths,
      getPath: (p: TrackedPath) => p.coords as [number, number][],
      getColor: (p: TrackedPath): [number, number, number, number] => {
        const alpha = Math.max(0, 210 - p.age * 20);
        return [255, 228, 60, alpha];
      },
      getWidth: () => 3.5,
      widthMinPixels: 2,
      widthMaxPixels: 8,
      updateTriggers: { getColor: [snapshot.tick] },
    });

    // Spawn zone
    const spawnZoneLayer = new ScatterplotLayer<GeoNode>({
      id: 'spawn-zone',
      data: entryNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => spawnRadius,
      getFillColor: (): [number, number, number, number] => [0, 230, 120, 16],
      getLineColor: (): [number, number, number, number] => [0, 230, 120, 150],
      stroked: true, filled: true,
      lineWidthMinPixels: 2,
      radiusUnits: 'meters',
    });

    // Exit zone
    const exitZoneLayer = new ScatterplotLayer<GeoNode>({
      id: 'exit-zone',
      data: exitNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => 50,
      getFillColor: (): [number, number, number, number] => [255, 200, 30, 16],
      getLineColor: (): [number, number, number, number] => [255, 200, 30, 170],
      stroked: true, filled: true,
      lineWidthMinPixels: 2,
      radiusUnits: 'meters',
    });

    // Intersection nodes
    const interLayer = new ScatterplotLayer<GeoNode>({
      id: 'intersections',
      data: interNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => 2.5,
      getFillColor: (): [number, number, number, number] => [200, 200, 200, 40],
      radiusMinPixels: 1.5,
      radiusMaxPixels: 5,
      pickable: mode === 'add-entry' || mode === 'add-exit',
      onClick: (info: PickingInfo) => {
        const obj = info.object as GeoNode | undefined;
        if (obj && onNodeClick) onNodeClick(obj.id);
        return true;
      },
    });

    // Entry markers
    const entryMarkerLayer = new ScatterplotLayer<GeoNode>({
      id: 'entry-markers',
      data: entryNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => 12,
      getFillColor: (): [number, number, number, number] => [0, 255, 120, 255],
      getLineColor: (): [number, number, number, number] => [0, 160, 80, 255],
      stroked: true, filled: true,
      lineWidthMinPixels: 3,
      radiusMinPixels: 6,
      radiusMaxPixels: 20,
    });

    // Exit markers
    const exitMarkerLayer = new ScatterplotLayer<GeoNode>({
      id: 'exit-markers',
      data: exitNodes,
      getPosition: (n: GeoNode): [number, number, number] => [n.lng, n.lat, 0],
      getRadius: () => 12,
      getFillColor: (): [number, number, number, number] => [255, 200, 30, 255],
      getLineColor: (): [number, number, number, number] => [200, 140, 0, 255],
      stroked: true, filled: true,
      lineWidthMinPixels: 3,
      radiusMinPixels: 6,
      radiusMaxPixels: 20,
    });

    // Agent particles
    type MA = typeof moving[0];
    const agentsLayer = new ScatterplotLayer<MA>({
      id: 'agents',
      data: moving,
      getPosition: (a: MA): [number, number, number] => [a.position[0], a.position[1], 0],
      getRadius: () => 5,
      getFillColor: (a: MA): [number, number, number, number] => [...a.color, 235] as [number, number, number, number],
      getLineColor: (): [number, number, number, number] => [255, 255, 255, 50],
      stroked: true,
      lineWidthMinPixels: 0.5,
      radiusMinPixels: 3,
      radiusMaxPixels: 11,
      updateTriggers: { getPosition: [snapshot.tick] },
    });

    // Dispersal zones
    const { zones } = snapshot;
    const attractZones = zones.filter(z => z.type === 'attract');
    const repelZones = zones.filter(z => z.type === 'repel');

    const attractMarkersLayer = new ScatterplotLayer<CrowdZone>({
      id: 'zones-attract-markers',
      data: attractZones,
      getPosition: (z: CrowdZone): [number, number, number] => [z.center[0], z.center[1], 0],
      getRadius: () => 15,
      getFillColor: (): [number, number, number, number] => [168, 85, 247, 200], // purple
      getLineColor: (): [number, number, number, number] => [219, 39, 119, 255],
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      radiusMinPixels: 4,
      radiusMaxPixels: 16,
      updateTriggers: { getPosition: [snapshot.tick] },
    });

    const repelMarkersLayer = new ScatterplotLayer<CrowdZone>({
      id: 'zones-repel-markers',
      data: repelZones,
      getPosition: (z: CrowdZone): [number, number, number] => [z.center[0], z.center[1], 0],
      getRadius: () => 15,
      getFillColor: (): [number, number, number, number] => [239, 68, 68, 200], // red
      getLineColor: (): [number, number, number, number] => [153, 27, 27, 255],
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      radiusMinPixels: 4,
      radiusMaxPixels: 16,
      updateTriggers: { getPosition: [snapshot.tick] },
    });

    const zoneRadiiLayer = new ScatterplotLayer<CrowdZone>({
      id: 'zones-radii',
      data: zones,
      getPosition: (z: CrowdZone): [number, number, number] => [z.center[0], z.center[1], 0],
      getRadius: (z: CrowdZone) => z.radius,
      getFillColor: (z: CrowdZone): [number, number, number, number] => {
        const alpha = Math.round(30 + (z.strength / 100) * 40);
        return z.type === 'attract'
          ? [168, 85, 247, alpha] // purple
          : [239, 68, 68, alpha]; // red
      },
      getLineColor: (z: CrowdZone): [number, number, number, number] => {
        return z.type === 'attract'
          ? [168, 85, 247, 120]
          : [239, 68, 68, 120];
      },
      stroked: true,
      filled: true,
      lineWidthMinPixels: 1,
      radiusUnits: 'meters',
      updateTriggers: {
        getFillColor: [snapshot.tick],
        getRadius: [snapshot.tick],
      },
    });

    return [
      ...(h3GridLayer ? [h3GridLayer] : []),   // 0 - ghost hex grid (bottom)
      roadsLayer, blockedLayer,                       // 1,2 - road network
      ...(h3DensityLayer ? [h3DensityLayer] : []),   // 3 - density heatmap
      ...(h3CountsLayer ? [h3CountsLayer] : []),   // 3.5 - cell counts
      pathsLayer,                                     // 4 - evac trails
      zoneRadiiLayer,                                 // 11a - zone radius circles
      spawnZoneLayer, exitZoneLayer,                  // 5,6 - zone circles
      interLayer,                                     // 7 - pickable intersections
      entryMarkerLayer, exitMarkerLayer,              // 8,9 - markers
      attractMarkersLayer, repelMarkersLayer,         // 11b,11c - zone markers
      agentsLayer,                                    // 10 - agents (top)
    ];
  }, [snapshot, mode, is3D, showH3Layer, showH3Counts, gridCells, onNodeClick, onEdgeClick]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onVSC = useCallback(({ viewState: vs }: any) => {
    setViewState(vs);
    if (onViewChange) onViewChange([vs.longitude, vs.latitude], vs.zoom);
  }, [onViewChange]);

  return (
    <DeckGL
      key={venueKey}
      viewState={viewState}
      onViewStateChange={onVSC}
      controller={true}
      layers={layers}
      getCursor={() => (mode === 'pick-location' ? 'crosshair' : mode === 'view' ? 'grab' : 'crosshair')}
      style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
      onClick={(info) => {
        if (mode === 'pick-location' && info.coordinate && onLocationPick) {
          onLocationPick(info.coordinate[0], info.coordinate[1]);
        }
      }}
    >
      <Map mapStyle={MAP_STYLE} reuseMaps />
    </DeckGL>
  );
}
