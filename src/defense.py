import torch
import numpy as np
from typing import Dict, List, Tuple

def check_tensor_health(state_dict: Dict[str, torch.Tensor]) -> Tuple[bool, str]:
    """
    Layer 1 Defense: Checks that update contains valid finite numerical tensors.
    Catches NaNs, infinities, and corrupted parameter structures.
    """
    for key, tensor in state_dict.items():
        if not torch.is_tensor(tensor):
            return False, f"Key {key} is not a valid tensor."
        if torch.isnan(tensor).any():
            return False, f"NaN values detected in parameter {key}."
        if torch.isinf(tensor).any():
            return False, f"Infinite values detected in parameter {key}."
    return True, "Passed structural integrity checks."

def compute_update_norm(state_dict: Dict[str, torch.Tensor]) -> float:
    """Computes total L2 Frobenius norm of all model parameters."""
    total_norm_sq = 0.0
    for tensor in state_dict.values():
        total_norm_sq += float(torch.sum(tensor ** 2).item())
    return float(np.sqrt(total_norm_sq))

def screen_client_updates(
    client_updates: List[Dict],
    norm_threshold_multiplier: float = 3.0
) -> List[Dict]:
    """
    Layer 2 Defense: Evaluates update norms and statistical anomalies.
    Flags clients launching model poisoning (e.g. extreme scaling or random noise).
    """
    results = []
    norms = [compute_update_norm(u["state_dict"]) for u in client_updates]
    median_norm = float(np.median(norms)) if len(norms) > 0 else 1.0

    for i, u in enumerate(client_updates):
        bank_id = u["bank_id"]
        state_dict = u["state_dict"]
        norm = norms[i]

        # 1. Structural check
        is_healthy, reason = check_tensor_health(state_dict)
        if not is_healthy:
            results.append({
                "bank_id": bank_id,
                "status": "REJECTED",
                "reason": reason,
                "norm": norm
            })
            continue

        # 2. Norm outlier check (Model scaling poisoning)
        if norm > (median_norm * norm_threshold_multiplier) and len(client_updates) > 2:
            results.append({
                "bank_id": bank_id,
                "status": "REJECTED",
                "reason": f"Abnormal weight norm ({norm:.2f} > {median_norm * norm_threshold_multiplier:.2f}). Poisoning suspected.",
                "norm": norm
            })
            continue

        results.append({
            "bank_id": bank_id,
            "status": "ACCEPTED",
            "reason": "Update validated successfully.",
            "norm": norm
        })

    return results

def aggregate_fedavg(
    accepted_updates: List[Dict]
) -> Dict[str, torch.Tensor]:
    """
    Layer 3 Aggregation: Standard sample-weighted Federated Averaging.
    w_global = sum(n_k * w_k) / sum(n_k)
    """
    if not accepted_updates:
        raise ValueError("Cannot aggregate: zero accepted updates.")

    total_samples = sum(u["sample_count"] for u in accepted_updates)
    ref_keys = accepted_updates[0]["state_dict"].keys()
    aggregated_dict = {}

    for key in ref_keys:
        weighted_sum = None
        for u in accepted_updates:
            weight = u["sample_count"] / total_samples
            tensor = u["state_dict"][key].float() * weight
            weighted_sum = tensor if weighted_sum is None else weighted_sum + tensor
        aggregated_dict[key] = weighted_sum

    return aggregated_dict

def aggregate_coordinate_median(
    accepted_updates: List[Dict]
) -> Dict[str, torch.Tensor]:
    """
    Layer 3 Byzantine-Robust Aggregation: Coordinate-wise Median.
    Provides resistance against arbitrary poisoning attacks when up to 50% of nodes are adversarial.
    """
    if not accepted_updates:
        raise ValueError("Cannot aggregate: zero accepted updates.")

    ref_keys = accepted_updates[0]["state_dict"].keys()
    aggregated_dict = {}

    for key in ref_keys:
        stacked = torch.stack([u["state_dict"][key].float() for u in accepted_updates], dim=0)
        median_val = torch.median(stacked, dim=0).values
        aggregated_dict[key] = median_val

    return aggregated_dict
