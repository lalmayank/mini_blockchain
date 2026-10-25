from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from backend.services.model_service import model_service

router = APIRouter(prefix="/api/fraud", tags=["Fraud Detection"])

class PredictRequest(BaseModel):
    features: List[float]
    threshold: float = 0.5

class EvaluateDatasetRequest(BaseModel):
    dataset_key: str = "bank_a" # bank_a, bank_b, bank_c
    threshold: float = 0.5

@router.post("/evaluate-dataset")
def evaluate_dataset(req: EvaluateDatasetRequest):
    """Evaluates the live Global MLP against a labelled evaluation dataset."""
    try:
        return model_service.evaluate_on_dataset(req.dataset_key, req.threshold)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict")
def predict_fraud(req: PredictRequest):
    try:
        return model_service.predict(req.features, threshold=req.threshold)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/samples")
def get_sample_transactions():
    return {
        "samples": model_service.get_sample_transactions()
    }
