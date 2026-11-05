# Page 5: Blockchain & Transaction Explorer

## 1. Overview & Regulatory Imperative

In federated banking consortia, financial regulators (such as the OCC, FINRA, ECB, and Basel Committee) require absolute non-repudiation, tamper-evidence, and forensic traceability. It is not enough to claim that models were trained ethically or that poisoned updates were discarded; institutions must provide mathematical proof.

The **Blockchain Audit Explorer** connects the federated learning coordinator directly to an Ethereum Virtual Machine (EVM) smart contract named `FraudAudit.sol`. Every completed federated learning round is committed permanently on-chain, creating an unalterable, chronological ledger of all participating bank weight hashes, screening verdicts, and resulting global model states.

---

## 2. Smart Contract Architecture: `FraudAudit.sol`

```text
               [ Solidity Smart Contract: FraudAudit.sol ]
            Deployed at: 0xF2E246BB76DF876Cef8b38ae84130F4F55De395b
                              │
  ┌───────────────────────────┼───────────────────────────┐
  ▼                           ▼                           ▼
[ Record Storage ]    [ Access Control ]          [ Verification Gate ]
struct RoundAudit {   onlyCoordinator modifier    function verifyGlobalModel(
  uint256 roundId,    Signer Address:               uint256 roundId,
  string modelHash,   0x7E5F455209...Bdf            string memory modelHash
  string defense,     (Authorized notary only)    ) external view returns (bool)
  ClientProof[] proofs,                           { return rounds[roundId]
  uint256 timestamp                                        .modelHash == hash; }
}
```

### Core On-Chain Data Structures

```solidity
struct ClientSubmission {
    string bankId;
    string updateHash;
    string decision; // "ACCEPTED" or "REJECTED"
    string reason;
}

struct RoundRecord {
    uint256 roundId;
    string defenseStrategy;
    string globalModelHash;
    ClientSubmission[] submissions;
    uint256 blockTimestamp;
    address coordinator;
}
```

- **Authorized Round Notary**: Only the verified coordinator address (`0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`) has permissions to write new round records to the contract.
- **State Immutability**: Once written, a round's parameters cannot be altered, overwritten, or deleted by any participant, including the bank members or the coordinator.

---

## 3. UI Components & Inspection Views

### 3.1. Infrastructure Overview Cards (Top)
Displays the fundamental Web3 network configuration:
1. **Smart Contract Address**: Displays `0xF2E246BB76DF876Cef8b38ae84130F4F55De395b` with one-click copy functionality.
2. **Coordinator Signer**: Displays the authorized Ethereum keypair address (`0x7E5F455209...Bdf`) responsible for notarizing training rounds.
3. **Consensus Layer**: Displays EVM local blockchain state running with `web3.py` and `py-evm`.

### 3.2. Cryptographic On-Chain Model Verifier (Middle Panel)
Allows auditors to independently verify whether a set of local neural network weights currently deployed in production matches the exact weights audited on the blockchain:
- **Round ID Input**: Specifies which historical round to query.
- **SHA-256 Hash Input**: Auto-populates with the active global model's fingerprint, or accepts any 64-character hash pasted by an auditor.
- **"Verify On-Chain" Button**: Executes a read-only EVM smart contract call to `verifyGlobalModel(roundId, modelHash)`.
- **Verdict Banner**:
  - **Authentic (Emerald)**: Confirms the candidate weights match the blockchain record down to the single bit.
  - **Tamper Detected (Rose)**: Signals that the candidate weights do not match the on-chain commitment, indicating unauthorized tampering, model degradation, or man-in-the-middle corruption.

### 3.3. Dual Exploration Modes

The page offers two complementary views: **Chain Diagram (Visual)** and **Ledger Table**.

#### View 1: Chain Diagram (Graphical Block Visualizer)
Renders a horizontal visual blockchain graph showing blocks linked together by SHA-256 cryptographic hashes:
- **Block #0 (Genesis)**: Represents architecture initialization and smart contract deployment.
- **Block #1, #2, #3, ... (Rounds)**:
  - Each block displays Round ID, Defense Strategy, and resulting global model hash slice.
  - Color-coded security pill: **`ALL ACCEPTED`** (Emerald) vs. **`POISON DEFENDED`** (Rose).
  - Shows participating client count and EVM block number.
- **Forensic Block Inspector**: Clicking any block opens an interactive forensic card displaying:
  - Full 64-character Global Model State SHA-256 Hash.
  - On-Chain EVM Transaction Receipt Hash (`0x...`).
  - Client Submission Proofs Grid: Shows each bank's update hash, along with its specific screening decision (`ACCEPTED` or `REJECTED`) and screening explanation.

#### View 2: Ledger Table (Tabular Audit View)
A compact, searchable monospace table designed for audit reporting:
- Columns: *Round ID*, *Defense Strategy*, *Global Model Hash*, *Bank Submissions & Verdicts*, and *On-Chain Transaction & Block Number*.

---

## 4. Backend REST Contracts & Web3 Integration

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/audit-rounds` | Returns the complete chronological history of on-chain audited rounds. |
| `POST` | `/api/verify-hash` | Queries the smart contract to verify a round's SHA-256 model fingerprint. |

### Sample Verification Request (`POST /api/verify-hash`):
```json
{
  "round_id": 2,
  "model_hash": "a4f89d31e9c2049c81b94236e89647230491845f9393a52861c892e850bdf602"
}
```

### Sample Verification Response:
```json
{
  "round_id": 2,
  "submitted_hash": "a4f89d31e9c2049c81b94236e89647230491845f9393a52861c892e850bdf602",
  "on_chain_hash": "a4f89d31e9c2049c81b94236e89647230491845f9393a52861c892e850bdf602",
  "is_valid_on_chain": true,
  "block_number": 2,
  "transaction_hash": "0x4b9a12c8e01f2...5910"
}
```

---

## 5. Audit & Compliance Workflow

1. **Verify Current Production Model**:
   - Navigate to **Blockchain Audit**.
   - The verification input defaults to Round 1 and the active model's hash.
   - Click **Verify On-Chain** and observe the green **Authentic** confirmation.
2. **Simulate Model Tampering**:
   - Change a single hexadecimal character in the hash input (e.g. change an `a` to a `b`).
   - Click **Verify On-Chain**.
   - The verifier immediately triggers the red **Tamper Detected** warning, demonstrating mathematical zero-trust integrity.
3. **Forensic Round Inspection**:
   - Switch between **Chain Diagram** and **Ledger Table**.
   - Click on a round where a poisoning attack occurred (e.g., Round #2 or #3).
   - Expand the block inspector to review the exact SHA-256 update hash of the attacking bank and verify that its status was recorded on-chain as `REJECTED`.
