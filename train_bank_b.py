import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    precision_recall_curve
)

class BankBMLP(nn.Module):
    def __init__(self, input_dim=12):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(32, 1)
        )

    def forward(self, x):
        return self.net(x)

def train_bank_b():
    print("=" * 60)
    print(" [Bank B] PaySim Mobile Money - Model Training")
    print("=" * 60)

    dataset_path = os.path.join("model1", "PS_20174392719_1491204439457_log.csv")
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    print(f"Loading data from {dataset_path}...")
    # Read chunked or sample to handle 6.3M rows efficiently and cleanly
    chunks = []
    fraud_chunks = []
    sample_non_fraud_target = 300000
    non_fraud_collected = 0

    chunk_size = 500000
    print(f"Reading dataset in chunks (preserving all fraud cases)...")
    for chunk in pd.read_csv(dataset_path, chunksize=chunk_size):
        frauds = chunk[chunk["isFraud"] == 1]
        non_frauds = chunk[chunk["isFraud"] == 0]

        fraud_chunks.append(frauds)
        if non_fraud_collected < sample_non_fraud_target:
            take = min(len(non_frauds), sample_non_fraud_target - non_fraud_collected)
            chunks.append(non_frauds.iloc[:take])
            non_fraud_collected += take

    df_frauds = pd.concat(fraud_chunks, ignore_index=True)
    df_non_frauds = pd.concat(chunks, ignore_index=True)
    df = pd.concat([df_frauds, df_non_frauds], ignore_index=True).sample(frac=1.0, random_state=42).reset_index(drop=True)

    print(f"Sampled records: {len(df):,}")
    print(f"Total Frauds preserved: {df['isFraud'].sum():,} ({df['isFraud'].mean()*100:.2f}%)")

    # Feature Engineering
    print("Engineering features...")
    df["hour"] = df["step"] % 24
    df["amount_log"] = np.log1p(df["amount"])
    df["orig_diff"] = df["oldbalanceOrg"] - df["newbalanceOrig"]
    df["dest_diff"] = df["newbalanceDest"] - df["oldbalanceDest"]
    df["orig_error"] = df["newbalanceOrig"] + df["amount"] - df["oldbalanceOrg"]
    df["dest_error"] = df["oldbalanceDest"] + df["amount"] - df["newbalanceDest"]

    # One-hot encode 'type'
    type_dummies = pd.get_dummies(df["type"], prefix="type", drop_first=False)

    numeric_cols = ["hour", "amount_log", "orig_diff", "dest_diff", "orig_error", "dest_error"]
    scaler = StandardScaler()
    scaled_numerics = scaler.fit_transform(df[numeric_cols])

    X = np.hstack([scaled_numerics, type_dummies.values.astype(np.float32)])
    y = df["isFraud"].values.astype(np.float32)

    input_dim = X.shape[1]
    print(f"Processed feature shape: {X.shape} (Input Dimension = {input_dim})")

    # Train/Val/Test Split (70% train, 15% val, 15% test)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    print(f"Train split: {len(X_train):,} | Val split: {len(X_val):,} | Test split: {len(X_test):,}")

    train_dataset = TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train))
    val_dataset = TensorDataset(torch.tensor(X_val, dtype=torch.float32), torch.tensor(y_val))

    train_loader = DataLoader(train_dataset, batch_size=512, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=1024, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = BankBMLP(input_dim=input_dim).to(device)

    neg_count = (y_train == 0).sum()
    pos_count = (y_train == 1).sum()
    pos_weight = torch.tensor([neg_count / max(pos_count, 1)], device=device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)

    epochs = 6
    print("\nStarting training...")
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            logits = model(batch_x).squeeze(-1)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(batch_y)

        train_loss = total_loss / len(X_train)

        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for bx, by in val_loader:
                bx = bx.to(device)
                probs = torch.sigmoid(model(bx).squeeze(-1)).cpu().numpy()
                val_preds.extend(probs)
                val_targets.extend(by.numpy())

        val_pr_auc = average_precision_score(val_targets, val_preds)
        val_roc_auc = roc_auc_score(val_targets, val_preds)
        print(f"Epoch [{epoch}/{epochs}] - Loss: {train_loss:.4f} | Val PR-AUC: {val_pr_auc:.4f} | Val ROC-AUC: {val_roc_auc:.4f}")

    # Evaluate on Test Set
    print("\nEvaluating on Test Set...")
    model.eval()
    with torch.no_grad():
        test_logits = model(torch.tensor(X_test, dtype=torch.float32).to(device)).squeeze(-1)
        test_probs = torch.sigmoid(test_logits).cpu().numpy()

    test_pr_auc = average_precision_score(y_test, test_probs)
    test_roc_auc = roc_auc_score(y_test, test_probs)

    precisions, recalls, thresholds = precision_recall_curve(y_test, test_probs)
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-10)
    best_idx = np.argmax(f1_scores)
    best_threshold = thresholds[min(best_idx, len(thresholds) - 1)]

    test_preds = (test_probs >= best_threshold).astype(int)

    print("\n" + "=" * 60)
    print(" [Bank B] Final Test Set Evaluation Results")
    print("=" * 60)
    print(f"PR-AUC Score        : {test_pr_auc:.4f}")
    print(f"ROC-AUC Score       : {test_roc_auc:.4f}")
    print(f"Optimal Threshold   : {best_threshold:.4f}")
    print(f"Best Test F1-Score  : {f1_scores[best_idx]:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, test_preds, digits=4, target_names=["Legitimate", "Fraud"]))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, test_preds))

    # Save Checkpoint
    os.makedirs("checkpoints", exist_ok=True)
    save_path = os.path.join("checkpoints", "bank_b_baseline.pt")
    torch.save({
        "model_state_dict": model.state_dict(),
        "input_dim": input_dim,
        "best_threshold": float(best_threshold),
        "test_pr_auc": float(test_pr_auc),
        "test_f1": float(f1_scores[best_idx])
    }, save_path)
    print(f"\nModel checkpoint saved successfully to: {save_path}")

if __name__ == "__main__":
    train_bank_b()
