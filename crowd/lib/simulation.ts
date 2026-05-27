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
  activeAgents:  number;
  arrivedAgents: number;
  totalAgents:   number;
  congestion:    number;   // 0–1 average across road edges
  nodesExplored: number;
  edgesRelaxed:  number;
  runtimeMs:     number;
  algorithm:     AlgorithmType;
  currentOperation: string;
  totalPathMetres:  number;
  // H3 metrics
  maxH3Density:  number;   // peak agents in any single H3 cell
  hotspotCount:  number;   // cells ≥ CRITICAL_THRESHOLD
  h3CoveredCells: number;  // distinct occupied H3 cells
}

export interface TimelineEvent { time: string; event: string; }

/** A recently computed evac path — kept for the glowing trail overlay */
export interface TrackedPath {
  coords: [number, number][];
  age: number;
}

export interface SimulationSnapshot {
  graph:         Graph;
  agents:        Agent[];
  metrics:       SimulationMetrics;
  entryNodeIds:  string[];
  exitNodeIds:   string[];
  spawnRadius:   number;         // metres — zone radius around each entry node
  recentPaths:   TrackedPath[];  // last N computed paths
  h3Cells:       HexCell[];      // current hexagonal density grid
  h3Resolution:  number;
  tick:          number;
  timeline:      TimelineEvent[];
}

// ─── Algorithm colour palettes ────────────────────────────────────────────────

const ALGO_PALETTE: Record<AlgorithmType, [number, number, number][]> = {
  dijkstra: [[0, 210, 255], [0, 180, 240], [60, 220, 255], [100, 230, 255]],
  astar:    [[255, 130, 0],  [255, 160, 30], [255, 100, 10], [240, 150, 40]],
  bfs:      [[60, 255, 130], [40, 235, 110], [90, 255, 150], [50, 210, 100]],
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export class SimulationEngine {
  private snap:        SimulationSnapshot;
  private algorithm:   AlgorithmType;
  private onUpdate?:   (s: SimulationSnapshot) => void;
  private rafId?:      number;
  private lastTs    =  0;
  private agentIdx  =  0;
  private spawnAccum = 0;
  private spawnRate  = 3;
  private timeScale  = 1;
  private spawnRadius = 200;
  private spawnPool:   string[] = [];
  private sessionPeak  = 1;   // running peak H3 density (for normalisation)

  /**
   * O(1) edge lookup: `${sourceId}→${targetId}` → edgeId
   * Built once per graph load; avoids inner loop in #recalcFlows.
   */
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
      entryNodeIds:  [],
      exitNodeIds:   [],
      spawnRadius:   this.spawnRadius,
      recentPaths:   [],
      h3Cells:       [],
      h3Resolution:  DEFAULT_RESOLUTION,
      tick:          0,
      timeline:      [],
    };
    this.#buildEdgeLookup();
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

  setH3Resolution(res: number) {
    this.snap.h3Resolution = res;
    this.sessionPeak = 1;  // reset normalisation on resolution change
  }

  setSpawnRate(r: number)  { this.spawnRate  = r; }
  setTimeScale(s: number)  { this.timeScale  = s; }

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
    this.snap.agents      = [];
    this.snap.recentPaths = [];
    this.snap.h3Cells     = [];
    this.snap.tick        = 0;
    this.snap.timeline    = [];
    this.agentIdx         = 0;
    this.spawnAccum       = 0;
    this.sessionPeak      = 1;
    for (const e of this.snap.graph.edges.values()) {
      e.flow = 0; e.weight = e.baseWeight;
    }
    this.#refreshMetrics();
    this.onUpdate?.(this.snap);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /**
   * Pre-build a lookup table: `${sourceId}→${targetId}` → edgeId.
   * Called once at construction. Reduces #recalcFlows from O(degree) per
   * agent to O(1) per agent.
   */
  #buildEdgeLookup() {
    this.edgeByEndpoints.clear();
    for (const [id, e] of this.snap.graph.edges) {
      this.edgeByEndpoints.set(`${e.source}→${e.target}`, id);
      this.edgeByEndpoints.set(`${e.target}→${e.source}`, id); // bidirectional
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
    const dt  = Math.min(raw, 0.1) * this.timeScale;
    this.lastTs = ts;
    this.snap.tick++;

    // Spawn agents
    const interval = 1 / Math.max(0.1, this.spawnRate);
    this.spawnAccum += dt;
    while (
      this.spawnAccum >= interval &&
      this.snap.entryNodeIds.length > 0 &&
      this.snap.exitNodeIds.length  > 0 &&
      this.snap.agents.length < 1500
    ) {
      this.#spawnAgent();
      this.spawnAccum -= interval;
    }

    this.#moveAgents(dt);
    this.#recalcFlows();
    this.#refreshMetrics();

    // Throttle H3 density: every tick when sparse, every 2nd tick when crowded.
    // latLngToCell is O(1) but 1500 × 60fps = 90k calls/s without throttling.
    const h3Interval = this.snap.agents.length > 400 ? 2 : 1;
    if (this.snap.tick % h3Interval === 0) {
      this.#computeH3Density();
    }

    this.onUpdate?.(this.snap);

    this.rafId = requestAnimationFrame(t => this.#tick(t));
  }

  #spawnAgent() {
    const pool    = this.spawnPool.length > 0 ? this.spawnPool : this.snap.entryNodeIds;
    const startId = pool[Math.floor(Math.random() * pool.length)];
    const exitId  = this.snap.exitNodeIds[Math.floor(Math.random() * this.snap.exitNodeIds.length)];
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

    // Save path for glowing trail
    this.snap.recentPaths = [
      { coords: pathCoords, age: 0 },
      ...this.snap.recentPaths.map(p => ({ ...p, age: p.age + 1 })),
    ].slice(0, 10);

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

      const segLen  = haversine(from[1], from[0], to[1], to[0]);
      a.progress   += segLen > 0 ? (a.speed * dt) / segLen : 1;

      if (a.progress >= 1) {
        a.pathIndex++;
        a.progress = 0;
        if (a.pathIndex >= a.pathCoords.length - 1) {
          a.status   = 'arrived';
          a.position = a.pathCoords.at(-1)!;
          this.#log(`✓ Agent reached exit safely`);
          continue;
        }
      }

      const nf = a.pathCoords[a.pathIndex];
      const nt = a.pathCoords[a.pathIndex + 1] ?? nf;
      a.position = lerpCoord(nf, nt, a.progress);
    }

    // Gradually prune arrived agents
    this.snap.agents = this.snap.agents.filter(
      a => a.status === 'moving' || Math.random() > 0.03,
    );
  }

  /**
   * Recalculate per-edge flow counts using the O(1) endpoint lookup table.
   * Previously O(agents × avg_degree); now O(agents).
   */
  #recalcFlows() {
    for (const e of this.snap.graph.edges.values()) e.flow = 0;

    for (const a of this.snap.agents) {
      if (a.status !== 'moving') continue;
      const cur  = a.path[a.pathIndex];
      const next = a.path[a.pathIndex + 1];
      if (!cur || !next) continue;

      const edgeId = this.edgeByEndpoints.get(`${cur}→${next}`);
      if (edgeId) {
        const e = this.snap.graph.edges.get(edgeId);
        if (e) e.flow++;
      }
    }

    for (const id of this.snap.graph.edges.keys()) updateEdgeWeight(this.snap.graph, id);
  }

  /**
   * Refresh live metrics in a single pass over the agents array.
   * Previously two separate filter() calls; now O(N) with one loop.
   */
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

    this.snap.metrics.activeAgents  = active;
    this.snap.metrics.arrivedAgents = arrived;
    this.snap.metrics.totalAgents   = this.snap.agents.length;
    this.snap.metrics.congestion    = n > 0 ? totalC / n : 0;
  }

  #computeH3Density() {
    const positions = this.snap.agents
      .filter(a => a.status === 'moving')
      .map(a => a.position);

    const result = buildH3Density(positions, this.snap.h3Resolution, this.sessionPeak);

    // Update running peak for stable normalisation
    if (result.maxCount > this.sessionPeak) this.sessionPeak = result.maxCount;

    this.snap.h3Cells = result.cells;
    this.snap.metrics.maxH3Density   = result.maxCount;
    this.snap.metrics.hotspotCount   = result.hotspots.length;
    this.snap.metrics.h3CoveredCells = result.totalCovered;

    // Critical density alert (at most once every ~5 s at 60 fps)
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
