'use client';

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Hexagon, Plus, ArrowRightFromLine, Ban, MapPin, Trash2, Settings,
} from 'lucide-react';
import { type SimulationSnapshot, type AlgorithmType } from '@/lib/simulation';
import { type InteractionMode } from '@/components/MapView';
import { DirectionPicker } from '@/components/DirectionPicker';

interface ControlsPanelProps {
    snapshot: SimulationSnapshot | null;
    mode: InteractionMode;
    setMode: (m: InteractionMode) => void;
    speed: number;
    setSpeedUI: (s: number) => void;
    h3Res: number;
    setH3ResUI: (r: number) => void;
    spawnRadius: number;
    setSpawnRadiusUI: (r: number) => void;
    algorithm: AlgorithmType;
    setAlgorithm: (a: AlgorithmType) => void;
    onClearAll: () => void;
    setDirectionPreference: any;
    graph: any;
}

function speedLabel(s: number) {
    if (s <= 1) return 'Crawl';
    if (s <= 5) return 'Walk';
    if (s <= 10) return 'Jog';
    if (s <= 15) return 'Run';
    return 'Flood';
}

function speedColor(s: number) {
    if (s <= 3) return { badge: 'bg-blue-500/20 text-blue-300' };
    if (s <= 8) return { badge: 'bg-emerald-500/20 text-emerald-300' };
    if (s <= 15) return { badge: 'bg-amber-500/20 text-amber-300' };
    return { badge: 'bg-red-500/20 text-red-300' };
}

function MiniStat({ label, val, color }: { label: string; val: number; color: string }) {
    return (
        <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{label}</p>
            <p className={`text-lg font-bold font-mono leading-none mt-0.5 ${color}`}>
                {new Intl.NumberFormat('en-US').format(val)}
            </p>
        </div>
    );
}

function ModeBtn({
    label, icon: Icon, k, cur, set, ac,
}: {
    label: string; icon: any; k: InteractionMode; cur: InteractionMode; set: (m: InteractionMode) => void; ac: string;
}) {
    const colors: Record<string, string> = {
        emerald: 'border-emerald-700/40 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50',
        amber: 'border-amber-700/40 bg-amber-950/30 text-amber-400 hover:bg-amber-950/50',
        red: 'border-red-700/40 bg-red-950/30 text-red-400 hover:bg-red-950/50',
    };
    return (
        <button
            onClick={() => set(k)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${cur === k ? colors[ac] : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'}`}
        >
            <Icon className="h-3 w-3" />{label}
        </button>
    );
}

export function ControlsPanel(props: ControlsPanelProps) {
    const m = props.snapshot?.metrics;
    const hasEntry = (props.snapshot?.entryNodeIds.length ?? 0) > 0;
    const hasExit = (props.snapshot?.exitNodeIds.length ?? 0) > 0;
    const sc = speedColor(props.speed);

    return (
        <div className="overflow-y-auto pr-1 space-y-2">
            <Accordion type="multiple" defaultValue={["sim", "zone"]}>
                {/* ─── Simulation Settings ─── */}
                <AccordionItem value="sim">
                    <AccordionTrigger className="px-2">
                        <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-blue-400" />
                            <span className="text-xs font-semibold">Simulation</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 space-y-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Algorithm</label>
                            <Select value={props.algorithm} onValueChange={props.setAlgorithm}>
                                <SelectTrigger className="h-8 text-xs rounded-lg border-slate-700 bg-slate-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border-slate-700 bg-slate-900">
                                    <SelectItem value="dijkstra" className="text-xs">Dijkstra — shortest</SelectItem>
                                    <SelectItem value="astar" className="text-xs">A* — heuristic</SelectItem>
                                    <SelectItem value="bfs" className="text-xs">BFS — fewest hops</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Speed</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white">{props.speed}×</span>
                                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${sc.badge}`}>
                                        {speedLabel(props.speed)}
                                    </span>
                                </div>
                            </div>
                            <Slider value={[props.speed]} onValueChange={([v]) => props.setSpeedUI(v)} min={1} max={20} step={1} />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* ─── H3 Spatial ─── */}
                <AccordionItem value="h3">
                    <AccordionTrigger className="px-2">
                        <div className="flex items-center gap-2">
                            <Hexagon className="h-4 w-4 text-violet-400" />
                            <span className="text-xs font-semibold">H3 Spatial</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 space-y-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Resolution</label>
                            <Select value={String(props.h3Res)} onValueChange={v => props.setH3ResUI(Number(v))}>
                                <SelectTrigger className="h-8 text-xs rounded-lg border-slate-700 bg-slate-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border-slate-700 bg-slate-900">
                                    <SelectItem value="8" className="text-xs">Res 8 — ~461 m</SelectItem>
                                    <SelectItem value="9" className="text-xs">Res 9 — ~174 m</SelectItem>
                                    <SelectItem value="10" className="text-xs">Res 10 — ~66 m</SelectItem>
                                    <SelectItem value="11" className="text-xs">Res 11 — ~25 m</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <MiniStat label="Cells" val={m?.h3CoveredCells ?? 0} color="text-violet-300" />
                            <MiniStat label="Peak" val={m?.maxH3Density ?? 0} color="text-amber-300" />
                            <MiniStat label="Hotspots" val={m?.hotspotCount ?? 0} color={(m?.hotspotCount ?? 0) > 0 ? 'text-red-300' : 'text-slate-600'} />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* ─── Crowd Zone ─── */}
                <AccordionItem value="zone">
                    <AccordionTrigger className="px-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-semibold">Crowd Zone</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className={`rounded-lg border px-2 py-1.5 text-center ${hasEntry ? 'border-emerald-700/40 bg-emerald-950/30' : 'border-slate-700 bg-slate-800/40'}`}>
                                <p className="text-[9px] text-slate-500 uppercase font-semibold">Entry</p>
                                <p className={`text-xs font-bold mt-0.5 ${hasEntry ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {hasEntry ? '✓ Set' : '—'}
                                </p>
                            </div>
                            <div className={`rounded-lg border px-2 py-1.5 text-center ${hasExit ? 'border-amber-700/40 bg-amber-950/30' : 'border-slate-700 bg-slate-800/40'}`}>
                                <p className="text-[9px] text-slate-500 uppercase font-semibold">Exits</p>
                                <p className={`text-xs font-bold mt-0.5 ${hasExit ? 'text-amber-400' : 'text-slate-500'}`}>
                                    {hasExit ? props.snapshot?.exitNodeIds.length ?? 0 : '—'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Spawn Radius</label>
                                <span className="text-xs font-mono text-slate-300">{props.spawnRadius} m</span>
                            </div>
                            <Slider value={[props.spawnRadius]} onValueChange={([v]) => props.setSpawnRadiusUI(v)} min={50} max={600} step={25} />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <ModeBtn label="Entry" icon={Plus} k="add-entry" cur={props.mode} set={props.setMode} ac="emerald" />
                            <ModeBtn label="Exit" icon={ArrowRightFromLine} k="add-exit" cur={props.mode} set={props.setMode} ac="amber" />
                            <ModeBtn label="Block" icon={Ban} k="block-road" cur={props.mode} set={props.setMode} ac="red" />
                            <button
                                onClick={() => props.setMode('view')}
                                disabled={props.mode === 'view'}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-40"
                            >
                                <MapPin className="h-3 w-3" />Pan
                            </button>
                        </div>

                        <DirectionPicker
                            selected={props.snapshot?.directionPreference?.directions ?? []}
                            onChange={(dirs) => props.setDirectionPreference({
                                ...(props.snapshot?.directionPreference ?? { enabled: false, weight: 0.5 }),
                                directions: dirs,
                            })}
                            enabled={props.snapshot?.directionPreference?.enabled ?? false}
                            onEnabledChange={(enabled) => props.setDirectionPreference({
                                ...(props.snapshot?.directionPreference ?? { directions: [], weight: 0.5 }),
                                enabled,
                            })}
                        />

                        <button
                            onClick={props.onClearAll}
                            disabled={!props.graph}
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs font-medium text-slate-500 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-400 disabled:opacity-40"
                        >
                            <Trash2 className="h-3 w-3" />Clear All
                        </button>
                    </AccordionContent>
                </AccordionItem>

                {/* ─── Metrics ─── */}
                <AccordionItem value="metrics">
                    <AccordionTrigger className="px-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">Crowd Metrics</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 space-y-2">
                        {m && m.totalAgents > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                <MiniStat label="Active" val={m.activeAgents} color="text-cyan-300" />
                                <MiniStat label="Arrived" val={m.arrivedAgents} color="text-emerald-300" />
                                <MiniStat label="Total" val={m.totalAgents} color="text-white" />
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600 italic">Start simulation to see metrics</p>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
