import { haversine } from './haversine';

// Types

export type HighwayType =
  | 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary'
  | 'residential' | 'unclassified' | 'pedestrian' | 'footway'
  | 'path' | 'service' | 'cycleway' | 'living_street' | 'steps';

export interface GeoNode {
  id: string;
  lng: number;
  lat: number;
  type: 'entry' | 'exit' | 'intersection' | 'waypoint';
  density: number; // Density level
}

export interface GeoEdge {
  id: string;
  source: string; // Source ID
  target: string; // Target ID
  weight: number;       // Dynamic weight
  baseWeight: number;   // Base weight
  capacity: number;     // Max capacity
  flow: number;         // Current flow
  blocked: boolean;
  highway: HighwayType;
  name?: string;
  coordinates: [number, number][]; // Coordinates
}

export interface Graph {
  nodes: Map<string, GeoNode>;
  edges: Map<string, GeoEdge>;
  adjacency: Map<string, string[]>; // Adjacency map
}

// Capacities

export const HIGHWAY_CAPACITY: Partial<Record<HighwayType, number>> = {
  motorway: 50,
  trunk: 40,
  primary: 30,
  secondary: 20,
  tertiary: 15,
  residential: 10,
  unclassified: 8,
  pedestrian: 5,
  footway: 5,
  path: 3,
  service: 5,
  cycleway: 3,
  living_street: 5,
  steps: 2,
};

// Graph helpers

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
  // Congestion factor
  const congestionFactor = 1 + (ratio * 50) + Math.pow(ratio, 2) * 500;
  edge.weight = edge.baseWeight * Math.max(1, congestionFactor);
}

export function getCongestionLevel(edge: GeoEdge): number {
  return Math.min(1, edge.flow / Math.max(1, edge.capacity));
}

// Midpoint
export function edgeMidpoint(edge: GeoEdge): [number, number] {
  const mid = Math.floor(edge.coordinates.length / 2);
  return edge.coordinates[mid] ?? edge.coordinates[0];
}

// Nearest node
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
