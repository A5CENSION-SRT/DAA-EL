'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Plus, Minus, Check } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapViewComponent = dynamic(
    () => import('@/components/MapView').then(m => ({ default: m.MapView })),
    { ssr: false, loading: () => <div className="w-full h-full bg-[#07090f] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div> }
);

interface LocationPickerProps {
    onLocationDefined: (center: [number, number], zoom: number) => void;
    initialCenter?: [number, number];
    initialZoom?: number;
}

export function LocationPicker({ onLocationDefined, initialCenter = [77.6076, 12.9752], initialZoom = 15 }: LocationPickerProps) {
    const [center, setCenter] = useState<[number, number]>(initialCenter);
    const [zoom, setZoom] = useState(initialZoom);
    const [isDragging, setIsDragging] = useState(false);

    const handleMapDrag = useCallback((newCenter: [number, number]) => {
        setCenter(newCenter);
    }, []);

    const handleZoomChange = (delta: number) => {
        setZoom(z => Math.max(10, Math.min(20, z + delta)));
    };

    return (
        <div className="space-y-3 rounded-lg border border-slate-700/60 bg-slate-800/40 p-4">
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Pick Location</p>
                <p className="text-[11px] text-slate-500">Zoom & pan the map, then click "Define"</p>
            </div>

            {/* Map preview - simplified version */}
            <div className="relative h-48 rounded-lg border border-slate-700/60 bg-[#07090f] overflow-hidden">
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 rounded-lg blur-md" />
                        <MapPin className="h-6 w-6 text-blue-400 relative" />
                    </div>
                </div>

                {/* Zoom controls */}
                <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-1">
                    <button
                        onClick={() => handleZoomChange(1)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-slate-300 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => handleZoomChange(-1)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-slate-300 transition-colors"
                    >
                        <Minus className="h-4 w-4" />
                    </button>
                </div>

                {/* Zoom level display */}
                <div className="absolute top-3 left-3 z-30 rounded-md border border-slate-600 bg-slate-900/60 px-2 py-1">
                    <p className="text-xs font-mono text-slate-300">Zoom: {zoom.toFixed(1)}</p>
                </div>
            </div>

            {/* Coordinates display */}
            <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-700/60 bg-slate-900/40 p-2.5">
                <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Latitude</p>
                    <p className="text-xs font-mono text-blue-300">{center[1].toFixed(5)}</p>
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Longitude</p>
                    <p className="text-xs font-mono text-blue-300">{center[0].toFixed(5)}</p>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => onLocationDefined(center, zoom)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-blue-600/40 bg-blue-600/20 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-600/30 transition-colors"
                >
                    <Check className="h-3 w-3" />
                    Define Location
                </button>
            </div>
        </div>
    );
}
