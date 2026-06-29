'use client';

import { useState, useCallback, useMemo } from 'react';
import { Trash2, Plus, Copy } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import type { CrowdZone, DirectionPreference, CardinalDirection } from '@/lib/zones';
import { createAttractionZone, createRepulsionZone, createPolygonZone, generateZoneId } from '@/lib/zones';

interface ZoneControlsProps {
    zones: CrowdZone[];
    directionPreference: DirectionPreference;
    onAddZone: (zone: Omit<CrowdZone, 'id'>) => void;
    onUpdateZone: (id: string, updates: Partial<CrowdZone>) => void;
    onRemoveZone: (id: string) => void;
    onSetDirectionPreference: (pref: DirectionPreference) => void;
    venueCenter?: [number, number];
    venueBbox?: [number, number, number, number];
}

const CARDINAL_DIRECTIONS: CardinalDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function DirectionCompass({
    selected,
    onChange,
}: {
    selected: CardinalDirection[];
    onChange: (dirs: CardinalDirection[]) => void;
}) {
    const toggleDirection = (dir: CardinalDirection) => {
        if (selected.includes(dir)) {
            onChange(selected.filter(d => d !== dir));
        } else {
            onChange([...selected, dir]);
        }
    };

    return (
        <div className="grid grid-cols-3 gap-1">
            {/* N */}
            <div className="col-start-2">
                <button
                    onClick={() => toggleDirection('N')}
                    className={`w-full h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('N')
                            ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                            : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                        }`}
                >
                    ↑
                </button>
            </div>

            {/* NW NE */}
            <button
                onClick={() => toggleDirection('NW')}
                className={`h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('NW')
                        ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                        : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                    }`}
            >
                ↖
            </button>
            <div />
            <button
                onClick={() => toggleDirection('NE')}
                className={`h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('NE')
                        ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                        : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                    }`}
            >
                ↗
            </button>

            {/* W E */}
            <button
                onClick={() => toggleDirection('W')}
                className={`h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('W')
                        ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                        : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                    }`}
            >
                ←
            </button>
            <div />
            <button
                onClick={() => toggleDirection('E')}
                className={`h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('E')
                        ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                        : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                    }`}
            >
                →
            </button>

            {/* SW SE */}
            <button
                onClick={() => toggleDirection('SW')}
                className={`h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('SW')
                        ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                        : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                    }`}
            >
                ↙
            </button>
            <div />
            <button
                onClick={() => toggleDirection('SE')}
                className={`h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('SE')
                        ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                        : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                    }`}
            >
                ↘
            </button>

            {/* S */}
            <div className="col-start-2">
                <button
                    onClick={() => toggleDirection('S')}
                    className={`w-full h-8 rounded-sm border text-xs font-bold transition-colors ${selected.includes('S')
                            ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                            : 'bg-slate-700/20 border-slate-600 text-slate-500 hover:border-slate-500'
                        }`}
                >
                    ↓
                </button>
            </div>
        </div>
    );
}

function ZoneListItem({
    zone,
    onUpdate,
    onDelete,
}: {
    zone: CrowdZone;
    onUpdate: (updates: Partial<CrowdZone>) => void;
    onDelete: () => void;
}) {
    return (
        <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-500 truncate">{zone.id}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <div
                            className={`size-2.5 rounded-full ${zone.type === 'attract' ? 'bg-purple-500' : 'bg-red-500'
                                }`}
                        />
                        <span className="text-sm font-medium text-slate-300">
                            {zone.isPolygon ? 'Polygon' : 'Point'} · {zone.type === 'attract' ? 'Attract' : 'Repel'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onDelete}
                    className="shrink-0 p-1 rounded-sm hover:bg-red-950/50 text-red-400/60 hover:text-red-400 transition-colors"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                    <span className="text-slate-500">Radius</span>
                    <span className="font-mono text-slate-300">{zone.radius}m</span>
                </div>
                <input
                    type="range"
                    min={10}
                    max={500}
                    value={zone.radius}
                    onChange={e => onUpdate({ radius: parseInt(e.target.value) })}
                    className="w-full h-1"
                />

                <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Strength</span>
                    <span className="font-mono text-slate-300">{zone.strength}</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={zone.strength}
                    onChange={e => onUpdate({ strength: parseInt(e.target.value) })}
                    className="w-full h-1"
                />
            </div>
        </div>
    );
}

export function ZoneControls({
    zones,
    directionPreference,
    onAddZone,
    onUpdateZone,
    onRemoveZone,
    onSetDirectionPreference,
    venueCenter = [77.6, 12.9],
    venueBbox,
}: ZoneControlsProps) {
    const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
    const [zoneMode, setZoneMode] = useState<'point-attract' | 'point-repel' | 'view'>('view');
    const [newZoneRadius, setNewZoneRadius] = useState(150);
    const [newZoneStrength, setNewZoneStrength] = useState(60);

    const onAddPointZone = useCallback((type: 'attract' | 'repel') => {
        const zone = type === 'attract'
            ? createAttractionZone(venueCenter, newZoneRadius, newZoneStrength)
            : createRepulsionZone(venueCenter, newZoneRadius, newZoneStrength);

        onAddZone({
            ...zone,
            id: undefined,
        } as Omit<CrowdZone, 'id'>);
        setZoneMode('view');
    }, [venueCenter, newZoneRadius, newZoneStrength, onAddZone]);

    const onGenerateRandomZones = useCallback((count: number) => {
        if (!venueBbox) return;

        const [south, west, north, east] = venueBbox;
        for (let i = 0; i < count; i++) {
            const lng = west + Math.random() * (east - west);
            const lat = south + Math.random() * (north - south);
            const type = Math.random() > 0.7 ? 'repel' : 'attract';
            const radius = 80 + Math.random() * 200;
            const strength = 30 + Math.random() * 60;

            const zone = type === 'attract'
                ? createAttractionZone([lng, lat], radius, strength)
                : createRepulsionZone([lng, lat], radius, strength);

            onAddZone({
                ...zone,
                id: undefined,
            } as Omit<CrowdZone, 'id'>);
        }
    }, [venueBbox, onAddZone]);

    return (
        <div className="rounded-sm border border-white/5 bg-[#090a0f] overflow-hidden shrink-0">
            {/* Header */}
            <div className="border-b border-white/5 px-4 py-3">
                <p className="text-[13px] font-bold text-slate-200">Crowd Zones</p>
                <p className="text-[11px] text-[#556275] font-medium mt-0.5">
                    Create attraction & repulsion zones
                </p>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {/* Quick Add Buttons */}
                <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#667285]">Quick Add</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onAddPointZone('attract')}
                            className="flex items-center justify-center gap-1 rounded-lg border border-purple-700/50 bg-purple-950/30 px-3 py-2 text-xs font-medium text-purple-400 hover:bg-purple-950/50 transition-colors"
                        >
                            <Plus className="h-3 w-3" />
                            Attract
                        </button>
                        <button
                            onClick={() => onAddPointZone('repel')}
                            className="flex items-center justify-center gap-1 rounded-lg border border-red-700/50 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/50 transition-colors"
                        >
                            <Plus className="h-3 w-3" />
                            Repel
                        </button>
                    </div>
                </div>

                {/* Zone Settings */}
                <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#667285]">
                        New Zone Settings
                    </p>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Radius</span>
                            <span className="font-mono text-slate-300">{newZoneRadius}m</span>
                        </div>
                        <Slider
                            value={[newZoneRadius]}
                            onValueChange={([v]) => setNewZoneRadius(v)}
                            min={50}
                            max={500}
                            step={10}
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Strength</span>
                            <span className="font-mono text-slate-300">{newZoneStrength}</span>
                        </div>
                        <Slider
                            value={[newZoneStrength]}
                            onValueChange={([v]) => setNewZoneStrength(v)}
                            min={0}
                            max={100}
                            step={5}
                        />
                    </div>
                </div>

                {/* Random Zones */}
                <div className="space-y-2 rounded-lg border border-slate-700/40 bg-slate-800/20 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#667285]">
                        Random Zones
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 5].map(count => (
                            <button
                                key={count}
                                onClick={() => onGenerateRandomZones(count)}
                                disabled={!venueBbox}
                                className="rounded-sm border border-slate-700/50 bg-slate-700/20 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                +{count}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Direction Preference */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#667285]">
                            Direction Preference
                        </p>
                        <label className="flex items-center gap-1.5">
                            <input
                                type="checkbox"
                                checked={directionPreference.enabled}
                                onChange={e =>
                                    onSetDirectionPreference({
                                        ...directionPreference,
                                        enabled: e.target.checked,
                                    })
                                }
                                className="rounded-sm"
                            />
                            <span className="text-xs text-slate-400">Enable</span>
                        </label>
                    </div>

                    {directionPreference.enabled && (
                        <>
                            <DirectionCompass
                                selected={directionPreference.directions}
                                onChange={dirs =>
                                    onSetDirectionPreference({
                                        ...directionPreference,
                                        directions: dirs,
                                    })
                                }
                            />

                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Weight</span>
                                    <span className="font-mono text-slate-300">
                                        {(directionPreference.weight * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[directionPreference.weight]}
                                    onValueChange={([v]) =>
                                        onSetDirectionPreference({
                                            ...directionPreference,
                                            weight: v,
                                        })
                                    }
                                    min={0}
                                    max={1}
                                    step={0.05}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Zone List */}
                {zones.length > 0 && (
                    <div className="space-y-2 border-t border-white/5 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#667285]">
                            Active Zones ({zones.length})
                        </p>
                        <div className="space-y-2">
                            {zones.map(zone => (
                                <ZoneListItem
                                    key={zone.id}
                                    zone={zone}
                                    onUpdate={updates => onUpdateZone(zone.id, updates)}
                                    onDelete={() => onRemoveZone(zone.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
