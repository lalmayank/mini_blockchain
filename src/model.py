import io
import hashlib
import torch
import torch.nn as nn

class GlobalFraudMLP(nn.Module):
    """
    Standardized Multi-Layer Perceptron (MLP) for Cross-Bank Fraud Detection.
    All participating banks share this exact architecture for FedAvg compatibility.
    """
    def __init__(self, input_dim=16, hidden1=64, hidden2=32):
        super().__init__()
        self.input_dim = input_dim
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden1),
            nn.BatchNorm1d(hidden1),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden1, hidden2),
            nn.BatchNorm1d(hidden2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden2, 1)
        )

    def forward(self, x):
        return self.net(x)

def get_model_hash(model: nn.Module) -> str:
    """Computes deterministic SHA-256 hash of model parameters."""
    hasher = hashlib.sha256()
    for param in model.parameters():
        hasher.update(param.detach().cpu().numpy().tobytes())
    return hasher.hexdigest()

def get_state_dict_hash(state_dict: dict) -> str:
    """Computes deterministic SHA-256 hash of a PyTorch state_dict."""
    hasher = hashlib.sha256()
    for key in sorted(state_dict.keys()):
        tensor = state_dict[key].detach().cpu()
        hasher.update(key.encode("utf-8"))
        hasher.update(tensor.numpy().tobytes())
    return hasher.hexdigest()

def serialize_state_dict(state_dict: dict) -> bytes:
    """Serializes state_dict to bytes for network transmission."""
    buffer = io.BytesIO()
    torch.save(state_dict, buffer)
    return buffer.getvalue()

def deserialize_state_dict(data: bytes) -> dict:
    """Deserializes bytes back to state_dict."""
    buffer = io.BytesIO(data)
    return torch.load(buffer, weights_only=True)
