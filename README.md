# CrossBank TrustFL 🛡️🏦
**Blockchain-Audited Federated Learning for Privacy-Preserving Cross-Bank Fraud Detection and Byzantine Defense**

CrossBank TrustFL enables multiple financial institutions (Bank A, Bank B, Bank C) to collaboratively train a high-performance fraud detection model without sharing private raw transaction data, while providing automated Byzantine fault defense and immutable cryptographic audit trails on an EVM smart contract.

---

## 🏛️ System Architecture

```text
[Bank A: Credit Card]     [Bank B: PaySim Mobile]     [Bank C: BankSim Payments]
       │                            │                            │
       └────────────────────┬───────┴────────────────────────────┘
                            │ (Local Model Updates & Weights Only)
                            ▼
               [ Federated Coordinator & Defense ]
               - Tensor Sanity Checks (NaN / Inf)
               - Frobenius Norm Anomaly Detection
               - Byzantine Poisoning Defense (Median / FedAvg)
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      [ Global Fraud Model ]    [ Blockchain Audit Layer ]
      16-D Standardized MLP      Solidity Smart Contract (EVM)
      Precision / Recall / F1    SHA-256 Commitments & Proofs
```

---

## 🚀 Key Features

1. **Privacy-Preserving Federated Learning (FedAvg)**: Banks keep their sensitive transaction data local; only serialized weight gradients are transmitted.
2. **Standardized Representation**: Maps heterogeneous banking datasets (Credit Card, PaySim, BankSim) into a unified 16-dimensional behavioral feature space.
3. **Byzantine & Poisoning Defense**: Multi-tier defense engine detects and rejects malicious updates (scaling attacks, label-flipping, noise injection).
4. **Blockchain Audit Trail**: All model round identifiers, participant weight hashes, defense validation decisions (`ACCEPTED` / `REJECTED`), and global model state hashes are committed to an Ethereum Virtual Machine (EVM) smart contract.
5. **Interactive Full-Stack Web Console**:
   - **Page 1: Overview Dashboard**: Global model version, participating clients, live metrics, audit status.
   - **Page 2: Federated Training**: Orchestrate training rounds with real-time log telemetry.
   - **Page 3: Fraud Explorer**: Test live predictions with both a 6-question Plain-English Banking Wizard and manual 16-D inputs, plus dataset benchmark evaluation.
   - **Page 4: Trust & Security Lab**: Simulate adversarial attacks and compare defended vs. undefended FedAvg performance.
   - **Page 5: Blockchain Explorer**: Visual block-chain node graph with cryptographic verification tools.

---

## 📦 Project Structure

```text
├── backend/                  # Modular FastAPI backend
│   ├── api/                  # REST endpoints (status, training, fraud, security, audit)
│   ├── coordinator/          # Asynchronous round execution engine
│   ├── services/             # PyTorch inference and Web3 blockchain integration
│   └── main.py               # FastAPI entrypoint with CORS
├── blockchain/               # Smart contract & EVM infrastructure
│   ├── contracts/            # Solidity contract (FraudAudit.sol)
│   └── blockchain_service.py # EVM deployment & transaction signing via web3.py / py-evm
├── frontend/                 # Next.js 16 (App Router) + Tailwind CSS + Lucide Icons
│   ├── app/                  # UI pages, tabs, interactive wizards, block graph
│   └── package.json          # Frontend dependencies
├── src/                      # Core ML & Defense logic
│   ├── common_preprocessing.py # 16-D universal feature transformer
│   ├── defense.py            # Robust aggregation & anomaly detection
│   └── model.py              # GlobalFraudMLP neural network & SHA-256 state hashing
├── checkpoints/              # Model weights and audit ledgers
├── coordinator.py            # FL Coordinator orchestration script
├── federated_client.py       # Bank client training & attack simulation script
├── run_backend.py            # Backend server runner (port 8000)
├── requirements.txt          # Python dependencies
└── .gitignore                # Git exclusions
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- Python 3.10+ (Recommended: Python 3.11 - 3.13)
- Node.js 18+ and `pnpm` (or `npm`)

### 2. Python Environment Setup
```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Launch the Backend Server
```powershell
python run_backend.py
```
*Backend runs at `http://127.0.0.1:8000` (Swagger docs at `/docs`).*

### 4. Launch the Frontend UI
In a separate terminal:
```powershell
cd frontend
pnpm install
pnpm dev
```
*Frontend runs at `http://localhost:3000`.*

---

## 🛡️ Security & Defense Aggregation

| Defense Stage | Purpose | Method |
|---|---|---|
| **Layer 1** | Tensor Sanity Check | Detects and drops `NaN`, `Inf`, or malformed tensors |
| **Layer 2** | Weight Anomaly Detection | Computes Frobenius norms of weight diffs to catch scaled poisoning |
| **Layer 3** | Robust Aggregation | Coordinate-wise Median or Sample-weighted FedAvg |
| **Layer 4** | Audit Commitment | Hashes local & global weights with SHA-256 and commits to EVM contract |

---

## 📄 License
MIT License
