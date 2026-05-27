'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import {
  Ban, Layers, Loader2, MapPin, Pause, Play,
  RotateCcw, Siren, Plus, ArrowRightFromLine, Trash2,
} from 'lucide-react';

import CountUp from '@/components/ui/CountUp';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider }    from '@/components/ui/slider';

import { type Graph }           from '@/lib/graph';
import { type AlgorithmType }   from '@/lib/simulation';
import { ALGORITHM_META }       from '@/lib/pathfinding';
import { fetchOsmGraph }        from '@/lib/osm';
import { VENUES }               from '@/lib/venues';
import { useSimulation }        from '@/hooks/useSimulation';
import { type InteractionMode } from '@/components/MapView';

// ─── Dynamic MapView (WebGL — client only) ────────────────────────────────────

const MapView = dynamic(
  () => import('@/components/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1a2e]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Initialising WebGL…</p>
      </div>
    ),
  },
);

// ─── Static data ──────────────────────────────────────────────────────────────

const DENSITY_SCALE = [
  { color: 'bg-blue-500',   label: 'Low'      },
  { color: 'bg-yellow-400', label: 'Medium'   },
  { color: 'bg-orange-500', label: 'High'     },
  { color: 'bg-red-600',    label: 'Critical' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrowdFlowSimulator() {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [venueKey,  setVenueKey]  = useState<string>('mg_road_bangalore');
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('dijkstra');
  const [speed,     setSpeed]     = useState(5);
  const [mode,      setMode]      = useState<InteractionMode>('view');
  const [is3D,      setIs3D]      = useState(false);
  const [spawnRadius, setSpawnRadiusUI] = useState(200); // metres

  // ── Graph loading ─────────────────────────────────────────────────────────
  const [graph,   setGraph]   = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const loadVenue = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    setGraph(null);
    try {
      const g = await fetchOsmGraph(VENUES[key]);
      setGraph(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVenue(venueKey); }, [venueKey]); // eslint-disable-line

  // ── Simulation ────────────────────────────────────────────────────────────
  const {
    snapshot, running,
    start, stop, reset,
    setSpeed: simSetSpeed,
    setSpawnRadius: simSetSpawnRadius,
    addEntryNode, addExitNode,
    blockEdge, clearAll,
  } = useSimulation(graph, algorithm);

  useEffect(() => { simSetSpeed(speed); }, [speed, simSetSpeed]);
  useEffect(() => { simSetSpawnRadius(spawnRadius); }, [spawnRadius, simSetSpawnRadius]);

  // ── Map interaction ───────────────────────────────────────────────────────
  const handleNodeClick = useCallback((nodeId: string) => {
    if (mode === 'add-entry') { addEntryNode(nodeId); setMode('view'); }
    if (mode === 'add-exit')  { addExitNode(nodeId);  setMode('view'); }
  }, [mode, addEntryNode, addExitNode]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    if (mode === 'block-road') { blockEdge(edgeId); setMode('view'); }
  }, [mode, blockEdge]);

  // ── Derived values ────────────────────────────────────────────────────────
  const m     = snapshot?.metrics;
  const venue = VENUES[venueKey];
  const meta  = ALGORITHM_META[algorithm];

  const hasEntry = (snapshot?.entryNodeIds.length ?? 0) > 0;
  const hasExit  = (snapshot?.exitNodeIds.length  ?? 0) > 0;
  const canStart = !!graph && !loading && hasEntry && hasExit;

  const metrics = [
    { label: 'Nodes',       value: graph ? graph.nodes.size                         : 0, suffix: ''   },
    { label: 'Edges',       value: graph ? graph.edges.size                         : 0, suffix: ''   },
    { label: 'Runtime',     value: m     ? parseFloat(m.runtimeMs.toFixed(1))       : 0, suffix: 'ms' },
    { label: 'Path',        value: m && m.totalPathMetres < 1e8
                                   ? Math.round(m.totalPathMetres)                  : 0, suffix: 'm'  },
    { label: 'Congestion',  value: m     ? Math.round(m.congestion * 100)           : 0, suffix: '%'  },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm
                           lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Crowd Flow Simulator
              </h1>
              <Badge variant={running ? 'default' : 'secondary'} className="gap-1.5">
                {running
                  ? <><span className="size-2 rounded-full bg-green-400 animate-pulse inline-block" /> Live</>
                  : 'Paused'}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Real-world OSM street networks · Dijkstra / A* / BFS · Agent-based crowd simulation
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg" variant="outline"
              className="gap-2"
              onClick={() => setIs3D(v => !v)}
            >
              <Layers className="h-4 w-4" />
              {is3D ? '2D' : '3D'}
            </Button>

            {running
              ? (
                <Button size="lg" variant="outline" className="gap-2" onClick={stop}>
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              )
              : (
                <Button size="lg" className="gap-2" onClick={start} disabled={!canStart}>
                  <Play className="h-4 w-4" />
                  {!graph || loading ? 'Loading…'
                    : !hasEntry ? 'Set Entry First'
                    : !hasExit  ? 'Set Exit First'
                    : 'Start'}
                </Button>
              )
            }

            <Button variant="outline" size="lg" className="gap-2" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>

            <Button variant="destructive" size="lg" className="gap-2" onClick={() => {
              // Emergency: flood all edges to simulate jam then start
              if (graph) {
                for (const e of graph.edges.values()) e.flow = e.capacity * 0.95;
              }
              reset();
            }}>
              <Siren className="h-4 w-4" /> Emergency
            </Button>
          </div>
        </header>

        {/* ── Main grid ──────────────────────────────────────────────────── */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <section className="flex min-w-0 flex-col gap-5">

            {/* Metric cards */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {metrics.map(met => <MetricCard key={met.label} {...met} />)}
            </div>

            {/* Map */}
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="border-b py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {loading ? 'Loading map data…' : venue?.name ?? 'Map'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {loading
                        ? `Fetching ${venue?.name} from OpenStreetMap…`
                        : error
                        ? 'Failed to load. Try another venue or retry.'
                        : 'Roads: blue=clear → red=jammed · 🟢 Entry zone · 🟡 Exit · Yellow line=evacuation path'}
                    </CardDescription>
                  </div>
                  {mode !== 'view' && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {mode === 'add-entry'  ? '🟢 Click an intersection to set Entry'
                      : mode === 'add-exit'  ? '🟡 Click an intersection to set Exit'
                      :                        '🔴 Click a road segment to block it'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative bg-[#0d0d1a]" style={{ height: 600 }}>
                  {error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <p className="text-sm text-red-400">{error}</p>
                      <Button size="sm" variant="outline" onClick={() => loadVenue(venueKey)}>
                        Retry
                      </Button>
                    </div>
                  ) : loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-9 w-9 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Fetching {venue?.name} from OpenStreetMap…
                      </p>
                      <p className="text-xs text-muted-foreground opacity-60">
                        Building graph: nodes, edges, weights…
                      </p>
                    </div>
                  ) : (
                    <MapView
                      snapshot={snapshot}
                      center={venue?.center ?? [77.6076, 12.9752]}
                      zoom={venue?.zoom ?? 15}
                      venueKey={venueKey}
                      mode={mode}
                      is3D={is3D}
                      onNodeClick={handleNodeClick}
                      onEdgeClick={handleEdgeClick}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timeline + Density legend */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <Card>
                <CardHeader>
                  <CardTitle>Simulation Timeline</CardTitle>
                  <CardDescription>Event log from the routing engine</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {snapshot?.timeline.length
                    ? snapshot.timeline.map((ev, i) => (
                        <div key={i} className="grid grid-cols-[52px_1fr] gap-3 text-sm">
                          <span className="font-mono text-muted-foreground">{ev.time}</span>
                          <p className="border-l pl-3 leading-5">{ev.event}</p>
                        </div>
                      ))
                    : <p className="text-sm text-muted-foreground italic">
                        Press Start to see events.
                      </p>
                  }
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Legend</CardTitle>
                  <CardDescription>Map colour guide</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {DENSITY_SCALE.map(d => (
                    <div key={d.label} className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-1.5">
                      <span className={`size-3 rounded-full ${d.color}`} />
                      <span className="text-sm font-medium">{d.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-1.5">
                    <span className="size-3 rounded-full bg-green-400" />
                    <span className="text-sm font-medium">Entry zone</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-1.5">
                    <span className="size-3 rounded-full bg-yellow-400" />
                    <span className="text-sm font-medium">Exit point</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-1.5">
                    <span className="h-1 w-6 rounded bg-yellow-400" />
                    <span className="text-sm font-medium">Evac path</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ── Right sidebar ────────────────────────────────────────────── */}
          <aside className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">

            {/* Simulation controls */}
            <Card>
              <CardHeader>
                <CardTitle>Simulation Controls</CardTitle>
                <CardDescription>Venue, algorithm & speed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Venue preset</label>
                  <Select value={venueKey} onValueChange={k => { reset(); setVenueKey(k); }}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(VENUES).map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          <span>{v.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Algorithm</label>
                  <Select value={algorithm} onValueChange={v => setAlgorithm(v as AlgorithmType)}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dijkstra">Dijkstra (shortest weighted)</SelectItem>
                      <SelectItem value="astar">A* (heuristic-guided)</SelectItem>
                      <SelectItem value="bfs">BFS (fewest hops)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground">Simulation speed</label>
                    <span className="text-sm font-semibold font-mono">{speed}×</span>
                  </div>
                  <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={1} max={10} step={1} />
                </div>

              </CardContent>
            </Card>

            {/* Crowd zone customisation */}
            <Card>
              <CardHeader>
                <CardTitle>Crowd Zone</CardTitle>
                <CardDescription>Define where the crowd spawns and exits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Status pills */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    hasEntry ? 'border-green-500/40 bg-green-500/10' : 'bg-muted/20'
                  }`}>
                    <span className={`size-2 rounded-full ${hasEntry ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                    <span className="text-sm">{hasEntry ? '1 Entry set' : 'No entry'}</span>
                  </div>
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    hasExit ? 'border-yellow-500/40 bg-yellow-500/10' : 'bg-muted/20'
                  }`}>
                    <span className={`size-2 rounded-full ${hasExit ? 'bg-yellow-400' : 'bg-muted-foreground'}`} />
                    <span className="text-sm">
                      {hasExit ? `${snapshot?.exitNodeIds.length ?? 0} Exit(s)` : 'No exit'}
                    </span>
                  </div>
                </div>

                {/* Spawn radius */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground">
                      Spawn radius
                    </label>
                    <span className="text-sm font-semibold font-mono">{spawnRadius} m</span>
                  </div>
                  <Slider
                    value={[spawnRadius]}
                    onValueChange={([v]) => setSpawnRadiusUI(v)}
                    min={50} max={600} step={25}
                  />
                  <p className="text-xs text-muted-foreground">
                    Crowd spawns from any road node within this radius of the entry point.
                    Larger = more spread-out crowd.
                  </p>
                </div>

                {/* Interaction mode buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <ModeButton label="Set Entry"   icon={Plus}               modeKey="add-entry"   current={mode} onSelect={setMode} />
                  <ModeButton label="Add Exit"    icon={ArrowRightFromLine} modeKey="add-exit"    current={mode} onSelect={setMode} />
                  <ModeButton label="Block Road"  icon={Ban}                modeKey="block-road"  current={mode} onSelect={setMode} />
                  <Button
                    variant="outline" size="lg"
                    className="justify-start gap-2"
                    onClick={() => setMode('view')}
                    disabled={mode === 'view'}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    View Mode
                  </Button>
                </div>

                <Button
                  variant="outline" size="sm"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => {
                    if (!graph) return;
                    for (const e of graph.edges.values()) e.blocked = false;
                    clearAll();
                    reset();
                  }}
                  disabled={!graph}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Entry / Exit / Blocks
                </Button>

              </CardContent>
            </Card>

            {/* Live crowd stats */}
            <Card>
              <CardHeader>
                <CardTitle>Crowd Metrics</CardTitle>
                <CardDescription>Live agent counts</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                <AgentStat label="Active"  value={m?.activeAgents  ?? 0} color="text-cyan-400"  />
                <AgentStat label="Arrived" value={m?.arrivedAgents ?? 0} color="text-green-400" />
                <AgentStat label="Total"   value={m?.totalAgents   ?? 0} color="text-foreground" />
              </CardContent>
            </Card>

            {/* Algorithm analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Algorithm Analysis</CardTitle>
                <CardDescription>{meta?.label}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    Last operation
                  </p>
                  <p className="text-xs font-mono font-semibold leading-relaxed text-foreground">
                    {m?.currentOperation ?? 'Idle — set entry/exit then press Start'}
                  </p>
                </div>
                <AnalysisRow label="Algorithm"       value={meta?.label      ?? '—'} />
                <Separator />
                <AnalysisRow label="Time complexity" value={meta?.complexity ?? '—'} />
                <Separator />
                <AnalysisRow label="Space complexity" value={meta?.space     ?? '—'} />
                <Separator />
                <AnalysisRow label="Nodes explored"  value={String(m?.nodesExplored ?? 0)} />
                <Separator />
                <AnalysisRow label="Edges relaxed"   value={String(m?.edgesRelaxed  ?? 0)} />
              </CardContent>
            </Card>

          </aside>
        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-2xl font-mono font-semibold tracking-tight">
          <CountUp to={value} from={0} direction="up" duration={0.5} />
          {suffix && (
            <span className="text-sm font-normal text-muted-foreground ml-0.5">{suffix}</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function AgentStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-muted/20 p-3">
      <span className={`text-2xl font-mono font-bold tabular-nums ${color}`}>{value}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function AnalysisRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold font-mono">{value}</p>
    </div>
  );
}

function ModeButton({
  label, icon: Icon, modeKey, current, onSelect,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  modeKey: InteractionMode;
  current: InteractionMode;
  onSelect: (m: InteractionMode) => void;
}) {
  const active = current === modeKey;
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="lg"
      className="justify-start gap-2"
      onClick={() => onSelect(active ? 'view' : modeKey)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}
