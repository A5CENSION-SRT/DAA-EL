'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationEngine, type AlgorithmType, type SimulationSnapshot } from '@/lib/simulation';
import { type Graph } from '@/lib/graph';

export function useSimulation(graph: Graph | null, algorithm: AlgorithmType) {
  const engineRef = useRef<SimulationEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [running, setRunning] = useState(false);

  // Rebuild engine when the graph changes
  useEffect(() => {
    if (!graph) return;
    engineRef.current?.stop();
    const engine = new SimulationEngine(graph, algorithm);

    const entries = [...graph.nodes.values()].filter(n => n.type === 'entry').map(n => n.id);
    const exits   = [...graph.nodes.values()].filter(n => n.type === 'exit').map(n => n.id);
    engine.setEntryNodes(entries);
    engine.setExitNodes(exits);

    engine.setOnUpdate(s => setSnapshot({ ...s }));
    engineRef.current = engine;
    setSnapshot(engine.getSnapshot());
    setRunning(false);
  }, [graph]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { engineRef.current?.setAlgorithm(algorithm); }, [algorithm]);

  const start = useCallback(() => {
    engineRef.current?.start();
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
    setRunning(false);
  }, []);

  const setSpeed = useCallback((speedSlider: number) => {
    const spawnRate = 1 + (speedSlider - 1) * (7 / 9);
    const timeScale = 0.5 + (speedSlider - 1) * (2 / 9);
    engineRef.current?.setSpawnRate(spawnRate);
    engineRef.current?.setTimeScale(timeScale);
  }, []);

  const setSpawnRadius = useCallback((r: number) => {
    engineRef.current?.setSpawnRadius(r);
    setSnapshot(s => s ? { ...s, spawnRadius: r } : s);
  }, []);

  const addEntryNode = useCallback((nodeId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const snap = engine.getSnapshot();
    // Mark previous entries back to intersection (keep only the new one as single zone)
    for (const id of snap.entryNodeIds) {
      const n = snap.graph.nodes.get(id);
      if (n) n.type = 'intersection';
    }
    engine.setEntryNodes([nodeId]);
    setSnapshot({ ...engine.getSnapshot() });
  }, []);

  const addExitNode = useCallback((nodeId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const snap = engine.getSnapshot();
    // Allow multiple exit points
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
    snapshot,
    running,
    start,
    stop,
    reset,
    setSpeed,
    setSpawnRadius,
    addEntryNode,
    addExitNode,
    blockEdge,
    clearAll,
  };
}
