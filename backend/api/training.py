from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from backend.coordinator.engine import coordinator_engine
from backend.services.model_service import model_service

router = APIRouter(prefix="/api", tags=["Training"])

class TrainingStartRequest(BaseModel):
    round_id: int
    defense_strategy: str = "fedavg" # "fedavg" or "coordinate_median"
    epochs: int = 1
    attack_bank: Optional[str] = None
    attack_type: str = "none" # "none", "scale_poison", "label_flip"

@router.post("/training/start")
def start_training(req: TrainingStartRequest):
    res = coordinator_engine.trigger_round(
        round_id=req.round_id,
        defense_strategy=req.defense_strategy,
        epochs=req.epochs,
        attack_bank=req.attack_bank,
        attack_type=req.attack_type
    )
    return res

@router.get("/training/status")
def get_training_progress():
    return coordinator_engine.get_status()

@router.get("/models/global")
def get_global_model_details():
    return model_service.get_info()
