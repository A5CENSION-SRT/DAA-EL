import { haversine } from './haversine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HighwayType =
  | 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary'
  | 'residential' | 'unclassified' | 'pedestrian' | 'footway'
  | 'path' | 'service' | 'cycleway' | 'living_street' | 'steps';

export interface GeoNode {
  id: string;
  lng: number;
  lat: number;
  type: 'entry' | 'exit' | 'intersection' | 'waypoint';
  density: number; // 0–1
}

export interface GeoEdge {
  id: string;
  source: string; // GeoNode id
  target: string; // GeoNode id
  weight: number;       // dynamic weight (metres × congestion factor)
  baseWeight: number;   // physical distance in metres
  capacity: number;     // max pedestrians per minute on this road
  flow: number;         // current pedestrians on this edge
  blocked: boolean;
  highway: HighwayType;
  name?: string;
  coordinates: [number, number][]; // [lng, lat] polyline for rendering
}

export interface Graph {
  nodes: Map<string, GeoNode>;
  edges: Map<string, GeoEdge>;
  adjacency: Map<string, string[]>; // nodeId → edgeId[]
}

// ─── Capacity by road type ────────────────────────────────────────────────────

export const HIGHWAY_CAPACITY: Partial<Record<HighwayType, number>> = {
  motorway:     8_000,
  trunk:        6_000,
  primary:      4_000,
  secondary:    3_000,
  tertiary:     2_000,
  residential:  1_000,
  unclassified:   800,
  pedestrian:     600,
  footway:        400,
  path:           300,
  service:        400,
  cycleway:       300,
  living_street:  500,
  steps:          200,
};

// ─── Graph helpers ────────────────────────────────────────────────────────────

export function createEmptyGraph(): Graph {
  return { nodes: new Map(), edges: new Map(), adjacency: new Map() };
}

export function addNode(graph: Graph, node: GeoNode): void {
  graph.nodes.set(node.id, node);
  if (!graph.adjacency.has(node.id)) graph.adjacency.set(node.id, []);
}

export function addEdge(graph: Graph, edge: GeoEdge): void {
  graph.edges.set(edge.id, edge);

  const push = (nodeId: string) => {
    const adj = graph.adjacency.get(nodeId) ?? [];
    if (!adj.includes(edge.id)) adj.push(edge.id);
    graph.adjacency.set(nodeId, adj);
  };
  push(edge.source);
  push(edge.target);
}

export function getNeighbors(
  graph: Graph,
  nodeId: string,
): { node: GeoNode; edge: GeoEdge }[] {
  const adj = graph.adjacency.get(nodeId) ?? [];
  const result: { node: GeoNode; edge: GeoEdge }[] = [];
  for (const edgeId of adj) {
    const edge = graph.edges.get(edgeId);
    if (!edge || edge.blocked) continue;
    const neighborId = edge.source === nodeId ? edge.target : edge.source;
    const neighbor = graph.nodes.get(neighborId);
    if (neighbor) result.push({ node: neighbor, edge });
  }
  return result;
}

export function updateEdgeWeight(graph: Graph, edgeId: string): void {
  const edge = graph.edges.get(edgeId);
  if (!edge) return;
  const ratio = edge.flow / Math.max(1, edge.capacity);
  const congestionFactor = 1 + ratio * 6; // up to 7× slower when full
  edge.weight = edge.baseWeight * congestionFactor;
}

export function getCongestionLevel(edge: GeoEdge): number {
  return Math.min(1, edge.flow / Math.max(1, edge.capacity));
}

/** Returns the [lng, lat] midpoint of an edge. */
export function edgeMidpoint(edge: GeoEdge): [number, number] {
  const mid = Math.floor(edge.coordinates.length / 2);
  return edge.coordinates[mid] ?? edge.coordinates[0];
}

/** Find the graph node closest to the given [lng, lat]. */
export function findNearestNode(
  graph: Graph,
  lng: number,
  lat: number,
): GeoNode | null {
  let nearest: GeoNode | null = null;
  let minDist = Infinity;
  for (const node of graph.nodes.values()) {
    const d = haversine(lat, lng, node.lat, node.lng);
    if (d < minDist) { minDist = d; nearest = node; }
  }
  return nearest;
}
