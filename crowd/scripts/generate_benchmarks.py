#!/usr/bin/env python3
import os
import sys
import math
import time
import json
import heapq
import random
import urllib.request
import urllib.parse
from collections import deque
import matplotlib.pyplot as plt
import h3
import numpy as np

# ─── Configuration ─────────────────────────────────────────────────────────────
VENUE_NAME = "MG Road, Bangalore"
BBOX = [12.969, 77.596, 12.982, 77.619] # south, west, north, east
CENTER = [12.9752, 77.6076] # lat, lng
OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
IMAGES_DIR = '/home/snehal-reddy/Coding/Repositories/DAA EL/crowd/images'

os.makedirs(IMAGES_DIR, exist_ok=True)

# ─── H3 Metrics Reference ──────────────────────────────────────────────────────
# Resolution -> (Area in m^2, Edge Length in m)
H3_METRICS = {
    5: (252900000.0, 9900.0),
    6: (36100000.0, 3700.0),
    7: (5160000.0, 1400.0),
    8: (737327.6, 537.1),
    9: (105332.5, 203.0),
    10: (15047.5, 76.7),
    11: (2149.6, 29.0),
    12: (307.1, 11.0)
}

# ─── Haversine Formula ─────────────────────────────────────────────────────────
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0  # earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2.0)**2
    c = 2.0 * math.asin(math.sqrt(a))
    return R * c

# ─── Data Acquisition (with Robust Local Fallback) ───────────────────────────
def fetch_osm_graph():
    s, w, n, e = BBOX
    walkable = "primary|secondary|tertiary|residential|unclassified|pedestrian|footway|path|service|living_street|steps"
    query = f"""[out:json][timeout:30];
(
  way["highway"~"^({walkable})$"]({s},{w},{n},{e});
);
out body;
>;
out skel qt;"""

    print("Attempting to fetch OpenStreetMap data from Overpass API...")
    data = urllib.parse.urlencode({'data': query}).encode('utf-8')
    req = urllib.request.Request(OVERPASS_URL, data=data, headers={'User-Agent': 'DAA-EL-Benchmark/1.0'})
    
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            raw = res.read().decode('utf-8')
            return json.loads(raw)
    except Exception as err:
        print(f"Warning: Could not fetch from Overpass API ({err}). Triggering local grid fallback...")
        return None

def generate_local_fallback_graph(grid_size=50):
    s, w, n, e = BBOX
    nodes_coords = {}
    adj = {}
    
    # 1. Create nodes
    for r in range(grid_size):
        for c in range(grid_size):
            node_id = f"fallback_n_{r}_{c}"
            lat = s + (n - s) * (r / (grid_size - 1))
            lon = w + (e - w) * (c / (grid_size - 1))
            lat += random.uniform(-0.00005, 0.00005)
            lon += random.uniform(-0.00005, 0.00005)
            nodes_coords[node_id] = (lat, lon)
            adj[node_id] = []
            
    # 2. Add edges with random street hierarchies
    highway_types = ['primary', 'secondary', 'tertiary', 'residential']
    highway_weights = [0.1, 0.2, 0.3, 0.4]
    highway_capacities = {'primary': 1000, 'secondary': 800, 'tertiary': 600, 'residential': 400}
    
    edge_seq = 0
    for r in range(grid_size):
        for c in range(grid_size):
            sk = f"fallback_n_{r}_{c}"
            
            if c < grid_size - 1:
                if random.random() < 0.90:
                    tk = f"fallback_n_{r}_{c+1}"
                    lat1, lon1 = nodes_coords[sk]
                    lat2, lon2 = nodes_coords[tk]
                    dist = haversine(lat1, lon1, lat2, lon2)
                    hw = random.choices(highway_types, weights=highway_weights)[0]
                    cap = highway_capacities[hw]
                    edge_id = f"fallback_e_{edge_seq}"
                    edge_seq += 1
                    adj[sk].append((tk, edge_id, dist, cap))
                    adj[tk].append((sk, edge_id, dist, cap))
                    
            if r < grid_size - 1:
                if random.random() < 0.90:
                    tk = f"fallback_n_{r+1}_{c}"
                    lat1, lon1 = nodes_coords[sk]
                    lat2, lon2 = nodes_coords[tk]
                    dist = haversine(lat1, lon1, lat2, lon2)
                    hw = random.choices(highway_types, weights=highway_weights)[0]
                    cap = highway_capacities[hw]
                    edge_id = f"fallback_e_{edge_seq}"
                    edge_seq += 1
                    adj[sk].append((tk, edge_id, dist, cap))
                    adj[tk].append((sk, edge_id, dist, cap))
                    
    return nodes_coords, adj

def parse_osm_to_graph(elements):
    print("Parsing OSM elements into adjacency list...")
    osm_nodes = {}
    for el in elements:
        if el.get('type') == 'node' and 'lat' in el and 'lon' in el:
            osm_nodes[el['id']] = (el['lat'], el['lon'])
            
    nodes_coords = {}
    adj = {}
    
    highway_capacities = {
        'primary': 1000, 'secondary': 800, 'tertiary': 600,
        'residential': 400, 'unclassified': 300, 'pedestrian': 800,
        'footway': 500, 'path': 300, 'service': 200, 'living_street': 300
    }
    
    edge_seq = 0
    for el in elements:
        if el.get('type') == 'way' and 'nodes' in el and len(el['nodes']) >= 2:
            highway = el.get('tags', {}).get('highway', 'residential')
            capacity = highway_capacities.get(highway, 400)
            way_nodes = el['nodes']
            
            for nid in way_nodes:
                if nid in osm_nodes:
                    nodes_coords[nid] = osm_nodes[nid]
                    if nid not in adj:
                        adj[nid] = []
                        
            for i in range(len(way_nodes) - 1):
                sk = way_nodes[i]
                tk = way_nodes[i+1]
                if sk in nodes_coords and tk in nodes_coords:
                    lat1, lon1 = nodes_coords[sk]
                    lat2, lon2 = nodes_coords[tk]
                    dist = haversine(lat1, lon1, lat2, lon2)
                    if dist < 0.1:
                        continue
                    
                    edge_id = f"e{el['id']}_{edge_seq}"
                    edge_seq += 1
                    adj[sk].append((tk, edge_id, dist, capacity))
                    adj[tk].append((sk, edge_id, dist, capacity))
                    
    print(f"Graph constructed: {len(nodes_coords)} nodes, {edge_seq} structural edges.")
    return nodes_coords, adj

# ─── Pathfinding Implementation ────────────────────────────────────────────────
def dijkstra(adj, start, end, flows=None):
    dist = {start: 0.0}
    prev = {}
    visited = set()
    visited_order = []
    edges_relaxed = 0
    max_queue_size = 0
    
    pq = [(0.0, start)]
    reached = False
    
    def get_weight(base_w, edge_id, cap):
        if not flows or edge_id not in flows:
            return base_w
        ratio = flows[edge_id] / max(1, cap)
        congestion_factor = 1.0 + (ratio * 50.0) + (ratio ** 2) * 500.0
        return base_w * max(1.0, congestion_factor)

    while pq:
        max_queue_size = max(max_queue_size, len(pq))
        d, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        visited_order.append(u)
        if u == end:
            reached = True
            break
            
        for v, edge_id, base_w, cap in adj[u]:
            edges_relaxed += 1
            w = get_weight(base_w, edge_id, cap)
            alt = d + w
            if alt < dist.get(v, float('inf')):
                dist[v] = alt
                prev[v] = u
                heapq.heappush(pq, (alt, v))
                
    path = []
    if reached:
        curr = end
        while curr:
            path.append(curr)
            curr = prev.get(curr)
        path.reverse()
        
    return {
        'path': path,
        'cost': dist.get(end, float('inf')) if reached else float('inf'),
        'visited': visited_order,
        'edges_relaxed': edges_relaxed,
        'peak_space': len(visited) + max_queue_size + len(dist)
    }

def astar(adj, start, end, nodes_coords, flows=None):
    end_lat, end_lon = nodes_coords[end]
    
    def h(u):
        u_lat, u_lon = nodes_coords[u]
        return haversine(u_lat, u_lon, end_lat, end_lon)
        
    g_score = {start: 0.0}
    prev = {}
    visited = set()
    visited_order = []
    edges_relaxed = 0
    max_queue_size = 0
    
    pq = [(h(start), start)]
    reached = False
    
    def get_weight(base_w, edge_id, cap):
        if not flows or edge_id not in flows:
            return base_w
        ratio = flows[edge_id] / max(1, cap)
        congestion_factor = 1.0 + (ratio * 50.0) + (ratio ** 2) * 500.0
        return base_w * max(1.0, congestion_factor)

    while pq:
        max_queue_size = max(max_queue_size, len(pq))
        f, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        visited_order.append(u)
        if u == end:
            reached = True
            break
            
        u_g = g_score[u]
        for v, edge_id, base_w, cap in adj[u]:
            if v in visited:
                continue
            edges_relaxed += 1
            w = get_weight(base_w, edge_id, cap)
            tent_g = u_g + w
            if tent_g < g_score.get(v, float('inf')):
                prev[v] = u
                g_score[v] = tent_g
                heapq.heappush(pq, (tent_g + h(v), v))
                
    path = []
    if reached:
        curr = end
        while curr:
            path.append(curr)
            curr = prev.get(curr)
        path.reverse()
        
    return {
        'path': path,
        'cost': g_score.get(end, float('inf')) if reached else float('inf'),
        'visited': visited_order,
        'edges_relaxed': edges_relaxed,
        'peak_space': len(visited) + max_queue_size + len(g_score)
    }

def bfs(adj, start, end):
    prev = {}
    visited = {start}
    visited_order = []
    edges_relaxed = 0
    max_queue_size = 0
    
    queue = deque([start])
    reached = False
    
    while queue:
        max_queue_size = max(max_queue_size, len(queue))
        u = queue.popleft()
        visited_order.append(u)
        if u == end:
            reached = True
            break
            
        for v, edge_id, base_w, cap in adj[u]:
            edges_relaxed += 1
            if v not in visited:
                visited.add(v)
                prev[v] = u
                queue.append(v)
                
    path = []
    if reached:
        curr = end
        while curr:
            path.append(curr)
            curr = prev.get(curr)
        path.reverse()
        
    return {
        'path': path,
        'cost': float(len(path) - 1) if reached else float('inf'),
        'visited': visited_order,
        'edges_relaxed': edges_relaxed,
        'peak_space': len(visited) + max_queue_size
    }

# ─── Benchmarking ─────────────────────────────────────────────────────────────
def run_benchmarks(nodes_coords, adj):
    print("Running routing benchmarks...")
    node_ids = list(nodes_coords.keys())
    
    dijkstra_runtimes = []
    astar_runtimes = []
    bfs_runtimes = []
    
    dijkstra_expanded = []
    astar_expanded = []
    bfs_expanded = []
    
    path_lengths = []
    
    pairs_tested = 0
    attempts = 0
    
    while pairs_tested < 300 and attempts < 1500:
        attempts += 1
        u = random.choice(node_ids)
        v = random.choice(node_ids)
        if u == v:
            continue
            
        res_bfs = bfs(adj, u, v)
        if not res_bfs['path']:
            continue
            
        # Dijkstra
        t0 = time.perf_counter()
        res_dij = dijkstra(adj, u, v)
        t_dij = (time.perf_counter() - t0) * 1000.0
        
        # A*
        t0 = time.perf_counter()
        res_ast = astar(adj, u, v, nodes_coords)
        t_ast = (time.perf_counter() - t0) * 1000.0
        
        # BFS
        t0 = time.perf_counter()
        res_bfs_timed = bfs(adj, u, v)
        t_bfs = (time.perf_counter() - t0) * 1000.0
        
        dijkstra_runtimes.append(t_dij)
        astar_runtimes.append(t_ast)
        bfs_runtimes.append(t_bfs)
        
        dijkstra_expanded.append(len(res_dij['visited']))
        astar_expanded.append(len(res_ast['visited']))
        bfs_expanded.append(len(res_bfs_timed['visited']))
        
        path = res_dij['path']
        dist_m = 0.0
        for i in range(len(path)-1):
            n1_lat, n1_lon = nodes_coords[path[i]]
            n2_lat, n2_lon = nodes_coords[path[i+1]]
            dist_m += haversine(n1_lat, n1_lon, n2_lat, n2_lon)
            
        path_lengths.append(dist_m)
        pairs_tested += 1
        
    return {
        'dijkstra': {'runtime': dijkstra_runtimes, 'expanded': dijkstra_expanded},
        'astar': {'runtime': astar_runtimes, 'expanded': astar_expanded},
        'bfs': {'runtime': bfs_runtimes, 'expanded': bfs_expanded},
        'lengths': path_lengths
    }

def run_population_simulation(nodes_coords, adj):
    print("Simulating routing latency vs. active agent population (crowding)...")
    populations = [100, 300, 600, 1000, 1500, 2000]
    node_ids = list(nodes_coords.keys())
    
    avg_dij_latencies = []
    avg_ast_latencies = []
    avg_network_congestion = []
    
    test_pairs = []
    attempts = 0
    while len(test_pairs) < 50 and attempts < 1000:
        attempts += 1
        u = random.choice(node_ids)
        v = random.choice(node_ids)
        if u != v and bfs(adj, u, v)['path']:
            test_pairs.append((u, v))
            
    for pop in populations:
        flows = {}
        for _ in range(pop):
            u = random.choice(node_ids)
            v = random.choice(node_ids)
            res = bfs(adj, u, v)
            if res['path']:
                for i in range(len(res['path'])-1):
                    sk = res['path'][i]
                    tk = res['path'][i+1]
                    for neighbor, edge_id, dist, cap in adj[sk]:
                        if neighbor == tk:
                            flows[edge_id] = flows.get(edge_id, 0) + 1
                            break
                            
        congestion_ratios = []
        for u in adj:
            for v, edge_id, dist, cap in adj[u]:
                flow = flows.get(edge_id, 0)
                congestion_ratios.append(flow / max(1, cap))
        avg_network_congestion.append(sum(congestion_ratios) / len(congestion_ratios) if congestion_ratios else 0)
        
        dij_times = []
        ast_times = []
        for u, v in test_pairs:
            t0 = time.perf_counter()
            dijkstra(adj, u, v, flows)
            dij_times.append((time.perf_counter() - t0) * 1000.0)
            
            t0 = time.perf_counter()
            astar(adj, u, v, nodes_coords, flows)
            ast_times.append((time.perf_counter() - t0) * 1000.0)
            
        avg_dij_latencies.append(sum(dij_times) / len(dij_times) if dij_times else 0)
        avg_ast_latencies.append(sum(ast_times) / len(ast_times) if ast_times else 0)
        print(f"Population {pop} simulated. Avg Congestion: {avg_network_congestion[-1]:.4f}, Avg A* Latency: {avg_ast_latencies[-1]:.2f} ms")
        
    return populations, avg_dij_latencies, avg_ast_latencies, avg_network_congestion

def run_h3_benchmarks(nodes_coords):
    print("Running H3 spatial index mapping benchmarks...")
    agent_counts = [100, 500, 1000, 2000, 3500, 5000]
    resolutions = [8, 9, 10, 11]
    
    lat_min, lon_min, lat_max, lon_max = BBOX
    results = {res: [] for res in resolutions}
    
    for count in agent_counts:
        agents = []
        for _ in range(count):
            lat = random.uniform(lat_min, lat_max)
            lon = random.uniform(lon_min, lon_max)
            agents.append((lat, lon))
            
        for res in resolutions:
            t0 = time.perf_counter()
            h3_counts = {}
            for lat, lon in agents:
                h3_cell = h3.latlng_to_cell(lat, lon, res)
                h3_counts[h3_cell] = h3_counts.get(h3_cell, 0) + 1
            dt = (time.perf_counter() - t0) * 1000.0
            results[res].append(dt)
            
    return agent_counts, results

# ─── Deep Complexity Benchmarking (Grid Scaling) ──────────────────────────────
def run_complexity_benchmarks():
    print("Benchmarking Time & Space Complexity scaling vs. Graph Size...")
    # Grid sizes: 10x10 to 60x60 (Nodes: 100 to 3600)
    grid_dims = [10, 18, 26, 34, 42, 50, 58]
    node_counts = [dim**2 for dim in grid_dims]
    
    times_dij = []
    times_ast = []
    times_bfs = []
    
    space_dij = []
    space_ast = []
    space_bfs = []
    
    for dim in grid_dims:
        nodes_coords, adj = generate_local_fallback_graph(grid_size=dim)
        node_ids = list(nodes_coords.keys())
        
        runs = 30
        dij_t, ast_t, bfs_t = [], [], []
        dij_s, ast_s, bfs_s = [], [], []
        
        for _ in range(runs):
            u = random.choice(node_ids)
            v = random.choice(node_ids)
            while u == v or not bfs(adj, u, v)['path']:
                u = random.choice(node_ids)
                v = random.choice(node_ids)
                
            # Dijkstra
            t0 = time.perf_counter()
            res_dij = dijkstra(adj, u, v)
            dij_t.append((time.perf_counter() - t0) * 1000.0)
            dij_s.append(res_dij['peak_space'])
            
            # A*
            t0 = time.perf_counter()
            res_ast = astar(adj, u, v, nodes_coords)
            ast_t.append((time.perf_counter() - t0) * 1000.0)
            ast_s.append(res_ast['peak_space'])
            
            # BFS
            t0 = time.perf_counter()
            res_bfs = bfs(adj, u, v)
            bfs_t.append((time.perf_counter() - t0) * 1000.0)
            bfs_s.append(res_bfs['peak_space'])
            
        times_dij.append(sum(dij_t) / runs)
        times_ast.append(sum(ast_t) / runs)
        times_bfs.append(sum(bfs_t) / runs)
        
        space_dij.append(sum(dij_s) / runs)
        space_ast.append(sum(ast_s) / runs)
        space_bfs.append(sum(bfs_s) / runs)
        
        print(f"Graph Size {dim**2:<4} nodes: A* = {times_ast[-1]:.2f} ms ({space_ast[-1]:.0f} states), Dijkstra = {times_dij[-1]:.2f} ms ({space_dij[-1]:.0f} states)")
        
    return node_counts, (times_dij, times_ast, times_bfs), (space_dij, space_ast, space_bfs)

# ─── Deep H3 Resolution Scaling & Hexagon Size Load Benchmarks ─────────────────
def run_h3_resolution_load_benchmarks():
    print("Benchmarking H3 Hexagon Resolution size vs. Computational Load...")
    resolutions = [6, 7, 8, 9, 10, 11, 12]
    
    lat_min, lon_min, lat_max, lon_max = BBOX
    agent_count = 2500 # Fixed population for aggregation sizing
    agents = [(random.uniform(lat_min, lat_max), random.uniform(lon_min, lon_max)) for _ in range(agent_count)]
    
    runtimes = []
    unique_cells_count = []
    
    for res in resolutions:
        # Measure indexing and binning speed
        t0 = time.perf_counter()
        h3_counts = {}
        for lat, lon in agents:
            cell = h3.latlng_to_cell(lat, lon, res)
            h3_counts[cell] = h3_counts.get(cell, 0) + 1
        dt = (time.perf_counter() - t0) * 1000.0
        
        runtimes.append(dt)
        unique_cells_count.append(len(h3_counts))
        
        area = H3_METRICS[res][0]
        side = H3_METRICS[res][1]
        print(f"Res {res:<2} (Area: {area:>11.1f} m^2, Side: {side:>6.1f} m) -> Index Time: {dt:.3f} ms, Unique Cells Occupied: {len(h3_counts)}")
        
    return resolutions, runtimes, unique_cells_count

# ─── Plot Generation ───────────────────────────────────────────────────────────
def generate_and_save_plots(bench, pop_sim, h3_sim, complexity_sim, h3_load_sim):
    print("Generating statistical plots using matplotlib...")
    plt.style.use('seaborn-v0_8-darkgrid' if 'seaborn-v0_8-darkgrid' in plt.style.available else 'default')
    
    primary_color = "#3b82f6"   # A* blue
    secondary_color = "#eab308" # Dijkstra yellow
    tertiary_color = "#a855f7"  # BFS purple
    dark_bg = "#0f172a"
    
    # PLOT 1: Algorithm Exploration Efficiency (Nodes Explored vs Path Distance)
    plt.figure(figsize=(10, 6))
    plt.scatter(bench['lengths'], bench['bfs']['expanded'], color=tertiary_color, label='BFS (Unweighted)', alpha=0.5, s=20)
    plt.scatter(bench['lengths'], bench['dijkstra']['expanded'], color=secondary_color, label="Dijkstra's", alpha=0.6, s=20)
    plt.scatter(bench['lengths'], bench['astar']['expanded'], color=primary_color, label='A* Search', alpha=0.7, s=20)
    
    for data, col, lbl in [(bench['bfs'], tertiary_color, 'BFS'), 
                            (bench['dijkstra'], secondary_color, 'Dijkstra'), 
                            (bench['astar'], primary_color, 'A*')]:
        x = np.array(bench['lengths'])
        y = np.array(data['expanded'])
        if len(x) > 0:
            idx = np.argsort(x)
            x_sorted = x[idx]
            y_sorted = y[idx]
            z = np.polyfit(x_sorted, y_sorted, 1)
            p = np.poly1d(z)
            plt.plot(x_sorted, p(x_sorted), color=col, linestyle='--', linewidth=2, label=f'{lbl} Trendline')
        
    plt.title("Algorithm Exploration Efficiency: Nodes Explored vs Path Length", fontsize=14, fontweight='bold')
    plt.xlabel("Path Distance (m)", fontsize=12)
    plt.ylabel("Number of Graph Nodes Explored (Visited Set)", fontsize=12)
    plt.legend(frameon=True, fontsize=10)
    plt.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "algorithm_exploration_efficiency.png"), dpi=200)
    plt.close()
    
    # PLOT 2: Congestion Weighting Inflation Factor Curve
    plt.figure(figsize=(8, 5))
    ratio_axis = np.linspace(0.0, 1.5, 300)
    inflation_factor = 1.0 + (ratio_axis * 50.0) + (ratio_axis ** 2) * 500.0
    plt.plot(ratio_axis, inflation_factor, color="#ef4444", linewidth=3, label="Dynamic Congestion Penalty $f(x)$")
    plt.axvline(x=1.0, color="gray", linestyle=":", label="Capacity Saturation Threshold (1.0)")
    
    plt.title("Dynamic Cost Inflation Curve vs Edge Saturation Ratio", fontsize=14, fontweight='bold')
    plt.xlabel("Edge Flow-to-Capacity Ratio ($x = Flow / Capacity$)", fontsize=12)
    plt.ylabel("Cost Inflation Multiplier ($f(x)$)", fontsize=12)
    plt.yscale('log')
    plt.grid(True, which="both", ls="--")
    plt.legend(frameon=True, fontsize=10)
    plt.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "congestion_weighting_curve.png"), dpi=200)
    plt.close()
    
    # PLOT 3: Population Density vs Pathfinding Latency
    pop_x, dij_lat, ast_lat, avg_cong = pop_sim
    fig, ax1 = plt.subplots(figsize=(10, 6))
    
    color = '#10b981'
    ax1.set_xlabel('Simulated Active Agent Population', fontsize=12)
    ax1.set_ylabel('Mean Congestion Ratio ($Flow/Capacity$)', color=color, fontsize=12)
    line1 = ax1.plot(pop_x, avg_cong, color=color, marker='o', linewidth=2.5, label='Average Network Congestion')
    ax1.tick_params(axis='y', labelcolor=color)
    
    ax2 = ax1.twinx()  
    color_ast = primary_color
    color_dij = secondary_color
    ax2.set_ylabel('Mean Routing Latency (ms)', color=dark_bg, fontsize=12)
    line2 = ax2.plot(pop_x, ast_lat, color=color_ast, marker='s', linewidth=2.5, label='A* Latency')
    line3 = ax2.plot(pop_x, dij_lat, color=color_dij, marker='^', linewidth=2.5, label='Dijkstra Latency')
    ax2.tick_params(axis='y')
    
    lines = line1 + line2 + line3
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper left', frameon=True, fontsize=10)
    
    plt.title("Routing Latency and Network Congestion vs Agent Population", fontsize=14, fontweight='bold')
    fig.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "population_vs_latency.png"), dpi=200)
    plt.close()
    
    # PLOT 4: H3 Spatial Aggregation Latency
    agent_x, h3_res_map = h3_sim
    plt.figure(figsize=(10, 6))
    for res in sorted(h3_res_map.keys()):
        area = H3_METRICS[res][0]
        plt.plot(agent_x, h3_res_map[res], marker='o', linewidth=2.0, label=f'H3 Resolution {res} (Cell Area ~ {area:.1f} $m^2$)')
        
    plt.title("H3 Spatial Indexing Latency vs Agent Count", fontsize=14, fontweight='bold')
    plt.xlabel("Number of Pedestrian Agents", fontsize=12)
    plt.ylabel("Aggregation Latency (ms)", fontsize=12)
    plt.grid(True, ls="--")
    plt.legend(frameon=True, fontsize=10)
    plt.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "h3_binning_latency.png"), dpi=200)
    plt.close()
    
    # NEW PLOT 5: Empirical Time Complexity (Grid Size vs Runtime)
    node_counts, times, spaces = complexity_sim
    t_dij, t_ast, t_bfs = times
    plt.figure(figsize=(10, 6))
    plt.plot(node_counts, t_bfs, color=tertiary_color, marker='o', linestyle='-', linewidth=2, label='BFS — $O(|V| + |E|)$')
    plt.plot(node_counts, t_dij, color=secondary_color, marker='^', linestyle='-', linewidth=2, label="Dijkstra — $O((|V|+|E|)\\log|V|)$")
    plt.plot(node_counts, t_ast, color=primary_color, marker='s', linestyle='-', linewidth=2, label="A* Search — Heuristic-Accelerated")
    
    plt.title("Routing Time Complexity Analysis: Graph Size vs Runtime", fontsize=14, fontweight='bold')
    plt.xlabel("Graph Size (Number of Nodes $|V|$)", fontsize=12)
    plt.ylabel("Average Route Execution Latency (ms)", fontsize=12)
    plt.grid(True, ls="--")
    plt.legend(frameon=True, fontsize=11)
    plt.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "time_complexity_benchmark.png"), dpi=200)
    plt.close()
    
    # NEW PLOT 6: Empirical Space Complexity (Grid Size vs Queue memory footprint)
    s_dij, s_ast, s_bfs = spaces
    plt.figure(figsize=(10, 6))
    plt.plot(node_counts, s_bfs, color=tertiary_color, marker='o', linestyle='-', linewidth=2, label='BFS Memory Footprint')
    plt.plot(node_counts, s_dij, color=secondary_color, marker='^', linestyle='-', linewidth=2, label="Dijkstra Memory Footprint")
    plt.plot(node_counts, s_ast, color=primary_color, marker='s', linestyle='-', linewidth=2, label="A* Search Memory Footprint")
    
    plt.title("Routing Space Complexity Analysis: Graph Size vs Peak Memory States", fontsize=14, fontweight='bold')
    plt.xlabel("Graph Size (Number of Nodes $|V|$)", fontsize=12)
    plt.ylabel("Peak Memory Allocation (States in Queue + Visited Set)", fontsize=12)
    plt.grid(True, ls="--")
    plt.legend(frameon=True, fontsize=11)
    plt.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "space_complexity_benchmark.png"), dpi=200)
    plt.close()
    
    # NEW PLOT 7: H3 Resolution vs. Computational Load & Unique Hexagons
    h3_res, h3_run, h3_cells = h3_load_sim
    fig, ax1 = plt.subplots(figsize=(10, 6))
    
    color = '#3b82f6'
    ax1.set_xlabel('H3 Hexagonal Indexing Resolution', fontsize=12)
    ax1.set_ylabel('Aggregation Latency (ms) [2500 Agents]', color=color, fontsize=12)
    ax1.plot(h3_res, h3_run, color=color, marker='o', linewidth=2.5, label='Aggregation Runtime')
    ax1.tick_params(axis='y', labelcolor=color)
    ax1.set_xticks(h3_res)
    
    # Format labels to include cell areas and edge lengths
    x_labels = []
    for res in h3_res:
        area = H3_METRICS[res][0]
        side = H3_METRICS[res][1]
        if area >= 1000000.0:
            area_str = f"Res {res}\n({area/1000000.0:.1f} km²\nSide: {side/1000.0:.1f} km)"
        else:
            area_str = f"Res {res}\n({area:.0f} m²\nSide: {side:.1f} m)"
        x_labels.append(area_str)
    ax1.set_xticklabels(x_labels, fontsize=8)
    
    ax2 = ax1.twinx()
    color_bar = '#ef4444'
    ax2.set_ylabel('Number of Unique Occupied H3 Hexagons', color=color_bar, fontsize=12)
    ax2.bar(h3_res, h3_cells, color=color_bar, alpha=0.3, width=0.4, label='Occupied Hexagons')
    ax2.tick_params(axis='y', labelcolor=color_bar)
    
    plt.title("H3 Resolution Scale vs Aggregation Speed & Memory Footprint", fontsize=14, fontweight='bold')
    fig.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "h3_resolution_load.png"), dpi=200)
    plt.close()
    
    # NEW PLOT 8: H3 Cell Count Explosion (Log Scale of Edge Length vs Memory Load)
    plt.figure(figsize=(9, 5.5))
    edge_lengths = [H3_METRICS[res][1] for res in h3_res]
    plt.plot(edge_lengths, h3_cells, color='#ec4899', marker='D', markersize=8, linewidth=2.5, label='Unique Occupied Cells')
    plt.xscale('log')
    plt.yscale('log')
    plt.gca().invert_xaxis() # Invert to show resolution increasing (edge length decreasing) left-to-right
    
    # Annotate points with resolution numbers
    for i, res in enumerate(h3_res):
        plt.annotate(f"Res {res}", (edge_lengths[i], h3_cells[i]), textcoords="offset points", xytext=(0,10), ha='center', fontweight='bold')
        
    plt.title("H3 Scale Degradation: Cell Explosion vs. Hexagon Edge Length", fontsize=14, fontweight='bold')
    plt.xlabel("H3 Hexagon Side Length (m) [Log Scale, Decreasing ->]", fontsize=12)
    plt.ylabel("Occupied Cells Count [Log Scale]", fontsize=12)
    plt.grid(True, which="both", ls="--")
    plt.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "h3_scale_vs_cells.png"), dpi=200)
    plt.close()
    
    # ORIGINAL PLOT 5 UPDATE: Empirical Performance Metrics Summary (4-Panel Figure, overwrites/replaces performance_metrics)
    fig, axs = plt.subplots(2, 2, figsize=(12, 10))
    
    axs[0, 0].hist(bench['astar']['runtime'], bins=25, color=primary_color, alpha=0.8, edgecolor='black')
    axs[0, 0].axvline(np.mean(bench['astar']['runtime']), color='red', linestyle='--', linewidth=1.5, label=f"Mean: {np.mean(bench['astar']['runtime']):.2f} ms")
    axs[0, 0].set_title("A* Routing Query Latency Distribution", fontsize=12, fontweight='bold')
    axs[0, 0].set_xlabel("Query Latency (ms)", fontsize=10)
    axs[0, 0].set_ylabel("Frequency", fontsize=10)
    axs[0, 0].legend(fontsize=9)
    
    axs[0, 1].bar(["A*", "Dijkstra", "BFS"], 
                  [np.mean(bench['astar']['expanded']), np.mean(bench['dijkstra']['expanded']), np.mean(bench['bfs']['expanded'])],
                  color=[primary_color, secondary_color, tertiary_color], edgecolor='black', width=0.5)
    axs[0, 1].set_title("Average Node Expansions Comparison", fontsize=12, fontweight='bold')
    axs[0, 1].set_ylabel("Nodes Placed in Visited Set", fontsize=10)
    
    axs[1, 0].bar(["A*", "Dijkstra", "BFS"], 
                  [np.mean(bench['astar']['runtime']), np.mean(bench['dijkstra']['runtime']), np.mean(bench['bfs']['runtime'])],
                  color=[primary_color, secondary_color, tertiary_color], edgecolor='black', width=0.5)
    axs[1, 0].set_title("Average Execution Time Comparison", fontsize=12, fontweight='bold')
    axs[1, 0].set_ylabel("Runtime (ms)", fontsize=10)
    
    axs[1, 1].plot(h3_res, h3_run, marker='s', color='#f59e0b', linewidth=2, label="Aggregation Speed")
    axs[1, 1].set_title("Spatial Aggregation Load vs H3 Scale", fontsize=12, fontweight='bold')
    axs[1, 1].set_xlabel("H3 Resolution Scale (6 to 12)", fontsize=10)
    axs[1, 1].set_ylabel("Runtime (ms)", fontsize=10)
    axs[1, 1].set_xticks(h3_res)
    axs[1, 1].legend(fontsize=9)
    
    plt.suptitle(f"H3 Spatial Crowd Control: Empirical Performance Telemetry ({VENUE_NAME})", fontsize=15, fontweight='bold', y=0.98)
    plt.tight_layout()
    plt.savefig(os.path.join(IMAGES_DIR, "performance_metrics.jpeg"), dpi=200)
    plt.close()
    
    print("All statistical plots successfully generated and saved to crowd/images/!")

# ─── Main Controller ───────────────────────────────────────────────────────────
def main():
    print(f"================================================================================")
    print(f"DAA EL Experiential Learning: Empirical Graph and Data Statistics Generator")
    print(f"================================================================================")
    
    # 1. Fetch data
    raw_osm = fetch_osm_graph()
    
    if raw_osm is not None:
        nodes_coords, adj = parse_osm_to_graph(raw_osm['elements'])
    else:
        nodes_coords, adj = generate_local_fallback_graph()
    
    if len(nodes_coords) == 0:
        print("Error: Graph construction failed. No nodes found.")
        sys.exit(1)
        
    # 3. Run pathfinding benchmarks
    bench = run_benchmarks(nodes_coords, adj)
    
    # 4. Run population routing simulation
    pop_sim = run_population_simulation(nodes_coords, adj)
    
    # 5. Run H3 indexing benchmarks vs agent counts
    h3_sim = run_h3_benchmarks(nodes_coords)
    
    # 6. Run Time and Space Complexity grid scaling benchmarks
    complexity_sim = run_complexity_benchmarks()
    
    # 7. Run H3 Hexagon Resolution size vs load benchmarks
    h3_load_sim = run_h3_resolution_load_benchmarks()
    
    # 8. Generate and save plots
    generate_and_save_plots(bench, pop_sim, h3_sim, complexity_sim, h3_load_sim)
    
    # Output statistics summary table for report text
    print(f"\n================================================================================")
    print(f"ALGORITHMIC COMPARISON SUMMARY ({VENUE_NAME} Graph)")
    print(f"================================================================================")
    print(f"{'Algorithm':<12} | {'Avg Runtime (ms)':<16} | {'Avg Nodes Explored':<18} | {'Worst Case Complexity':<22}")
    print(f"-" * 78)
    print(f"{'A* Search':<12} | {np.mean(bench['astar']['runtime']):.4f} ms{' ':<5} | {np.mean(bench['astar']['expanded']):.1f}{' ':<14} | O((|V| + |E|) log |V|)")
    print(f"{'Dijkstra':<12} | {np.mean(bench['dijkstra']['runtime']):.4f} ms{' ':<5} | {np.mean(bench['dijkstra']['expanded']):.1f}{' ':<14} | O((|V| + |E|) log |V|)")
    print(f"{'BFS':<12} | {np.mean(bench['bfs']['runtime']):.4f} ms{' ':<5} | {np.mean(bench['bfs']['expanded']):.1f}{' ':<14} | O(|V| + |E|)")
    print(f"================================================================================")

if __name__ == "__main__":
    main()
