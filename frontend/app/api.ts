const API_BASE = "http://localhost:8000";

export async function getSystemStatus() {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function getRegisteredBanks() {
  const res = await fetch(`${API_BASE}/api/banks`);
  if (!res.ok) throw new Error("Failed to fetch banks");
  return res.json();
}

export async function startTrainingRound(payload: {
  round_id: number;
  defense_strategy: string;
  epochs: number;
  attack_bank?: string;
  attack_type?: string;
}) {
  const res = await fetch(`${API_BASE}/api/training/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to start training round");
  return res.json();
}

export async function getTrainingStatus() {
  const res = await fetch(`${API_BASE}/api/training/status`);
  if (!res.ok) throw new Error("Failed to fetch training status");
  return res.json();
}

export async function getGlobalModel() {
  const res = await fetch(`${API_BASE}/api/models/global`);
  if (!res.ok) throw new Error("Failed to fetch global model");
  return res.json();
}

export async function getFraudSamples() {
  const res = await fetch(`${API_BASE}/api/fraud/samples`);
  if (!res.ok) throw new Error("Failed to fetch fraud samples");
  return res.json();
}

export async function predictFraud(features: number[], threshold: number = 0.5) {
  const res = await fetch(`${API_BASE}/api/fraud/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features, threshold }),
  });
  if (!res.ok) throw new Error("Failed to score transaction");
  return res.json();
}

export async function evaluateDataset(dataset_key: string, threshold: number = 0.5) {
  const res = await fetch(`${API_BASE}/api/fraud/evaluate-dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_key, threshold }),
  });
  if (!res.ok) throw new Error("Failed to evaluate dataset");
  return res.json();
}

export async function simulateAttack(payload: {
  attacker: string;
  attack_type: string;
  defense_strategy: string;
  round_id: number;
}) {
  const res = await fetch(`${API_BASE}/api/security/attack-simulation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to trigger attack simulation");
  return res.json();
}

export async function getModelComparison() {
  const res = await fetch(`${API_BASE}/api/security/compare`);
  if (!res.ok) throw new Error("Failed to fetch model comparison");
  return res.json();
}

export async function getAuditRounds() {
  const res = await fetch(`${API_BASE}/api/audit/rounds`);
  if (!res.ok) throw new Error("Failed to fetch audit rounds");
  return res.json();
}

export async function verifyModelHash(round_id: number, model_hash: string) {
  const res = await fetch(`${API_BASE}/api/audit/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round_id, model_hash }),
  });
  if (!res.ok) throw new Error("Failed to verify model hash");
  return res.json();
}

// ==========================================
// GRAPH ALGORITHMS & HEURISTICS API
// ==========================================
export async function getGraphTopology() {
  const res = await fetch(`${API_BASE}/api/algorithms/graph-topology`);
  if (!res.ok) throw new Error("Failed to fetch graph topology");
  return res.json();
}

export async function runBFSMuleTrace(start_account: string = "A_CARD_901", max_depth: number = 3) {
  const res = await fetch(`${API_BASE}/api/algorithms/bfs-mule-trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_account, max_depth }),
  });
  if (!res.ok) throw new Error("Failed to run BFS trace");
  return res.json();
}

export async function runDFSWashCycles(max_cycle_length: number = 6) {
  const res = await fetch(`${API_BASE}/api/algorithms/dfs-wash-cycles?max_cycle_length=${max_cycle_length}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to run DFS cycle detection");
  return res.json();
}

export async function runAStarPath(start_account: string = "A_CARD_901", end_account: string = "C_RETL_302") {
  const res = await fetch(`${API_BASE}/api/algorithms/astar-laundering-path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_account, end_account }),
  });
  if (!res.ok) throw new Error("Failed to run A* search");
  return res.json();
}

export async function runBenfordHeuristic(use_synthetic_anomaly: boolean = false, amounts?: number[]) {
  const res = await fetch(`${API_BASE}/api/algorithms/benford-heuristic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ use_synthetic_anomaly, amounts }),
  });
  if (!res.ok) throw new Error("Failed to run Benford heuristic");
  return res.json();
}

export async function runSmurfingHeuristic(sample_type: string = "smurfed", threshold_limit: number = 10000.0) {
  const res = await fetch(`${API_BASE}/api/algorithms/smurfing-heuristic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sample_type, threshold_limit }),
  });
  if (!res.ok) throw new Error("Failed to run Smurfing heuristic");
  return res.json();
}

export async function runClientWeightsSA(initial_temp: number = 100.0, cooling_rate: number = 0.92, max_iterations: number = 150) {
  const res = await fetch(`${API_BASE}/api/algorithms/client-weights-sa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initial_temp, cooling_rate, max_iterations }),
  });
  if (!res.ok) throw new Error("Failed to run Simulated Annealing optimizer");
  return res.json();
}
