from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ContentCreate(BaseModel):
    title: str
    platform: str
    content_type: str
    content_text: str

class ContentResponse(BaseModel):
    id: int
    title: str
    platform: str
    content_type: str
    content_text: str
    version: int
    is_latest: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ContentUpdate(BaseModel):
    title: Optional[str] = None
    content_text: Optional[str] = None
