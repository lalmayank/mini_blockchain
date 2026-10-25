import os
import threading
import time
from typing import Dict, Any, Optional

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
from backend.services.chain_service import chain_service
from backend.services.model_service import model_service
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

class CoordinatorEngine:
    """Manages asynchronous federated learning training rounds and malicious attacks."""
    def __init__(self):
        self.lock = threading.Lock()
        self.job_status = {
            "status": "IDLE", # IDLE, RUNNING, COMPLETED, FAILED
            "round_id": 0,
            "progress_percent": 0,
            "current_step": "Ready for training",
            "logs": [],
            "last_result": None
        }

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            return dict(self.job_status)

    def trigger_round(
        self,
        round_id: int,
        defense_strategy: str = "fedavg",
        epochs: int = 1,
        attack_bank: Optional[str] = None,
        attack_type: str = "none"
    ) -> Dict[str, Any]:
        with self.lock:
            if self.job_status["status"] == "RUNNING":
                return {"error": "A federated round is already in progress.", "round_id": self.job_status["round_id"]}

            self.job_status = {
                "status": "RUNNING",
                "round_id": round_id,
                "progress_percent": 5,
                "current_step": f"Initiating Round {round_id} across 3 Banks",
                "logs": [f"Round {round_id} initiated with Defense Strategy: {defense_strategy.upper()}"],
                "last_result": None
            }

        # Run in background daemon thread
        t = threading.Thread(
            target=self._execute_round_pipeline,
            args=(round_id, defense_strategy, epochs, attack_bank, attack_type),
            daemon=True
        )
        t.start()
        return {"message": f"Federated Round {round_id} launched successfully in background.", "round_id": round_id}

    def _log(self, msg: str, progress: int = None):
        with self.lock:
            self.job_status["logs"].append(msg)
            self.job_status["current_step"] = msg
            if progress is not None:
                self.job_status["progress_percent"] = progress

    def _execute_round_pipeline(
        self,
        round_id: int,
        defense_strategy: str,
        epochs: int,
        attack_bank: Optional[str],
        attack_type: str
    ):
        try:
            os.makedirs("checkpoints", exist_ok=True)
            global_model_path = os.path.join("checkpoints", "global_model.pt")

            # 1. Load initial model
            self._log("Fetching current global model parameters...", 15)
            global_model = GlobalFraudMLP(input_dim=16)
            if os.path.exists(global_model_path):
                ckpt = torch.load(global_model_path, weights_only=True)
                s_dict = ckpt["state_dict"] if "state_dict" in ckpt else ckpt
                global_model.load_state_dict(s_dict)

            # 2. Train Bank Clients
            bank_configs = [
                ("bank_a", "Bank A (Credit Card)", load_bank_a_common),
                ("bank_b", "Bank B (PaySim)", load_bank_b_common),
                ("bank_c", "Bank C (BankSim)", load_bank_c_common)
            ]

            client_updates = []
            for idx, (b_id, b_name, loader_fn) in enumerate(bank_configs):
                pct = 25 + (idx * 20)
                self._log(f"Training local model on private transactions for {b_name}...", pct)

                X, y = loader_fn()
                # Check for attack
                is_attacking = (attack_bank == b_id and attack_type != "none")
                if is_attacking and attack_type == "label_flip":
                    y = 1.0 - y
                    self._log(f" [ATTACK TRIGGERED] {b_name} inverted training labels!", pct)

                local_model = GlobalFraudMLP(input_dim=16)
                local_model.load_state_dict(global_model.state_dict())

                neg = (y == 0).sum()
                pos = (y == 1).sum()
                criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([neg / max(pos, 1)]))
                optimizer = optim.Adam(local_model.parameters(), lr=0.001)

                loader = DataLoader(
                    TensorDataset(torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)),
                    batch_size=512,
                    shuffle=True
                )

                local_model.train()
                for _ in range(epochs):
                    for bx, by in loader:
                        optimizer.zero_grad()
                        loss = criterion(local_model(bx).squeeze(-1), by)
                        loss.backward()
                        optimizer.step()

                local_state = {k: v.cpu() for k, v in local_model.state_dict().items()}

                if is_attacking and attack_type == "scale_poison":
                    self._log(f" [ATTACK TRIGGERED] {b_name} scaled weight updates by 100x!", pct)
                    for k in local_state:
                        local_state[k] = local_state[k] * 100.0

                update_hash = get_state_dict_hash(local_state)
                client_updates.append({
                    "bank_id": b_id,
                    "sample_count": len(X),
                    "weights_hash": update_hash,
                    "state_dict": local_state,
                    "attack": attack_type if is_attacking else "none"
                })

            # 3. Defense Screening
            self._log("Coordinator running Byzantine defense screening on updates...", 85)
            screening_results = screen_client_updates(client_updates, norm_threshold_multiplier=3.0)

            accepted_updates = []
            for res in screening_results:
                b = res["bank_id"]
                st = res["status"]
                rs = res["reason"]
                self._log(f"Defense Verdict: {b.upper()} -> [{st}] ({rs})", 88)
                if st == "ACCEPTED":
                    for u in client_updates:
                        if u["bank_id"] == b:
                            accepted_updates.append(u)

            if not accepted_updates:
                raise RuntimeError("All updates rejected by defense screening.")

            # 4. Aggregation
            self._log(f"Aggregating {len(accepted_updates)} accepted updates using {defense_strategy.upper()}...", 90)
            if defense_strategy == "coordinate_median":
                new_state = aggregate_coordinate_median(accepted_updates)
            else:
                new_state = aggregate_fedavg(accepted_updates)

            new_global_hash = get_state_dict_hash(new_state)

            # 5. Save Global Model
            round_save_path = os.path.join("checkpoints", f"global_model_r{round_id}.pt")
            torch.save({"round": round_id, "weights_hash": new_global_hash, "state_dict": new_state}, round_save_path)
            torch.save({"round": round_id, "weights_hash": new_global_hash, "state_dict": new_state}, global_model_path)
            model_service.reload_model()

            # 6. Commit to Blockchain Smart Contract
            self._log("Submitting round audit commitment to Blockchain Smart Contract...", 95)
            chain_res = chain_service.record_round(
                round_id=round_id,
                defense_strategy=defense_strategy.upper(),
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

            result_summary = {
                "round_id": round_id,
                "global_model_hash": new_global_hash,
                "defense_strategy": defense_strategy,
                "screening_verdicts": screening_results,
                "blockchain_receipt": chain_res,
                "completed_at": int(time.time())
            }

            with self.lock:
                self.job_status["status"] = "COMPLETED"
                self.job_status["progress_percent"] = 100
                self.job_status["current_step"] = f"Round {round_id} completed successfully!"
                self.job_status["last_result"] = result_summary
                self.job_status["logs"].append(f"Round {round_id} committed on-chain. TxHash: {chain_res['transaction_hash'][:16]}...")

        except Exception as e:
            with self.lock:
                self.job_status["status"] = "FAILED"
                self.job_status["progress_percent"] = 100
                self.job_status["current_step"] = f"Round failed: {str(e)}"
                self.job_status["logs"].append(f"[ERROR] {str(e)}")

coordinator_engine = CoordinatorEngine()
