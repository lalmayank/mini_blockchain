import os
import argparse
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np

from src.model import GlobalFraudMLP, get_state_dict_hash
from src.common_preprocessing import (
    load_bank_a_common,
    load_bank_b_common,
    load_bank_c_common
)

def run_local_training():
    parser = argparse.ArgumentParser(description="CrossBank TrustFL - Federated Client Node")
    parser.add_argument("--bank", type=str, required=True, choices=["bank_a", "bank_b", "bank_c"],
                        help="Bank identity (bank_a, bank_b, bank_c)")
    parser.add_argument("--round", type=int, default=1, help="Federated training round number")
    parser.add_argument("--epochs", type=int, default=2, help="Number of local epochs")
    parser.add_argument("--batch-size", type=int, default=512, help="Training batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--global-weights", type=str, default="", help="Path to current global model checkpoint")
    parser.add_argument("--output", type=str, default="", help="Output update checkpoint path")
    parser.add_argument("--attack", type=str, default="none",
                        choices=["none", "scale_poison", "random_noise", "label_flip"],
                        help="Simulate malicious attack: none, scale_poison, random_noise, label_flip")

    args = parser.parse_args()

    print("=" * 65)
    print(f" [Client Node: {args.bank.upper()}] Starting Federated Round {args.round}")
    if args.attack != "none":
        print(f" >>> ATTACK SIMULATION ACTIVE: {args.attack.upper()} <<<")
    print("=" * 65)

    # 1. Load data via universal 16-feature schema
    print(f"Loading local private data for {args.bank}...")
    if args.bank == "bank_a":
        X, y = load_bank_a_common()
    elif args.bank == "bank_b":
        X, y = load_bank_b_common()
    else:
        X, y = load_bank_c_common()

    # If label flip attack is active, reverse the fraud labels
    if args.attack == "label_flip":
        print(" [ATTACK] Flipping labels (teaching model that fraud is legitimate)...")
        y = 1.0 - y

    sample_count = len(X)
    print(f"Total local records: {sample_count:,} | Fraud count: {int(y.sum()):,}")

    dataset = TensorDataset(torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.float32))
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = GlobalFraudMLP(input_dim=16).to(device)

    # 2. Load global model weights if provided
    if args.global_weights and os.path.exists(args.global_weights):
        print(f"Loading initial global weights from: {args.global_weights}")
        ckpt = torch.load(args.global_weights, weights_only=True)
        state_dict = ckpt["state_dict"] if "state_dict" in ckpt else ckpt
        model.load_state_dict(state_dict)
    else:
        print("No prior global weights provided; initializing from base architecture.")

    # 3. Train on local data
    neg_count = (y == 0).sum()
    pos_count = (y == 1).sum()
    pos_weight = torch.tensor([neg_count / max(pos_count, 1)], device=device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    print(f"Executing {args.epochs} local training epoch(s)...")
    model.train()
    for ep in range(1, args.epochs + 1):
        running_loss = 0.0
        for bx, by in loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            logits = model(bx).squeeze(-1)
            loss = criterion(logits, by)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * len(by)
        avg_loss = running_loss / sample_count
        print(f"  Local Epoch [{ep}/{args.epochs}] - Loss: {avg_loss:.4f}")

    # Extract state dict
    local_state_dict = {k: v.cpu() for k, v in model.state_dict().items()}

    # 4. Apply malicious poisoning if simulated
    if args.attack == "scale_poison":
        print(" [ATTACK] Scaling weights by 100x to poison global consensus...")
        for k in local_state_dict:
            local_state_dict[k] = local_state_dict[k] * 100.0
    elif args.attack == "random_noise":
        print(" [ATTACK] Injecting high-variance Gaussian noise into parameters...")
        for k in local_state_dict:
            local_state_dict[k] = local_state_dict[k] + torch.randn_like(local_state_dict[k]) * 10.0

    # 5. Compute cryptographic hash
    update_hash = get_state_dict_hash(local_state_dict)
    print(f"\nCryptographic Update Hash (SHA-256): {update_hash}")

    # 6. Save update payload
    os.makedirs("checkpoints", exist_ok=True)
    out_file = args.output if args.output else os.path.join("checkpoints", f"update_{args.bank}_r{args.round}.pt")
    torch.save({
        "bank_id": args.bank,
        "round_id": args.round,
        "sample_count": sample_count,
        "weights_hash": update_hash,
        "state_dict": local_state_dict,
        "attack_mode": args.attack
    }, out_file)

    print(f"Update package successfully created and saved to: {out_file}\n")

if __name__ == "__main__":
    run_local_training()
