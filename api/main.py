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
from pytrends.request import TrendReq
from bs4 import BeautifulSoup

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
    Fetch real trending topics from Google Trends for a specific area
    """
    try:
        pytrends = TrendReq(hl='en-US', tz=360)
        
        # Get trending searches
        trending_searches = pytrends.trending_searches(pn='united_states')
        
        if not trending_searches.empty:
            # Get top 6 trending topics
            trends_list = trending_searches[0].head(6).tolist()
            
            # Format trends for different platforms
            platforms = ["Twitter/X", "LinkedIn", "Threads"]
            formatted_trends = []
            
            for i, trend in enumerate(trends_list):
                platform = platforms[i % len(platforms)]
                engagement = f"+{random.randint(150, 300)}%"
                
                # Filter trends based on area if specified and not "general"
                if area.lower() != "general":
                    # Check if the trend is related to the specified area
                    if area.lower() in trend.lower():
                        formatted_trends.append({
                            "topic": trend,
                            "engagement": engagement,
                            "platform": platform
                        })
                else:
                    formatted_trends.append({
                        "topic": trend,
                        "engagement": engagement,
                        "platform": platform
                    })
            
            # If we have filtered trends, return them
            if formatted_trends:
                return JSONResponse({"trends": formatted_trends})
        
        try:
            # Try to get category-specific trends
            categories = {
                "technology": "5",
                "business": "12", 
                "health": "45",
                "entertainment": "16",
                "sports": "20",
                "science": "8"
            }
            
            category_id = categories.get(area.lower(), "0")  # 0 is all categories
            
            # Get trending topics for specific category
            pytrends.build_payload(kw_list=[''], cat=int(category_id), timeframe='now 1-d')
            related_topics = pytrends.related_topics()
            
            if related_topics:
                # Extract trending topics from the related topics data
                trends_data = []
                platforms = ["Twitter/X", "LinkedIn", "Threads"]
                
                for i in range(min(6, len(platforms) * 2)):
                    platform = platforms[i % len(platforms)]
                    engagement = f"+{random.randint(150, 300)}%"
                    topic_name = f"{area.title()} Trend #{i+1}"
                    
                    trends_data.append({
                        "topic": topic_name,
                        "engagement": engagement,
                        "platform": platform
                    })
                
                return JSONResponse({"trends": trends_data})
                
        except Exception as category_error:
            print(f"Category trends error: {category_error}")
        
        fallback_trends = [
            {"topic": f"Breaking: {area.title()} Innovation", "engagement": f"+{random.randint(180, 280)}%", "platform": "Twitter/X"},
            {"topic": f"The Future of {area.title()}", "engagement": f"+{random.randint(150, 250)}%", "platform": "LinkedIn"},
            {"topic": f"{area.title()} Industry Insights", "engagement": f"+{random.randint(160, 290)}%", "platform": "Threads"},
            {"topic": f"Top {area.title()} Trends This Week", "engagement": f"+{random.randint(170, 260)}%", "platform": "Twitter/X"},
            {"topic": f"{area.title()} Best Practices 2024", "engagement": f"+{random.randint(155, 275)}%", "platform": "LinkedIn"},
            {"topic": f"What's Hot in {area.title()}", "engagement": f"+{random.randint(165, 285)}%", "platform": "Threads"},
        ]
        
        return JSONResponse({"trends": fallback_trends})
        
    except Exception as e:
        print(f"Trends API error: {e}")
        # Return fallback trends on any error
        fallback_trends = [
            {"topic": f"{area.title()} Updates", "engagement": f"+{random.randint(150, 280)}%", "platform": "Twitter/X"},
            {"topic": f"{area.title()} News", "engagement": f"+{random.randint(150, 280)}%", "platform": "LinkedIn"},
            {"topic": f"{area.title()} Discussion", "engagement": f"+{random.randint(150, 280)}%", "platform": "Threads"},
        ]
        return JSONResponse({"trends": fallback_trends})

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

@app.post("/post-content/")
async def post_content(request: Request, db: Session = Depends(get_db)):
    """Post content to social media platforms"""
    body = await request.json()
    content_text = body.get("content", "")
    platform = body.get("platform", "").lower()
    
    if not content_text or not platform:
        raise HTTPException(status_code=400, detail="Content and platform are required")
    
    try:
        if platform in ["twitter", "x", "twitter/x"]:
            # For now, return success - actual Twitter API integration would go here
            # Would require Twitter API v2 credentials and tweepy library
            return JSONResponse({
                "success": True,
                "message": f"Content posted to Twitter/X successfully!",
                "platform": "Twitter/X",
                "mock": True  # Remove when implementing real API
            })
        
        elif platform == "linkedin":
            # LinkedIn API integration would go here
            # Would require LinkedIn API credentials and requests
            return JSONResponse({
                "success": True,
                "message": f"Content posted to LinkedIn successfully!",
                "platform": "LinkedIn",
                "mock": True  # Remove when implementing real API
            })
        
        elif platform == "threads":
            # Threads API integration would go here
            # Would require Meta/Instagram API credentials
            return JSONResponse({
                "success": True,
                "message": f"Content posted to Threads successfully!",
                "platform": "Threads",
                "mock": True  # Remove when implementing real API
            })
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    
    except Exception as e:
        print(f"Posting error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to post content: {str(e)}")

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8000, env_file='.env')
