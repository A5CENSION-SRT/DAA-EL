'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import {
    Loader2, Pause, Play, RotateCcw, Siren, Layers, Hexagon, Users, HexagonIcon,
    Activity, Zap, Network, AlertTriangle, Timer, UserPlus, MapPinned, Check, X,
    Square, StopCircle,
} from 'lucide-react';
import { type Graph } from '@/lib/graph';
import { type AlgorithmType } from '@/lib/simulation';
import { fetchOsmGraph } from '@/lib/osm';
import { VENUES } from '@/lib/venues';
import { useSimulation } from '@/hooks/useSimulation';
import { type InteractionMode } from '@/components/MapView';
import { ControlsPanel } from '@/components/ControlsPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

// Location picking state
type PickPhase = 'idle' | 'corner1' | 'corner2' | 'confirm';

export default function H3CrowdControlSystem() {
    const [venueKey, setVenueKey] = useState('mg_road_bangalore');
    const [algorithm, setAlgorithm] = useState<AlgorithmType>('dijkstra');
    const [speed, setSpeedUI] = useState(5);
    const [mode, setMode] = useState<InteractionMode>('view');
    const [is3D, setIs3D] = useState(false);
    const [showH3, setShowH3] = useState(true);
    const [showH3Counts, setShowH3Counts] = useState(false);
    const [spawnRadius, setSpawnRadiusUI] = useState(200);
    const [h3Res, setH3ResUI] = useState(10);

    // Location picking
    const [pickPhase, setPickPhase] = useState<PickPhase>('idle');
    const [corner1, setCorner1] = useState<[number, number] | null>(null);
    const [corner2, setCorner2] = useState<[number, number] | null>(null);
    const [liveCenter, setLiveCenter] = useState<[number, number]>([77.6076, 12.9752]);
    const [liveZoom, setLiveZoom] = useState(15);

    // Map graph state
    const [graph, setGraph] = useState<Graph | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentVenue, setCurrentVenue] = useState<any>(VENUES.mg_road_bangalore);

    const loadVenue = useCallback(async (key: string) => {
        setLoading(true); setError(null); setGraph(null);
        try {
            setCurrentVenue(VENUES[key]);
            setGraph(await fetchOsmGraph(VENUES[key]));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch map data');
        } finally { setLoading(false); }
    }, []);

    // Load OSM area
    const confirmBbox = useCallback(async () => {
        if (!corner1 || !corner2) return;
        const minLng = Math.min(corner1[0], corner2[0]);
        const maxLng = Math.max(corner1[0], corner2[0]);
        const minLat = Math.min(corner1[1], corner2[1]);
        const maxLat = Math.max(corner1[1], corner2[1]);
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        const customVenue = {
            id: 'custom',
            name: `Custom (${centerLat.toFixed(3)}, ${centerLng.toFixed(3)})`,
            description: `Custom bbox`,
            center: [centerLng, centerLat] as [number, number],
            zoom: liveZoom,
            bbox: [minLat, minLng, maxLat, maxLng] as [number, number, number, number],
        };
        setPickPhase('idle');
        setCorner1(null); setCorner2(null);
        setMode('view');
        setLoading(true); setError(null); setGraph(null);
        try {
            setCurrentVenue(customVenue);
            setGraph(await fetchOsmGraph(customVenue));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch — try a smaller area');
        } finally { setLoading(false); }
    }, [corner1, corner2, liveZoom]);

    const cancelPick = useCallback(() => {
        setPickPhase('idle'); setCorner1(null); setCorner2(null); setMode('view');
    }, []);

    useEffect(() => {
        if (venueKey !== 'custom') loadVenue(venueKey);
    }, [venueKey, loadVenue]);

    const {
        snapshot, running, spawning,
        start, stop, reset,
        setSpeed, setSpawnRadius, setH3Resolution,
        setEntryNode, addExitNode, blockEdge, clearAll,
        setDirectionPreference, spawnBatch, setSpawningEnabled,
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

    // Map click picking
    const handleLocationPick = useCallback((lng: number, lat: number) => {
        if (pickPhase === 'corner1') {
            setCorner1([lng, lat]);
            setPickPhase('corner2');
        } else if (pickPhase === 'corner2') {
            setCorner2([lng, lat]);
            setPickPhase('confirm');
        }
    }, [pickPhase]);

    const handleViewChange = useCallback((center: [number, number], zoom: number) => {
        setLiveCenter(center);
        setLiveZoom(zoom);
    }, []);

    const m = snapshot?.metrics;
    const hasEntry = (snapshot?.entryNodeIds.length ?? 0) > 0;
    const hasExit = (snapshot?.exitNodeIds.length ?? 0) > 0;
    const canRun = !!graph && !loading && hasEntry && hasExit;
    const hotspot = (m?.hotspotCount ?? 0) > 0;
    const isPicking = pickPhase !== 'idle';
    const effectiveMode: InteractionMode = isPicking ? 'pick-location' : mode;

    // Bbox preview corners
    const bboxPreview = corner1 && corner2 ? {
        minLng: Math.min(corner1[0], corner2[0]),
        maxLng: Math.max(corner1[0], corner2[0]),
        minLat: Math.min(corner1[1], corner2[1]),
        maxLat: Math.max(corner1[1], corner2[1]),
    } : null;

    return (
        <main className="h-screen overflow-hidden flex flex-col bg-[#050608] text-slate-300 font-sans">
            <div className="mx-auto flex w-full flex-1 min-h-0 flex-col gap-2 p-2 sm:p-3">

                {/* Header */}
                <header className="flex flex-wrap items-center gap-2 rounded-sm border border-white/5 bg-[#090a0f] px-4 py-2 shadow-sm">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-500/10 border border-blue-500/20">
                        <HexagonIcon className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="mr-auto min-w-0">
                        <p className="text-sm font-semibold text-slate-100 leading-none">H3 SPATIAL CROWD CONTROL</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Geospatial Operations Engine</p>
                    </div>

                    {/* Status */}
                    <div className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] uppercase tracking-wider font-semibold ${hotspot && running ? 'border-red-500/30 bg-red-950/40 text-red-400' : running ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-400'}`}>
                        <span className={`size-1.5 rounded-full ${hotspot && running ? 'bg-red-500 animate-pulse' : running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                        {hotspot && running ? 'HOTSPOT' : running ? 'LIVE' : 'STANDBY'}
                    </div>

                    <div className="h-5 w-px bg-white/10 hidden sm:block" />

                    {/* View toggles */}
                    <button onClick={() => setIs3D(v => !v)} className={`flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-medium transition-colors ${is3D ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'}`}>
                        <Layers className="h-3 w-3" />{is3D ? '3D' : '2D'}
                    </button>
                    <button onClick={() => setShowH3(v => !v)} className={`flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-medium transition-colors ${showH3 ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'}`}>
                        <Hexagon className="h-3 w-3" />H3
                    </button>
                    {showH3 && (
                        <button onClick={() => setShowH3Counts(v => !v)} className={`flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-medium transition-colors ${showH3Counts ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'}`}>
                            <Users className="h-3 w-3" />Counts
                        </button>
                    )}

                    <div className="h-5 w-px bg-white/10 hidden sm:block" />

                    {/* Spawn control */}
                    <button
                        onClick={() => spawnBatch(50)}
                        disabled={!canRun}
                        title="Place 50 agents on the map (doesn't start routing)"
                        className={`flex h-7 items-center gap-1.5 rounded-sm border px-3 text-[11px] font-medium transition-colors ${canRun ? 'border-violet-600/40 bg-violet-600/15 text-violet-300 hover:bg-violet-600/25' : 'border-white/10 text-slate-600 cursor-not-allowed'}`}
                    >
                        <UserPlus className="h-3 w-3" />Spawn
                    </button>

                    {/* Auto spawn toggle */}
                    {running && (
                        <button
                            onClick={() => setSpawningEnabled(!spawning)}
                            title={spawning ? 'Stop spawning new agents' : 'Resume spawning new agents'}
                            className={`flex h-7 items-center gap-1.5 rounded-sm border px-3 text-[11px] font-medium transition-colors ${spawning ? 'border-amber-600/40 bg-amber-600/15 text-amber-300 hover:bg-amber-600/25' : 'border-slate-600 text-slate-400 hover:text-slate-200'}`}
                        >
                            {spawning ? <><StopCircle className="h-3 w-3" />No Spawn</> : <><UserPlus className="h-3 w-3" />Auto Spawn</>}
                        </button>
                    )}

                    {/* Run control */}
                    {running
                        ? <button onClick={stop} className="flex h-7 items-center gap-1.5 rounded-sm border border-white/10 px-3 text-[11px] font-medium text-slate-300 hover:border-white/20 hover:text-white transition-colors">
                            <Pause className="h-3 w-3" />Pause
                        </button>
                        : <button onClick={start} disabled={!canRun} className={`flex h-7 items-center gap-1.5 rounded-sm px-4 text-[11px] uppercase font-semibold transition-all ${canRun ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50' : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'}`}>
                            <Play className="h-3 w-3" />
                            {!graph || loading ? 'Wait' : !hasEntry ? 'Set Entry' : !hasExit ? 'Set Exit' : 'Engage'}
                        </button>
                    }
                    <button onClick={reset} className="flex h-7 items-center gap-1.5 rounded-sm border border-white/10 px-3 text-[11px] font-medium text-slate-400 hover:text-white hover:border-white/20 transition-colors">
                        <RotateCcw className="h-3 w-3" />Reset
                    </button>
                    <button onClick={() => { if (graph) for (const e of graph.edges.values()) e.flow = e.capacity * 0.95; reset(); }} className="flex h-7 items-center gap-1.5 rounded-sm border border-red-900/50 bg-red-950/30 px-3 text-[11px] uppercase font-semibold text-red-500 hover:bg-red-950/60 hover:text-red-400 transition-colors">
                        <Siren className="h-3 w-3" />Panic
                    </button>
                </header>

                {/* Metrics strip */}
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {([
                        { label: 'Nodes', val: graph ? graph.nodes.size : 0, Icon: Network, color: 'text-blue-300' },
                        { label: 'Edges', val: graph ? graph.edges.size : 0, Icon: Activity, color: 'text-indigo-300' },
                        { label: 'Runtime', val: m ? parseFloat(m.runtimeMs.toFixed(1)) : 0, sfx: 'ms', Icon: Timer, color: 'text-yellow-300' },
                        { label: 'H3 Cells', val: m ? m.h3CoveredCells : 0, Icon: Hexagon, color: 'text-violet-300' },
                        { label: 'Hotspots', val: m ? m.hotspotCount : 0, Icon: AlertTriangle, color: m && m.hotspotCount > 0 ? 'text-red-300' : 'text-slate-600', alert: true },
                        { label: 'Active', val: m ? m.activeAgents : 0, Icon: Users, color: 'text-cyan-300' },
                        { label: 'Arrived', val: m ? m.arrivedAgents : 0, Icon: Zap, color: 'text-emerald-300' },
                    ] as const).map(({ label, val, Icon, color, sfx, alert }: any) => (
                        <div key={label} className={`rounded-xl border-l-2 border border-slate-700/60 bg-[#0c0f1a] px-3 py-2.5 ${alert && val > 0 ? 'bg-red-950/30' : ''}`}>
                            <div className="flex items-start justify-between gap-1">
                                <div>
                                    <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                                    <p className={`mt-1 text-xl font-bold font-mono tabular-nums leading-none ${alert && val > 0 ? 'text-red-400' : color}`}>
                                        {label !== 'Runtime' ? new Intl.NumberFormat('en-US').format(val) : val}
                                        {sfx && <span className="text-[11px] font-normal text-slate-500 ml-0.5">{sfx}</span>}
                                    </p>
                                </div>
                                <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${alert && val > 0 ? 'text-red-500/60' : 'text-slate-700'}`} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main grid */}
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px] flex-1 min-h-0">

                    {/* Left: Map */}
                    <section className="flex min-w-0 flex-col gap-2 h-full min-h-0">
                        <div className="rounded-2xl border border-slate-700/60 bg-[#0c0f1a] overflow-hidden relative flex-1 min-h-0 flex flex-col">

                            {/* Mode hint */}
                            {(effectiveMode !== 'view') && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                                    <span className="shadow-lg rounded-full border border-white/15 bg-slate-900/90 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-slate-200">
                                        {effectiveMode === 'add-entry' ? '🟢 Click a node → Set Entry'
                                            : effectiveMode === 'add-exit' ? '🟡 Click a node → Set Exit'
                                                : effectiveMode === 'block-road' ? '🔴 Click a road → Block'
                                                    : pickPhase === 'corner1' ? '📍 Click to set first corner of your zone'
                                                        : pickPhase === 'corner2' ? '📍 Click to set second corner'
                                                            : '✅ Confirm your selection below'}
                                    </span>
                                </div>
                            )}

                            {/* Bbox picker overlay */}
                            {isPicking && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-stretch gap-2 max-w-md w-full px-4">
                                    <div className="flex-1 rounded-xl border border-white/10 bg-black/85 backdrop-blur-md px-4 py-3 text-xs space-y-2">
                                        {/* Step indicators */}
                                        <div className="flex items-center gap-3">
                                            <div className={`flex items-center gap-1.5 ${corner1 ? 'text-emerald-400' : pickPhase === 'corner1' ? 'text-blue-300 animate-pulse' : 'text-slate-600'}`}>
                                                <span className={`size-2 rounded-full ${corner1 ? 'bg-emerald-400' : pickPhase === 'corner1' ? 'bg-blue-400' : 'bg-slate-700'}`} />
                                                <span>Corner 1 {corner1 ? `(${corner1[1].toFixed(4)}, ${corner1[0].toFixed(4)})` : '— click map'}</span>
                                            </div>
                                            <span className="text-slate-700">→</span>
                                            <div className={`flex items-center gap-1.5 ${corner2 ? 'text-emerald-400' : pickPhase === 'corner2' ? 'text-blue-300 animate-pulse' : 'text-slate-600'}`}>
                                                <span className={`size-2 rounded-full ${corner2 ? 'bg-emerald-400' : pickPhase === 'corner2' ? 'bg-blue-400' : 'bg-slate-700'}`} />
                                                <span>Corner 2 {corner2 ? `(${corner2[1].toFixed(4)}, ${corner2[0].toFixed(4)})` : '— click map'}</span>
                                            </div>
                                        </div>
                                        {bboxPreview && (
                                            <p className="text-slate-500 font-mono text-[10px]">
                                                Bbox: {bboxPreview.minLat.toFixed(4)}°–{bboxPreview.maxLat.toFixed(4)}°N · {bboxPreview.minLng.toFixed(4)}°–{bboxPreview.maxLng.toFixed(4)}°E
                                            </p>
                                        )}
                                    </div>
                                    {pickPhase === 'confirm' && (
                                        <button onClick={confirmBbox} className="flex items-center gap-1.5 rounded-xl border border-emerald-600/50 bg-emerald-600/20 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-colors whitespace-nowrap">
                                            <Check className="h-3.5 w-3.5" />Load Zone
                                        </button>
                                    )}
                                    <button onClick={cancelPick} className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/60 px-3 text-xs font-medium text-slate-400 hover:text-white transition-colors">
                                        <X className="h-3.5 w-3.5" />Cancel
                                    </button>
                                </div>
                            )}

                            <div className="relative bg-[#07090f] flex-1 min-h-0">
                                {error ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                        <p className="text-sm text-red-400">{error}</p>
                                        <button onClick={() => loadVenue(venueKey)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white">Retry</button>
                                    </div>
                                ) : loading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                                        <p className="text-sm text-slate-400">Fetching {currentVenue?.name}…</p>
                                        <p className="text-xs text-slate-600">OpenStreetMap → road network</p>
                                    </div>
                                ) : (
                                    <>
                                        <MapView
                                            snapshot={snapshot}
                                            center={currentVenue?.center ?? [77.6076, 12.9752]}
                                            zoom={currentVenue?.zoom ?? 15}
                                            venueKey={venueKey}
                                            bbox={currentVenue?.bbox}
                                            mode={effectiveMode}
                                            is3D={is3D}
                                            showH3Layer={showH3}
                                            showH3Counts={showH3Counts}
                                            onNodeClick={handleNodeClick}
                                            onEdgeClick={handleEdgeClick}
                                            onLocationPick={handleLocationPick}
                                            onViewChange={handleViewChange}
                                        />
                                        {/* Legend */}
                                        <div className="absolute top-4 right-4 z-10 rounded-xl border border-white/10 bg-black/70 backdrop-blur-md p-3">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Legend</p>
                                            <div className="space-y-1.5">
                                                {[
                                                    { dot: 'bg-blue-500', label: 'Clear road' },
                                                    { dot: 'bg-yellow-400', label: 'Moderate' },
                                                    { dot: 'bg-red-500', label: 'Jammed' },
                                                    { dot: 'bg-emerald-400', label: 'Entry' },
                                                    { dot: 'bg-yellow-300', label: 'Exit' },
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
                        <div className="rounded-2xl border border-slate-700/60 bg-[#0c0f1a] px-4 py-3 shrink-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Event Log</p>
                            <div className="h-20 overflow-y-auto space-y-1.5 pr-1">
                                {snapshot?.timeline.length
                                    ? snapshot.timeline.map((ev, i) => (
                                        <div key={i} className="grid grid-cols-[44px_1fr] gap-2 text-xs">
                                            <span className="font-mono text-slate-700">{ev.time}</span>
                                            <p className={`border-l pl-2.5 leading-5 ${ev.event.startsWith('⚠') ? 'text-red-400 border-red-700' : ev.event.startsWith('🚧') ? 'text-amber-400 border-amber-700' : 'text-slate-400 border-slate-700'}`}>{ev.event}</p>
                                        </div>
                                    ))
                                    : <p className="text-xs text-slate-600 italic">Set entry/exit then press Engage or Spawn.</p>
                                }
                            </div>
                        </div>
                    </section>

                    {/* Right: Sidebar */}
                    <aside className="flex flex-col gap-2 h-full min-h-0 overflow-y-auto">

                        {/* Location */}
                        <div className="rounded-sm border border-white/5 bg-[#090a0f] p-3 space-y-2 shrink-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Location</p>
                            <Select value={venueKey} onValueChange={k => { reset(); setVenueKey(k); cancelPick(); }}>
                                <SelectTrigger className="h-8 text-xs rounded-lg border-slate-700 bg-slate-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border-slate-700 bg-slate-900">
                                    {Object.values(VENUES).map(v => (
                                        <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Selection actions */}
                            {pickPhase === 'idle' ? (
                                <button
                                    onClick={() => { setPickPhase('corner1'); }}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-blue-600/40 bg-blue-600/10 px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/20 transition-colors"
                                >
                                    <MapPinned className="h-3.5 w-3.5" />Define Custom Zone on Map
                                </button>
                            ) : (
                                <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-3 py-2 space-y-1">
                                    <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">Defining zone…</p>
                                    <p className="text-[11px] text-slate-400">
                                        {pickPhase === 'corner1' ? 'Pan/zoom, then click first corner on the map'
                                            : pickPhase === 'corner2' ? 'Now click the opposite corner'
                                                : 'Click "Load Zone" to fetch the road network'}
                                    </p>
                                    <button onClick={cancelPick} className="text-[10px] text-slate-500 hover:text-red-400 underline mt-1">Cancel</button>
                                </div>
                            )}

                            {/* Current area info */}
                            <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2 text-[11px] text-slate-500">
                                <span className="text-slate-400 font-medium">{currentVenue?.name}</span>
                                {currentVenue?.description && <p className="text-[10px] mt-0.5">{currentVenue.description}</p>}
                            </div>
                        </div>

                        {/* Controls */}
                        <ControlsPanel
                            snapshot={snapshot}
                            mode={mode}
                            setMode={setMode}
                            speed={speed}
                            setSpeedUI={setSpeedUI}
                            h3Res={h3Res}
                            setH3ResUI={setH3ResUI}
                            spawnRadius={spawnRadius}
                            setSpawnRadiusUI={setSpawnRadiusUI}
                            algorithm={algorithm}
                            setAlgorithm={setAlgorithm}
                            onClearAll={() => { if (graph) for (const e of graph.edges.values()) e.blocked = false; clearAll(); reset(); }}
                            setDirectionPreference={setDirectionPreference}
                            graph={graph}
                        />
                    </aside>
                </div>
            </div>
        </main>
    );
}
