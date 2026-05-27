'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationEngine, type AlgorithmType, type SimulationSnapshot } from '@/lib/simulation';
import { type Graph } from '@/lib/graph';

export function useSimulation(graph: Graph | null, algorithm: AlgorithmType) {
  const engineRef = useRef<SimulationEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [running,  setRunning]  = useState(false);

  // Rebuild engine when graph changes (new venue loaded)
  useEffect(() => {
    if (!graph) return;
    engineRef.current?.stop();
    const engine = new SimulationEngine(graph, algorithm);

    const entries = [...graph.nodes.values()].filter(n => n.type === 'entry').map(n => n.id);
    const exits   = [...graph.nodes.values()].filter(n => n.type === 'exit' ).map(n => n.id);
    engine.setEntryNodes(entries);
    engine.setExitNodes(exits);

    engine.setOnUpdate(s => setSnapshot({ ...s }));
    engineRef.current = engine;
    setSnapshot(engine.getSnapshot());
    setRunning(false);
  }, [graph]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { engineRef.current?.setAlgorithm(algorithm); }, [algorithm]);

  const start = useCallback(() => { engineRef.current?.start(); setRunning(true);  }, []);
  const stop  = useCallback(() => { engineRef.current?.stop();  setRunning(false); }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
    setRunning(false);
  }, []);

  /**
   * Map the UI speed slider (1–10) to engine parameters.
   *
   * Wider range than before for a more noticeable effect:
   *   Speed 1  → 0.5 agents/s,  0.5× realtime  (slow-motion, watch individual paths)
   *   Speed 5  → 8   agents/s,  2×  realtime  (normal viewing)
   *   Speed 10 → 20  agents/s,  5×  realtime  (crowd flood)
   */
  const setSpeed = useCallback((s: number) => {
    const t = (s - 1) / 9;                       // 0 → 1
    const spawnRate = 0.5 + t * 19.5;             // 0.5 → 20 agents/s
    const timeScale = 0.5 + t * 4.5;             // 0.5× → 5× realtime
    engineRef.current?.setSpawnRate(spawnRate);
    engineRef.current?.setTimeScale(timeScale);
  }, []);

  const setSpawnRadius = useCallback((r: number) => {
    engineRef.current?.setSpawnRadius(r);
    setSnapshot(s => s ? { ...s, spawnRadius: r } : s);
  }, []);

  const setH3Resolution = useCallback((res: number) => {
    engineRef.current?.setH3Resolution(res);
    setSnapshot(s => s ? { ...s, h3Resolution: res } : s);
  }, []);

  /** Replace entry — one zone centre at a time */
  const setEntryNode = useCallback((nodeId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const snap = engine.getSnapshot();
    for (const id of snap.entryNodeIds) {
      const n = snap.graph.nodes.get(id);
      if (n) n.type = 'intersection';
    }
    engine.setEntryNodes([nodeId]);
    setSnapshot({ ...engine.getSnapshot() });
  }, []);

  /** Accumulate exit nodes */
  const addExitNode = useCallback((nodeId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const snap = engine.getSnapshot();
    if (!snap.exitNodeIds.includes(nodeId)) {
      engine.setExitNodes([...snap.exitNodeIds, nodeId]);
    }
    setSnapshot({ ...engine.getSnapshot() });
  }, []);

  const blockEdge = useCallback((edgeId: string) => {
    engineRef.current?.blockEdge(edgeId);
  }, []);

  const clearAll = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const snap = engine.getSnapshot();
    for (const n of snap.graph.nodes.values()) {
      if (n.type === 'entry' || n.type === 'exit') n.type = 'intersection';
    }
    engine.setEntryNodes([]);
    engine.setExitNodes([]);
    setSnapshot({ ...engine.getSnapshot() });
  }, []);

  return {
    snapshot, running,
    start, stop, reset,
    setSpeed, setSpawnRadius, setH3Resolution,
    setEntryNode, addExitNode,
    blockEdge, clearAll,
  };
}
