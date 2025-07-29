from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
import datetime


class TemplateBase(BaseModel):
    doc_type: str
    variation: str
    file_url: str
    info_json: Dict[str, Any]


class TemplateCreate(TemplateBase):
    pass


class Template(TemplateBase):
    id: UUID
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True 