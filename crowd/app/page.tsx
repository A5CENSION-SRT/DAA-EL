'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import {
  Ban, Hexagon, Layers, Loader2, MapPin, Pause, Play,
  RotateCcw, Siren, Plus, ArrowRightFromLine, Trash2, HexagonIcon,
  Activity, Users, Zap, Network, AlertTriangle, Timer,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

import { type Graph } from '@/lib/graph';
import { type AlgorithmType } from '@/lib/simulation';
import { ALGORITHM_META } from '@/lib/pathfinding';
import { fetchOsmGraph } from '@/lib/osm';
import { VENUES } from '@/lib/venues';
import { CRITICAL_THRESHOLD, h3ResolutionLabel } from '@/lib/h3-spatial';
import { useSimulation } from '@/hooks/useSimulation';
import { type InteractionMode } from '@/components/MapView';

// ─── Dynamic MapView ──────────────────────────────────────────────────────────
const MapView = dynamic(
  () => import('@/components/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#07090f]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <p className="text-sm text-slate-400">Initialising WebGL renderer…</p>
      </div>
    ),
  },
);

// ─── Speed helpers ────────────────────────────────────────────────────────────
function speedLabel(s: number) {
  if (s <= 1) return 'Crawl';
  if (s <= 3) return 'Walk';
  if (s <= 6) return 'Jog';
  if (s <= 8) return 'Run';
  return 'Flood';
}
function speedColor(s: number) {
  if (s <= 2) return { badge: 'bg-blue-500/20 text-blue-300', dot: 'bg-blue-400' };
  if (s <= 5) return { badge: 'bg-emerald-500/20 text-emerald-300', dot: 'bg-emerald-400' };
  if (s <= 8) return { badge: 'bg-amber-500/20 text-amber-300', dot: 'bg-amber-400' };
  return { badge: 'bg-red-500/20 text-red-300', dot: 'bg-red-400' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function H3CrowdControlSystem() {
  const [venueKey, setVenueKey] = useState('mg_road_bangalore');
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('dijkstra');
  const [speed, setSpeedUI] = useState(3);
  const [mode, setMode] = useState<InteractionMode>('view');
  const [is3D, setIs3D] = useState(false);
  const [showH3, setShowH3] = useState(true);
  const [showH3Counts, setShowH3Counts] = useState(false);
  const [spawnRadius, setSpawnRadiusUI] = useState(200);
  const [h3Res, setH3ResUI] = useState(10);

  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVenue = useCallback(async (key: string) => {
    setLoading(true); setError(null); setGraph(null);
    try { setGraph(await fetchOsmGraph(VENUES[key])); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to fetch map data'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadVenue(venueKey); }, [venueKey]); // eslint-disable-line

  const {
    snapshot, running, start, stop, reset,
    setSpeed, setSpawnRadius, setH3Resolution,
    setEntryNode, addExitNode, blockEdge, clearAll,
  } = useSimulation(graph, algorithm);

  useEffect(() => { setSpeed(speed); }, [speed, setSpeed]);
  useEffect(() => { setSpawnRadius(spawnRadius); }, [spawnRadius, setSpawnRadius]);
  useEffect(() => { setH3Resolution(h3Res); }, [h3Res, setH3Resolution]);

  const handleNodeClick = useCallback((id: string) => {
    if (mode === 'add-entry') { setEntryNode(id); setMode('view'); }
    if (mode === 'add-exit') { addExitNode(id); setMode('view'); }
  }, [mode, setEntryNode, addExitNode]);

  const handleEdgeClick = useCallback((id: string) => {
    if (mode === 'block-road') { blockEdge(id); setMode('view'); }
  }, [mode, blockEdge]);

  const m = snapshot?.metrics;
  const venue = VENUES[venueKey];
  const meta = ALGORITHM_META[algorithm];
  const hasEntry = (snapshot?.entryNodeIds.length ?? 0) > 0;
  const hasExit = (snapshot?.exitNodeIds.length ?? 0) > 0;
  const canStart = !!graph && !loading && hasEntry && hasExit;
  const hotspot = (m?.hotspotCount ?? 0) > 0;
  const sc = speedColor(speed);

  return (
    <main className="h-screen overflow-hidden flex flex-col bg-[#050608] text-slate-300 font-sans">
      <div className="mx-auto flex w-full flex-1 min-h-0 flex-col gap-2 p-2 sm:p-3">

        {/* ═══ HEADER ═══════════════════════════════════════════════════════ */}
        <header className="flex flex-wrap items-center gap-3 rounded-sm border border-white/5 bg-[#090a0f] px-4 py-2 shadow-sm">
          {/* Logo */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-500/10 border border-blue-500/20">
            <HexagonIcon className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mr-auto min-w-0">
            <p className="text-sm font-semibold text-slate-100 leading-none tracking-tight">
              H3 SPATIAL CROWD CONTROL
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-medium">
              Geospatial Operations Engine
            </p>
          </div>

          {/* Status pill */}
          <div className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] uppercase tracking-wider font-semibold ${hotspot && running ? 'border-red-500/30 bg-red-950/40 text-red-400'
            : running ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-400'
              : 'border-white/10 bg-white/5 text-slate-400'
            }`}>
            <span className={`size-1.5 rounded-full ${hotspot && running ? 'bg-red-500 animate-pulse' : running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            {hotspot && running ? 'HOTSPOT' : running ? 'LIVE' : 'STANDBY'}
          </div>

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* View toggles */}
          <button
            onClick={() => setIs3D(v => !v)}
            className={`flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-medium transition-colors ${is3D ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
              : 'border-white/10 bg-transparent text-slate-400 hover:text-slate-200 hover:border-white/20'
              }`}>
            <Layers className="h-3 w-3" />{is3D ? '3D On' : '3D'}
          </button>
          <button
            onClick={() => setShowH3(v => !v)}
            className={`flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-medium transition-colors ${showH3 ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
              : 'border-white/10 bg-transparent text-slate-400 hover:text-slate-200 hover:border-white/20'
              }`}>
            <Hexagon className="h-3 w-3" />H3 Grid
          </button>
          {showH3 && (
            <button
              onClick={() => setShowH3Counts(v => !v)}
              className={`flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-medium transition-colors ${showH3Counts ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                : 'border-white/10 bg-transparent text-slate-400 hover:text-slate-200 hover:border-white/20'
                }`}>
              <Users className="h-3 w-3" />Counts
            </button>
          )}

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Sim controls */}
          {running
            ? <button onClick={stop}
              className="flex h-7 items-center gap-1.5 rounded-sm border border-white/10 bg-transparent px-3 text-[11px] font-medium text-slate-300 hover:border-white/20 hover:text-white transition-colors">
              <Pause className="h-3 w-3" /> Pause
            </button>
            : <button onClick={start} disabled={!canStart}
              className={`flex h-7 items-center gap-1.5 rounded-sm px-4 text-[11px] uppercase tracking-wide font-semibold transition-all ${canStart ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50'
                : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                }`}>
              <Play className="h-3 w-3" />
              {!graph || loading ? 'Wait' : !hasEntry ? 'No Entry' : !hasExit ? 'No Exit' : 'Engage'}
            </button>
          }
          <button onClick={reset}
            className="flex h-7 items-center gap-1.5 rounded-sm border border-white/10 bg-transparent px-3 text-[11px] font-medium text-slate-400 hover:text-white hover:border-white/20 transition-colors">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
          <button onClick={() => {
            if (graph) for (const e of graph.edges.values()) e.flow = e.capacity * 0.95;
            reset();
          }}
            className="flex h-7 items-center gap-1.5 rounded-sm border border-red-900/50 bg-red-950/30 px-3 text-[11px] uppercase tracking-wider font-semibold text-red-500 hover:bg-red-950/60 hover:text-red-400 transition-colors">
            <Siren className="h-3 w-3" /> Panic
          </button>
        </header>

        {/* ═══ METRIC STRIP ══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[
            { label: 'OSM Nodes', val: graph ? graph.nodes.size : 0, sfx: '', Icon: Network, lBorder: 'border-l-blue-500', num: 'text-blue-300' },
            { label: 'OSM Edges', val: graph ? graph.edges.size : 0, sfx: '', Icon: Activity, lBorder: 'border-l-indigo-500', num: 'text-indigo-300' },
            { label: 'Runtime', val: m ? parseFloat(m.runtimeMs.toFixed(1)) : 0, sfx: 'ms', Icon: Timer, lBorder: 'border-l-yellow-500', num: 'text-yellow-300' },
            { label: 'H3 Cells', val: m ? m.h3CoveredCells : 0, sfx: '', Icon: Hexagon, lBorder: 'border-l-violet-500', num: 'text-violet-300' },
            { label: 'Hotspots', val: m ? m.hotspotCount : 0, sfx: '', Icon: AlertTriangle, lBorder: 'border-l-red-500', num: 'text-red-300', alert: true },
            { label: 'Active', val: m ? m.activeAgents : 0, sfx: '', Icon: Users, lBorder: 'border-l-cyan-500', num: 'text-cyan-300' },
            { label: 'Arrived', val: m ? m.arrivedAgents : 0, sfx: '', Icon: Zap, lBorder: 'border-l-emerald-500', num: 'text-emerald-300' },
          ].map(({ label, val, sfx, Icon, lBorder, num, alert }) => {
            const isAlert = alert && (val as number) > 0;
            return (
              <div key={label}
                className={`relative rounded-xl border-l-2 border border-slate-700/60 bg-[#0c0f1a] px-3 py-2.5 ${lBorder} ${isAlert ? 'border-t-red-900/60 border-r-red-900/60 border-b-red-900/60 bg-red-950/30' : ''}`}>
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                    <p className={`mt-1 text-xl font-bold font-mono tabular-nums leading-none ${isAlert ? 'text-red-600 dark:text-red-400' : num}`}>
                      {typeof val === 'number' && label !== 'Runtime' ? new Intl.NumberFormat('en-US').format(val) : val}
                      {sfx && <span className="text-[11px] font-normal text-slate-500 ml-0.5">{sfx}</span>}
                    </p>
                  </div>
                  <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isAlert ? 'text-red-500/60' : 'text-slate-700'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ MAIN GRID ═════════════════════════════════════════════════════ */}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] flex-1 min-h-0">

          {/* ─── LEFT ─────────────────────────────────────────────────────── */}
          <section className="flex min-w-0 flex-col gap-3 h-full min-h-0">

            {/* Map container */}
            <div className="rounded-2xl border border-slate-700/60 bg-[#0c0f1a] overflow-hidden relative flex-1 min-h-0 flex flex-col">
              {/* Map interaction pill floating above */}
              {mode !== 'view' && (
                <div className="absolute top-4 left-4 z-10">
                  <span className="animate-pulse shadow-lg rounded-full border border-white/15 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-slate-200">
                    {mode === 'add-entry' ? '🟢 Click node → Entry'
                      : mode === 'add-exit' ? '🟡 Click node → Exit'
                        : '🔴 Click road → Block'}
                  </span>
                </div>
              )}

              {/* Map canvas + legend overlay */}
              <div className="relative bg-[#07090f] flex-1 min-h-0">
                {error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <p className="text-sm text-red-400">{error}</p>
                    <Button size="sm" variant="outline" onClick={() => loadVenue(venueKey)}>Retry</Button>
                  </div>
                ) : loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                    <p className="text-sm text-slate-400">Fetching {venue?.name} road network…</p>
                    <p className="text-xs text-slate-600">Overpass API → nodes/edges → graph</p>
                  </div>
                ) : (
                  <>
                    <MapView
                      snapshot={snapshot}
                      center={venue?.center ?? [77.6076, 12.9752]}
                      zoom={venue?.zoom ?? 15}
                      venueKey={venueKey}
                      bbox={venue?.bbox}
                      mode={mode}
                      is3D={is3D}
                      showH3Layer={showH3}
                      showH3Counts={showH3Counts}
                      onNodeClick={handleNodeClick}
                      onEdgeClick={handleEdgeClick}
                    />

                    {/* ── Legend overlay (top-right of map) ── */}
                    <div className="absolute top-4 right-4 z-10 rounded-xl border border-white/10 bg-black/70 backdrop-blur-md p-3 min-w-[156px]">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Legend</p>
                      <div className="space-y-1.5">
                        {[
                          { dot: 'bg-blue-500', label: 'Road — clear' },
                          { dot: 'bg-yellow-400', label: 'Road — moderate' },
                          { dot: 'bg-red-500', label: 'Road — jammed' },
                          { dot: 'bg-indigo-400 opacity-60', label: 'H3 grid cell' },
                          { dot: 'bg-violet-500', label: 'H3 — low density' },
                          { dot: 'bg-red-600', label: 'H3 — critical' },
                          { dot: 'bg-emerald-400', label: 'Entry zone' },
                          { dot: 'bg-yellow-300', label: 'Exit point' },
                        ].map(d => (
                          <div key={d.label} className="flex items-center gap-2">
                            <span className={`size-2 shrink-0 rounded-sm ${d.dot}`} />
                            <span className="text-[11px] text-slate-300">{d.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Event log */}
            <div className="rounded-2xl border border-slate-700/60 bg-[#0c0f1a] p-4 shrink-0 overflow-hidden flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 shrink-0">Event Log</p>
              <div className="h-32 min-h-0 overflow-y-auto space-y-2 pr-2">
                {snapshot?.timeline.length
                  ? snapshot.timeline.map((ev, i) => (
                    <div key={i} className="grid grid-cols-[44px_1fr] gap-2 text-xs">
                      <span className="font-mono text-slate-700 pt-px">{ev.time}</span>
                      <p className={`border-l pl-2.5 leading-5 ${ev.event.startsWith('⚠') ? 'text-red-400 border-red-700'
                        : ev.event.startsWith('🚧') ? 'text-amber-400 border-amber-700'
                          : 'text-slate-400 border-slate-700'}`}>{ev.event}</p>
                    </div>
                  ))
                  : <p className="text-xs text-slate-600 italic">Set entry/exit points then press Start.</p>
                }
              </div>
            </div>
          </section>

          {/* ─── RIGHT SIDEBAR ────────────────────────────────────────────── */}
          <aside className="flex flex-col gap-3 h-full min-h-0 overflow-y-auto pr-1">

            {/* ── Simulation Controls ── */}
            <Panel title="Simulation Controls" sub="Venue, algorithm & speed">
              <div className="space-y-4">
                <Field label="Venue">
                  <Select value={venueKey} onValueChange={k => { reset(); setVenueKey(k); }}>
                    <SelectTrigger className="h-9 w-full rounded-xl border-slate-700 bg-slate-800 text-slate-200 text-sm focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 shadow-2xl shadow-black/50">
                      {Object.values(VENUES).map(v => (
                        <SelectItem key={v.id} value={v.id}
                          className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Algorithm">
                  <Select value={algorithm} onValueChange={v => setAlgorithm(v as AlgorithmType)}>
                    <SelectTrigger className="h-9 w-full rounded-xl border-slate-700 bg-slate-800 text-slate-200 text-sm focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 shadow-2xl shadow-black/50">
                      <SelectItem value="dijkstra" className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">
                        Dijkstra — shortest weighted
                      </SelectItem>
                      <SelectItem value="astar" className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">
                        A* — heuristic guided
                      </SelectItem>
                      <SelectItem value="bfs" className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">
                        BFS — fewest hops
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {/* Speed */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel>Speed</FieldLabel>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-white">{speed}×</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sc.badge}`}>
                        {speedLabel(speed)}
                      </span>
                    </div>
                  </div>
                  <Slider value={[speed]} onValueChange={([v]) => setSpeedUI(v)} min={1} max={10} step={1} />
                  <div className="flex justify-between text-[10px] font-mono text-slate-700">
                    <span>0.5 / s · 0.5×</span>
                    <span>20 / s · 5×</span>
                  </div>
                </div>
              </div>
            </Panel>

            {/* ── H3 Spatial ── */}
            <Panel
              title="H3 Spatial"
              sub="Hexagonal density grid"
              icon={<HexagonIcon className="h-3.5 w-3.5 text-violet-400" />}
            >
              <div className="space-y-4">
                <Field label="Resolution">
                  <Select value={String(h3Res)} onValueChange={v => setH3ResUI(Number(v))}>
                    <SelectTrigger className="h-9 w-full rounded-xl border-slate-700 bg-slate-800 text-slate-200 text-sm focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 shadow-2xl shadow-black/50">
                      <SelectItem value="8" className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">Res 8 — ~461 m / cell (district)</SelectItem>
                      <SelectItem value="9" className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">Res 9 — ~174 m / cell (neighbourhood)</SelectItem>
                      <SelectItem value="10" className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">Res 10 — ~66 m / cell  ← default</SelectItem>
                      <SelectItem value="11" className="rounded-lg text-sm text-slate-300 focus:bg-slate-700/80 focus:text-white cursor-pointer">Res 11 — ~25 m / cell (building)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Cells" val={m?.h3CoveredCells ?? 0} color="text-violet-300" />
                  <MiniStat label="Peak" val={m?.maxH3Density ?? 0} color="text-amber-300" />
                  <MiniStat label="Hotspots" val={m?.hotspotCount ?? 0}
                    color={(m?.hotspotCount ?? 0) > 0 ? 'text-red-300' : 'text-slate-600'} />
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 text-[11px] text-slate-500">
                  Critical at{' '}
                  <span className="font-semibold text-slate-300">≥ {CRITICAL_THRESHOLD} agents/cell</span>
                  {' · '}
                  <span className="text-violet-400">Grid visible on map</span>
                </div>
              </div>
            </Panel>

            {/* ── Crowd Zone ── */}
            <Panel title="Crowd Zone" sub="Entry · exits · road blocks">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <ZonePill ok={hasEntry} okText="Entry set" nokText="No entry" color="emerald" />
                  <ZonePill ok={hasExit} okText={`${snapshot?.exitNodeIds.length ?? 0} exit(s)`} nokText="No exits" color="amber" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel>Spawn radius</FieldLabel>
                    <span className="text-xs font-mono font-bold text-slate-200">{spawnRadius} m</span>
                  </div>
                  <Slider value={[spawnRadius]} onValueChange={([v]) => setSpawnRadiusUI(v)} min={50} max={600} step={25} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ModeBtn label="Set Entry" icon={Plus} k="add-entry" cur={mode} set={setMode} ac="emerald" />
                  <ModeBtn label="Add Exit" icon={ArrowRightFromLine} k="add-exit" cur={mode} set={setMode} ac="amber" />
                  <ModeBtn label="Block Road" icon={Ban} k="block-road" cur={mode} set={setMode} ac="red" />
                  <button onClick={() => setMode('view')} disabled={mode === 'view'}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <MapPin className="h-3 w-3" /> Pan / Zoom
                  </button>
                </div>

                <button
                  onClick={() => { if (graph) for (const e of graph.edges.values()) e.blocked = false; clearAll(); reset(); }}
                  disabled={!graph}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs font-medium text-slate-500 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Trash2 className="h-3 w-3" />Clear All Zones &amp; Blocks
                </button>
              </div>
            </Panel>

            {/* ── Crowd Metrics ── */}
            <Panel title="Crowd Metrics" sub="Live agent counts">
              {running || (m && m.totalAgents > 0) ? (
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Active" val={m?.activeAgents ?? 0} color="text-cyan-300" big />
                  <MiniStat label="Arrived" val={m?.arrivedAgents ?? 0} color="text-emerald-300" big />
                  <MiniStat label="Total" val={m?.totalAgents ?? 0} color="text-white" big />
                </div>
              ) : (
                <div className="flex h-[88px] items-center justify-center rounded-sm border border-dashed border-white/10 bg-white/[0.02]">
                  <p className="text-[11px] text-[#556275] font-medium italic">Waiting for simulation to start...</p>
                </div>
              )}
            </Panel>

            {/* ── Algorithm Analysis ── */}
            <Panel title="Routing Analysis" sub={meta?.label ?? '—'}>
              {!running && (!m || m.nodesExplored === 0) ? (
                <div className="flex h-32 items-center justify-center rounded-sm border border-dashed border-white/10 bg-white/[0.02]">
                  <p className="text-[11px] text-[#556275] font-medium italic">No routing telemetry available yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-sm border border-white/5 bg-[#0c0d14] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#556275] mb-1">Last path</p>
                    <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                      {m?.currentOperation ?? 'Idle — set entry & exit then Start'}
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      ['Algorithm', meta?.label ?? '—'],
                      ['Time complexity', meta?.complexity ?? '—'],
                      ['Space complexity', meta?.space ?? '—'],
                      ['Nodes explored', String(m?.nodesExplored ?? 0)],
                      ['Edges relaxed', String(m?.edgesRelaxed ?? 0)],
                      ['Path length', m?.totalPathMetres && m.totalPathMetres < 1e8
                        ? `${Math.round(m.totalPathMetres)} m` : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-widest text-[#556275] shrink-0">{label}</p>
                        <p className="text-[11px] font-mono font-semibold text-slate-300 text-right">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

          </aside>
        </div>
      </div>
    </main>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-[#667285]">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function Panel({
  title, sub, icon, children,
}: {
  title: string; sub?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-white/5 bg-[#090a0f] overflow-hidden shrink-0">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-[13px] font-bold text-slate-200">{title}</p>
        </div>
        {sub && <p className="text-[11px] text-[#556275] font-medium mt-0.5">{sub}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MiniStat({ label, val, color, big }: { label: string; val: number; color: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-sm border border-white/5 bg-transparent py-3">
      <span className={`font-semibold font-mono tabular-nums leading-none ${big ? 'text-2xl' : 'text-xl'} ${color}`}>{val}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-[#667285]">{label}</span>
    </div>
  );
}

function ZonePill({ ok, okText, nokText, color }: { ok: boolean; okText: string; nokText: string; color: 'emerald' | 'amber' }) {
  return (
    <div className={`flex items-center gap-2 rounded-sm border px-3 py-2 ${ok
      ? color === 'emerald' ? 'border-[#059669]/50 bg-[#064e3b]/40' : 'border-[#d97706]/50 bg-[#78350f]/40'
      : 'border-white/5 bg-transparent'
      }`}>
      <span className={`size-1.5 rounded-full shrink-0 ${ok ? (color === 'emerald' ? 'bg-[#34d399]' : 'bg-[#fbbf24]') : 'bg-slate-600'}`} />
      <span className={`text-[11px] font-medium truncate ${ok ? (color === 'emerald' ? 'text-[#34d399]' : 'text-[#fbbf24]') : 'text-slate-500'}`}>
        {ok ? okText : nokText}
      </span>
    </div>
  );
}

function ModeBtn({
  label, icon: Icon, k, cur, set, ac,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  k: InteractionMode;
  cur: InteractionMode;
  set: (m: InteractionMode) => void;
  ac: 'emerald' | 'amber' | 'red';
}) {
  const active = cur === k;
  const styles = {
    emerald: 'border-emerald-700/70 bg-emerald-950/60 text-emerald-300',
    amber: 'border-amber-700/70 bg-amber-950/60 text-amber-300',
    red: 'border-red-700/70 bg-red-950/60 text-red-300',
  };
  return (
    <button
      onClick={() => set(active ? 'view' : k)}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${active
        ? styles[ac]
        : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
        }`}>
      <Icon className="h-3 w-3" />{label}
    </button>
  );
}
