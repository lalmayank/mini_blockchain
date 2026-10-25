from fastapi import APIRouter
from backend.services.model_service import model_service
from backend.services.chain_service import chain_service
from backend.coordinator.engine import coordinator_engine

router = APIRouter(prefix="/api", tags=["Status"])

@router.get("/status")
def get_system_status():
    model_info = model_service.get_info()
    training_status = coordinator_engine.get_status()
    chain_records = chain_service.get_audit_ledger_records()

    return {
        "system": "CrossBank TrustFL Coordinator",
        "status": "OPERATIONAL",
        "current_round": model_info["current_round"],
        "active_global_model_hash": model_info["weights_hash"],
        "blockchain_network": "EVM TestNet (Solidity FraudAudit.sol)",
        "total_audited_rounds": len(chain_records),
        "active_training_job": training_status["status"],
        "current_step": training_status["current_step"]
    }

@router.get("/banks")
def get_registered_banks():
    return {
        "banks": [
            {
                "id": "bank_a",
                "name": "Bank A — Card Transactions",
                "dataset_source": "ULB Worldline Credit Card Fraud",
                "records": 284807,
                "fraud_count": 492,
                "fraud_rate_pct": 0.173,
                "status": "ONLINE",
                "features_shared": 16,
                "role": "Participant Node"
            },
            {
                "id": "bank_b",
                "name": "Bank B — Mobile Money",
                "dataset_source": "PaySim Synthetic Mobile Money",
                "records": 308213,
                "fraud_count": 8213,
                "fraud_rate_pct": 2.66,
                "status": "ONLINE",
                "features_shared": 16,
                "role": "Participant Node"
            },
            {
                "id": "bank_c",
                "name": "Bank C — Retail Payments",
                "dataset_source": "BankSim Customer Payments",
                "records": 594643,
                "fraud_count": 7200,
                "fraud_rate_pct": 1.21,
                "status": "ONLINE",
                "features_shared": 16,
                "role": "Participant Node"
            }
        ]
    }
