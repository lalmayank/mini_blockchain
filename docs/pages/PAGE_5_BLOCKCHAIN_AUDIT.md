# Page 5: Blockchain & Transaction Explorer

## 1. Overview & Regulatory Imperative

In federated banking consortia, financial regulators (such as the OCC, FINRA, ECB, and Basel Committee) require absolute non-repudiation, tamper-evidence, and forensic traceability. It is not enough to claim that models were trained ethically or that poisoned updates were discarded; institutions must provide mathematical proof.

The **Blockchain Audit Explorer** connects the federated learning coordinator directly to an Ethereum Virtual Machine (EVM) smart contract named `FraudAudit.sol`. Every completed federated learning round is committed permanently on-chain, creating an unalterable, chronological ledger of all participating bank weight hashes, screening verdicts, multi-sig quorum approvals, and resulting global model states.

---

## 2. Smart Contract Architecture: `FraudAudit.sol` (Multi-Sig Consortium Edition)

```text
               [ Solidity Smart Contract: FraudAudit.sol ]
            Deployed on Ethereum Sepolia Testnet (EIP-1559)
                              │
  ┌───────────────────────────┼───────────────────────────┐
  ▼                           ▼                           ▼
[ Multi-Sig Quorum Gate ]   [ Gas & Cost Tracker ]      [ Verification Gate ]
- 2-of-3 Bank Consensus    - Pre-estimate gas          function verifyGlobalModel(
- proposeRound() by Coord   - Effective gas price       uint256 roundId,
- approveRound() by Banks   - Round fee in Sepolia ETH  string memory modelHash
- rejectRound() by Banks    - USD cost equivalent       ) external view returns (bool)
```

### Core On-Chain Data Structures

```solidity
struct Submission {
    string bankId;
    string weightsHash;
    uint256 sampleCount;
    string decision; // "ACCEPTED" or "REJECTED"
    string reason;
    uint256 timestamp;
}

struct RoundAudit {
    uint256 roundId;
    string globalModelHash;
    string defenseStrategy;
    uint256 timestamp;
    bool isProposed;
    bool isFinalized;
    uint256 approvalCount;
    uint256 rejectionCount;
    Submission[] submissions;
}
```

### Multi-Bank Quorum Consensus ($M$-of-$N$)
- **Two-Phase Commit**:
  1. **Phase 1 (Proposal)**: Coordinator broadcasts `proposeRound(...)` with client update proofs and screening decisions. State is set to `isProposed = true, isFinalized = false`.
  2. **Phase 2 (Consensus Approval)**: Member banks inspect local validation performance and call `approveRound(roundId)` with their individual MetaMask keys.
  3. **Automatic Finalization**: When `approvalCount >= requiredApprovals` (default: 2 of 3 banks), the contract sets `isFinalized = true` and updates `activeGlobalModelHash`.

---

## 3. UI Components & Web3 MetaMask Integration

### 3.1. Top Navigation Header MetaMask Integration
- **Connect MetaMask Button**: Prompts the browser extension to connect using EIP-1193 (`window.ethereum`).
- **Automatic Sepolia Network Guard**: Checks network `chainId`. If on Mainnet or another network, automatically prompts a 1-click switch to **Sepolia Testnet** (`0xaa36a7` / `11155111`).
- **Dynamic Role Badge**: Automatically compares connected wallet against consortium addresses:
  - `Coordinator Notary`
  - `Bank A Authorized Signer`
  - `Bank B Authorized Signer`
  - `Bank C Authorized Signer`
  - `Public Auditor`
- **Live Wallet Balance**: Displays real-time Sepolia testnet ETH balance.

### 3.2. Consortium Gas & Network Analytics Card (Top of Page 5)
Provides real-time visibility into the computational and monetary cost of on-chain compliance:
- **Gas Used / Round**: Exact compute units burned (e.g. `894,818` units).
- **Effective Gas Price**: Live EIP-1559 base fee + priority tip (in Gwei).
- **Round Fee (ETH)**: Exact cost paid in Sepolia ETH.
- **Estimated Mainnet USD Equivalent**: Real-time projection of what the round would cost on Ethereum Mainnet ($ USD).
- **Block Confirmation Time**: Time taken for Sepolia Proof of Stake validators to seal the block ($\approx 12$ seconds).

### 3.3. Cryptographic On-Chain Model Verifier (Middle Panel)
Allows auditors to independently verify whether a set of local neural network weights currently deployed in production matches the exact weights audited on the blockchain:
- **Round ID Input**: Specifies which historical round to query.
- **SHA-256 Hash Input**: Auto-populates with the active global model's fingerprint, or accepts any 64-character hash pasted by an auditor.
- **"Verify On-Chain" Button**: Executes a read-only EVM smart contract call to `verifyGlobalModel(roundId, modelHash)`.
- **Verdict Banner**:
  - **Authentic (Emerald)**: Confirms candidate weights match the blockchain record down to the single bit.
  - **Tamper Detected (Rose)**: Signals that candidate weights do not match the on-chain commitment.

### 3.4. Dual Exploration Modes

#### View 1: Chain Diagram (Graphical Block Visualizer)
Renders a horizontal visual blockchain graph showing blocks linked together by SHA-256 cryptographic hashes:
- **Block #0 (Genesis)**: Represents architecture initialization and smart contract deployment.
- **Block #1, #2, #3, ... (Rounds)**:
  - Color-coded security pill: **`ALL ACCEPTED`** (Emerald) vs. **`POISON DEFENDED`** (Rose).
  - Displays participating client count and EVM block number.
- **Forensic Block Inspector**: Clicking any block opens an interactive forensic card displaying:
  - Full 64-character Global Model State SHA-256 Hash.
  - On-Chain EVM Transaction Hash with a **clickable Sepolia Etherscan link** (`https://sepolia.etherscan.io/tx/...`).
  - **Multi-Bank Quorum Approval Bar**: Displays quorum voting status and provides a **"Sign & Approve Round (MetaMask)"** button for authorized bank signers.
  - Client Submission Proofs Grid: Shows each bank's update hash, along with its specific screening decision (`ACCEPTED` or `REJECTED`) and screening explanation.

#### View 2: Ledger Table (Tabular Audit View)
A compact monospace table designed for audit reporting:
- Columns: *Round ID*, *Defense Strategy*, *Global Model Hash*, *Bank Submissions & Verdicts*, and *On-Chain Transaction & Block Number (with Etherscan external link)*.

---

## 4. Backend REST Contracts & Web3 Integration

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/audit/rounds` | Returns the complete chronological history of on-chain audited rounds. |
| `POST` | `/api/audit/verify` | Queries the smart contract to verify a round's SHA-256 model fingerprint. |
| `GET` | `/api/audit/config` | Returns deployed contract address, ABI, network name, and registered bank addresses. |
| `GET` | `/api/audit/gas-metrics` | Returns cumulative gas used, latest gas price in Gwei, fee in ETH, and block time. |
| `POST` | `/api/audit/approve` | Submits an on-chain quorum approval vote on behalf of a bank. |

### Sample Gas Metrics Response (`GET /api/audit/gas-metrics`):
```json
{
  "cumulative_gas_used": 894818,
  "latest_gas_price_gwei": 1.0,
  "latest_tx_fee_eth": 0.000895,
  "estimated_usd_cost": 2.3713,
  "block_confirmation_time_sec": 12.0,
  "network": "Ethereum Sepolia Testnet (EIP-1559)",
  "consensus": "Proof of Stake (PoS) + 2-of-3 Bank Quorum"
}
```

---

## 5. Audit & Compliance Workflow

1. **Connecting via MetaMask**:
   - Open the web console and click **"Connect MetaMask"** in the top header.
   - MetaMask prompts approval and ensures you are on the Sepolia Testnet.
   - The UI identifies your account (e.g. *Bank A Authorized Signer*).
2. **Reviewing and Approving a Proposed Round**:
   - Navigate to **Blockchain Audit**.
   - Select the latest round.
   - Click **"Sign & Approve Round (MetaMask)"**.
   - MetaMask opens a transaction prompt, signing the approval on-chain.
   - Once 2 out of 3 bank approvals are recorded, the smart contract automatically sets `isFinalized = true`.
3. **Public Verification on Sepolia Etherscan**:
   - Click the **Sepolia Etherscan** link next to the transaction hash to open the public explorer.
   - Inspect the transaction details, gas burned, block timestamp, and emitted `RoundFinalized` events directly on the Ethereum network.
