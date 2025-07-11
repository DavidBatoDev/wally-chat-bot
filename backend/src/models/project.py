from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import datetime


class ProjectBase(BaseModel):
    title: str


class ProjectCreate(ProjectBase):
    user_id: UUID
    collaborator: Optional[UUID] = None
    pass


class Project(ProjectBase):
    id: UUID
    user_id: UUID
    files: Optional[List[str]] = []
    collaborator: Optional[UUID] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True 