# CrossBank TrustFL — Platform Documentation Index

Welcome to the comprehensive technical documentation for **CrossBank TrustFL**, a privacy-preserving federated learning and blockchain-audited consortium fraud detection platform.

This directory contains in-depth architectural specifications, mathematical formulations, REST API contracts, UI component breakdowns, and operational walkthroughs for all six pages of the application.

---

## 📑 Page Documentation Directory

| Page # | Document Link | Focus Area | Key Technologies & Algorithms |
| :---: | :--- | :--- | :--- |
| **01** | [Page 1: Overview & Dashboard](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_1_OVERVIEW_DASHBOARD.md) | Executive Cockpit & Telemetry | Consortium KPI Cards, Live Health Polling, SHA-256 Model Fingerprinting |
| **02** | [Page 2: Federated Learning Hub](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_2_FEDERATED_LEARNING.md) | Distributed Training Console | Sample-Weighted FedAvg, Coordinate-wise Median, Asynchronous Pipeline |
| **03** | [Page 3: Fraud Explorer](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_3_FRAUD_EXPLORER.md) | Dual-Mode Real-Time Inference | 16-D `GlobalFraudMLP`, Banking Wizard Form, PR-AUC / Confusion Matrix |
| **04** | [Page 4: Trust & Security Lab](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_4_TRUST_AND_SECURITY.md) | Byzantine Defense & Attacks | 100x Scale Poisoning, Label-Flipping, Dynamic Frobenius Norm Anomaly Gate |
| **05** | [Page 5: Blockchain Explorer](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_5_BLOCKCHAIN_AUDIT.md) | On-Chain Audit Trails | Solidity EVM Smart Contract (`FraudAudit.sol`), Graphical Block DAG, Verification |
| **06** | [Page 6: Algorithms & Heuristics](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_6_ALGORITHMS_AND_HEURISTICS.md) | Graph Search, Forensics & AI | BFS Mule Layering, DFS Cycles, A* Pathfinding, Benford's Law, Bayesian Networks |

---

## 🏛️ High-Level System Architecture

```text
  ┌─────────────────────────────────────────────────────────────┐
  │                   Consortium Banking Nodes                  │
  │     Bank A (Cards)     Bank B (Mobile)     Bank C (Retail)  │
  └───────────────┬─────────────────┬───────────────────┬───────┘
                  │                 │                   │
                  │ (Local Weights) │ (Local Weights)   │ (Local Weights)
                  ▼                 ▼                   ▼
  ┌─────────────────────────────────────────────────────────────┐
  │         Federated Coordinator & Defense Screening           │
  │         - NaN / Inf / Dimension Validation Gate             │
  │         - Dynamic Frobenius Norm Outlier Threshold          │
  │         - Robust Coordinate-wise Median Aggregator          │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
  ┌─────────────────────────────────┐   ┌───────────────────────────────┐
  │     Active Global Model MLP     │   │      Solidity Smart Contract  │
  │  16-D Standardized Embeddings   │   │      FraudAudit.sol (EVM)     │
  │  Weight Hash: SHA-256 Digest    │   │      Immutable Audit Records  │
  └─────────────────────────────────┘   └───────────────────────────────┘
                   │                                   │
                   └─────────────────┬─────────────────┘
                                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              Interactive Web UI (Next.js 16)                │
  │  - Page 1: Overview & Telemetry                             │
  │  - Page 2: Training Hub & Live Terminal Logs                │
  │  - Page 3: Dual-Mode Fraud Prediction & Dataset Evaluation  │
  │  - Page 4: Adversarial Simulation & Defense Benchmarking    │
  │  - Page 5: Blockchain DAG & Cryptographic Verifier          │
  │  - Page 6: AI Graph Search, Benford's Law & Bayesian DAG    │
  └─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Navigation

- For **auditors and compliance teams**: Consult [Page 5: Blockchain Audit](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_5_BLOCKCHAIN_AUDIT.md) and [Page 6: Algorithms & Heuristics](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_6_ALGORITHMS_AND_HEURISTICS.md).
- For **machine learning engineers**: Consult [Page 2: Federated Learning](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_2_FEDERATED_LEARNING.md) and [Page 3: Fraud Explorer](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_3_FRAUD_EXPLORER.md).
- For **security and threat modeling teams**: Consult [Page 4: Trust & Security Lab](file:///C:/Users/lalma/Downloads/models/docs/pages/PAGE_4_TRUST_AND_SECURITY.md).
