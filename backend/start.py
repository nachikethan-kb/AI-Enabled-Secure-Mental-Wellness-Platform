#!/usr/bin/env python
"""Start the Healthly FastAPI backend server"""

import uvicorn
import sys
import os

# Ensure we're in the backend directory
os.chdir(os.path.dirname(__file__))

if __name__ == "__main__":
    print("Starting Healthly Backend...")
    print("API available at: http://localhost:8000")
    print("API Docs at: http://localhost:8000/docs")
    print("Press Ctrl+C to stop the server\n")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
