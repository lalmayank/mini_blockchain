# Page 3: Fraud Detection & Intelligence Explorer

## 1. Overview & Purpose

The **Fraud Detection & Intelligence Explorer** enables risk analysts, fraud investigators, and ML researchers to evaluate the global collaborative model on live individual transactions as well as large-scale held-out benchmark splits.

It provides a bridge between complex 16-dimensional continuous tensor embeddings and practical banking domain language. Analysts can inspect pre-configured real-world fraud cases, test custom hypothetical transaction scenarios using a **Plain-English Guided Form**, or tune raw mathematical vectors using the **Direct 16-D Advanced Mode**.

---

## 2. Neural Architecture: `GlobalFraudMLP`

The active global model evaluated on this page is a Multi-Layer Perceptron designed specifically for federated tabular financial fraud detection:

```text
  Input Layer (16 Dimensions)
      │
      ▼
  Linear(16 → 64) + BatchNorm1d(64) + LeakyReLU(0.1) + Dropout(0.2)
      │
      ▼
  Linear(64 → 32) + BatchNorm1d(32) + LeakyReLU(0.1) + Dropout(0.1)
      │
      ▼
  Linear(32 → 1)  + Sigmoid
      │
      ▼
  Output Fraud Probability P(Fraud) ∈ [0.0, 1.0]
```

### 16-Dimensional Universal Feature Vector Space
To allow disparate banking datasets to feed into a single unified architecture, raw transaction records are transformed into 16 standardized features:

| Index | Feature Name | Description & Mathematical Encoding |
| :---: | :--- | :--- |
| `0` | `amt_norm` | Min-Max normalized transaction amount $\in [0, 1]$. |
| `1` | `amt_log` | Logarithm of transaction amount: $\log_{10}(\text{amount} + 1.0)$. |
| `2` | `is_high_amt` | Binary indicator ($1.0$ if amount $\ge \$5,000$, else $0.0$). |
| `3` | `hour_sin` | Cyclical time of day: $\sin(2\pi \cdot \text{hour} / 24)$. |
| `4` | `hour_cos` | Cyclical time of day: $\cos(2\pi \cdot \text{hour} / 24)$. |
| `5` | `day_sin` | Cyclical day of week: $\sin(2\pi \cdot \text{day} / 7)$. |
| `6` | `day_cos` | Cyclical day of week: $\cos(2\pi \cdot \text{day} / 7)$. |
| `7` | `velocity_proxy` | Frequency velocity index (number of transactions within preceding 1-hour window). |
| `8` | `high_risk_channel` | Channel indicator ($1.0$ for international wire/cash-out, $0.0$ for domestic/POS). |
| `9` | `rapid_outflow` | Outflow speed ratio (funds transferred within 5 minutes of deposit). |
| `10` | `ratio_to_median` | Ratio of current transaction amount to the account's historical 30-day median. |
| `11` | `zero_bal_after` | Account draining indicator ($1.0$ if destination balance reaches $\$0.00$). |
| `12` | `heuristic_risk` | Compound heuristic risk score combining geo-velocity and mismatch flags. |
| `13` | `outflow_dir` | Transfer direction ($1.0$ for outgoing transfer, $0.0$ for incoming deposit). |
| `14` | `inst_scale` | Institutional scale factor ($0.8$ for wire/cross-bank, $0.5$ for local ATM). |
| `15` | `deviation_score` | Standard deviations away from user's historical behavioral baseline. |

---

## 3. Dual Input Modalities

### 3.1. Guided Form (Plain-English Banking Wizard)
Designed for banking compliance officers and fraud investigators who may not be machine learning specialists. Users answer 6 intuitive operational questions, which are mapped automatically in real-time into the 16-D feature vector:

1. **Transaction Amount ($ USD)**: Direct numeric input (e.g. $\$9,850$).
2. **Channel Type**: Select from *Online Card Swipe*, *Cross-Border Wire Transfer*, *Mobile Money Cash-Out*, or *Merchant POS*.
3. **Time of Day**: Select from *Daytime Normal Hours (08:00 - 20:00)* or *Unusual Odd Hours (01:00 - 05:00)*.
4. **Amount Deviation**: Toggle whether the transaction significantly exceeds the account's normal spending baseline.
5. **Account Drain Indicator**: Toggle whether the transfer empties the balance to $\$0.00$ (a classic credential-stuffing/cashing-out signal).
6. **Geographic / Device Anomaly**: Toggle whether the IP address or geo-location exhibits an impossible travel speed anomaly.

### 3.2. Direct 16-D Advanced Mode
Designed for machine learning researchers and data scientists. Provides 16 interactive sliders to fine-tune each standardized feature individually between $[-2.0, 2.0]$, allowing granular stress-testing and boundary analysis.

---

## 4. UI Components & Feature Modules

### 4.1. Benchmark Evaluation on Held-Out Test Splits (Top Panel)
Allows instant evaluation of the collaborative global model across entire held-out test splits from:
- **Bank A (Credit Card Test Split)**
- **Bank B (PaySim Mobile Money Test Split)**
- **Bank C (BankSim Retail Test Split)**

Clicking **"Run Evaluation"** computes and displays:
- **PR-AUC (Precision-Recall Area Under Curve)**: The definitive metric for extreme class imbalance in banking fraud.
- **ROC-AUC**: Overall classification separability.
- **F1-Score**: Harmonic mean of Precision and Recall.
- **Precision**: Proportion of flagged transactions that were truly fraudulent.
- **Recall**: Proportion of actual fraudulent transactions detected by the model.
- **Confusion Matrix Breakdown**: True Negatives (TN), False Positives (FP), False Negatives (FN), and True Positives (TP).

### 4.2. Preset Test Transaction Library (Left Column)
Provides quick-load scenarios across consortium banks:
- **Bank A: High-Amount Sudden Velocity Spike** (Ground Truth: `Fraud`)
- **Bank B: Rapid Mobile Cash-Out to Mule Account** (Ground Truth: `Fraud`)
- **Bank C: Ordinary Supermarket POS Swipe** (Ground Truth: `Legitimate`)
- **Bank A: Routine Utility Bill Autopay** (Ground Truth: `Legitimate`)

### 4.3. Dynamic Decision Threshold Slider ($\tau$)
Allows operators to shift the classification threshold dynamically between $0.10$ and $0.90$ (Default: $\tau = 0.50$):
- $\hat{y} = 1 \iff P(\text{Fraud}) \ge \tau$
- **Lower Threshold ($\tau \approx 0.20$)**: High recall; captures subtle fraud at the expense of more manual review false alarms.
- **Higher Threshold ($\tau \approx 0.80$)**: High precision; only flags transactions with near-certain algorithmic confidence.

### 4.4. Live Prediction Banner & Risk Tier Classification
When **"Score Selected Transaction"** is clicked, the model generates:
- **Status Verdict**: Transaction Approved (Emerald) vs. Fraud Alert Triggered (Rose).
- **Fraud Probability Gauge**: Expressed as an exact percentage ($0.0\%$ to $100.0\%$).
- **Risk Tier Badge**:
  - `CRITICAL` ($P \ge 85\%$): Automated hold placed on transaction.
  - `HIGH` ($65\% \le P < 85\%$): Routed to 2FA step-up challenge.
  - `MEDIUM` ($40\% \le P < 65\%$): Marked for asynchronous analyst review.
  - `LOW` ($P < 40\%$): Immediate straight-through processing.
- **Explanatory Diagnostic Narrative**: Plain-language explanation detailing which features drove the score.

---

## 5. Backend REST Contracts

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/predict` | Scores a single 16-D feature vector against the active global model. |
| `POST` | `/api/evaluate-dataset` | Evaluates model against Bank A, B, or C test split on disk. |
| `GET` | `/api/fraud-samples` | Fetches pre-configured transaction cases with metadata and ground truths. |

### Sample Scoring Request (`POST /api/predict`):
```json
{
  "features": [0.85, 3.99, 1.0, 0.25, 0.96, 0.0, 1.0, 0.75, 1.0, 1.0, 4.2, 1.0, 0.88, 1.0, 0.8, 0.88],
  "threshold": 0.50
}
```

### Sample Scoring Response:
```json
{
  "fraud_probability": 0.9421,
  "is_fraud": true,
  "threshold_applied": 0.50,
  "risk_tier": "CRITICAL",
  "explanation": "High fraud probability detected. Driven by extreme deviation from historical baseline, rapid balance emptying, and high-risk cross-border wire channel."
}
```

---

## 6. Recommended Testing Procedures

1. **Test a Known Fraud Case**:
   - Select **Bank B (Mobile Money Cash-Out)** from the preset list.
   - Click **Score Selected Transaction**.
   - Verify that the fraud probability exceeds $90\%$ and the alert banner displays in red.
2. **Test Custom Guided Form**:
   - Switch to **Guided Form**.
   - Enter an amount of **$9,900**.
   - Set Channel to **Cross-Border Wire Transfer**, Time to **Odd Hours (03:00)**, and check **Account Emptied to $0.00**.
   - Click **Score Selected Transaction** and observe how the plain-language inputs translate into a high-risk classification.
3. **Threshold Calibration**:
   - Drag the decision threshold slider from $0.50$ down to $0.20$ to see borderline transactions trigger step-up review.
