import {
  createEmptyGraph, addNode, addEdge,
  HIGHWAY_CAPACITY, findNearestNode,
  type Graph, type GeoNode, type GeoEdge, type HighwayType,
} from './graph';
import { haversine } from './haversine';
import type { VenuePreset } from './venues';

// Overpass API

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const WALKABLE_HIGHWAYS = [
  'primary', 'secondary', 'tertiary', 'residential', 'unclassified',
  'pedestrian', 'footway', 'path', 'service', 'living_street', 'steps',
].join('|');

interface OsmElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

export async function fetchOsmGraph(venue: VenuePreset): Promise<Graph> {
  const [s, w, n, e] = venue.bbox;
  const query = `[out:json][timeout:30];
(
  way["highway"~"^(${WALKABLE_HIGHWAYS})$"](${s},${w},${n},${e});
);
out body;
>;
out skel qt;`;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 35_000);

  let data: { elements: OsmElement[] };
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }

  return parseOsmToGraph(data.elements, venue);
}

// Parse OSM

function parseOsmToGraph(elements: OsmElement[], venue: VenuePreset): Graph {
  const graph = createEmptyGraph();

  // Index OSM nodes
  const osmNodes = new Map<number, [number, number]>(); // Map coordinates
  for (const el of elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      osmNodes.set(el.id, [el.lon, el.lat]);
    }
  }

  // Process ways
  let edgeSeq = 0;
  for (const el of elements) {
    if (el.type !== 'way' || !el.nodes || el.nodes.length < 2) continue;

    const highway = (el.tags?.highway ?? 'residential') as HighwayType;
    const name = el.tags?.name;
    const cap = HIGHWAY_CAPACITY[highway] ?? 500;

    // Register nodes
    for (const osmId of el.nodes) {
      const key = `n${osmId}`;
      if (!graph.nodes.has(key)) {
        const coord = osmNodes.get(osmId);
        if (!coord) continue;
        addNode(graph, {
          id: key, lng: coord[0], lat: coord[1],
          type: 'intersection', density: 0,
        });
      }
    }

    // Create edges
    for (let i = 0; i < el.nodes.length - 1; i++) {
      const sk = `n${el.nodes[i]}`;
      const tk = `n${el.nodes[i + 1]}`;
      const src = graph.nodes.get(sk);
      const tgt = graph.nodes.get(tk);
      if (!src || !tgt) continue;

      const dist = haversine(src.lat, src.lng, tgt.lat, tgt.lng);
      if (dist < 0.1) continue; // Skip duplicates

      const edge: GeoEdge = {
        id: `e${el.id}_${edgeSeq++}`,
        source: sk, target: tk,
        weight: dist, baseWeight: dist,
        capacity: cap, flow: 0,
        blocked: false, highway, name,
        coordinates: [[src.lng, src.lat], [tgt.lng, tgt.lat]],
      };
      addEdge(graph, edge);
    }
  }

  // Set defaults
  autoSelectEntryExits(graph, venue);

  return graph;
}

// Auto select

function autoSelectEntryExits(graph: Graph, venue: VenuePreset): void {
  const [clng, clat] = venue.center;

  // Center entry
  const entry = findNearestNode(graph, clng, clat);
  if (entry) entry.type = 'entry';

  // Corner exits
  const [s, w, n, e] = venue.bbox;
  const corners: [number, number][] = [
    [w, s]4
  ];
  const usedIds = new Set<string>(entry ? [entry.id] : []);
  for (const [lng, lat] of corners) {
    let best: GeoNode | null = null;
    let bestDist = Infinity;
    for (const node of graph.nodes.values()) {
      if (usedIds.has(node.id)) continue;
      const d = haversine(lat, lng, node.lat, node.lng);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    if (best) { best.type = 'exit'; usedIds.add(best.id); }
  }
}

// Helpers

// Get entries
export function getEntryNodes(graph: Graph): string[] {
  return [...graph.nodes.values()].filter(n => n.type === 'entry').map(n => n.id);
}

// Get exits
export function getExitNodes(graph: Graph): string[] {
  return [...graph.nodes.values()].filter(n => n.type === 'exit').map(n => n.id);
}
