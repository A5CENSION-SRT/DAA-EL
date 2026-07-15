import {
  type Graph,
  getNeighbors, updateEdgeWeight, getCongestionLevel,
} from './graph';
import { dijkstra, aStar, bfs } from './pathfinding';
import { haversine, lerpCoord } from './haversine';
import {
  buildH3Density, DEFAULT_RESOLUTION, CRITICAL_THRESHOLD,
  type HexCell,
} from './h3-spatial';
import {
  type CrowdZone, type DirectionPreference,
} from './zones';

// Types

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
  congestion: number;   // average road congestion
  nodesExplored: number;
  edgesRelaxed: number;
  runtimeMs: number;
  algorithm: AlgorithmType;
  currentOperation: string;
  totalPathMetres: number;
  // H3 metrics
  maxH3Density: number;   // peak H3 density
  hotspotCount: number;   // hotspot cell count
  h3CoveredCells: number;  // occupied H3 cells
}

export interface TimelineEvent { time: string; event: string; }

// Evacuation trails
export interface TrackedPath {
  coords: [number, number][];
  age: number;
}

export interface SimulationSnapshot {
  graph: Graph;
  agents: Agent[];
  metrics: SimulationMetrics;
  entryNodeIds: string[];
  exitNodeIds: string[];
  spawnRadius: number;         // spawn radius metres
  recentPaths: TrackedPath[];  // recent paths history
  h3Cells: HexCell[];      // hexagonal cells array
  h3Resolution: number;
  zones: CrowdZone[];          // crowd zones array
  directionPreference: DirectionPreference;  // routing preferences config
  tick: number;
  timeline: TimelineEvent[];
}

// Algo colors

const ALGO_PALETTE: Record<AlgorithmType, [number, number, number][]> = {
  dijkstra: [[0, 210, 255], [0, 180, 240], [60, 220, 255], [100, 230, 255]],
  astar: [[255, 130, 0], [255, 160, 30], [255, 100, 10], [240, 150, 40]],
  bfs: [[60, 255, 130], [40, 235, 110], [90, 255, 150], [50, 210, 100]],
};

// Engine

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
  private spawnRadius = 200;
  private spawnPool: string[] = [];
  private sessionPeak = 1;   // Peak density
  private spawningEnabled = true; // Spawning enabled

  // Endpoint lookup map
  private edgeByEndpoints = new Map<string, string>();

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
        maxH3Density: 0, hotspotCount: 0, h3CoveredCells: 0,
      },
      entryNodeIds: [],
      exitNodeIds: [],
      spawnRadius: this.spawnRadius,
      recentPaths: [],
      h3Cells: [],
      h3Resolution: DEFAULT_RESOLUTION,
      zones: [],
      directionPreference: { enabled: false, directions: [], weight: 0 },
      tick: 0,
      timeline: [],
    };
    this.#buildEdgeLookup();
  }

  // Configuration

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

  setH3Resolution(res: number) {
    this.snap.h3Resolution = res;
    this.sessionPeak = 1;  // Reset peak
  }

  setSpawnRate(r: number) { this.spawnRate = r; }
  setTimeScale(s: number) { this.timeScale = s; }
  setSpawningEnabled(enabled: boolean) { this.spawningEnabled = enabled; }

  // Zone management
  addZone(zone: Omit<CrowdZone, 'id'>): void {
    const newZone: CrowdZone = {
      ...zone,
      id: `zone_${this.snap.zones.length}_${Date.now()}`,
    };
    this.snap.zones.push(newZone);
  }

  updateZone(id: string, updates: Partial<CrowdZone>): void {
    const zone = this.snap.zones.find(z => z.id === id);
    if (zone) {
      Object.assign(zone, updates);
    }
  }

  removeZone(id: string): void {
    this.snap.zones = this.snap.zones.filter(z => z.id !== id);
  }

  setDirectionPreference(pref: DirectionPreference): void {
    this.snap.directionPreference = pref;
  }

  blockEdge(edgeId: string) {
    const e = this.snap.graph.edges.get(edgeId);
    if (!e) return;
    e.blocked = true;
    this.#log(`🚧 Road blocked${e.name ? ': ' + e.name : ''}`);
  }

  unblockEdge(edgeId: string) {
    const e = this.snap.graph.edges.get(edgeId);
    if (e) e.blocked = false;
  }

  // Spawn batch
  spawnBatch(count: number) {
    if (this.snap.entryNodeIds.length === 0 || this.snap.exitNodeIds.length === 0) return;
    for (let i = 0; i < count; i++) {
      this.#spawnAgent();
    }
    this.#recalcFlows();
    this.#refreshMetrics();
    this.onUpdate?.(this.snap);
  }

  setOnUpdate(cb: (s: SimulationSnapshot) => void) { this.onUpdate = cb; }
  getSnapshot(): SimulationSnapshot { return this.snap; }

  // Lifecycle

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
    this.snap.h3Cells = [];
    this.snap.zones = [];
    this.snap.tick = 0;
    this.snap.timeline = [];
    this.agentIdx = 0;
    this.spawnAccum = 0;
    this.sessionPeak = 1;
    for (const e of this.snap.graph.edges.values()) {
      e.flow = 0; e.weight = e.baseWeight;
    }
    this.#refreshMetrics();
    this.onUpdate?.(this.snap);
  }

  // Internal helpers

  // Build lookup table
  #buildEdgeLookup() {
    this.edgeByEndpoints.clear();
    for (const [id, e] of this.snap.graph.edges) {
      this.edgeByEndpoints.set(`${e.source}→${e.target}`, id);
      this.edgeByEndpoints.set(`${e.target}→${e.source}`, id); // Bidirectional
    }
  }

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
    const dt = Math.min(raw, 0.1) * this.timeScale;
    this.lastTs = ts;
    this.snap.tick++;

    // Spawn agents
    const interval = 1 / Math.max(0.1, this.spawnRate);
    this.spawnAccum += dt;
    while (
      this.spawningEnabled &&
      this.spawnAccum >= interval &&
      this.snap.entryNodeIds.length > 0 &&
      this.snap.exitNodeIds.length > 0 &&
      this.snap.agents.length < 10000
    ) {
      this.#spawnAgent();
      this.spawnAccum -= interval;
    }
    if (!this.spawningEnabled) this.spawnAccum = 0; // Drain accumulator

    this.#moveAgents(dt);
    this.#recalcFlows();
    this.#refreshMetrics();

    // Throttle density
    const h3Interval = this.snap.agents.length > 1000 ? 2 : 1;
    if (this.snap.tick % h3Interval === 0) {
      this.#computeH3Density();
    }

    this.onUpdate?.(this.snap);

    this.rafId = requestAnimationFrame(t => this.#tick(t));
  }

  #spawnAgent() {
    const pool = this.spawnPool.length > 0 ? this.spawnPool : this.snap.entryNodeIds;
    const startId = pool[Math.floor(Math.random() * pool.length)];
    const exitIds = this.snap.exitNodeIds;
    if (!startId || exitIds.length === 0 || exitIds.includes(startId)) return;

    const solver = this.algorithm === 'astar' ? aStar
      : this.algorithm === 'bfs' ? bfs
        : dijkstra;

    const t0 = performance.now();
    // Solver exits
    const result = solver(this.snap.graph, startId, exitIds, {
      directionPreference: this.snap.directionPreference,
    });
    const rt = performance.now() - t0;
    if (result.path.length < 2) return;

    const pathCoords: [number, number][] = result.path.map(id => {
      const n = this.snap.graph.nodes.get(id)!;
      return [n.lng, n.lat];
    });

    const palette = ALGO_PALETTE[this.algorithm];
    const color = palette[this.agentIdx % palette.length];

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

    // Glowing trails
    this.snap.recentPaths = [
      { coords: pathCoords, age: 0 },
      ...this.snap.recentPaths.map(p => ({ ...p, age: p.age + 1 })),
    ].slice(0, 10);

    this.snap.metrics.edgesRelaxed = result.edgesRelaxed;
    this.snap.metrics.nodesExplored = result.visitedOrder.length;
    this.snap.metrics.runtimeMs = parseFloat(rt.toFixed(2));
    this.snap.metrics.totalPathMetres = result.totalWeight;
    this.snap.metrics.currentOperation =
      `${this.algorithm.toUpperCase()} · ${result.path.length} hops · ${Math.round(result.totalWeight)} m`;
  }

  #moveAgents(dt: number) {
    for (const a of this.snap.agents) {
      if (a.status !== 'moving') continue;
      const from = a.pathCoords[a.pathIndex];
      const to = a.pathCoords[a.pathIndex + 1];
      if (!from || !to) { a.status = 'arrived'; continue; }

      const segLen = haversine(from[1], from[0], to[1], to[0]);
      a.progress += segLen > 0 ? (a.speed * dt) / segLen : 1;

      if (a.progress >= 1) {
        a.pathIndex++;
        a.progress = 0;
        if (a.pathIndex >= a.pathCoords.length - 1) {
          a.status = 'arrived';
          a.position = a.pathCoords.at(-1)!;
          this.#log(`✓ Agent reached exit safely`);
          continue;
        }
      }

      const nf = a.pathCoords[a.pathIndex];
      const nt = a.pathCoords[a.pathIndex + 1] ?? nf;
      a.position = lerpCoord(nf, nt, a.progress);
    }

    // Prune arrived
    this.snap.agents = this.snap.agents.filter(
      a => a.status === 'moving' || Math.random() > 0.03,
    );
  }

  // Recalculate flows
  #recalcFlows() {
    for (const e of this.snap.graph.edges.values()) e.flow = 0;

    for (const a of this.snap.agents) {
      if (a.status !== 'moving') continue;

      // Intended flows
      for (let i = Math.max(0, a.pathIndex - 1); i < a.path.length - 1; i++) {
        const cur = a.path[i];
        const next = a.path[i + 1];
        if (!cur || !next) continue;

        const edgeId = this.edgeByEndpoints.get(`${cur}→${next}`);
        if (edgeId) {
          const e = this.snap.graph.edges.get(edgeId);
          if (e) e.flow++;
        }
      }
    }

    for (const id of this.snap.graph.edges.keys()) updateEdgeWeight(this.snap.graph, id);
  }

  // Refresh metrics
  #refreshMetrics() {
    let active = 0, arrived = 0;
    for (const a of this.snap.agents) {
      if (a.status === 'moving') active++;
      else arrived++;
    }

    let totalC = 0, n = 0;
    for (const e of this.snap.graph.edges.values()) {
      if (!e.blocked) { totalC += getCongestionLevel(e); n++; }
    }

    this.snap.metrics.activeAgents = active;
    this.snap.metrics.arrivedAgents = arrived;
    this.snap.metrics.totalAgents = this.snap.agents.length;
    this.snap.metrics.congestion = n > 0 ? totalC / n : 0;
  }

  #computeH3Density() {
    const positions = this.snap.agents
      .filter(a => a.status === 'moving')
      .map(a => a.position);

    const result = buildH3Density(positions, this.snap.h3Resolution, this.sessionPeak);

    if (result.maxCount > this.sessionPeak) this.sessionPeak = result.maxCount;

    this.snap.h3Cells = result.cells;
    this.snap.metrics.maxH3Density = result.maxCount;
    this.snap.metrics.hotspotCount = result.hotspots.length;
    this.snap.metrics.h3CoveredCells = result.totalCovered;

    // Density alert
    if (result.hotspots.length > 0 && this.snap.tick % 300 === 0) {
      this.#log(`⚠ H3 critical: ${result.hotspots.length} cell(s) above threshold (${CRITICAL_THRESHOLD} agents/cell)`);
    }
  }

  #log(event: string) {
    const t = this.snap.tick;
    const m = String(Math.floor(t / 1800)).padStart(2, '0');
    const s = String(Math.floor((t % 1800) / 30)).padStart(2, '0');
    this.snap.timeline.unshift({ time: `${m}:${s}`, event });
    if (this.snap.timeline.length > 15) this.snap.timeline.pop();
  }
}
