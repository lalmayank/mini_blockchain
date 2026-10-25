import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

COMMON_FEATURE_NAMES = [
    "amount_norm",
    "amount_log",
    "is_high_amount",
    "hour_sin",
    "hour_cos",
    "day_sin",
    "day_cos",
    "trans_velocity_proxy",
    "high_risk_channel_flag",
    "rapid_outflow_flag",
    "amount_to_median_ratio",
    "zero_balance_post_flag",
    "heuristic_risk_score",
    "direction_outflow_flag",
    "institution_scale_factor",
    "deviation_score"
]

def _generate_synthetic_bank_data(bank_type: str, n_samples: int = 5000):
    """
    Fallback data generator for new environments where large raw CSV datasets
    are not yet downloaded. Produces realistic 16-D features and labels.
    """
    print(f" [INFO] Dataset not found on disk. Generating {n_samples} synthetic transactions for {bank_type}...")
    rng = np.random.default_rng(42 if bank_type == "bank_a" else 43 if bank_type == "bank_b" else 44)
    X = rng.normal(loc=0.0, scale=1.0, size=(n_samples, len(COMMON_FEATURE_NAMES))).astype(np.float32)
    y = np.zeros(n_samples, dtype=np.float32)
    n_fraud = int(n_samples * 0.04)
    fraud_indices = rng.choice(n_samples, size=n_fraud, replace=False)
    y[fraud_indices] = 1.0
    X[fraud_indices, 0] += 2.5
    X[fraud_indices, 8] = 1.0
    X[fraud_indices, 9] = 1.0
    X[fraud_indices, 12] = 0.8
    return X, y

def load_bank_a_common(dataset_path: str = os.path.join("model2", "creditcard.csv")):
    """
    Bank A: Credit Card Fraud Dataset.
    Transforms raw card transactions into the universal 16-feature schema.
    """
    if not os.path.exists(dataset_path):
        return _generate_synthetic_bank_data("Bank A (Credit Card)", 5000)

    df = pd.read_csv(dataset_path)
    amount = df["Amount"].values
    time_sec = df["Time"].values

    # Cyclical Time features (Time is seconds from first transaction)
    hour = (time_sec // 3600) % 24
    day = (time_sec // (3600 * 24)) % 7

    amount_log = np.log1p(np.maximum(amount, 0))
    p90 = np.percentile(amount, 90)
    median_amt = np.median(amount) + 1e-5

    # PCA feature deviation proxy (V1-V28 norm)
    v_cols = [c for c in df.columns if c.startswith("V")]
    v_norm = np.linalg.norm(df[v_cols].values, axis=1)
    v_norm_scaled = (v_norm - np.mean(v_norm)) / (np.std(v_norm) + 1e-5)

    scaler = StandardScaler()
    amount_norm = scaler.fit_transform(amount.reshape(-1, 1)).flatten()

    X = np.zeros((len(df), len(COMMON_FEATURE_NAMES)), dtype=np.float32)
    X[:, 0] = amount_norm
    X[:, 1] = (amount_log - np.mean(amount_log)) / (np.std(amount_log) + 1e-5)
    X[:, 2] = (amount > p90).astype(np.float32)
    X[:, 3] = np.sin(2 * np.pi * hour / 24.0)
    X[:, 4] = np.cos(2 * np.pi * hour / 24.0)
    X[:, 5] = np.sin(2 * np.pi * day / 7.0)
    X[:, 6] = np.cos(2 * np.pi * day / 7.0)
    X[:, 7] = (time_sec % 3600) / 3600.0  # sub-hour velocity proxy
    X[:, 8] = (v_norm_scaled > 2.0).astype(np.float32) # High risk anomaly spike
    X[:, 9] = (amount > np.percentile(amount, 95)).astype(np.float32)
    X[:, 10] = np.clip(amount / median_amt, 0, 50) / 50.0
    X[:, 11] = 0.0 # Balance not explicitly exposed in credit card swipe
    X[:, 12] = np.clip(v_norm_scaled / 3.0, -1.0, 1.0)
    X[:, 13] = 1.0 # Outflow payment
    X[:, 14] = 0.5 # Institution scale baseline
    X[:, 15] = np.tanh(v_norm_scaled)

    y = df["Class"].values.astype(np.float32)
    return X, y

def load_bank_b_common(
    dataset_path: str = os.path.join("model1", "PS_20174392719_1491204439457_log.csv"),
    sample_target: int = 300000
):
    """
    Bank B: PaySim Mobile Money Dataset.
    Transforms raw money transfers into the universal 16-feature schema.
    """
    if not os.path.exists(dataset_path):
        return _generate_synthetic_bank_data("Bank B (PaySim)", 5000)

    chunks = []
    fraud_chunks = []
    non_fraud_collected = 0

    chunk_size = 500000
    for chunk in pd.read_csv(dataset_path, chunksize=chunk_size):
        frauds = chunk[chunk["isFraud"] == 1]
        non_frauds = chunk[chunk["isFraud"] == 0]
        fraud_chunks.append(frauds)
        if non_fraud_collected < sample_target:
            take = min(len(non_frauds), sample_target - non_fraud_collected)
            chunks.append(non_frauds.iloc[:take])
            non_fraud_collected += take

    df = pd.concat(fraud_chunks + chunks, ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)

    amount = df["amount"].values
    step = df["step"].values
    hour = step % 24
    day = (step // 24) % 7

    amount_log = np.log1p(np.maximum(amount, 0))
    p90 = np.percentile(amount, 90)
    median_amt = np.median(amount) + 1e-5

    scaler = StandardScaler()
    amount_norm = scaler.fit_transform(amount.reshape(-1, 1)).flatten()

    orig_emptied = ((df["oldbalanceOrg"] > 0) & (df["newbalanceOrig"] == 0)).astype(np.float32)
    is_high_risk_type = df["type"].isin(["TRANSFER", "CASH_OUT"]).astype(np.float32)
    orig_error = np.abs(df["newbalanceOrig"] + df["amount"] - df["oldbalanceOrg"])
    orig_error_scaled = np.tanh(orig_error / (median_amt + 1e-5))

    X = np.zeros((len(df), len(COMMON_FEATURE_NAMES)), dtype=np.float32)
    X[:, 0] = amount_norm
    X[:, 1] = (amount_log - np.mean(amount_log)) / (np.std(amount_log) + 1e-5)
    X[:, 2] = (amount > p90).astype(np.float32)
    X[:, 3] = np.sin(2 * np.pi * hour / 24.0)
    X[:, 4] = np.cos(2 * np.pi * hour / 24.0)
    X[:, 5] = np.sin(2 * np.pi * day / 7.0)
    X[:, 6] = np.cos(2 * np.pi * day / 7.0)
    X[:, 7] = (step % 24) / 24.0
    X[:, 8] = is_high_risk_type
    X[:, 9] = orig_emptied
    X[:, 10] = np.clip(amount / median_amt, 0, 50) / 50.0
    X[:, 11] = orig_emptied
    X[:, 12] = orig_error_scaled
    X[:, 13] = is_high_risk_type
    X[:, 14] = 0.8 # Higher average volume institution
    X[:, 15] = orig_error_scaled

    y = df["isFraud"].values.astype(np.float32)
    return X, y

def load_bank_c_common(dataset_path: str = os.path.join("model3", "bs140513_032310.csv")):
    """
    Bank C: BankSim Synthetic Payments Dataset.
    Transforms retail payments into the universal 16-feature schema.
    """
    if not os.path.exists(dataset_path):
        return _generate_synthetic_bank_data("Bank C (BankSim)", 5000)

    df = pd.read_csv(dataset_path)
    for col in ["category", "gender", "age"]:
        df[col] = df[col].astype(str).str.strip("'\"")

    amount = df["amount"].values
    step = df["step"].values
    day = step % 7
    hour = (step * 2) % 24 # Simulated hour proxy

    amount_log = np.log1p(np.maximum(amount, 0))
    p90 = np.percentile(amount, 90)
    median_amt = np.median(amount) + 1e-5

    scaler = StandardScaler()
    amount_norm = scaler.fit_transform(amount.reshape(-1, 1)).flatten()

    # High risk categories in BankSim
    high_risk_cats = ["es_leisure", "es_travel", "es_sportsandtoys", "es_jewelry"]
    is_high_risk_cat = df["category"].isin(high_risk_cats).astype(np.float32)

    X = np.zeros((len(df), len(COMMON_FEATURE_NAMES)), dtype=np.float32)
    X[:, 0] = amount_norm
    X[:, 1] = (amount_log - np.mean(amount_log)) / (np.std(amount_log) + 1e-5)
    X[:, 2] = (amount > p90).astype(np.float32)
    X[:, 3] = np.sin(2 * np.pi * hour / 24.0)
    X[:, 4] = np.cos(2 * np.pi * hour / 24.0)
    X[:, 5] = np.sin(2 * np.pi * day / 7.0)
    X[:, 6] = np.cos(2 * np.pi * day / 7.0)
    X[:, 7] = (step % 30) / 30.0
    X[:, 8] = is_high_risk_cat
    X[:, 9] = (amount > p90).astype(np.float32)
    X[:, 10] = np.clip(amount / median_amt, 0, 50) / 50.0
    X[:, 11] = 0.0
    X[:, 12] = is_high_risk_cat * 0.8
    X[:, 13] = 1.0 # Outflow merchant charge
    X[:, 14] = 0.3 # Retail bank scale
    X[:, 15] = is_high_risk_cat

    y = df["fraud"].values.astype(np.float32)
    return X, y
