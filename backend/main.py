import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.api import status, training, fraud, security, audit

app = FastAPI(
    title="CrossBank TrustFL API",
    description="Blockchain-Audited Federated Learning for Cross-Bank Fraud Detection and Malicious-Participant Defence",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(status.router)
app.include_router(training.router)
app.include_router(fraud.router)
app.include_router(security.router)
app.include_router(audit.router)

@app.get("/")
def root():
    return {
        "project": "CrossBank TrustFL",
        "description": "Federated Learning & Blockchain Audit Backend",
        "docs_url": "/docs",
        "status": "ONLINE"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
