from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.chain_service import chain_service

router = APIRouter(prefix="/api/audit", tags=["Blockchain Audit"])

class VerifyHashRequest(BaseModel):
    round_id: int
    model_hash: str

class ApproveRoundRequest(BaseModel):
    round_id: int
    bank_address: str
    bank_private_key: Optional[str] = ""

class SyncWalletRequest(BaseModel):
    address: str
    role: Optional[str] = "coordinator"

class RegisterDeployedRequest(BaseModel):
    contract_address: str
    deployer: str
    tx_hash: Optional[str] = ""
    block_number: Optional[int] = 0

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

@router.get("/config")
def get_blockchain_config():
    """Returns smart contract address, ABI, and consortium bank keys for MetaMask integration."""
    return chain_service.get_chain_config()

@router.get("/gas-metrics")
def get_gas_metrics():
    """Returns live gas consumption, price in Gwei, fee in ETH, and block confirmation time."""
    return chain_service.get_gas_metrics()

@router.post("/approve")
def approve_round(req: ApproveRoundRequest):
    """Submits a bank approval vote to the smart contract."""
    try:
        res = chain_service.approve_round(req.round_id, req.bank_address, req.bank_private_key)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")

@router.get("/deploy-payload")
def get_deploy_payload():
    """Returns compiled Solidity ABI, bytecode, and constructor args so MetaMask can deploy directly."""
    try:
        return chain_service.get_deploy_payload()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compilation error: {str(e)}")

@router.post("/sync-wallet")
def sync_user_wallet(req: SyncWalletRequest):
    """Syncs the user's connected MetaMask address as the active Coordinator or Bank signer."""
    try:
        return chain_service.sync_user_wallet(req.address, req.role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")

@router.post("/register-deployed")
def register_deployed_contract(req: RegisterDeployedRequest):
    """Registers a contract deployed directly by the user's MetaMask wallet."""
    try:
        return chain_service.register_deployed_contract(
            req.contract_address, req.deployer, req.tx_hash, req.block_number
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")
