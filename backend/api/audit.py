from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.chain_service import chain_service

router = APIRouter(prefix="/api/audit", tags=["Blockchain Audit"])

class VerifyHashRequest(BaseModel):
    round_id: int
    model_hash: str

@router.get("/rounds")
def get_audited_rounds():
    records = chain_service.get_audit_ledger_records()
    return {"rounds": records}

@router.get("/round/{round_id}")
def get_on_chain_round_details(round_id: int):
    try:
        return chain_service.get_round_audit(round_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"On-chain round {round_id} not found: {str(e)}")

@router.post("/verify")
def verify_model_hash_commitment(req: VerifyHashRequest):
    try:
        is_valid = chain_service.verify_hash(req.round_id, req.model_hash)
        return {
            "round_id": req.round_id,
            "queried_hash": req.model_hash,
            "is_valid_on_chain": is_valid,
            "verification_status": "AUTHENTIC" if is_valid else "TAMPERED_OR_NOT_FOUND"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
