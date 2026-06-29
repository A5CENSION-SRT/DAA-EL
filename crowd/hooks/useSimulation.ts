'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationEngine, type AlgorithmType, type SimulationSnapshot } from '@/lib/simulation';
import { type Graph } from '@/lib/graph';
import { type CrowdZone, type DirectionPreference } from '@/lib/zones';

export function useSimulation(graph: Graph | null, algorithm: AlgorithmType) {
  const engineRef = useRef<SimulationEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [spawning, setSpawning] = useState(true); // whether auto-spawn is on

  // Rebuild engine when graph changes
  useEffect(() => {
    if (!graph) return;
    engineRef.current?.stop();
    const engine = new SimulationEngine(graph, algorithm);

    const entries = [...graph.nodes.values()].filter(n => n.type === 'entry').map(n => n.id);
    const exits = [...graph.nodes.values()].filter(n => n.type === 'exit').map(n => n.id);
    engine.setEntryNodes(entries);
    engine.setExitNodes(exits);

    engine.setOnUpdate(s => setSnapshot({ ...s }));
    engineRef.current = engine;
    setSnapshot(engine.getSnapshot());
    setRunning(false);
    setSpawning(true);
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
    setSpawning(true);
  }, []);

  /** Toggle whether new agents are auto-spawned during the simulation loop */
  const setSpawningEnabled = useCallback((enabled: boolean) => {
    engineRef.current?.setSpawningEnabled(enabled);
    setSpawning(enabled);
  }, []);

  /**
   * Speed slider maps 1–20:
   *   1  → 0.5 agents/s, 0.5× time
   *   10 → 20  agents/s, 5×  time
   *   20 → 60  agents/s, 15× time
   */
  const setSpeed = useCallback((s: number) => {
    const t = (s - 1) / 19;
    engineRef.current?.setSpawnRate(0.5 + t * 59.5);
    engineRef.current?.setTimeScale(0.5 + t * 14.5);
  }, []);

  const setSpawnRadius = useCallback((r: number) => {
    engineRef.current?.setSpawnRadius(r);
    setSnapshot(s => s ? { ...s, spawnRadius: r } : s);
  }, []);

  const setH3Resolution = useCallback((res: number) => {
    engineRef.current?.setH3Resolution(res);
    setSnapshot(s => s ? { ...s, h3Resolution: res } : s);
  }, []);

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

  const addZone = useCallback((zone: Omit<CrowdZone, 'id'>) => {
    engineRef.current?.addZone(zone);
    setSnapshot(s => s ? { ...s } : s);
  }, []);

  const updateZone = useCallback((id: string, updates: Partial<CrowdZone>) => {
    engineRef.current?.updateZone(id, updates);
    setSnapshot(s => s ? { ...s } : s);
  }, []);

  const removeZone = useCallback((id: string) => {
    engineRef.current?.removeZone(id);
    setSnapshot(s => s ? { ...s } : s);
  }, []);

  const setDirectionPreference = useCallback((pref: DirectionPreference) => {
    engineRef.current?.setDirectionPreference(pref);
    setSnapshot(s => s ? { ...s } : s);
  }, []);

  const spawnBatch = useCallback((count: number) => {
    engineRef.current?.spawnBatch(count);
    setSnapshot(s => s ? { ...s } : s);
  }, []);

  return {
    snapshot, running, spawning,
    start, stop, reset,
    setSpeed, setSpawnRadius, setH3Resolution,
    setEntryNode, addExitNode,
    blockEdge, clearAll,
    addZone, updateZone, removeZone, setDirectionPreference,
    spawnBatch, setSpawningEnabled,
  };
}
