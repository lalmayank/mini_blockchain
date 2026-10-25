import os
import json
from typing import Dict, List, Any
from blockchain.blockchain_service import BlockchainAuditService

class ChainService:
    """Wrapper around BlockchainAuditService for FastAPI controllers."""
    def __init__(self):
        self._auditor = None

    def get_auditor(self) -> BlockchainAuditService:
        if self._auditor is None:
            self._auditor = BlockchainAuditService()
        return self._auditor

    def record_round(
        self,
        round_id: int,
        defense_strategy: str,
        global_model_hash: str,
        submissions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        auditor = self.get_auditor()
        return auditor.record_round_on_chain(
            round_id=round_id,
            defense_strategy=defense_strategy,
            global_model_hash=global_model_hash,
            submissions=submissions
        )

    def get_round_audit(self, round_id: int) -> Dict[str, Any]:
        auditor = self.get_auditor()
        return auditor.get_round_audit(round_id)

    def verify_hash(self, round_id: int, model_hash: str) -> bool:
        auditor = self.get_auditor()
        return auditor.verify_model_hash(round_id, model_hash)

    def get_audit_ledger_records(self) -> List[Dict[str, Any]]:
        ledger_path = os.path.join("checkpoints", "audit_ledger.json")
        if os.path.exists(ledger_path):
            try:
                with open(ledger_path, "r") as f:
                    return json.load(f)
            except Exception:
                return []
        return []

chain_service = ChainService()
