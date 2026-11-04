from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from src.algorithms.graph_engine import create_demo_crossbank_graph, TransactionGraph
from src.algorithms.heuristics import (
    analyze_benfords_law,
    detect_smurfing_structuring,
    optimize_client_weights_sa
)

router = APIRouter(prefix="/api/algorithms", tags=["Algorithms & Heuristics"])

# Global demo graph instance
_GRAPH_INSTANCE = create_demo_crossbank_graph()

class BFSTraceRequest(BaseModel):
    start_account: str = Field(default="A_CARD_901", description="Source account to trace")
    max_depth: int = Field(default=3, ge=1, le=5, description="Max traversal depth / hops")

class AStarPathRequest(BaseModel):
    start_account: str = Field(default="A_CARD_901", description="Origin account")
    end_account: str = Field(default="C_RETL_302", description="Destination / Cashout terminal account")

class BenfordAuditRequest(BaseModel):
    amounts: Optional[List[float]] = Field(default=None, description="List of transaction amounts")
    use_synthetic_anomaly: bool = Field(default=False, description="Whether to inject synthetic fabricated amounts")

class StructuringAuditRequest(BaseModel):
    threshold_limit: float = Field(default=10000.0, description="Legal AML reporting threshold limit")
    sample_type: str = Field(default="smurfed", description="sample type: 'smurfed' or 'normal'")

class SAOptimizationRequest(BaseModel):
    initial_temp: float = Field(default=100.0, description="Starting temperature")
    cooling_rate: float = Field(default=0.92, description="Cooling factor")
    max_iterations: int = Field(default=150, description="Optimization iterations")

@router.get("/graph-topology")
def get_graph_topology():
    """Returns the full multi-bank transaction network for frontend graph rendering."""
    return _GRAPH_INSTANCE.get_topology()

@router.post("/bfs-mule-trace")
def run_bfs_mule_trace(req: BFSTraceRequest):
    """
    ALGORITHM: Breadth-First Search (BFS)
    Traces multi-hop money mule layering and fund dispersion starting from suspect node.
    """
    result = _GRAPH_INSTANCE.trace_mule_layering_bfs(
        start_account=req.start_account,
        max_depth=req.max_depth
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.post("/dfs-wash-cycles")
def run_dfs_wash_cycles(max_cycle_length: int = 6):
    """
    ALGORITHM: Depth-First Search (DFS) Cycle Detection
    Identifies closed circular laundering loops (A -> B -> C -> A) using active recursion stack.
    """
    return _GRAPH_INSTANCE.detect_wash_cycles_dfs(max_cycle_length=max_cycle_length)

@router.post("/astar-laundering-path")
def run_astar_laundering_path(req: AStarPathRequest):
    """
    ALGORITHMS: A* Heuristic Search vs. Dijkstra's Algorithm
    Compares heuristic-guided cashout pathfinding with standard uninformed Dijkstra.
    """
    astar_res = _GRAPH_INSTANCE.astar_laundering_path(req.start_account, req.end_account)
    dijkstra_res = _GRAPH_INSTANCE.shortest_risk_path_dijkstra(req.start_account, req.end_account)

    if "error" in astar_res:
        raise HTTPException(status_code=404, detail=astar_res["error"])

    return {
        "astar": astar_res,
        "dijkstra": dijkstra_res,
        "comparison": {
            "astar_nodes_expanded": astar_res["nodes_expanded"],
            "dijkstra_nodes_expanded": dijkstra_res["nodes_expanded"],
            "heuristic_efficiency_gain": (
                f"{round((1 - astar_res['nodes_expanded'] / max(1, dijkstra_res['nodes_expanded'])) * 100, 1)}% fewer node expansions"
                if dijkstra_res["nodes_expanded"] > astar_res["nodes_expanded"]
                else "Optimal path resolved immediately"
            )
        }
    }

@router.post("/benford-heuristic")
def run_benford_heuristic(req: BenfordAuditRequest):
    """
    HEURISTIC: Benford's Law Chi-Square Forensic Accounting
    Tests first-digit logarithmic conformity to detect scripted/fraudulent money amounts.
    """
    if req.amounts and len(req.amounts) >= 10:
        amounts = req.amounts
    elif req.use_synthetic_anomaly:
        # Generate fabricated amounts (e.g., lots of 7s, 8s, 9s unnatural in Benford)
        import random
        amounts = [random.choice([7400, 7850, 8100, 8900, 9200, 9800, 9950]) for _ in range(80)]
    else:
        # Generate Benford-conformant natural transaction amounts
        import numpy as np
        # Log-normal distribution produces natural Benford conformity
        amounts = list(np.random.lognormal(mean=4.5, sigma=1.2, size=150))

    return analyze_benfords_law(amounts)

@router.post("/smurfing-heuristic")
def run_smurfing_heuristic(req: StructuringAuditRequest):
    """
    HEURISTIC: AML Smurfing / Structuring Detection
    Catches transactions intentionally placed just under legal reporting limits.
    """
    if req.sample_type == "smurfed":
        sample_txs = [
            {"tx_id": "TX-01", "amount": 9850.0, "time_offset_min": 12, "sender": "A_CARD_901", "receiver": "B_MOBI_201"},
            {"tx_id": "TX-02", "amount": 9500.0, "time_offset_min": 18, "sender": "A_CARD_901", "receiver": "B_MOBI_202"},
            {"tx_id": "TX-03", "amount": 9920.0, "time_offset_min": 25, "sender": "A_CARD_901", "receiver": "C_RETL_301"},
            {"tx_id": "TX-04", "amount": 9780.0, "time_offset_min": 31, "sender": "A_CARD_901", "receiver": "B_MOBI_203"},
            {"tx_id": "TX-05", "amount": 150.0, "time_offset_min": 45, "sender": "A_CARD_901", "receiver": "COFFEE_SHOP"},
        ]
    else:
        sample_txs = [
            {"tx_id": "TX-01", "amount": 42.50, "time_offset_min": 5, "sender": "A_CARD_105", "receiver": "GROCERY"},
            {"tx_id": "TX-02", "amount": 115.00, "time_offset_min": 12, "sender": "A_CARD_440", "receiver": "ONLINE_STORE"},
            {"tx_id": "TX-03", "amount": 2500.00, "time_offset_min": 60, "sender": "B_MOBI_550", "receiver": "RENT_PAYMENT"},
            {"tx_id": "TX-04", "amount": 12.00, "time_offset_min": 90, "sender": "C_RETL_700", "receiver": "METRO_PASS"}
        ]

    return detect_smurfing_structuring(sample_txs, threshold_limit=req.threshold_limit)

@router.post("/client-weights-sa")
def run_client_weights_sa(req: SAOptimizationRequest):
    """
    META-HEURISTIC: Simulated Annealing Federated Client Weight Optimizer
    Finds optimal aggregation weights balancing Accuracy vs Latency vs Byzantine Anomaly.
    """
    # Metrics representative of the 3 participating banks
    client_metrics = {
        "Bank A (Credit Card)": {"pr_auc": 0.826, "anomaly_norm": 0.12, "latency_ms": 110.0},
        "Bank B (PaySim Mobile)": {"pr_auc": 0.952, "anomaly_norm": 0.08, "latency_ms": 145.0},
        "Bank C (BankSim Retail)": {"pr_auc": 0.809, "anomaly_norm": 0.22, "latency_ms": 280.0}
    }
    return optimize_client_weights_sa(
        client_metrics,
        initial_temp=req.initial_temp,
        cooling_rate=req.cooling_rate,
        max_iterations=req.max_iterations
    )
