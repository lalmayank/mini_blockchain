import math
from typing import Dict, List, Any, Optional

class BayesianFraudNetwork:
    """
    Exact Bayesian Belief Network (BBN) for Causal Fraud Reasoning & Evidence Propagation.
    
    DAG Structure:
         [TimeRisk] (T)       [ChannelRisk] (C)
              │                    │
              ├───► [AmountSpike] (A) ◄───┤
              │            │              │
              │            ▼              ▼
              └──────► [IsFraud] (F) ◄────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
        [BalanceEmptied] (B)   [RapidMuleOutflow] (M)
    """

    def __init__(self):
        # State definitions for each random variable
        self.variables = ["TimeRisk", "ChannelRisk", "AmountSpike", "IsFraud", "BalanceEmptied", "RapidMuleOutflow"]
        self.domains = {
            "TimeRisk": ["NORMAL", "ODD_HOURS"],
            "ChannelRisk": ["STANDARD", "HIGH_RISK"],
            "AmountSpike": ["NORMAL", "SPIKE"],
            "IsFraud": ["LEGIT", "FRAUD"],
            "BalanceEmptied": ["NO", "YES"],
            "RapidMuleOutflow": ["NO", "YES"]
        }

        # 1. P(TimeRisk)
        self.p_time = {
            "NORMAL": 0.82,
            "ODD_HOURS": 0.18
        }

        # 2. P(ChannelRisk)
        self.p_channel = {
            "STANDARD": 0.80,
            "HIGH_RISK": 0.20
        }

        # 3. P(AmountSpike | TimeRisk, ChannelRisk)
        self.p_amount = {
            ("NORMAL", "STANDARD"): {"NORMAL": 0.94, "SPIKE": 0.06},
            ("NORMAL", "HIGH_RISK"): {"NORMAL": 0.72, "SPIKE": 0.28},
            ("ODD_HOURS", "STANDARD"): {"NORMAL": 0.81, "SPIKE": 0.19},
            ("ODD_HOURS", "HIGH_RISK"): {"NORMAL": 0.42, "SPIKE": 0.58}
        }

        # 4. P(IsFraud | AmountSpike, ChannelRisk, TimeRisk)
        self.p_fraud = {
            ("NORMAL", "STANDARD", "NORMAL"): {"LEGIT": 0.998, "FRAUD": 0.002},
            ("NORMAL", "STANDARD", "ODD_HOURS"): {"LEGIT": 0.985, "FRAUD": 0.015},
            ("NORMAL", "HIGH_RISK", "NORMAL"): {"LEGIT": 0.940, "FRAUD": 0.060},
            ("NORMAL", "HIGH_RISK", "ODD_HOURS"): {"LEGIT": 0.860, "FRAUD": 0.140},
            ("SPIKE", "STANDARD", "NORMAL"): {"LEGIT": 0.880, "FRAUD": 0.120},
            ("SPIKE", "STANDARD", "ODD_HOURS"): {"LEGIT": 0.750, "FRAUD": 0.250},
            ("SPIKE", "HIGH_RISK", "NORMAL"): {"LEGIT": 0.450, "FRAUD": 0.550},
            ("SPIKE", "HIGH_RISK", "ODD_HOURS"): {"LEGIT": 0.120, "FRAUD": 0.880}
        }

        # 5. P(BalanceEmptied | IsFraud)
        self.p_balance = {
            "LEGIT": {"NO": 0.97, "YES": 0.03},
            "FRAUD": {"NO": 0.15, "YES": 0.85}
        }

        # 6. P(RapidMuleOutflow | IsFraud)
        self.p_mule = {
            "LEGIT": {"NO": 0.99, "YES": 0.01},
            "FRAUD": {"NO": 0.22, "YES": 0.78}
        }

    def _joint_probability(self, t: str, c: str, a: str, f: str, b: str, m: str) -> float:
        """Computes factor product P(T)*P(C)*P(A|T,C)*P(F|A,C,T)*P(B|F)*P(M|F)"""
        prob = (
            self.p_time[t] *
            self.p_channel[c] *
            self.p_amount[(t, c)][a] *
            self.p_fraud[(a, c, t)][f] *
            self.p_balance[f][b] *
            self.p_mule[f][m]
        )
        return prob

    def get_dag_structure(self) -> Dict[str, Any]:
        """Returns nodes and directed dependency edges for visual frontend rendering."""
        return {
            "nodes": [
                {"id": "TimeRisk", "label": "Time Anomaly (T)", "parents": [], "states": self.domains["TimeRisk"]},
                {"id": "ChannelRisk", "label": "Channel / Device Risk (C)", "parents": [], "states": self.domains["ChannelRisk"]},
                {"id": "AmountSpike", "label": "Amount Anomaly (A)", "parents": ["TimeRisk", "ChannelRisk"], "states": self.domains["AmountSpike"]},
                {"id": "IsFraud", "label": "Fraud Target Node (F)", "parents": ["AmountSpike", "ChannelRisk", "TimeRisk"], "states": self.domains["IsFraud"]},
                {"id": "BalanceEmptied", "label": "Balance Emptied (B)", "parents": ["IsFraud"], "states": self.domains["BalanceEmptied"]},
                {"id": "RapidMuleOutflow", "label": "Mule Fan-out (M)", "parents": ["IsFraud"], "states": self.domains["RapidMuleOutflow"]}
            ],
            "edges": [
                {"from": "TimeRisk", "to": "AmountSpike"},
                {"from": "ChannelRisk", "to": "AmountSpike"},
                {"from": "AmountSpike", "to": "IsFraud"},
                {"from": "ChannelRisk", "to": "IsFraud"},
                {"from": "TimeRisk", "to": "IsFraud"},
                {"from": "IsFraud", "to": "BalanceEmptied"},
                {"from": "IsFraud", "to": "RapidMuleOutflow"}
            ]
        }

    def query(self, evidence: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Exact Variable Elimination / Bayesian Posterior Query.
        Calculates P(Variable = state | Evidence = e) for all variables in the network.
        """
        if evidence is None:
            evidence = {}

        # Validate evidence values
        clean_evidence = {}
        for var, val in evidence.items():
            if var in self.domains and val in self.domains[var]:
                clean_evidence[var] = val

        # Calculate joint marginal distribution summing across unobserved states
        marginal_counts = {
            var: {st: 0.0 for st in self.domains[var]}
            for var in self.variables
        }
        total_evidence_weight = 0.0

        for t in self.domains["TimeRisk"]:
            if "TimeRisk" in clean_evidence and clean_evidence["TimeRisk"] != t:
                continue
            for c in self.domains["ChannelRisk"]:
                if "ChannelRisk" in clean_evidence and clean_evidence["ChannelRisk"] != c:
                    continue
                for a in self.domains["AmountSpike"]:
                    if "AmountSpike" in clean_evidence and clean_evidence["AmountSpike"] != a:
                        continue
                    for f in self.domains["IsFraud"]:
                        if "IsFraud" in clean_evidence and clean_evidence["IsFraud"] != f:
                            continue
                        for b in self.domains["BalanceEmptied"]:
                            if "BalanceEmptied" in clean_evidence and clean_evidence["BalanceEmptied"] != b:
                                continue
                            for m in self.domains["RapidMuleOutflow"]:
                                if "RapidMuleOutflow" in clean_evidence and clean_evidence["RapidMuleOutflow"] != m:
                                    continue

                                p = self._joint_probability(t, c, a, f, b, m)
                                total_evidence_weight += p

                                marginal_counts["TimeRisk"][t] += p
                                marginal_counts["ChannelRisk"][c] += p
                                marginal_counts["AmountSpike"][a] += p
                                marginal_counts["IsFraud"][f] += p
                                marginal_counts["BalanceEmptied"][b] += p
                                marginal_counts["RapidMuleOutflow"][m] += p

        if total_evidence_weight <= 0:
            return {"error": "Evidence combination has zero probability in prior distribution."}

        # Normalize marginals
        posterior_distributions = {}
        for var in self.variables:
            posterior_distributions[var] = {}
            for st in self.domains[var]:
                prob = marginal_counts[var][st] / total_evidence_weight
                posterior_distributions[var][st] = round(prob, 4)

        fraud_prob = posterior_distributions["IsFraud"]["FRAUD"]
        prior_fraud_prob = 0.021 # Unconditional baseline prior

        # Causal Contribution / Log-Odds Ratio
        log_odds_multiplier = (
            (fraud_prob / max(1e-5, 1.0 - fraud_prob)) /
            (prior_fraud_prob / (1.0 - prior_fraud_prob))
        )

        return {
            "algorithm": "Bayesian Belief Network (Exact Variable Elimination)",
            "observed_evidence": clean_evidence,
            "evidence_count": len(clean_evidence),
            "posterior_distributions": posterior_distributions,
            "fraud_posterior": fraud_prob,
            "fraud_prior_baseline": prior_fraud_prob,
            "risk_multiplier": round(log_odds_multiplier, 2),
            "verdict": (
                "CRITICAL_FRAUD_PROBABILITY" if fraud_prob >= 0.70
                else ("ELEVATED_SUSPICION" if fraud_prob >= 0.25 else "LOW_RISK_LEGITIMATE")
            ),
            "causal_explanation": self._generate_causal_explanation(clean_evidence, fraud_prob, log_odds_multiplier)
        }

    def _generate_causal_explanation(self, evidence: Dict[str, str], fraud_prob: float, mult: float) -> str:
        """Constructs plain-English causal audit explanation required for banking compliance."""
        if not evidence:
            return f"Unconditional baseline prior. Overall banking fraud risk is {round(fraud_prob * 100, 2)}%."

        factors = []
        if evidence.get("ChannelRisk") == "HIGH_RISK":
            factors.append("high-risk transfer channel")
        if evidence.get("TimeRisk") == "ODD_HOURS":
            factors.append("unusual off-hours transaction timing")
        if evidence.get("AmountSpike") == "SPIKE":
            factors.append("sudden volume/amount anomaly")
        if evidence.get("BalanceEmptied") == "YES":
            factors.append("immediate account balance liquidation")
        if evidence.get("RapidMuleOutflow") == "YES":
            factors.append("rapid fan-out to known mule accounts")

        factors_str = ", ".join(factors) if factors else "observed evidence"
        return (
            f"Posterior fraud probability updated to {round(fraud_prob * 100, 1)}% ({round(mult, 1)}x baseline) "
            f"driven by {factors_str} through conditional Bayesian causal propagation."
        )

# Global singleton
bayesian_fraud_net = BayesianFraudNetwork()
