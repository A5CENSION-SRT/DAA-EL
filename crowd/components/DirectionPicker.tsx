'use client';

import { Navigation } from 'lucide-react';
import type { CardinalDirection } from '@/lib/zones';

interface DirectionPickerProps {
    selected: CardinalDirection[];
    onChange: (dirs: CardinalDirection[]) => void;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
}

const DIRECTION_LABELS: Record<CardinalDirection, { label: string; arrow: string }> = {
    N: { label: 'North', arrow: '↑' },
    NE: { label: 'NE', arrow: '↗' },
    E: { label: 'East', arrow: '→' },
    SE: { label: 'SE', arrow: '↘' },
    S: { label: 'South', arrow: '↓' },
    SW: { label: 'SW', arrow: '↙' },
    W: { label: 'West', arrow: '←' },
    NW: { label: 'NW', arrow: '↖' },
};

export function DirectionPicker({ selected, onChange, enabled, onEnabledChange }: DirectionPickerProps) {
    const toggleDirection = (dir: CardinalDirection) => {
        if (selected.includes(dir)) {
            onChange(selected.filter(d => d !== dir));
        } else {
            onChange([...selected, dir]);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-slate-300">Direction Routing</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => onEnabledChange(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {enabled && (
                <>
                    <p className="text-xs text-slate-500">
                        Select preferred evacuation directions
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                        // Row 1
                        <button
                            onClick={() => toggleDirection('NW')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('NW')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.NW.arrow}
                        </button>
                        <button
                            onClick={() => toggleDirection('N')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('N')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.N.arrow}
                        </button>
                        <button
                            onClick={() => toggleDirection('NE')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('NE')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.NE.arrow}
                        </button>

                        // Row 2
                        <button
                            onClick={() => toggleDirection('W')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('W')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.W.arrow}
                        </button>
                        <div className="flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40" />
                        </div>
                        <button
                            onClick={() => toggleDirection('E')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('E')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.E.arrow}
                        </button>

                        // Row 3
                        <button
                            onClick={() => toggleDirection('SW')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('SW')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.SW.arrow}
                        </button>
                        <button
                            onClick={() => toggleDirection('S')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('S')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.S.arrow}
                        </button>
                        <button
                            onClick={() => toggleDirection('SE')}
                            className={`h-10 rounded-lg border text-sm font-bold transition-all ${selected.includes('SE')
                                    ? 'bg-blue-500/30 border-blue-400 text-blue-300 shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            {DIRECTION_LABELS.SE.arrow}
                        </button>
                    </div>

                    {selected.length > 0 && (
                        <div className="rounded-lg border border-blue-700/40 bg-blue-950/30 p-2 text-xs text-blue-300">
                            ✓ Agents will prefer {selected.map(d => DIRECTION_LABELS[d].label).join(', ')}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
