from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID


class ExtractedField(BaseModel):
    label: str
    value: str


class BoundingPoly(BaseModel):
    vertices: List[Dict[str, float]]


class EntityStyle(BaseModel):
    x: float
    y: float
    width: float
    height: float
    font_family: str
    font_size: int
    color: str
    background_color: str = "transparent"
    border_color: str = "transparent"
    border_width: int = 0
    rotation: int = 0
    opacity: float = 1.0
    z_index: int = 1


class OCREntity(BaseModel):
    type: str
    text: str
    confidence: float
    bounding_poly: BoundingPoly
    id: str
    style: EntityStyle


class DocumentInfo(BaseModel):
    total_pages: int
    mime_type: str
    page_width: float
    page_height: float


class PageLayout(BaseModel):
    page_number: int
    text: str
    entities: List[OCREntity]


class StyledLayout(BaseModel):
    document_info: DocumentInfo
    pages: List[PageLayout]


class TemplateOCRResponse(BaseModel):
    template_id: str
    doc_type: str
    variation: str
    extracted_data: Dict[str, ExtractedField]
    missing_fields: Dict[str, ExtractedField]
    styled_layout: StyledLayout
    success: bool


class TemplateOCRError(BaseModel):
    template_id: str
    error: str
    success: bool = False 