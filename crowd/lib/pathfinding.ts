import { type Graph, getNeighbors, updateEdgeWeight } from './graph';
import { haversine } from './haversine';
import { type DirectionPreference, getBearing, directionMatches } from './zones';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface PathResult {
  path: string[];          // ordered node IDs
  totalWeight: number;     // metres (accounting for congestion)
  visitedOrder: string[];  // nodes touched during search (visualisation)
  edgesRelaxed: number;
  runtimeMs: number;
}

export interface PathfindingOptions {
  directionPreference?: DirectionPreference;
  avoidZoneIds?: string[]; // Zone IDs to avoid
  attractZoneIds?: string[]; // Zone IDs to move toward
}

// ─── Direction Cost Helper ────────────────────────────────────────────────────

function getDirectionalCostModifier(
  options: PathfindingOptions | undefined,
  sourceCoord: [number, number],
  targetCoord: [number, number],
): number {
  if (!options?.directionPreference || !options.directionPreference.enabled || options.directionPreference.directions.length === 0) {
    return 1.0; // No modifier
  }

  const bearing = getBearing(sourceCoord, targetCoord);
  const dirMatch = options.directionPreference.directions.some(d =>
    directionMatches(d, bearing, Math.PI / 4)
  );

  const weight = options.directionPreference.weight || 0.5;
  return dirMatch ? 1.0 - weight : 1.0 + weight;
}

// ─── Min-heap (priority queue) ────────────────────────────────────────────────

class MinHeap<T> {
  private heap: { key: number; value: T }[] = [];

  get size() { return this.heap.length; }

  push(key: number, value: T) {
    this.heap.push({ key, value });
    this.#bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (!this.heap.length) return undefined;
    const top = this.heap[0].value;
    const last = this.heap.pop()!;
    if (this.heap.length) { this.heap[0] = last; this.#sinkDown(0); }
    return top;
  }

  #bubbleUp(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].key <= this.heap[i].key) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  #sinkDown(i: number) {
    const n = this.heap.length;
    for (; ;) {
      let s = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].key < this.heap[s].key) s = l;
      if (r < n && this.heap[r].key < this.heap[s].key) s = r;
      if (s === i) break;
      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
      i = s;
    }
  }
}

// ─── Shared path reconstruction ───────────────────────────────────────────────

function reconstructPath(
  prev: Map<string, string | null>,
  startId: string,
  endId: string,
): string[] {
  const path: string[] = [];
  let cur: string | null = endId;
  while (cur !== null) {
    path.unshift(cur);
    if (cur === startId) break;
    cur = prev.get(cur) ?? null;
  }
  return path[0] === startId ? path : [];
}

// ─── Dijkstra ─────────────────────────────────────────────────────────────────
//
// Efficiency notes:
//  • Lazy initialisation — no O(V) init loop; Maps start empty and
//    unvisited nodes are treated as Infinity via `?? Infinity`.
//  • Early exit when target is popped from the heap.

export function dijkstra(
  graph: Graph,
  startId: string,
  endIdInput: string | string[],
  options?: PathfindingOptions,
): PathResult {
  const t0 = performance.now();
  const endIds = new Set(Array.isArray(endIdInput) ? endIdInput : [endIdInput]);

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  let edgesRelaxed = 0;

  dist.set(startId, 0);

  const pq = new MinHeap<string>();
  pq.push(0, startId);

  let reachedEndId: string | null = null;

  while (pq.size > 0) {
    const u = pq.pop()!;
    if (visited.has(u)) continue;
    visited.add(u);
    visitedOrder.push(u);
    if (endIds.has(u)) {
      reachedEndId = u;
      break;
    }

    const uDist = dist.get(u) ?? Infinity;
    const uNode = graph.nodes.get(u);

    for (const { node: v, edge } of getNeighbors(graph, u)) {
      updateEdgeWeight(graph, edge.id);
      edgesRelaxed++;
      let costModifier = 1.0;
      if (options?.directionPreference && uNode) {
        costModifier = getDirectionalCostModifier(
          options,
          [uNode.lng, uNode.lat],
          [v.lng, v.lat],
        );
      }
      const alt = uDist + edge.weight * costModifier;
      if (alt < (dist.get(v.id) ?? Infinity)) {
        dist.set(v.id, alt);
        prev.set(v.id, u);
        pq.push(alt, v.id);
      }
    }
  }

  const finalEndId = reachedEndId ?? (Array.isArray(endIdInput) ? endIdInput[0] : endIdInput);

  return {
    path: reconstructPath(prev, startId, finalEndId),
    totalWeight: dist.get(finalEndId) ?? Infinity,
    visitedOrder,
    edgesRelaxed,
    runtimeMs: performance.now() - t0,
  };
}

// ─── A* ───────────────────────────────────────────────────────────────────────
//
// Efficiency notes:
//  • Same lazy-init approach as Dijkstra.
//  • Heuristic: straight-line haversine distance to goal (admissible).

export function aStar(
  graph: Graph,
  startId: string,
  endIdInput: string | string[],
  options?: PathfindingOptions,
): PathResult {
  const t0 = performance.now();
  const endIds = new Set(Array.isArray(endIdInput) ? endIdInput : [endIdInput]);
  const endNodes = Array.from(endIds).map(id => graph.nodes.get(id)).filter((n): n is Exclude<typeof n, undefined> => n !== undefined);
  if (endNodes.length === 0) return emptyResult(t0);

  const h = (id: string) => {
    const n = graph.nodes.get(id);
    if (!n) return 0;
    // For multiple targets, A* heuristic should be the minimum distance to *any* of the goals
    let minDist = Infinity;
    for (const en of endNodes) {
      const d = haversine(n.lat, n.lng, en.lat, en.lng);
      if (d < minDist) minDist = d;
    }
    return minDist;
  };

  const gScore = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const closed = new Set<string>();
  const visitedOrder: string[] = [];
  let edgesRelaxed = 0;

  gScore.set(startId, 0);

  const open = new MinHeap<string>();
  open.push(h(startId), startId);

  let reachedEndId: string | null = null;

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed.has(cur)) continue;
    closed.add(cur);
    visitedOrder.push(cur);
    if (endIds.has(cur)) {
      reachedEndId = cur;
      break;
    }

    const curG = gScore.get(cur) ?? Infinity;
    const curNode = graph.nodes.get(cur);

    for (const { node: nb, edge } of getNeighbors(graph, cur)) {
      if (closed.has(nb.id)) continue;
      updateEdgeWeight(graph, edge.id);
      edgesRelaxed++;
      let costModifier = 1.0;
      if (options?.directionPreference && curNode) {
        costModifier = getDirectionalCostModifier(
          options,
          [curNode.lng, curNode.lat],
          [nb.lng, nb.lat],
        );
      }
      const tentG = curG + edge.weight * costModifier;
      if (tentG < (gScore.get(nb.id) ?? Infinity)) {
        prev.set(nb.id, cur);
        gScore.set(nb.id, tentG);
        open.push(tentG + h(nb.id), nb.id);
      }
    }
  }

  const finalEndId = reachedEndId ?? (Array.isArray(endIdInput) ? endIdInput[0] : endIdInput);

  return {
    path: reconstructPath(prev, startId, finalEndId),
    totalWeight: gScore.get(finalEndId) ?? Infinity,
    visitedOrder,
    edgesRelaxed,
    runtimeMs: performance.now() - t0,
  };
}

// ─── BFS (unweighted) ─────────────────────────────────────────────────────────
//
// Efficiency notes:
//  • Uses a head-pointer dequeue pattern — O(1) per dequeue vs O(n) array.shift().
//  • Lazy-init: no O(V) prev initialisation loop.

export function bfs(
  graph: Graph,
  startId: string,
  endIdInput: string | string[],
  options?: PathfindingOptions,
): PathResult {
  const t0 = performance.now();
  const endIds = new Set(Array.isArray(endIdInput) ? endIdInput : [endIdInput]);

  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  let edgesRelaxed = 0;

  // O(1)-dequeue queue via head pointer
  const queue: string[] = [startId];
  let head = 0;
  visited.add(startId);

  let reachedEndId: string | null = null;

  while (head < queue.length) {
    const u = queue[head++];           // O(1) — no array shift
    visitedOrder.push(u);
    if (endIds.has(u)) {
      reachedEndId = u;
      break;
    }

    for (const { node: v } of getNeighbors(graph, u)) {
      edgesRelaxed++;
      if (!visited.has(v.id)) {
        visited.add(v.id);
        prev.set(v.id, u);
        queue.push(v.id);
      }
    }
  }

  const finalEndId = reachedEndId ?? (Array.isArray(endIdInput) ? endIdInput[0] : endIdInput);
  const path = reconstructPath(prev, startId, finalEndId);
  let totalWeight = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = graph.nodes.get(path[i])!;
    const b = graph.nodes.get(path[i + 1])!;
    if (a && b) totalWeight += haversine(a.lat, a.lng, b.lat, b.lng);
  }

  return { path, totalWeight, visitedOrder, edgesRelaxed, runtimeMs: performance.now() - t0 };
}

function emptyResult(t0: number): PathResult {
  return { path: [], totalWeight: Infinity, visitedOrder: [], edgesRelaxed: 0, runtimeMs: performance.now() - t0 };
}

// ─── Algorithm complexity strings ─────────────────────────────────────────────

export const ALGORITHM_META: Record<string, { label: string; complexity: string; space: string }> = {
  dijkstra: { label: "Dijkstra's Algorithm", complexity: 'O((V + E) log V)', space: 'O(V)' },
  astar: { label: 'A* Search', complexity: 'O(E log V)', space: 'O(V)' },
  bfs: { label: 'BFS (unweighted)', complexity: 'O(V + E)', space: 'O(V)' },
};
