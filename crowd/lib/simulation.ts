import {
  type Graph,
  getNeighbors, updateEdgeWeight, getCongestionLevel,
} from './graph';
import { dijkstra, aStar, bfs } from './pathfinding';
import { haversine, lerpCoord } from './haversine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlgorithmType = 'dijkstra' | 'astar' | 'bfs';

export interface Agent {
  id: string;
  position: [number, number];
  path: string[];
  pathCoords: [number, number][];
  pathIndex: number;
  progress: number;
  speed: number;
  color: [number, number, number];
  status: 'moving' | 'arrived';
}

export interface SimulationMetrics {
  activeAgents: number;
  arrivedAgents: number;
  totalAgents: number;
  congestion: number;
  nodesExplored: number;
  edgesRelaxed: number;
  runtimeMs: number;
  algorithm: AlgorithmType;
  currentOperation: string;
  totalPathMetres: number;
}

export interface TimelineEvent { time: string; event: string; }

/** A recently computed path — kept for the glowing-trail layer. */
export interface TrackedPath {
  coords: [number, number][];
  age: number;   // increases each spawn cycle; old paths fade out
}

export interface SimulationSnapshot {
  graph: Graph;
  agents: Agent[];
  metrics: SimulationMetrics;
  entryNodeIds: string[];
  exitNodeIds: string[];
  spawnRadius: number;         // metres — zone around each entry node
  recentPaths: TrackedPath[];  // last N computed paths (for trail layer)
  tick: number;
  timeline: TimelineEvent[];
}

// ─── Palette by algorithm ─────────────────────────────────────────────────────
const ALGO_PALETTE: Record<AlgorithmType, [number, number, number][]> = {
  dijkstra: [[0, 220, 255], [0, 180, 240], [40, 200, 255], [80, 230, 255]],
  astar:    [[255, 140, 0], [255, 170, 40], [255, 100, 20], [240, 160, 50]],
  bfs:      [[80, 255, 140], [60, 240, 120], [100, 255, 160], [50, 220, 110]],
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export class SimulationEngine {
  private snap: SimulationSnapshot;
  private algorithm: AlgorithmType;
  private onUpdate?: (s: SimulationSnapshot) => void;
  private rafId?: number;
  private lastTs = 0;
  private agentIdx = 0;
  private spawnAccum = 0;
  private spawnRate = 3;
  private timeScale = 1;
  private spawnRadius = 200;           // metres
  private spawnPool: string[] = [];    // nodes within radius of any entry

  constructor(graph: Graph, algorithm: AlgorithmType = 'dijkstra') {
    this.algorithm = algorithm;
    this.snap = {
      graph,
      agents: [],
      metrics: {
        activeAgents: 0, arrivedAgents: 0, totalAgents: 0,
        congestion: 0, nodesExplored: 0, edgesRelaxed: 0,
        runtimeMs: 0, algorithm, currentOperation: 'Idle',
        totalPathMetres: 0,
      },
      entryNodeIds: [],
      exitNodeIds: [],
      spawnRadius: this.spawnRadius,
      recentPaths: [],
      tick: 0,
      timeline: [],
    };
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  setAlgorithm(alg: AlgorithmType) {
    this.algorithm = alg;
    this.snap.metrics.algorithm = alg;
  }

  setEntryNodes(ids: string[]) {
    this.snap.entryNodeIds = ids;
    ids.forEach(id => {
      const n = this.snap.graph.nodes.get(id);
      if (n) n.type = 'entry';
    });
    this.#rebuildSpawnPool();
  }

  setExitNodes(ids: string[]) {
    this.snap.exitNodeIds = ids;
    ids.forEach(id => {
      const n = this.snap.graph.nodes.get(id);
      if (n) n.type = 'exit';
    });
  }

  setSpawnRadius(r: number) {
    this.spawnRadius = r;
    this.snap.spawnRadius = r;
    this.#rebuildSpawnPool();
  }

  setSpawnRate(r: number) { this.spawnRate = r; }
  setTimeScale(s: number) { this.timeScale = s; }

  blockEdge(edgeId: string) {
    const e = this.snap.graph.edges.get(edgeId);
    if (!e) return;
    e.blocked = true;
    this.#log(`Road blocked${e.name ? ': ' + e.name : ''}`);
  }

  unblockEdge(edgeId: string) {
    const e = this.snap.graph.edges.get(edgeId);
    if (e) e.blocked = false;
  }

  setOnUpdate(cb: (s: SimulationSnapshot) => void) { this.onUpdate = cb; }

  getSnapshot(): SimulationSnapshot { return this.snap; }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start() {
    if (typeof window === 'undefined') return;
    this.lastTs = performance.now();
    this.#tick(performance.now());
  }

  stop() {
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
  }

  reset() {
    this.stop();
    this.snap.agents = [];
    this.snap.recentPaths = [];
    this.snap.tick = 0;
    this.snap.timeline = [];
    this.agentIdx = 0;
    this.spawnAccum = 0;
    for (const e of this.snap.graph.edges.values()) {
      e.flow = 0; e.weight = e.baseWeight;
    }
    this.#refreshMetrics();
    this.onUpdate?.(this.snap);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  #rebuildSpawnPool() {
    const pool = new Set<string>();
    for (const entryId of this.snap.entryNodeIds) {
      const entry = this.snap.graph.nodes.get(entryId);
      if (!entry) continue;
      for (const node of this.snap.graph.nodes.values()) {
        if (haversine(entry.lat, entry.lng, node.lat, node.lng) <= this.spawnRadius) {
          pool.add(node.id);
        }
      }
    }
    this.spawnPool = [...pool];
  }

  #tick(ts: number) {
    const raw = (ts - this.lastTs) / 1000;
    const dt  = Math.min(raw, 0.1) * this.timeScale;
    this.lastTs = ts;
    this.snap.tick++;

    const spawnInterval = 1 / Math.max(0.1, this.spawnRate);
    this.spawnAccum += dt;
    while (
      this.spawnAccum >= spawnInterval &&
      this.snap.entryNodeIds.length > 0 &&
      this.snap.exitNodeIds.length > 0 &&
      this.snap.agents.length < 1200
    ) {
      this.#spawnAgent();
      this.spawnAccum -= spawnInterval;
    }

    this.#moveAgents(dt);
    this.#recalcFlows();
    this.#refreshMetrics();
    this.onUpdate?.(this.snap);

    this.rafId = requestAnimationFrame(t => this.#tick(t));
  }

  #spawnAgent() {
    // Pick from spawn pool (nodes within radius), or fall back to exact entry node
    const pool    = this.spawnPool.length > 0 ? this.spawnPool : this.snap.entryNodeIds;
    const startId = pool[Math.floor(Math.random() * pool.length)];
    const exitId  = this.snap.exitNodeIds[
      Math.floor(Math.random() * this.snap.exitNodeIds.length)
    ];
    if (!startId || !exitId || startId === exitId) return;

    const solver = this.algorithm === 'astar' ? aStar
                 : this.algorithm === 'bfs'   ? bfs
                 : dijkstra;

    const t0     = performance.now();
    const result = solver(this.snap.graph, startId, exitId);
    const rt     = performance.now() - t0;
    if (result.path.length < 2) return;

    const pathCoords: [number, number][] = result.path.map(id => {
      const n = this.snap.graph.nodes.get(id)!;
      return [n.lng, n.lat];
    });

    // Pick colour from algorithm palette
    const palette = ALGO_PALETTE[this.algorithm];
    const color   = palette[this.agentIdx % palette.length];

    this.snap.agents.push({
      id: `a${this.agentIdx++}`,
      position: pathCoords[0],
      path: result.path,
      pathCoords,
      pathIndex: 0,
      progress: 0,
      speed: 1.0 + Math.random() * 1.0,
      color,
      status: 'moving',
    });

    // Track path for the trail layer (age old ones)
    this.snap.recentPaths = [
      { coords: pathCoords, age: 0 },
      ...this.snap.recentPaths.map(p => ({ ...p, age: p.age + 1 })),
    ].slice(0, 12);

    this.snap.metrics.edgesRelaxed    = result.edgesRelaxed;
    this.snap.metrics.nodesExplored   = result.visitedOrder.length;
    this.snap.metrics.runtimeMs       = parseFloat(rt.toFixed(2));
    this.snap.metrics.totalPathMetres = result.totalWeight;
    this.snap.metrics.currentOperation =
      `${this.algorithm.toUpperCase()} · ${result.path.length} hops · ${Math.round(result.totalWeight)} m`;
  }

  #moveAgents(dt: number) {
    for (const a of this.snap.agents) {
      if (a.status !== 'moving') continue;
      const from = a.pathCoords[a.pathIndex];
      const to   = a.pathCoords[a.pathIndex + 1];
      if (!from || !to) { a.status = 'arrived'; continue; }

      const segLen = haversine(from[1], from[0], to[1], to[0]);
      a.progress += segLen > 0 ? (a.speed * dt) / segLen : 1;

      if (a.progress >= 1) {
        a.pathIndex++;
        a.progress = 0;
        if (a.pathIndex >= a.pathCoords.length - 1) {
          a.status = 'arrived';
          a.position = a.pathCoords.at(-1)!;
          this.#log(`Agent reached exit`);
          continue;
        }
      }

      const nf = a.pathCoords[a.pathIndex];
      const nt = a.pathCoords[a.pathIndex + 1] ?? nf;
      a.position = lerpCoord(nf, nt, a.progress);
    }

    // Fade out arrived agents
    this.snap.agents = this.snap.agents.filter(
      a => a.status === 'moving' || Math.random() > 0.03,
    );
  }

  #recalcFlows() {
    for (const e of this.snap.graph.edges.values()) e.flow = 0;
    for (const a of this.snap.agents) {
      if (a.status !== 'moving') continue;
      const cur  = a.path[a.pathIndex];
      const next = a.path[a.pathIndex + 1];
      if (!cur || !next) continue;
      for (const edgeId of (this.snap.graph.adjacency.get(cur) ?? [])) {
        const e = this.snap.graph.edges.get(edgeId);
        if (!e) continue;
        if ((e.source === cur && e.target === next) ||
            (e.target === cur && e.source === next)) {
          e.flow++;
          break;
        }
      }
    }
    for (const id of this.snap.graph.edges.keys()) updateEdgeWeight(this.snap.graph, id);
  }

  #refreshMetrics() {
    const active  = this.snap.agents.filter(a => a.status === 'moving').length;
    const arrived = this.snap.agents.filter(a => a.status === 'arrived').length;
    let totalC = 0, n = 0;
    for (const e of this.snap.graph.edges.values()) {
      if (!e.blocked) { totalC += getCongestionLevel(e); n++; }
    }
    this.snap.metrics.activeAgents  = active;
    this.snap.metrics.arrivedAgents = arrived;
    this.snap.metrics.totalAgents   = this.snap.agents.length;
    this.snap.metrics.congestion    = n > 0 ? totalC / n : 0;
  }

  #log(event: string) {
    const t = this.snap.tick;
    const m = String(Math.floor(t / 1800)).padStart(2, '0');
    const s = String(Math.floor((t % 1800) / 30)).padStart(2, '0');
    this.snap.timeline.unshift({ time: `${m}:${s}`, event });
    if (this.snap.timeline.length > 14) this.snap.timeline.pop();
  }
}
