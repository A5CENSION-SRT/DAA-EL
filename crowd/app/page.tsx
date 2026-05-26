import {
  Ban,
  DoorOpen,
  History,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Siren,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

const metrics = [
  { label: "Nodes", value: "148" },
  { label: "Edges", value: "522" },
  { label: "Runtime", value: "2.1ms" },
  { label: "Path length", value: "17" },
  { label: "Congestion", value: "72%" },
];

const timeline = [
  { time: "00:12", event: "Crowd density rising near corridor C4" },
  { time: "00:21", event: "Evacuation route recomputed" },
  { time: "00:37", event: "Critical bottleneck detected" },
];

const densityScale = [
  { color: "bg-blue-500", label: "Low" },
  { color: "bg-yellow-400", label: "Medium" },
  { color: "bg-orange-500", label: "High" },
  { color: "bg-red-600", label: "Critical" },
];

const actions = [
  { label: "Add Entry", icon: Plus },
  { label: "Add Exit", icon: DoorOpen },
  { label: "Block Cell", icon: Ban },
  { label: "Clear", icon: RotateCcw },
  { label: "Randomize", icon: Shuffle },
  { label: "Pause Sim", icon: Pause },
  { label: "Replay", icon: History },
];

export default function CrowdManagementSimulator() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Crowd Flow Simulator
              </h1>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                Live
              </Badge>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Graph traversal, congestion analysis, and evacuation routing on a
              hexagonal venue map.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="lg">
              <Play data-icon="inline-start" />
              Start
            </Button>
            <Button variant="outline" size="lg">
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
            <Button variant="destructive" size="lg">
              <Siren data-icon="inline-start" />
              Emergency
            </Button>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-w-0 flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>

            <Card className="min-w-0 p-0">
              <CardHeader className="border-b px-5 py-4">
                <div>
                  <CardTitle>Venue Flow Map</CardTitle>
                  <CardDescription>
                    Hex cells are colored by density; the dashed route marks the
                    current evacuation path.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden bg-zinc-950 sm:min-h-[580px]">
                  <HexGrid />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <CardHeader>
                  <CardTitle>Simulation Timeline</CardTitle>
                  <CardDescription>Latest events from the route engine</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {timeline.map((item) => (
                    <TimelineEvent key={item.time} {...item} />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Density Scale</CardTitle>
                  <CardDescription>Cell color intensity</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                  {densityScale.map((item) => (
                    <Legend key={item.label} {...item} />
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          <aside className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Simulation Controls</CardTitle>
                <CardDescription>Preset, algorithm, and playback speed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Venue preset
                  </label>
                  <Select defaultValue="stadium">
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select venue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stadium">Stadium layout</SelectItem>
                      <SelectItem value="concert">Concert hall</SelectItem>
                      <SelectItem value="metro">Metro station</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Algorithm
                  </label>
                  <Select defaultValue="dijkstra">
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dijkstra">Dijkstra</SelectItem>
                      <SelectItem value="bfs">BFS</SelectItem>
                      <SelectItem value="astar">A*</SelectItem>
                      <SelectItem value="bottleneck">Bottleneck Analysis</SelectItem>
                      <SelectItem value="comparison">Comparison Replay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground">
                      Simulation speed
                    </label>
                    <span className="text-sm font-semibold">6x</span>
                  </div>
                  <Slider defaultValue={[6]} min={1} max={10} step={1} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stress Testing</CardTitle>
                <CardDescription>Modify the venue graph</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {actions.map(({ label, icon: Icon }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="lg"
                    className="justify-start"
                  >
                    <Icon data-icon="inline-start" />
                    {label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Algorithm Analysis</CardTitle>
                <CardDescription>Dijkstra traversal state</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current operation
                  </p>
                  <p className="mt-2 text-sm font-semibold text-emerald-400">
                    Relaxing edge H12 -&gt; H13
                  </p>
                </div>

                <AnalysisRow label="Current algorithm" value="Dijkstra's Algorithm" />
                <Separator />
                <AnalysisRow label="Time complexity" value="O(E log V)" />
                <Separator />
                <AnalysisRow
                  label="Traversal status"
                  value="Frontier Expansion Active"
                  valueClassName="text-emerald-400"
                />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm" className="gap-2">
      <CardContent className="px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
      <span className={`size-3 rounded-full ${color}`} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function TimelineEvent({ time, event }: { time: string; event: string }) {
  return (
    <div className="grid grid-cols-[56px_1fr] gap-3">
      <span className="text-sm font-medium text-muted-foreground">{time}</span>
      <p className="border-l pl-4 text-sm leading-6">{event}</p>
    </div>
  );
}

function AnalysisRow({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function HexGrid() {
  const rows = 9;
  const cols = 11;

  const getCellColor = (r: number, c: number) => {
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
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_68%)] p-5">
      <svg
        className="h-full max-h-[560px] w-full max-w-[980px]"
        viewBox="0 0 900 700"
        role="img"
        aria-label="Hexagonal crowd density map"
      >
        {Array.from({ length: rows }).map((_, row) =>
          Array.from({ length: cols }).map((_, col) => {
            const size = 32;
            const xOffset = row % 2 === 0 ? 0 : size * 0.9;

            const x = col * size * 1.8 + xOffset + 100;
            const y = row * size * 1.55 + 86;

            const points = createHexagonPoints(x, y, size);

            return (
              <g key={`${row}-${col}`}>
                {(row + col) % 5 === 0 && (
                  <circle cx={x} cy={y} r="5" fill="white" opacity="0.9" />
                )}
                <polygon
                  points={points}
                  fill={getCellColor(row, col)}
                  stroke="#09090b"
                  strokeWidth="4"
                  className="cursor-pointer transition-opacity duration-200 hover:opacity-80"
                />
              </g>
            );
          }),
        )}

        <polyline
          points="154,124 214,154 274,184 334,214 394,244 454,274 514,304"
          fill="none"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="16 12"
        />
        <line
          x1="154"
          y1="124"
          x2="514"
          y2="304"
          stroke="#ffffff66"
          strokeWidth="2"
          strokeDasharray="6 8"
        />

        <text x="535" y="309" fill="white" fontSize="16" fontWeight="650">
          Optimal evacuation route
        </text>
      </svg>
    </div>
  );
}

function createHexagonPoints(cx: number, cy: number, size: number) {
  const points = [];

  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 30) * Math.PI) / 180;

    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);

    points.push(`${x},${y}`);
  }

  return points.join(" ");
}
