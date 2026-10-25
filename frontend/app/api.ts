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
