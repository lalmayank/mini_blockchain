# Page 4: Trust, Security & Byzantine Defense Lab

## 1. Overview & Adversarial Threat Landscape

In an open or multi-institution federated learning consortium, not all participants are guaranteed to be benign or uncompromised. Financial networks face severe adversarial threats:
- **Malicious Insiders & Rogue Nodes**: A compromised bank node may deliberately inject poisoned parameter updates to blind the global fraud model.
- **Data Poisoning & Label-Flipping**: An attacker with access to a local bank database may reverse ground truth labels (marking obvious fraud as legitimate), degrading the model's sensitivity.
- **Model Poisoning & Scale Attacks**: An adversary can multiply local gradient updates by large scaling factors (e.g. $100\times$), overpowering legitimate bank contributions during aggregation.

The **Trust & Security Lab** provides an interactive simulation sandbox where security researchers and compliance officers can simulate real-world Byzantine attacks against the consortium and empirically verify how TrustFL's defense mechanisms neutralize them.

---

## 2. Threat Modeling & Attack Vectors

```text
  [ Rogue Client: Bank C ]
         │
         ├──────────────────────────────────────────┐
         │ (Attack Vector 1)                        │ (Attack Vector 2)
         ▼                                          ▼
  [ 100x Scale Poisoning ]                 [ Label Flipping ]
  W_mal = W_global + 100 * (W_local - W)   y_train = 1 - y_train (Fraud ↔ Benign)
         │                                          │
         └────────────────────┬─────────────────────┘
                              │
                              ▼
        [ TrustFL Coordinator Multi-Layer Screening Gate ]
        ├── Check 1: Tensor Shape & NaN / Inf Check ──► [FAIL: Drop]
        ├── Check 2: Frobenius Norm Threshold: ||W_k - W_prev||_F <= tau
        │            (Norm > 50.0 flagged as anomalous) ──► [REJECTED]
        └── Check 3: Robust Aggregation (Coordinate Median)
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       [ Undefended FedAvg ]         [ Defended FedAvg ]
       PR-AUC drops to ~0.08         PR-AUC preserved at ~0.89+
       (Model Sabotaged)             (Byzantine Update Blocked)
```

### 2.1. Vector A: 100x Scale Weight Poisoning
The attacker trains on local data but scales the parameter delta by a massive multiplier $\gamma = 100$:

$$\Delta W_{\text{attacker}} = \gamma \cdot \left(W_{\text{local}} - W_{\text{global}}\right)$$

In standard FedAvg, this single submission dominates the parameter sum:

$$W^{(t+1)} = \frac{n_A W_A + n_B W_B + n_C (\gamma W_C)}{n_A + n_B + n_C}$$

This blows up the weights, causing gradient explosion, exploding activations, and catastrophic collapse of the fraud classification boundary.

### 2.2. Vector B: Label-Flipping Attack
The attacker inverts all training labels in their local partition:

$$y_i^{\text{flipped}} = 1 - y_i \quad \forall (x_i, y_i) \in D_{\text{compromised}}$$

The neural network is trained to classify blatant fraud patterns as benign, and legitimate transactions as fraud. When aggregated without defense, the global model develops severe blind spots for known fraud signatures.

---

## 3. TrustFL Multi-Tier Defense Architecture

TrustFL deploys a sequential three-tier defense pipeline in `src/defense.py` before any client weights can influence the global model:

### Tier 1: Numerical & Shape Integrity Gate
- Ensures every tensor strictly matches expected layer shapes ($[64, 16], [64], [32, 64], [32], [1, 32], [1]$).
- Rejects any submission containing `NaN`, positive infinity, or negative infinity:
  $$\exists w \in W_k \text{ s.t. } w \in \{\text{NaN}, \pm\infty\} \implies \text{REJECT}$$

### Tier 2: Dynamic Frobenius Norm Anomaly Gate
The coordinator computes the Euclidean/Frobenius norm of the weight delta for each client $k$:

$$\|\Delta W_k\|_F = \sqrt{\sum_{l} \sum_{i,j} \left(W_{k,l}[i,j] - W_{\text{global},l}[i,j]\right)^2}$$

The coordinator maintains a dynamic outlier cutoff threshold $\tau_{\text{norm}}$. Any client submission whose norm deviates drastically from the cohort distribution (e.g. $\|\Delta W_k\|_F > 15.0$) is tagged as `REJECTED` and quarantined from aggregation.

### Tier 3: Coordinate-wise Median Aggregator
Even if an attacker crafts an adversarial update that narrowly slips under the Frobenius norm threshold, coordinate-wise median replaces mean averaging:

$$W_j^{(t+1)} = \operatorname{median}\left(W_{1,j}, W_{2,j}, \dots, W_{K,j}\right)$$

Since the median is resistant up to a $50\%$ Byzantine breakdown threshold, a single rogue bank cannot move the coordinate value away from the consensus of honest banks.

---

## 4. UI Components & Attack Simulator

### 4.1. Simulation Control Panel (Left Column)
- **Compromised Client Node Dropdown**: Select which bank node to compromise (*Bank C Retail*, *Bank B Mobile Money*, or *Bank A Credit Cards*).
- **Poisoning Attack Vector Dropdown**:
  - `100x Scale Weight Poisoning (Exploding Gradients)`
  - `Label Flipping Attack (Reverses Fraud Labels)`
- **Defense Aggregation Algorithm Dropdown**:
  - `Standard FedAvg + Multi-Layer Anomaly Gate`
  - `Coordinate-wise Median (Byzantine-Robust)`
- **Simulate Attack Button**: Executes the simulated attack round and returns comparative metrics.

### 4.2. Coordinator Screening Verdicts (Right Top)
Displays the automated screening decisions for each bank:
- Honest banks are tagged with **`ACCEPTED`** (Emerald badge) with normal weight norm measurements ($\approx 1.2 - 2.1$).
- The compromised node is tagged with **`REJECTED`** (Rose badge) displaying the specific detection reason (e.g., *"Frobenius norm 142.8 exceeds safe threshold 15.0"* or *"Label-flip distribution divergence detected"*).

### 4.3. Side-by-Side Impact Benchmark Cards
Provides an immediate empirical comparison between defended and undefended aggregation:
- **Undefended FedAvg (Rose Card)**:
  - Displays catastrophic degradation (PR-AUC drops from $\approx 0.89$ down to $\le 0.12$).
  - Proves vulnerability of naive federated learning.
- **Defended FedAvg (TrustFL) (Emerald Card)**:
  - Displays resilient performance (PR-AUC preserved at $\approx 0.88 - 0.91$).
  - Confirms complete mitigation of the attack vector.

### 4.4. Paradigm Comparison Matrix (Bottom Table)
Compares five architectural paradigms across PR-AUC, ROC-AUC, F1-Score, Poisoning Defense, and Data Privacy:

| Paradigm | PR-AUC | ROC-AUC | F1-Score | Poisoning Defense | Data Privacy |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Standalone Bank A Model** | 0.8120 | 0.8850 | 0.7910 | Local Only (N/A) | 100% Isolated |
| **Standalone Bank B Model** | 0.7840 | 0.8620 | 0.7630 | Local Only (N/A) | 100% Isolated |
| **Standalone Bank C Model** | 0.7610 | 0.8410 | 0.7420 | Local Only (N/A) | 100% Isolated |
| **Undefended FedAvg (Under Attack)** | 0.1140 | 0.5210 | 0.0820 | 0% (Vulnerable) | Protected |
| **TrustFL Defended FedAvg** | **0.8940** | **0.9410** | **0.8810** | **100% Mitigated** | **100% Protected** |

---

## 5. Backend REST Contracts

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/simulate-attack` | Simulates an adversarial round and evaluates defended vs undefended metrics. |
| `GET` | `/api/model-comparison` | Returns benchmark comparison across standalone, undefended, and defended models. |

### Sample Attack Simulation Request:
```json
{
  "attacker_bank": "bank_c",
  "attack_type": "scale_poison",
  "defense_strategy": "coordinate_median"
}
```

### Sample Response:
```json
{
  "screening_results": [
    {"bank_id": "bank_a", "status": "ACCEPTED", "reason": "Weight norm 1.41 within nominal bounds"},
    {"bank_id": "bank_b", "status": "ACCEPTED", "reason": "Weight norm 1.39 within nominal bounds"},
    {"bank_id": "bank_c", "status": "REJECTED", "reason": "Weight norm 141.2 exceeds safe threshold 15.0"}
  ],
  "ordinary_fedavg_metrics": { "pr_auc": 0.0982, "roc_auc": 0.5120, "f1_score": 0.0710 },
  "defended_fedavg_metrics": { "pr_auc": 0.8941, "roc_auc": 0.9412, "f1_score": 0.8804 },
  "defense_summary": "TrustFL multi-layer defense successfully flagged Bank C's scaled update. The poisoned tensor was quarantined before aggregation, preserving global model PR-AUC at 0.8941."
}
```

---

## 6. Recommended Operator Walkthrough

1. Select **Bank C (Retail Payments)** as the compromised node.
2. Select **100x Scale Weight Poisoning (Exploding Gradients)**.
3. Keep the defense strategy as **Coordinate-wise Median**.
4. Click **Simulate Attack**.
5. Inspect the **Screening Verdicts**: Bank C will display in red with a status of `REJECTED`.
6. Contrast the metrics cards: Notice how undefended FedAvg collapses to nearly zero predictive power, while TrustFL maintains near-optimal PR-AUC.
