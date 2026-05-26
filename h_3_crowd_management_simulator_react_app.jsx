export default function CrowdManagementSimulator() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Simulation Area */}
        <div className="lg:col-span-3 bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Crowd Flow Simulator
              </h1>
              <p className="text-zinc-400 mt-1 text-sm">
                Graph-based crowd management visualization using hexagonal grids
              </p>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              <button className="px-4 py-2 rounded-xl bg-white text-black font-medium hover:opacity-90 transition">
                Start Simulation
              </button>

              <button className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition">
                Reset
              </button>

              <button className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 transition font-medium">
                Trigger Emergency
              </button>
            </div>
          </div>

          {/* Hex Grid Area */}
          <div className="relative flex-1 bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden min-h-[650px]">
            <HexGrid />

            <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-zinc-700 rounded-2xl p-4 w-72">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Simulation Timeline</h3>
                <span className="text-xs text-green-400">LIVE</span>
              </div>

              <div className="space-y-3 text-sm">
                <TimelineEvent
                  time="00:12"
                  event="Crowd density increasing near corridor C4"
                />

                <TimelineEvent
                  time="00:21"
                  event="Evacuation route recomputed"
                />

                <TimelineEvent
                  time="00:37"
                  event="Critical bottleneck detected"
                />
              </div>
            </div>

            {/* Overlay Stats */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-zinc-700 rounded-2xl p-4 w-56">
              <h3 className="font-semibold mb-3">Live Metrics</h3>

              <div className="space-y-2 text-sm">
                <Metric label="Nodes" value="148" />
                <Metric label="Edges" value="522" />
                <Metric label="Runtime" value="2.1ms" />
                <Metric label="Path Length" value="17" />
                <Metric label="Congestion" value="72%" />
              </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md border border-zinc-700 rounded-2xl p-4 w-64">
              <h3 className="font-semibold mb-3">Density Scale</h3>

              <div className="space-y-3">
                <Legend color="bg-blue-500" label="Low Density" />
                <Legend color="bg-yellow-400" label="Medium Density" />
                <Legend color="bg-orange-500" label="High Density" />
                <Legend color="bg-red-600" label="Critical Density" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Simulation Controls</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Venue Preset
                </label>

                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white text-sm">
                  <option>Stadium Layout</option>
                  <option>Concert Hall</option>
                  <option>Metro Station</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Algorithm
                </label>

                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white text-sm">
                  <option>Dijkstra</option>
                  <option>BFS</option>
                  <option>A*</option>
                  <option>Bottleneck Analysis</option>
                  <option>Comparison Replay</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Simulation Speed
                </label>

                <input
                  type="range"
                  className="w-full"
                  min="1"
                  max="10"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Stress Testing</h2>

            <div className="grid grid-cols-2 gap-3">
              <ActionButton label="Add Entry" />
              <ActionButton label="Add Exit" />
              <ActionButton label="Block Cell" />
              <ActionButton label="Clear" />
              <ActionButton label="Randomize" />
              <ActionButton label="Pause Sim" />
              <ActionButton label="Replay" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Algorithm Analysis</h2>

            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 space-y-4">
              <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-xs text-zinc-400 mb-1">Current Operation</p>
                <p className="text-sm font-medium text-emerald-400">
                  Relaxing edge H12 → H13
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-400">Current Algorithm</p>
                <p className="font-semibold">Dijkstra's Algorithm</p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">Time Complexity</p>
                <p className="font-semibold">O(E log V)</p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">Traversal Status</p>
                <p className="font-semibold text-green-400">
                  Frontier Expansion Active
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-2xl border border-zinc-700 p-5">
            <h3 className="font-semibold mb-2">Project Focus</h3>

            <p className="text-sm text-zinc-400 leading-relaxed">
              This simulation demonstrates graph traversal, shortest path
              computation, congestion analysis, and spatial crowd flow
              visualization using hexagonal node structures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`w-4 h-4 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function TimelineEvent({ time, event }) {
  return (
    <div className="border-l-2 border-zinc-600 pl-3">
      <p className="text-xs text-zinc-500">{time}</p>
      <p className="text-sm text-zinc-200 leading-relaxed">{event}</p>
    </div>
  );
}

function ActionButton({ label }) {
  return (
    <button className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 py-3 text-sm transition">
      {label}
    </button>
  );
}

function HexGrid() {
  const rows = 9;
  const cols = 11;

  const getCellColor = (r, c) => {
    const value = (r + c) % 4;

    switch (value) {
      case 0:
        return "#2563eb";
      case 1:
        return "#facc15";
      case 2:
        return "#f97316";
      default:
        return "#dc2626";
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_70%)]">
      <svg width="900" height="700" viewBox="0 0 900 700">
        {Array.from({ length: rows }).map((_, row) =>
          Array.from({ length: cols }).map((_, col) => {
            const size = 32;
            const xOffset = row % 2 === 0 ? 0 : size * 0.9;

            const x = col * size * 1.8 + xOffset + 100;
            const y = row * size * 1.55 + 80;

            const points = createHexagonPoints(x, y, size);

            return (
              <g key={`${row}-${col}`}>
                {(row + col) % 5 === 0 && (
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="white"
                    opacity="0.9"
                  />
                )}
                <polygon
                  points={points}
                  fill={getCellColor(row, col)}
                  stroke="#18181b"
                  strokeWidth="2"
                  className="hover:opacity-80 cursor-pointer transition-all duration-200"
                />
              </g>
            );
          })
        )}

        {/* Example Path Visualization */}
        <polyline
          points="140,120 200,150 260,180 320,210 380,240 440,270"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="14 10"
        />
              <line
          x1="140"
          y1="120"
          x2="440"
          y2="270"
          stroke="#ffffff55"
          strokeWidth="2"
          strokeDasharray="6 8"
        />

        <text
          x="460"
          y="275"
          fill="white"
          fontSize="14"
          fontWeight="600"
        >
          Optimal Evacuation Route
        </text>
      </svg>
    </div>
  );
}

function createHexagonPoints(cx, cy, size) {
  const points = [];

  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 30) * Math.PI) / 180;

    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);

    points.push(`${x},${y}`);
  }

  return points.join(" ");
}
