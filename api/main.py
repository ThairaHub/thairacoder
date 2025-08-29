from fastapi import FastAPI, Request, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
import google.generativeai as genai
import os
import json
from typing import AsyncGenerator, List, Optional
from datetime import datetime, date
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from .database import get_db, Content
from .models import ContentCreate, ContentResponse, ContentUpdate
import requests
import random

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

@app.get("/trends")
async def get_trends(area: Optional[str] = Query("general", description="Area/topic to get trends for")):
    """
    Fetch trending topics for a specific area using AI generation
    """
    try:
        # Use Gemini to generate trending topics based on the area
        if os.environ.get("GEMINI_API_KEY"):
            genai.configure(api_key=os.environ["GEMINI_API_KEY"])
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = f"""
            Generate 6 trending topics for {area} that would be popular on social media platforms like Twitter/X, LinkedIn, and Threads.
            
            Return the response as a JSON array with this exact format:
            [
                {{"topic": "Topic Name", "engagement": "+XXX%", "platform": "Twitter/X"}},
                {{"topic": "Topic Name", "engagement": "+XXX%", "platform": "LinkedIn"}},
                {{"topic": "Topic Name", "engagement": "+XXX%", "platform": "Threads"}}
            ]
            
            Make sure the topics are:
            - Current and relevant to {area}
            - Engaging and clickable
            - Varied across different platforms
            - Have realistic engagement percentages between 120% and 300%
            
            Only return the JSON array, no other text.
            """
            
            result = model.generate_content(prompt)
            response_text = result.text.strip()
            
            # Clean up the response to extract JSON
            if response_text.startswith("\`\`\`json"):
                response_text = response_text[7:-3]
            elif response_text.startswith("\`\`\`"):
                response_text = response_text[3:-3]
            
            try:
                trends_data = json.loads(response_text)
                return JSONResponse({"trends": trends_data})
            except json.JSONDecodeError:
                # Fallback to default trends if JSON parsing fails
                pass
        
        # Fallback trends if API fails or no API key
        fallback_trends = [
            {"topic": f"{area.title()} Innovation", "engagement": f"+{random.randint(150, 280)}%", "platform": "LinkedIn"},
            {"topic": f"Future of {area.title()}", "engagement": f"+{random.randint(150, 280)}%", "platform": "Twitter/X"},
            {"topic": f"{area.title()} Best Practices", "engagement": f"+{random.randint(150, 280)}%", "platform": "Threads"},
            {"topic": f"{area.title()} Trends 2024", "engagement": f"+{random.randint(150, 280)}%", "platform": "LinkedIn"},
            {"topic": f"{area.title()} Tips & Tricks", "engagement": f"+{random.randint(150, 280)}%", "platform": "Twitter/X"},
            {"topic": f"{area.title()} Success Stories", "engagement": f"+{random.randint(150, 280)}%", "platform": "Threads"},
        ]
        
        return JSONResponse({"trends": fallback_trends})
        
    except Exception as e:
        return JSONResponse({"error": f"Failed to fetch trends: {str(e)}"}, status_code=500)

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

@app.post("/content/", response_model=ContentResponse)
async def create_content(content: ContentCreate, db: Session = Depends(get_db)):
    """Create new content entry"""
    # Mark previous versions as not latest
    db.query(Content).filter(
        Content.title == content.title,
        Content.platform == content.platform
    ).update({"is_latest": False})
    
    # Get next version number
    last_version = db.query(Content).filter(
        Content.title == content.title,
        Content.platform == content.platform
    ).order_by(Content.version.desc()).first()
    
    next_version = (last_version.version + 1) if last_version else 1
    
    # Create new content
    db_content = Content(
        title=content.title,
        platform=content.platform,
        content_type=content.content_type,
        content_text=content.content_text,
        version=next_version,
        is_latest=True
    )
    
    db.add(db_content)
    db.commit()
    db.refresh(db_content)
    
    return db_content

@app.get("/content/", response_model=List[ContentResponse])
async def get_all_content(
    db: Session = Depends(get_db), 
    latest_only: bool = True,
    platform: Optional[str] = Query(None, description="Filter by platform (twitter, linkedin, threads)"),
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD format)")
):
    """Get all content entries with optional filtering by platform and date"""
    query = db.query(Content)
    
    if latest_only:
        query = query.filter(Content.is_latest == True)
    
    if platform and platform.lower() != "all":
        query = query.filter(Content.platform.ilike(f"%{platform}%"))
    
    if date:
        try:
            filter_date = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(func.date(Content.created_at) == filter_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    return query.order_by(Content.created_at.desc()).all()

@app.get("/content/{content_id}", response_model=ContentResponse)
async def get_content(content_id: int, db: Session = Depends(get_db)):
    """Get specific content by ID"""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content

@app.get("/content/versions/{title}/{platform}", response_model=List[ContentResponse])
async def get_content_versions(title: str, platform: str, db: Session = Depends(get_db)):
    """Get all versions of specific content"""
    versions = db.query(Content).filter(
        Content.title == title,
        Content.platform == platform
    ).order_by(Content.version.desc()).all()
    
    if not versions:
        raise HTTPException(status_code=404, detail="Content not found")
    
    return versions

@app.put("/content/{content_id}", response_model=ContentResponse)
async def update_content(content_id: int, content_update: ContentUpdate, db: Session = Depends(get_db)):
    """Update existing content (creates new version)"""
    existing_content = db.query(Content).filter(Content.id == content_id).first()
    if not existing_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Mark all versions as not latest
    db.query(Content).filter(
        Content.title == existing_content.title,
        Content.platform == existing_content.platform
    ).update({"is_latest": False})
    
    # Create new version
    new_content = Content(
        title=content_update.title or existing_content.title,
        platform=existing_content.platform,
        content_type=existing_content.content_type,
        content_text=content_update.content_text or existing_content.content_text,
        version=existing_content.version + 1,
        is_latest=True
    )
    
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    
    return new_content

@app.delete("/content/{content_id}")
async def delete_content(content_id: int, db: Session = Depends(get_db)):
    """Delete specific content version"""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    db.delete(content)
    db.commit()
    
    return {"message": "Content deleted successfully"}

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8000, env_file='.env')
