from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
import google.generativeai as genai
import os
import json
from typing import AsyncGenerator
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
"http://localhost:3000",  # Your Next.js frontend origin
"http://localhost:8080",  # Your Vite.js frontend origin
"https://coder.thairahub.com", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Or explicitly: ["POST", "GET", "OPTIONS"]
    allow_headers=["*"],
)

# Configure Gemini - initial configuration (optional if API key comes from request)
if os.environ.get("GEMINI_API_KEY"):
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])

@app.post("/gemini/generate")
async def generate(request: Request):
    """
    Non-streaming Gemini response (for quick calls).
    """
    body = await request.json()
    message = body.get("message", "")
    context = body.get("context", "")
    api_key = body.get("apiKey")
    
    # Use provided API key or fallback to environment variable
    if api_key:
        genai.configure(api_key=api_key)
    elif os.environ.get("GEMINI_API_KEY"):
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    else:
        return JSONResponse({"error": "No API key provided"}, status_code=400)

    model = genai.GenerativeModel("gemini-1.5-flash")
    result = model.generate_content(
        f"{message}\n\nContext (selected files):\n{context}" if context else message
    )

    text = result.text or "No response generated"
    return JSONResponse({"response": text})


@app.post("/gemini/stream")
async def stream_generate(request: Request):
    """
    Streaming Gemini response (NDJSON style).
    """
    body = await request.json()
    print(body)
    prompt = body.get("prompt", "")
    api_key = body.get("apiKey")
    
    # Use provided API key or fallback to environment variable
    if api_key:
        genai.configure(api_key=api_key)
    elif os.environ.get("GEMINI_API_KEY"):
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    else:
        return JSONResponse({"error": "No API key provided"}, status_code=400)

    model = genai.GenerativeModel("gemini-1.5-flash")

    async def event_generator() -> AsyncGenerator[str, None]:
        # Gemini SDK streaming
        response = model.generate_content(prompt, stream=True)
        for chunk in response:
            text = chunk.text
            if text:
                # Send NDJSON (newline-delimited JSON)
                yield json.dumps({"response": text}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8001, env_file='.env')
