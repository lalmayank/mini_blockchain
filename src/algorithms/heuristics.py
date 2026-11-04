import math
import random
import numpy as np
from typing import Dict, List, Any

# =============================================================================
# HEURISTIC 1: Benford's Law Chi-Square Forensic Accounting Analyzer
# =============================================================================
BENFORD_IDEAL = {
    d: math.log10(1.0 + 1.0 / d) for d in range(1, 10)
}

def analyze_benfords_law(amounts: List[float]) -> Dict[str, Any]:
    """
    Heuristic Forensic Test based on Benford's Law:
    In natural commercial finance, the probability of leading digit d is log10(1 + 1/d).
    Synthetic/fraudulent transaction generators deviate significantly from Benford's distribution.
    Computes Chi-Square goodness-of-fit statistic and p-value proxy.
    """
    valid_digits = []
    for a in amounts:
        val = abs(a)
        if val >= 1.0:
            s = str(val).lstrip("0").replace(".", "")
            if len(s) > 0 and s[0].isdigit() and int(s[0]) > 0:
                valid_digits.append(int(s[0]))

    n = len(valid_digits)
    if n < 10:
        return {
            "status": "INSUFFICIENT_DATA",
            "message": "At least 10 non-zero transactions required for Benford analysis."
        }

    counts = {d: 0 for d in range(1, 10)}
    for d in valid_digits:
        counts[d] += 1

    observed_proportions = {d: round(counts[d] / n, 4) for d in range(1, 10)}
    expected_proportions = {d: round(BENFORD_IDEAL[d], 4) for d in range(1, 10)}

    # Chi-Square Calculation: sum((O - E)^2 / E)
    chi_square = 0.0
    digit_anomalies = []
    for d in range(1, 10):
        obs = counts[d]
        exp = n * BENFORD_IDEAL[d]
        diff = obs - exp
        chi_square += (diff ** 2) / exp
        
        # Flag if observed proportion is > 2x expected (classic fabrication signature)
        if observed_proportions[d] > 2.0 * expected_proportions[d]:
            digit_anomalies.append({
                "digit": d,
                "observed": observed_proportions[d],
                "expected": expected_proportions[d],
                "deviation": "EXTREME_OVER_REPRESENTATION"
            })

    # Critical value for 8 degrees of freedom at alpha=0.01 is ~20.09
    is_anomalous = chi_square > 20.09
    risk_level = "CRITICAL_SYNTHETIC" if chi_square > 35.0 else ("ELEVATED_ANOMALY" if is_anomalous else "NATURAL_CONFORMANT")

    return {
        "heuristic": "Benford's Law Forensic Accounting Test",
        "sample_count": n,
        "chi_square_statistic": round(chi_square, 3),
        "critical_threshold_p01": 20.09,
        "is_anomalous": is_anomalous,
        "risk_level": risk_level,
        "observed_distribution": observed_proportions,
        "expected_distribution": expected_proportions,
        "digit_anomalies": digit_anomalies,
        "explanation": (
            "Violates Benford's Law! Transactions show unnatural clustering of leading digits indicating automated/fraudulent scripting."
            if is_anomalous else
            "Conforms to natural logarithmic financial distribution. No statistical fabrication detected."
        )
    }

# =============================================================================
# HEURISTIC 2: Smurfing & Structuring Heuristic Detector
# =============================================================================
def detect_smurfing_structuring(
    transactions: List[Dict[str, Any]],
    threshold_limit: float = 10000.0,
    structuring_band_ratio: float = 0.15
) -> Dict[str, Any]:
    """
    AML Heuristic: Identifies 'Smurfing' or 'Structuring' — intentionally splitting
    large sums into multiple micro-transfers positioned right below the legal AML threshold
    (e.g., $9,200 to $9,950 for a $10,000 threshold) across a small time interval.
    """
    lower_band = threshold_limit * (1.0 - structuring_band_ratio)
    upper_band = threshold_limit * 0.999

    flagged_txs = []
    total_structured_volume = 0.0

    for tx in transactions:
        amt = float(tx.get("amount", 0.0))
        if lower_band <= amt <= upper_band:
            flagged_txs.append(tx)
            total_structured_volume += amt

    # Heuristic structuring score based on count and proximity to limit
    count = len(flagged_txs)
    structuring_detected = count >= 2

    return {
        "heuristic": "Smurfing / Structuring AML Detector",
        "legal_threshold": threshold_limit,
        "monitored_band": f"${lower_band:,.0f} - ${upper_band:,.0f}",
        "structuring_detected": structuring_detected,
        "flagged_transactions_count": count,
        "total_structured_volume": round(total_structured_volume, 2),
        "flagged_transactions": flagged_txs,
        "heuristic_action": (
            "TRIGGER_SAR_REPORT" if count >= 3 else ("FLAG_MANUAL_REVIEW" if count >= 1 else "PASS")
        )
    }

# =============================================================================
# HEURISTIC 3: Simulated Annealing Meta-Heuristic for FL Client Weighting
# =============================================================================
def optimize_client_weights_sa(
    client_metrics: Dict[str, Dict[str, float]],
    initial_temp: float = 100.0,
    cooling_rate: float = 0.92,
    max_iterations: int = 150
) -> Dict[str, Any]:
    """
    Simulated Annealing meta-heuristic to find optimal aggregation weights
    for Bank A, Bank B, and Bank C.
    Objective:
      Maximize: Performance Score (PR-AUC, F1)
      Minimize: Frobenius Norm Anomaly Penalty & Network Latency
    """
    clients = list(client_metrics.keys())
    k = len(clients)
    if k == 0:
        return {"error": "No clients provided"}

    # Objective evaluator
    def evaluate_fitness(weights: List[float]) -> float:
        # Normalize weights to sum to 1.0
        w_sum = sum(weights)
        if w_sum <= 0:
            return -1e9
        norm_w = [w / w_sum for w in weights]

        score = 0.0
        for i, c_name in enumerate(clients):
            m = client_metrics[c_name]
            auc = m.get("pr_auc", 0.8)
            anomaly = m.get("anomaly_norm", 0.0) # Frobenius deviation from median
            latency_sec = m.get("latency_ms", 100.0) / 1000.0

            # Fitness: Rewards AUC, heavily penalizes anomaly norm and high latency
            client_value = (auc * 1.5) - (anomaly * 2.0) - (latency_sec * 0.1)
            score += norm_w[i] * client_value

        return score

    # Initial state: Equal weighting
    current_weights = [1.0 / k] * k
    current_fitness = evaluate_fitness(current_weights)

    best_weights = list(current_weights)
    best_fitness = current_fitness

    temp = initial_temp
    history = []

    for step in range(max_iterations):
        # Generate neighbor state via perturbation
        perturb_idx = random.randint(0, k - 1)
        delta = random.uniform(-0.15, 0.15)
        neighbor_weights = list(current_weights)
        neighbor_weights[perturb_idx] = max(0.01, neighbor_weights[perturb_idx] + delta)

        # Re-normalize
        s = sum(neighbor_weights)
        neighbor_weights = [w / s for w in neighbor_weights]
        neighbor_fitness = evaluate_fitness(neighbor_weights)

        # Acceptance probability (Metropolis criterion)
        fitness_diff = neighbor_fitness - current_fitness
        if fitness_diff > 0:
            accept = True
        else:
            accept_prob = math.exp(fitness_diff / max(temp, 1e-6))
            accept = random.random() < accept_prob

        if accept:
            current_weights = neighbor_weights
            current_fitness = neighbor_fitness
            if current_fitness > best_fitness:
                best_fitness = current_fitness
                best_weights = list(current_weights)

        if step % 15 == 0:
            history.append({
                "step": step,
                "temp": round(temp, 2),
                "fitness": round(current_fitness, 4),
                "weights": [round(w, 3) for w in current_weights]
            })

        temp *= cooling_rate

    # Final normalized dict
    s = sum(best_weights)
    final_weights = {clients[i]: round(best_weights[i] / s, 4) for i in range(k)}

    return {
        "meta_heuristic": "Simulated Annealing Optimization",
        "initial_temp": initial_temp,
        "cooling_rate": cooling_rate,
        "total_iterations": max_iterations,
        "best_fitness_score": round(best_fitness, 4),
        "optimized_client_weights": final_weights,
        "cooling_history": history
    }
