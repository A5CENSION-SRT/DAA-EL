import { type Graph, getNeighbors, updateEdgeWeight } from './graph';
import { haversine } from './haversine';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface PathResult {
  path: string[];          // ordered node IDs
  totalWeight: number;     // metres (accounting for congestion)
  visitedOrder: string[];  // nodes touched during search (visualisation)
  edgesRelaxed: number;
  runtimeMs: number;
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
    for (;;) {
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

export function dijkstra(
  graph: Graph,
  startId: string,
  endId: string,
): PathResult {
  const t0 = performance.now();

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  let edgesRelaxed = 0;

  for (const id of graph.nodes.keys()) { dist.set(id, Infinity); prev.set(id, null); }
  dist.set(startId, 0);

  const pq = new MinHeap<string>();
  pq.push(0, startId);

  while (pq.size > 0) {
    const u = pq.pop()!;
    if (visited.has(u)) continue;
    visited.add(u);
    visitedOrder.push(u);
    if (u === endId) break;

    for (const { node: v, edge } of getNeighbors(graph, u)) {
      updateEdgeWeight(graph, edge.id);
      edgesRelaxed++;
      const alt = (dist.get(u) ?? Infinity) + edge.weight;
      if (alt < (dist.get(v.id) ?? Infinity)) {
        dist.set(v.id, alt);
        prev.set(v.id, u);
        pq.push(alt, v.id);
      }
    }
  }

  return {
    path: reconstructPath(prev, startId, endId),
    totalWeight: dist.get(endId) ?? Infinity,
    visitedOrder,
    edgesRelaxed,
    runtimeMs: performance.now() - t0,
  };
}

// ─── A* ───────────────────────────────────────────────────────────────────────

export function aStar(
  graph: Graph,
  startId: string,
  endId: string,
): PathResult {
  const t0 = performance.now();
  const endNode = graph.nodes.get(endId);
  if (!endNode) return emptyResult(t0);

  const h = (id: string) => {
    const n = graph.nodes.get(id);
    return n ? haversine(n.lat, n.lng, endNode.lat, endNode.lng) : 0;
  };

  const gScore = new Map<string, number>();
  const prev   = new Map<string, string | null>();
  const closed = new Set<string>();
  const visitedOrder: string[] = [];
  let edgesRelaxed = 0;

  for (const id of graph.nodes.keys()) { gScore.set(id, Infinity); prev.set(id, null); }
  gScore.set(startId, 0);

  const open = new MinHeap<string>();
  open.push(h(startId), startId);

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed.has(cur)) continue;
    closed.add(cur);
    visitedOrder.push(cur);
    if (cur === endId) break;

    for (const { node: nb, edge } of getNeighbors(graph, cur)) {
      if (closed.has(nb.id)) continue;
      updateEdgeWeight(graph, edge.id);
      edgesRelaxed++;
      const tentG = (gScore.get(cur) ?? Infinity) + edge.weight;
      if (tentG < (gScore.get(nb.id) ?? Infinity)) {
        prev.set(nb.id, cur);
        gScore.set(nb.id, tentG);
        open.push(tentG + h(nb.id), nb.id);
      }
    }
  }

  return {
    path: reconstructPath(prev, startId, endId),
    totalWeight: gScore.get(endId) ?? Infinity,
    visitedOrder,
    edgesRelaxed,
    runtimeMs: performance.now() - t0,
  };
}

// ─── BFS (unweighted) ─────────────────────────────────────────────────────────

export function bfs(
  graph: Graph,
  startId: string,
  endId: string,
): PathResult {
  const t0 = performance.now();

  const prev    = new Map<string, string | null>();
  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  let edgesRelaxed = 0;

  for (const id of graph.nodes.keys()) prev.set(id, null);

  const queue = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const u = queue.shift()!;
    visitedOrder.push(u);
    if (u === endId) break;

    for (const { node: v } of getNeighbors(graph, u)) {
      edgesRelaxed++;
      if (!visited.has(v.id)) {
        visited.add(v.id);
        prev.set(v.id, u);
        queue.push(v.id);
      }
    }
  }

  const path = reconstructPath(prev, startId, endId);
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
  astar:    { label: 'A* Search',            complexity: 'O(E log V)',       space: 'O(V)' },
  bfs:      { label: 'BFS (unweighted)',     complexity: 'O(V + E)',         space: 'O(V)' },
};
