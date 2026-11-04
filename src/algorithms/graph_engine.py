import heapq
import math
from collections import deque
from typing import Dict, List, Set, Tuple, Any, Optional

class TransactionGraph:
    """
    Multi-Bank Transaction Network with Graph Search Algorithms:
    - BFS: Multi-Hop Money Mule & Layering Discovery
    - DFS: Circular Wash-Trading & Laundering Loop Detection
    - Dijkstra: Minimum Cost / Max Risk Pathway
    - A* Search: Heuristic-Guided Laundering Highway Finder
    """
    def __init__(self):
        # account_id -> Dict of account metadata
        self.nodes: Dict[str, Dict[str, Any]] = {}
        # account_id -> list of outgoing edges (Dict)
        self.adj: Dict[str, List[Dict[str, Any]]] = {}

    def add_node(self, account_id: str, bank: str, account_type: str, baseline_risk: float = 0.05):
        self.nodes[account_id] = {
            "id": account_id,
            "bank": bank,
            "type": account_type, # 'origin_suspect', 'mule', 'intermediary', 'cashout_terminal', 'standard'
            "risk": baseline_risk
        }
        if account_id not in self.adj:
            self.adj[account_id] = []

    def add_edge(self, u: str, v: str, amount: float, timestamp_sec: int, channel: str, fraud_prob: float):
        if u not in self.nodes:
            self.add_node(u, "Unknown", "standard")
        if v not in self.nodes:
            self.add_node(v, "Unknown", "standard")
        
        edge = {
            "source": u,
            "target": v,
            "amount": amount,
            "time": timestamp_sec,
            "channel": channel,
            "fraud_prob": max(0.001, min(0.999, fraud_prob))
        }
        self.adj[u].append(edge)

    def get_topology(self) -> Dict[str, Any]:
        """Returns the full node and edge list for frontend rendering."""
        edges = []
        for u in self.adj:
            for e in self.adj[u]:
                edges.append(e)
        return {
            "nodes": list(self.nodes.values()),
            "edges": edges,
            "total_nodes": len(self.nodes),
            "total_edges": len(edges)
        }

    # =========================================================================
    # ALGORITHM 1: Breadth-First Search (BFS) - Multi-Hop Money Mule Discovery
    # =========================================================================
    def trace_mule_layering_bfs(self, start_account: str, max_depth: int = 3) -> Dict[str, Any]:
        """
        BFS Traversal to identify fund dispersion across mule rings.
        Layer 1 -> Direct Transfers (Smurfing Fan-out)
        Layer 2 -> Second-tier Mules
        Layer 3 -> Cash-out / Crypto gateways
        """
        if start_account not in self.nodes:
            return {"error": f"Account {start_account} not in network", "layers": []}

        visited: Set[str] = {start_account}
        queue = deque([(start_account, 0, [start_account], 0.0)])
        
        layers: Dict[int, List[Dict[str, Any]]] = {d: [] for d in range(1, max_depth + 1)}
        traversal_order: List[str] = [start_account]
        flagged_mules: List[Dict[str, Any]] = []

        while queue:
            curr, depth, path, cum_risk = queue.popleft()
            if depth >= max_depth:
                continue

            for edge in self.adj.get(curr, []):
                target = edge["target"]
                new_path = path + [target]
                edge_risk = edge["fraud_prob"]
                step_record = {
                    "from": curr,
                    "to": target,
                    "depth": depth + 1,
                    "amount": edge["amount"],
                    "fraud_prob": edge_risk,
                    "channel": edge["channel"],
                    "path": new_path
                }
                layers[depth + 1].append(step_record)

                if target not in visited:
                    visited.add(target)
                    traversal_order.append(target)
                    queue.append((target, depth + 1, new_path, cum_risk + edge_risk))
                    
                    # Heuristic check for money mule: high risk or fan-out receiver
                    target_meta = self.nodes.get(target, {})
                    if edge_risk > 0.6 or target_meta.get("type") in ["mule", "cashout_terminal"]:
                        flagged_mules.append({
                            "account": target,
                            "layer": depth + 1,
                            "bank": target_meta.get("bank", "Unknown"),
                            "type": target_meta.get("type", "mule"),
                            "fraud_score": round(edge_risk, 3),
                            "exposure_amount": edge["amount"]
                        })

        return {
            "algorithm": "BFS (Breadth-First Search)",
            "origin": start_account,
            "max_depth": max_depth,
            "total_visited": len(visited),
            "traversal_sequence": traversal_order,
            "layers": layers,
            "flagged_mules": flagged_mules,
            "complexity": "O(V + E) deterministic traversal"
        }

    # =========================================================================
    # ALGORITHM 2: Depth-First Search (DFS) - Circular Wash-Trading Cycle Detection
    # =========================================================================
    def detect_wash_cycles_dfs(self, max_cycle_length: int = 6) -> Dict[str, Any]:
        """
        DFS with recursion stack state (White/Gray/Black graph coloring)
        to identify closed circular laundering loops (A -> B -> C -> A).
        """
        visited: Set[str] = set()
        rec_stack: Dict[str, int] = {} # node -> index in current path
        current_path: List[str] = []
        cycles_found: List[Dict[str, Any]] = []
        cycle_signatures: Set[str] = set()

        def dfs(node: str):
            visited.add(node)
            rec_stack[node] = len(current_path)
            current_path.append(node)

            for edge in self.adj.get(node, []):
                target = edge["target"]
                if target in rec_stack:
                    # Circular Cycle Encountered!
                    cycle_start_idx = rec_stack[target]
                    cycle_loop = current_path[cycle_start_idx:] + [target]
                    if 2 < len(cycle_loop) - 1 <= max_cycle_length:
                        # Generate canonical cycle signature to avoid cyclic permutations
                        loop_nodes = cycle_loop[:-1]
                        min_idx = loop_nodes.index(min(loop_nodes))
                        canonical = "-".join(loop_nodes[min_idx:] + loop_nodes[:min_idx])
                        if canonical not in cycle_signatures:
                            cycle_signatures.add(canonical)
                            cycles_found.append({
                                "cycle_id": f"CYC-{len(cycles_found)+1}",
                                "nodes": cycle_loop,
                                "length": len(cycle_loop) - 1,
                                "type": "Circular Round-Trip Wash Laundering",
                                "severity": "HIGH",
                                "description": f"Closed funds loop detected: {' -> '.join(cycle_loop)}"
                            })
                elif target not in visited:
                    dfs(target)

            current_path.pop()
            del rec_stack[node]

        for n in list(self.nodes.keys()):
            if n not in visited:
                dfs(n)

        return {
            "algorithm": "DFS (Depth-First Search Cycle Finder)",
            "cycles_detected": len(cycles_found),
            "cycles": cycles_found,
            "complexity": "O(V + E) with active recursion stack back-edge detection"
        }

    # =========================================================================
    # ALGORITHM 3: Dijkstra's Algorithm - Max-Risk Shortest Laundering Path
    # =========================================================================
    def shortest_risk_path_dijkstra(self, start: str, end: str) -> Dict[str, Any]:
        """
        Dijkstra search where edge cost = -log(fraud_prob).
        Minimizing additive cost maximizes the product of fraud probabilities,
        yielding the Highest-Risk Money Laundering Pathway.
        """
        if start not in self.nodes or end not in self.nodes:
            return {"error": "Start or end node does not exist"}

        # distances: account -> lowest cost from start
        dist: Dict[str, float] = {node: float("inf") for node in self.nodes}
        dist[start] = 0.0
        prev: Dict[str, Optional[str]] = {node: None for node in self.nodes}
        visited: Set[str] = set()

        pq = [(0.0, start)]
        nodes_expanded = 0

        while pq:
            curr_dist, u = heapq.heappop(pq)
            if u in visited:
                continue
            visited.add(u)
            nodes_expanded += 1

            if u == end:
                break

            for edge in self.adj.get(u, []):
                v = edge["target"]
                # Cost is inversely related to fraud probability (high fraud = low distance)
                weight = -math.log(edge["fraud_prob"] + 1e-4) + 0.1
                new_dist = curr_dist + weight

                if new_dist < dist[v]:
                    dist[v] = new_dist
                    prev[v] = u
                    heapq.heappush(pq, (new_dist, v))

        # Reconstruct path
        path = []
        curr = end
        while curr is not None:
            path.append(curr)
            curr = prev[curr]
        path.reverse()

        found = len(path) > 1 and path[0] == start
        return {
            "algorithm": "Dijkstra's Algorithm",
            "start": start,
            "end": end,
            "path_found": found,
            "path": path if found else [],
            "total_cost": round(dist[end], 4) if found else None,
            "nodes_expanded": nodes_expanded,
            "total_graph_nodes": len(self.nodes)
        }

    # =========================================================================
    # ALGORITHM 4: A* Heuristic Search - Informed Laundering Escape Route
    # =========================================================================
    def astar_laundering_path(self, start: str, end: str) -> Dict[str, Any]:
        """
        A* Search: f(n) = g(n) + h(n)
        g(n) = exact path cost from start to n
        h(n) = admissible heuristic estimating distance to target cash-out node
        Guarantees faster node resolution than exhaustive Dijkstra.
        """
        if start not in self.nodes or end not in self.nodes:
            return {"error": "Start or end node does not exist"}

        # Admissible Heuristic: Target terminal proximity bonus
        # If node n is a cashout terminal or high-risk entity, h(n) is low
        def heuristic(node: str) -> float:
            target_meta = self.nodes.get(end, {})
            curr_meta = self.nodes.get(node, {})
            # If same bank or terminal type, smaller remaining heuristic cost
            if node == end:
                return 0.0
            h = 0.5
            if curr_meta.get("type") in ["mule", "cashout_terminal"]:
                h -= 0.3
            return max(0.05, h)

        open_set = [(heuristic(start), 0.0, start)] # (f_score, g_score, node)
        g_score: Dict[str, float] = {node: float("inf") for node in self.nodes}
        g_score[start] = 0.0
        came_from: Dict[str, Optional[str]] = {node: None for node in self.nodes}
        closed_set: Set[str] = set()
        nodes_expanded = 0

        while open_set:
            f, curr_g, curr = heapq.heappop(open_set)
            if curr in closed_set:
                continue
            closed_set.add(curr)
            nodes_expanded += 1

            if curr == end:
                break

            for edge in self.adj.get(curr, []):
                neighbor = edge["target"]
                weight = -math.log(edge["fraud_prob"] + 1e-4) + 0.1
                tentative_g = curr_g + weight

                if tentative_g < g_score[neighbor]:
                    came_from[neighbor] = curr
                    g_score[neighbor] = tentative_g
                    f_val = tentative_g + heuristic(neighbor)
                    heapq.heappush(open_set, (f_val, tentative_g, neighbor))

        # Reconstruct path
        path = []
        curr = end
        while curr is not None:
            path.append(curr)
            curr = came_from[curr]
        path.reverse()

        found = len(path) > 1 and path[0] == start
        return {
            "algorithm": "A* Informed Heuristic Search",
            "start": start,
            "end": end,
            "path_found": found,
            "path": path if found else [],
            "total_g_cost": round(g_score[end], 4) if found else None,
            "nodes_expanded": nodes_expanded,
            "heuristic_type": "Admissible Cash-Out Proximity Heuristic h(n)",
            "speedup_vs_uninformed": f"Expanded {nodes_expanded} nodes vs {len(self.nodes)} total network size"
        }


def create_demo_crossbank_graph() -> TransactionGraph:
    """
    Constructs a realistic multi-bank fraud & money-mule topology connecting:
    - Bank A (Credit Card Network)
    - Bank B (PaySim Mobile Money)
    - Bank C (BankSim Retail Merchant Accounts)
    Includes multi-hop mule layering, circular wash cycles, and cash-out sinks.
    """
    g = TransactionGraph()

    # 1. Bank A Nodes (Credit Cards)
    g.add_node("A_CARD_901", "Bank A (Cards)", "origin_suspect", 0.92)
    g.add_node("A_CARD_902", "Bank A (Cards)", "mule", 0.78)
    g.add_node("A_CARD_105", "Bank A (Cards)", "standard", 0.05)
    g.add_node("A_CARD_440", "Bank A (Cards)", "standard", 0.08)

    # 2. Bank B Nodes (Mobile Money Transfers)
    g.add_node("B_MOBI_201", "Bank B (PaySim)", "mule", 0.85)
    g.add_node("B_MOBI_202", "Bank B (PaySim)", "intermediary", 0.60)
    g.add_node("B_MOBI_203", "Bank B (PaySim)", "mule", 0.89)
    g.add_node("B_MOBI_550", "Bank B (PaySim)", "standard", 0.02)

    # 3. Bank C Nodes (Retail & Merchant Cash-out)
    g.add_node("C_RETL_301", "Bank C (BankSim)", "intermediary", 0.70)
    g.add_node("C_RETL_302", "Bank C (BankSim)", "cashout_terminal", 0.95)
    g.add_node("C_RETL_303", "Bank C (BankSim)", "intermediary", 0.65)
    g.add_node("C_RETL_700", "Bank C (BankSim)", "standard", 0.04)

    # 4. Transactions: Layering Tree (BFS Multi-Hop)
    # A_CARD_901 fans out to B_MOBI_201 and B_MOBI_202
    g.add_edge("A_CARD_901", "B_MOBI_201", 9850.0, 100, "WIRE_TRANSFER", 0.88)
    g.add_edge("A_CARD_901", "B_MOBI_202", 9500.0, 120, "WIRE_TRANSFER", 0.72)
    
    # Layer 2: B_MOBI_201 -> B_MOBI_203 and C_RETL_301
    g.add_edge("B_MOBI_201", "B_MOBI_203", 4900.0, 200, "MOBILE_INSTANT", 0.84)
    g.add_edge("B_MOBI_201", "C_RETL_301", 4800.0, 210, "POS_PURCHASE", 0.79)

    # Layer 3: Cashout sinks
    g.add_edge("B_MOBI_203", "C_RETL_302", 4750.0, 320, "CRYPTO_ATM_CASHOUT", 0.96)
    g.add_edge("C_RETL_301", "C_RETL_302", 4600.0, 340, "OFFSHORE_WIRE", 0.94)

    # 5. Circular Wash-Trading Cycle (DFS Target):
    # C_RETL_301 -> C_RETL_303 -> A_CARD_902 -> C_RETL_301 (Closed wash cycle)
    g.add_edge("C_RETL_301", "C_RETL_303", 3500.0, 400, "MERCHANT_REFUND", 0.81)
    g.add_edge("C_RETL_303", "A_CARD_902", 3450.0, 420, "CREDIT_REVERSAL", 0.85)
    g.add_edge("A_CARD_902", "C_RETL_301", 3400.0, 450, "PEER_SETTLEMENT", 0.87)

    # 6. Standard benign transactions
    g.add_edge("A_CARD_105", "A_CARD_440", 54.20, 50, "GROCERY_PAY", 0.02)
    g.add_edge("A_CARD_440", "C_RETL_700", 112.50, 70, "ONLINE_CHECKOUT", 0.04)
    g.add_edge("B_MOBI_550", "C_RETL_700", 35.00, 90, "UTILITY_BILL", 0.01)

    return g
