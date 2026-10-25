import os
import json
import time
import argparse
import torch
import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score

from src.model import GlobalFraudMLP, get_state_dict_hash
from src.defense import (
    screen_client_updates,
    aggregate_fedavg,
    aggregate_coordinate_median
)
from src.common_preprocessing import (
    load_bank_a_common,
    load_bank_b_common,
    load_bank_c_common
)

def run_coordinator():
    parser = argparse.ArgumentParser(description="CrossBank TrustFL - Coordinator Engine")
    parser.add_argument("--round", type=int, default=1, help="Federated round to aggregate")
    parser.add_argument("--defense", type=str, default="fedavg", choices=["fedavg", "coordinate_median"],
                        help="Aggregation method: standard fedavg or byzantine-robust coordinate_median")
    parser.add_argument("--norm-mult", type=float, default=3.0, help="Outlier norm threshold multiplier")
    parser.add_argument("--init-only", action="store_true", help="Only initialize round 0 global model")
    args = parser.parse_args()

    os.makedirs("checkpoints", exist_ok=True)
    global_model_path = os.path.join("checkpoints", "global_model.pt")

    # If initializing
    if args.init_only or not os.path.exists(global_model_path):
        print("=" * 65)
        print(" [Coordinator] Initializing Initial Global Model (Round 0)")
        print("=" * 65)
        init_model = GlobalFraudMLP(input_dim=16)
        init_hash = get_state_dict_hash(init_model.state_dict())
        torch.save({
            "round": 0,
            "weights_hash": init_hash,
            "state_dict": init_model.state_dict()
        }, global_model_path)
        print(f"Initial Global Model created: {global_model_path}")
        print(f"Initial Model Hash (SHA-256): {init_hash}\n")
        if args.init_only:
            return

    print("=" * 65)
    print(f" [Coordinator Engine] Processing Federated Round {args.round}")
    print(f" Defense Strategy: {args.defense.upper()}")
    print("=" * 65)

    # 1. Collect client update files
    banks = ["bank_a", "bank_b", "bank_c"]
    client_updates = []
    for b in banks:
        update_file = os.path.join("checkpoints", f"update_{b}_r{args.round}.pt")
        if not os.path.exists(update_file):
            print(f"[!] Warning: Update file for {b} not found ({update_file}). Skipping.")
            continue
        data = torch.load(update_file, weights_only=True)
        # Verify hash integrity
        calculated_hash = get_state_dict_hash(data["state_dict"])
        if calculated_hash != data["weights_hash"]:
            print(f"[X] Hash mismatch for {b}! Recorded: {data['weights_hash']} != Computed: {calculated_hash}")
            continue
        client_updates.append(data)

    if not client_updates:
        print("[!] No valid updates found to aggregate. Aborting.")
        return

    print(f"Received {len(client_updates)} client model update(s). Running Defense Screening...")

    # 2. Defense Screening
    screening_results = screen_client_updates(client_updates, norm_threshold_multiplier=args.norm_mult)

    accepted_updates = []
    print("\n--- DEFENSE VALIDATION AUDIT ---")
    for res in screening_results:
        bank = res["bank_id"]
        status = res["status"]
        reason = res["reason"]
        norm = res["norm"]
        print(f"  * {bank.upper():<8} -> [{status}] (Weight Norm: {norm:.2f}) | {reason}")
        if status == "ACCEPTED":
            for u in client_updates:
                if u["bank_id"] == bank:
                    accepted_updates.append(u)

    if not accepted_updates:
        print("\n[!] All client updates were rejected by defense screening! Global model remains unchanged.")
        return

    # 3. Aggregation
    print(f"\nAggregating {len(accepted_updates)} accepted update(s) using {args.defense.upper()}...")
    if args.defense == "coordinate_median":
        new_state_dict = aggregate_coordinate_median(accepted_updates)
    else:
        new_state_dict = aggregate_fedavg(accepted_updates)

    new_global_hash = get_state_dict_hash(new_state_dict)
    print(f"New Global Model Computed! SHA-256 Hash: {new_global_hash}")

    # 4. Save New Global Model
    round_save_path = os.path.join("checkpoints", f"global_model_r{args.round}.pt")
    torch.save({
        "round": args.round,
        "weights_hash": new_global_hash,
        "state_dict": new_state_dict,
        "defense": args.defense,
        "accepted_banks": [u["bank_id"] for u in accepted_updates]
    }, round_save_path)
    torch.save({
        "round": args.round,
        "weights_hash": new_global_hash,
        "state_dict": new_state_dict
    }, global_model_path)
    print(f"Saved: {round_save_path} and {global_model_path}")

    # 5. Cross-Bank Benchmark Evaluation
    print("\nEvaluating New Global Model on Cross-Bank Validation Benchmark...")
    eval_model = GlobalFraudMLP(input_dim=16)
    eval_model.load_state_dict(new_state_dict)
    eval_model.eval()

    # Load 5,000 samples from each bank to test universal generalization
    eval_results = {}
    for b_id, loader_fn in [("Bank_A", load_bank_a_common), ("Bank_C", load_bank_c_common)]:
        X_sub, y_sub = loader_fn()
        with torch.no_grad():
            preds = torch.sigmoid(eval_model(torch.tensor(X_sub[:10000], dtype=torch.float32)).squeeze(-1)).numpy()
        pr_auc = average_precision_score(y_sub[:10000], preds)
        eval_results[b_id] = float(pr_auc)
        print(f"  - Performance on {b_id} validation subset (PR-AUC): {pr_auc:.4f}")

    # 6. Commit to Blockchain Audit Contract
    print("\nCommitting Audit Record to Solidity Smart Contract (Blockchain)...")
    try:
        from blockchain.blockchain_service import BlockchainAuditService
        auditor = BlockchainAuditService()
        chain_res = auditor.record_round_on_chain(
            round_id=args.round,
            defense_strategy=args.defense.upper(),
            global_model_hash=new_global_hash,
            submissions=[
                {
                    "bank_id": u["bank_id"],
                    "weights_hash": u["weights_hash"],
                    "sample_count": u["sample_count"],
                    "decision": next((r["status"] for r in screening_results if r["bank_id"] == u["bank_id"]), "UNKNOWN"),
                    "reason": next((r["reason"] for r in screening_results if r["bank_id"] == u["bank_id"]), "")
                }
                for u in client_updates
            ]
        )
        print(f"  [On-Chain TX] TxHash: {chain_res['transaction_hash'][:16]}... | Block #{chain_res['block_number']} | Gas Used: {chain_res['gas_used']:,}")
    except Exception as e:
        print(f"  [!] Blockchain commit warning: {e}")
        chain_res = {}

    # 7. Generate Off-chain Audit Record Backup
    audit_entry = {
        "timestamp": int(time.time()),
        "round_id": args.round,
        "defense_strategy": args.defense,
        "blockchain_receipt": chain_res,
        "client_submissions": [
            {
                "bank_id": u["bank_id"],
                "weights_hash": u["weights_hash"],
                "sample_count": u["sample_count"],
                "decision": next((r["status"] for r in screening_results if r["bank_id"] == u["bank_id"]), "UNKNOWN"),
                "reason": next((r["reason"] for r in screening_results if r["bank_id"] == u["bank_id"]), "")
            }
            for u in client_updates
        ],
        "resulting_global_model_hash": new_global_hash,
        "evaluation_metrics": eval_results
    }

    ledger_path = os.path.join("checkpoints", "audit_ledger.json")
    ledger = []
    if os.path.exists(ledger_path):
        try:
            with open(ledger_path, "r") as f:
                ledger = json.load(f)
        except Exception:
            ledger = []
    ledger.append(audit_entry)
    with open(ledger_path, "w") as f:
        json.dump(ledger, f, indent=2)

    print(f"\n[Audit Record Committed] Written to {ledger_path}")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    run_coordinator()
