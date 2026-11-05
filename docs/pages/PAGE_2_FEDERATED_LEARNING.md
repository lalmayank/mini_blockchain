# Page 2: Federated Learning Hub & Execution Console

## 1. Overview & Objective

The **Federated Learning Hub** is the operational control center of CrossBank TrustFL. It enables administrators and machine learning engineers to trigger, monitor, and audit distributed federated learning rounds in real time. 

Instead of pooling sensitive banking records into a vulnerable central data lake, each bank trains locally on its proprietary dataset. The coordinator aggregates only the resulting mathematical weight updates, screens them for anomalies, updates the global model, and commits cryptographic proofs directly to the Ethereum Virtual Machine (EVM).

---

## 2. Mathematical & Algorithmic Foundations

### 2.1. Standard Sample-Weighted FedAvg (McMahan et al.)
In standard Federated Averaging, each participating bank $k \in \{A, B, C\}$ computes local gradient descent on its private dataset $D_k$ containing $n_k$ samples, producing updated parameter weights $W_k^{(t+1)}$. The coordinator aggregates these updates proportionally to each bank's data volume:

$$W^{(t+1)} = \sum_{k=1}^{K} \frac{n_k}{N} W_k^{(t+1)} \quad \text{where } N = \sum_{k=1}^{K} n_k$$

While efficient, standard FedAvg is highly vulnerable to Byzantine attacks: a single compromised bank submitting arbitrarily large or malicious weights can corrupt the entire global model.

### 2.2. Coordinate-wise Median Aggregation (Byzantine-Robust)
To defend against malicious or poisoned model updates without requiring raw data inspection, TrustFL supports **Coordinate-wise Median**. For each scalar parameter coordinate $j$ across all received client weight vectors:

$$W_j^{(t+1)} = \operatorname{median}\left(W_{1,j}^{(t+1)}, W_{2,j}^{(t+1)}, \dots, W_{K,j}^{(t+1)}\right)$$

Coordinate-wise median guarantees an optimal Byzantine breakdown point: as long as fewer than $50\%$ of the participating nodes are Byzantine, extreme gradient outliers cannot steer the aggregated parameters.

---

## 3. Four-Stage Execution Pipeline

```text
  [ Stage 1: Local Client Training ]
  ├── Bank A executes PyTorch SGD over Credit Card dataset (n=20,000)
  ├── Bank B executes PyTorch SGD over PaySim Mobile dataset (n=20,000)
  └── Bank C executes PyTorch SGD over BankSim Retail dataset (n=20,000)
                 │
                 ▼
  [ Stage 2: Coordinator Defense Screening ]
  ├── Layer-by-layer tensor shape sanity check
  ├── NaN / Infinity numeric gate check
  └── Frobenius norm anomaly score screening: ||W_k - W_prev||_F <= tau
                 │
                 ▼
  [ Stage 3: Parameter Aggregation ]
  ├── Filter out rejected / flagged client submissions
  └── Compute new Global Model weights (FedAvg or Coordinate-wise Median)
                 │
                 ▼
  [ Stage 4: EVM Smart Contract Commitment ]
  ├── Compute SHA-256 digest of resulting global weights
  ├── Package client submission hashes and defense verdicts
  └── Execute signAndSendTransaction to FraudAudit.sol
```

1. **Stage 1 — Local Training**: Each bank loads the current global weights $W^{(t)}$ and performs $E$ local epochs of supervised training using binary cross-entropy loss with class-weight rebalancing.
2. **Stage 2 — Coordinator Defense Screening**: Before any weights enter aggregation, the coordinator evaluates the Frobenius norm distance $\|\Delta W_k\|_F$. Clients whose updates deviate beyond the dynamic anomaly cutoff or contain invalid floating-point values are tagged as `REJECTED`.
3. **Stage 3 — Parameter Aggregation**: Only approved updates (`ACCEPTED`) are merged into the new global state $W^{(t+1)}$.
4. **Stage 4 — Blockchain Notarization**: The coordinator signs an on-chain transaction committing the round metadata, approved bank hashes, rejected bank hashes, defense algorithm name, and the final global model SHA-256 state hash.

---

## 4. UI Components & Control Layout

### 4.1. Training Control Panel (Left Column)
- **Round ID Input**: Auto-increments from the last completed round, or allows manual specification of a target round number.
- **Defense & Aggregation Strategy Dropdown**:
  - `Sample-Weighted FedAvg (Standard)`: Standard sample-weighted aggregation.
  - `Coordinate-wise Median (Byzantine-Robust)`: Coordinate-wise median aggregation resilient to outlier poisoning.
- **Local Training Epochs Selector**: Configure 1 or 2 local epochs per bank per federated round.
- **Execute Training Round Button**: Dispatches an asynchronous request to the backend. Automatically disables when training is already in progress to prevent race conditions.
- **Coordinator Status Badge**: Displays live execution phase (`IDLE`, `TRAINING_CLIENTS`, `AGGREGATING`, `COMMITTING_ON_CHAIN`, `COMPLETED`).

### 4.2. Round Progression Bar & Milestone Stepper (Right Top)
- **Visual Progress Bar**: Displays percentage completion ($0\%$ to $100\%$) with smooth transition animations.
- **4-Stage Stepper**: Clearly highlights which phase the distributed cluster is currently executing:
  1. *Local Training*
  2. *Defense Screen*
  3. *Parameter Aggregation*
  4. *Smart Contract Commit*

### 4.3. Execution Telemetry & Live Defense Terminal (Right Bottom)
- **Terminal Emulator**: Dark monospace container styling (`bg-slate-950 text-slate-300`).
- **Real-Time Telemetry Stream**: Displays timestamped, indexed log lines generated during training:
  - Client data load confirmation.
  - Local training loss and micro-batch metrics.
  - Frobenius norm calculations per bank.
  - Byzantine defense screening decisions (`ACCEPTED` / `REJECTED`).
  - Web3 transaction receipt details (Block number, Gas used, Transaction Hash).

---

## 5. Backend Architecture & REST Contracts

### 5.1. Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/train` | Initiates an asynchronous training round in a background worker thread. |
| `GET` | `/api/train/status` | Polls the current round status, progress percentage, step label, and log buffer. |

### 5.2. Request Payload (`POST /api/train`)
```json
{
  "round_id": 4,
  "defense_strategy": "coordinate_median",
  "local_epochs": 1
}
```

### 5.3. Status Response (`GET /api/train/status`)
```json
{
  "status": "RUNNING",
  "progress_percent": 75,
  "current_step": "Aggregating approved client parameters via coordinate-wise median",
  "logs": [
    "Starting Federated Round #4...",
    "Bank A: Completed 1 local epoch on 20,000 credit card samples (Loss: 0.0412)",
    "Bank B: Completed 1 local epoch on 20,000 mobile money samples (Loss: 0.0388)",
    "Bank C: Completed 1 local epoch on 20,000 retail samples (Loss: 0.0520)",
    "Defense Screening: Bank A update norm = 1.42 (ACCEPTED)",
    "Defense Screening: Bank B update norm = 1.38 (ACCEPTED)",
    "Defense Screening: Bank C update norm = 1.49 (ACCEPTED)",
    "Aggregating weights via coordinate-wise median...",
    "New Global Model SHA-256: d8e3...7f21",
    "Submitting transaction to FraudAudit.sol..."
  ]
}
```

---

## 6. Step-by-Step Operator Walkthrough

1. Navigate to the **Federated Learning** tab in the main navigation.
2. Select your desired aggregation strategy:
   - Use **FedAvg** when operating in an authenticated, fully trusted consortium environment.
   - Use **Coordinate-wise Median** if adversarial or unreliable client behavior is suspected.
3. Click **Execute Training Round**.
4. Observe the progress bar advance from Stage 1 through Stage 4.
5. Review the execution logs in the terminal console to verify that all three banks were accepted and that the transaction was confirmed on-chain.
6. Once complete, switch to **Page 3 (Fraud Explorer)** to test the newly updated model, or **Page 5 (Blockchain Audit)** to inspect the new block.
