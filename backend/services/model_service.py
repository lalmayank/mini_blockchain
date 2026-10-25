import os
import torch
import numpy as np
from typing import Dict, Any, List
from src.model import GlobalFraudMLP, get_state_dict_hash
from src.common_preprocessing import COMMON_FEATURE_NAMES

GLOBAL_MODEL_PATH = os.path.join("checkpoints", "global_model.pt")

class ModelService:
    """Provides inference, model introspection, and test transactions."""
    def __init__(self):
        self.device = torch.device("cpu")
        self.model = GlobalFraudMLP(input_dim=16)
        self.reload_model()

    def reload_model(self) -> bool:
        if os.path.exists(GLOBAL_MODEL_PATH):
            try:
                ckpt = torch.load(GLOBAL_MODEL_PATH, weights_only=True)
                state_dict = ckpt["state_dict"] if "state_dict" in ckpt else ckpt
                self.model.load_state_dict(state_dict)
                self.model.eval()
                return True
            except Exception as e:
                print(f"[ModelService] Failed to load model: {e}")
        return False

    def evaluate_on_dataset(self, dataset_key: str = "bank_a", threshold: float = 0.5) -> Dict[str, Any]:
        """
        Runs real-time evaluation of the active Global MLP on the actual held-out test split
        of Bank A, Bank B, or Bank C, computing PR-AUC, ROC-AUC, F1, Precision, Recall, and Confusion Matrix.
        """
        self.reload_model()
        from sklearn.metrics import (
            average_precision_score,
            roc_auc_score,
            f1_score,
            precision_score,
            recall_score,
            confusion_matrix
        )
        from src.common_preprocessing import load_bank_a_common, load_bank_b_common, load_bank_c_common

        if dataset_key == "bank_a":
            X, y = load_bank_a_common()
            name = "Bank A (Credit Card Fraud Dataset)"
        elif dataset_key == "bank_b":
            X, y = load_bank_b_common(sample_target=100000)
            name = "Bank B (PaySim Mobile Money Dataset)"
        else:
            X, y = load_bank_c_common()
            name = "Bank C (BankSim Payment Fraud Dataset)"

        # Use test split (last 20%)
        test_size = int(len(X) * 0.20)
        X_test = X[-test_size:]
        y_test = y[-test_size:]

        with torch.no_grad():
            logits = self.model(torch.tensor(X_test, dtype=torch.float32)).squeeze(-1)
            probs = torch.sigmoid(logits).numpy()

        preds = (probs >= threshold).astype(int)
        y_int = y_test.astype(int)

        pr_auc = float(average_precision_score(y_test, probs))
        roc_auc = float(roc_auc_score(y_test, probs)) if len(np.unique(y_test)) > 1 else 0.5
        f1 = float(f1_score(y_int, preds, zero_division=0))
        precision = float(precision_score(y_int, preds, zero_division=0))
        recall = float(recall_score(y_int, preds, zero_division=0))
        cm = confusion_matrix(y_int, preds).tolist()

        return {
            "dataset_name": name,
            "dataset_key": dataset_key,
            "evaluated_samples": test_size,
            "actual_frauds_in_test": int(y_test.sum()),
            "pr_auc": round(pr_auc, 4),
            "roc_auc": round(roc_auc, 4),
            "f1_score": round(f1, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "applied_threshold": threshold,
            "confusion_matrix": cm,
            "is_real_data": True
        }

    def get_info(self) -> Dict[str, Any]:
        self.reload_model()
        weights_hash = get_state_dict_hash(self.model.state_dict())
        param_count = sum(p.numel() for p in self.model.parameters())

        round_num = 0
        if os.path.exists(GLOBAL_MODEL_PATH):
            try:
                ckpt = torch.load(GLOBAL_MODEL_PATH, weights_only=True)
                round_num = ckpt.get("round", 0)
            except Exception:
                pass

        return {
            "model_type": "Multi-Layer Perceptron (GlobalFraudMLP)",
            "architecture": "16 -> 64 (BatchNorm+ReLU+Dropout) -> 32 (BatchNorm+ReLU+Dropout) -> 1",
            "input_dimension": 16,
            "total_parameters": param_count,
            "current_round": round_num,
            "weights_hash": weights_hash,
            "common_features": COMMON_FEATURE_NAMES
        }

    def predict(self, feature_vector: List[float], threshold: float = 0.5) -> Dict[str, Any]:
        self.reload_model()
        if len(feature_vector) != 16:
            raise ValueError(f"Expected 16 features, got {len(feature_vector)}")

        x = torch.tensor([feature_vector], dtype=torch.float32)
        with torch.no_grad():
            logit = self.model(x).squeeze(-1)
            prob = float(torch.sigmoid(logit).item())

        is_fraud = prob >= threshold
        risk_tier = "CRITICAL" if prob >= 0.85 else ("HIGH" if prob >= 0.60 else ("MEDIUM" if prob >= 0.30 else "LOW"))

        return {
            "fraud_probability": round(prob, 4),
            "is_fraud": is_fraud,
            "risk_tier": risk_tier,
            "applied_threshold": threshold,
            "explanation": f"Transaction scored a {prob*100:.1f}% fraud probability under the active Global MLP consensus."
        }

    def get_sample_transactions(self) -> List[Dict[str, Any]]:
        """Returns pre-configured realistic test transactions from Bank A, B, and C."""
        return [
            {
                "id": "TX-A-001",
                "bank": "Bank A (Credit Card)",
                "description": "Legitimate grocery swipe during business hours",
                "ground_truth": "Legitimate",
                "features": [0.05, 0.42, 0.0, 0.25, 0.96, 0.78, 0.62, 0.15, 0.0, 0.0, 0.08, 0.0, -0.10, 1.0, 0.5, -0.05]
            },
            {
                "id": "TX-A-999",
                "bank": "Bank A (Credit Card)",
                "description": "Stolen card midnight spending spree with extreme PCA anomaly",
                "ground_truth": "Fraud",
                "features": [3.45, 2.85, 1.0, -0.98, 0.15, 0.22, 0.97, 0.88, 1.0, 1.0, 0.95, 0.0, 0.92, 1.0, 0.5, 0.89]
            },
            {
                "id": "TX-B-002",
                "bank": "Bank B (PaySim Mobile)",
                "description": "Standard utility bill transfer",
                "ground_truth": "Legitimate",
                "features": [-0.12, 0.35, 0.0, 0.50, 0.86, 0.43, 0.90, 0.40, 0.0, 0.0, 0.12, 0.0, 0.02, 0.0, 0.8, 0.01]
            },
            {
                "id": "TX-B-888",
                "bank": "Bank B (PaySim Mobile)",
                "description": "Account takeover: full balance transfer & immediate cash-out",
                "ground_truth": "Fraud",
                "features": [4.10, 3.20, 1.0, 0.12, 0.99, 0.85, 0.52, 0.95, 1.0, 1.0, 1.0, 1.0, 0.98, 1.0, 0.8, 0.96]
            },
            {
                "id": "TX-C-003",
                "bank": "Bank C (BankSim Retail)",
                "description": "Coffee shop contactless payment",
                "ground_truth": "Legitimate",
                "features": [-0.45, 0.15, 0.0, 0.70, 0.71, 0.10, 0.99, 0.20, 0.0, 0.0, 0.04, 0.0, 0.0, 1.0, 0.3, 0.0]
            },
            {
                "id": "TX-C-777",
                "bank": "Bank C (BankSim Retail)",
                "description": "High-risk luxury jewelry purchase with anomalous amount",
                "ground_truth": "Fraud",
                "features": [2.80, 2.45, 1.0, -0.85, 0.52, 0.65, 0.75, 0.70, 1.0, 1.0, 0.85, 0.0, 0.80, 1.0, 0.3, 0.85]
            }
        ]

model_service = ModelService()
