import uvicorn

if __name__ == "__main__":
    print("Starting CrossBank TrustFL FastAPI Backend on http://127.0.0.1:8000...")
    print("Interactive Swagger API Documentation available at: http://127.0.0.1:8000/docs")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
