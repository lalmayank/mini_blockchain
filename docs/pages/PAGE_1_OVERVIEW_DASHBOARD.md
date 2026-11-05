# Page 1: Overview & Executive Dashboard

## 1. Executive Summary

The **Overview & Executive Dashboard** serves as the central command cockpit for **CrossBank TrustFL**. It gives compliance officers, ML engineers, and banking auditors an instantaneous, bird's-eye view into the health, convergence status, and cryptographic integrity of the federated fraud detection consortium.

This page visualizes how three distinct financial institutions—**Bank A** (Credit Card transactions), **Bank B** (PaySim mobile money), and **Bank C** (BankSim retail payments)—collaboratively train a centralized neural network while keeping 100% of their private customer datasets locked within their respective firewalls.

---

## 2. Core Architectural Principles Displayed

```text
  ┌─────────────────────────────────────────────────────────────┐
  │                 Participating Banking Nodes                 │
  │  [Bank A: Credit Card]  [Bank B: Mobile Pay]  [Bank C: Retail] │
  └───────────────┬─────────────────┬───────────────────┬───────┘
                  │                 │                   │
                  │ (Local Weights) │ (Local Weights)   │ (Local Weights)
                  ▼                 ▼                   ▼
  ┌─────────────────────────────────────────────────────────────┐
  │         Federated Coordinator & Anomaly Defense Filter      │
  │         - NaN / Inf / Dimension Validation                  │
  │         - Frobenius Norm Dispersion Anomaly Gate            │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
  ┌─────────────────────────────────┐   ┌───────────────────────────────┐
  │     Active Global Model MLP     │   │      Solidity Smart Contract  │
  │  16-D Standardized Embeddings   │   │      FraudAudit.sol (EVM)     │
  │  Weight Hash: SHA-256 Digest    │   │      Immutable Audit Receipts │
  └─────────────────────────────────┘   └───────────────────────────────┘
```

1. **Strict Data Sovereignty**: Raw customer records, PII, balances, and account identities never cross banking perimeter boundaries. Only model parameter tensors ($\Delta W, \Delta b$) are transmitted.
2. **Unified Feature Standardization**: Heterogeneous raw schemas across card swipe logs, mobile money transfers, and retail point-of-sale systems are transformed into a standardized 16-dimensional continuous behavioral representation.
3. **Dual Audit Anchoring**: Every round's resulting model state is hashed with SHA-256 and anchored to an on-chain smart contract (`FraudAudit.sol`), establishing a non-repudiable audit trail for banking regulators.

---

## 3. UI Components & Metric Displays

### 3.1. Top System Header & Network Status Badges
- **Prototype Status Badge**: Signals live consortium prototype execution.
- **Backend Online Indicator**: Real-time heartbeat checking the FastAPI server on port 8000 (`http://127.0.0.1:8000/api/status`). Pulses green when healthy, amber/red if disconnected.
- **Solidity EVM On-Chain Badge**: Confirms an active JSON-RPC connection to the Ethereum Virtual Machine containing the deployed `FraudAudit.sol` smart contract.
- **Refresh Control Button**: Triggers immediate parallel re-fetching of all system telemetry.

### 3.2. Consortium KPI Metric Cards
The dashboard displays four real-time metric cards:
1. **Current Round**:
   - Displays the active federated training round identifier ($R \in \mathbb{N}$).
   - Indicates whether consensus convergence has been reached across bank nodes.
2. **Participating Banks**:
   - Count of currently active banking nodes registered with the coordinator (Bank A, Bank B, Bank C).
3. **Audited Rounds**:
   - Total number of completed rounds committed to the EVM blockchain.
   - Cross-references the immutable records stored on `FraudAudit.sol`.
4. **Global Architecture**:
   - Neural network parameter count: **3,393 weights and biases**.
   - Input layer topology: Standardized 16-dimensional MLP (`GlobalFraudMLP`).

### 3.3. Active Global Model Fingerprint Card
- Displays the canonical 64-character SHA-256 hexadecimal hash computed over all serialized layer parameters ($W_1, b_1, W_2, b_2, W_3, b_3$) of the active global model.
- Includes a **"Verified On-Chain"** badge confirming that this digest matches the cryptographic commitment stored in the blockchain state.

### 3.4. Participating Bank Clients Grid
Provides dedicated status cards for each consortium member:
- **Bank A (Credit Card Swipes)**:
  - Dataset: Credit Card Fraud Detection benchmark.
  - Characteristics: High volume, extreme class imbalance, low latency card swipes.
  - Data privacy guarantee: Private local dataset; only weight gradients leave the bank.
- **Bank B (Mobile Money Transfers)**:
  - Dataset: PaySim Synthetic Financial Mobile Dataset.
  - Characteristics: High transaction values, cash-out laundering patterns, mobile wallet agents.
- **Bank C (Retail & POS Payments)**:
  - Dataset: BankSim Agent-Based Simulation.
  - Characteristics: Merchant categories, consumer POS terminals, structured payment amounts.

Each bank card reports:
- Node status (`READY`, `TRAINING`, `COMPLETED`).
- Total private training sample volume.
- Historical fraud incidence and local class imbalance ratio.
- Transmitted data classification (`Model Weights Only`).

---

## 4. Backend Endpoints & Data Contracts

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Returns coordinator state, current round, total audited rounds, and active model hash. |
| `GET` | `/api/banks` | Returns registry list of participating banks, sample counts, and fraud ratios. |
| `GET` | `/api/global-model` | Fetches model topology, layer dimensions, parameter count, and SHA-256 fingerprint. |

### Sample Response (`GET /api/status`):
```json
{
  "current_round": 3,
  "status": "IDLE",
  "total_audited_rounds": 3,
  "active_global_model_hash": "a4f89d31e9c2049c81b94236e89647230491845f9393a52861c892e850bdf602",
  "coordinator_address": "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
  "contract_address": "0xF2E246BB76DF876Cef8b38ae84130F4F55De395b"
}
```

---

## 5. User Interaction & Operational Flow

1. **Initial Page Load**:
   - The page invokes `loadInitialData()` upon mount, firing parallel asynchronous promises to fetch coordinator status, registered bank telemetry, and active model hashes.
2. **Polling Loop**:
   - A reactive timer invokes `refreshLiveStatus()` every 2,500ms to keep metric cards and on-chain block counters synchronized with ongoing backend training processes.
3. **Manual Refresh**:
   - Clicking the refresh icon in the upper right header forces an immediate telemetry reload.
4. **Navigation Pathways**:
   - Operators can jump directly to **Page 2 (Federated Learning)** to trigger a new training cycle, **Page 3 (Fraud Explorer)** to run inference against the active model, or **Page 5 (Blockchain Audit)** to verify on-chain block proofs.
