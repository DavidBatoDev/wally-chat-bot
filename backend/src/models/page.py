from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from uuid import UUID
import datetime


class BoundingPoly(BaseModel):
    vertices: List[Dict[str, float]]


class Style(BaseModel):
    background_color: Optional[List[float]] = None
    text_color: Optional[List[float]] = None
    border_color: Optional[List[float]] = None
    has_border: Optional[bool] = False
    border_radius: Optional[int] = 0
    padding: Optional[int] = 8
    font_weight: Optional[str] = "normal"
    alignment: Optional[str] = "left"
    font_size: Optional[float] = 12.0
    font_name: Optional[str] = "Helvetica"  # Changed from font_family to match service
    actual_width: Optional[float] = None
    actual_height: Optional[float] = None
    leading: Optional[float] = None
    expanded_width: Optional[float] = None
    expanded_height: Optional[float] = None


class OCREntity(BaseModel):
    type: str
    text: str
    confidence: float
    bounding_poly: BoundingPoly
    id: str
    style: Style


class PageBase(BaseModel):
    title: Optional[str] = None
    page_no: int
    layout: Optional[Dict[str, Any]] = None
    ocr_layout: Optional[Dict[str, Any]] = None


class PageCreate(PageBase):
    project_id: UUID


class Page(PageBase):
    id: UUID
    project_id: UUID
    user_id: UUID
    files: Optional[List[str]] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True 