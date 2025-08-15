from enum import Enum
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
from uuid import UUID
import datetime


class ProjectBase(BaseModel):
    title: str


class ProjectCreate(ProjectBase):
    user_id: UUID
    collaborator: Optional[UUID] = None
    pass

class ProjectStep(Enum):
    # initial_ocr = "initial_ocr"
    # pending_confirmation = "pending_confirmation"
    text_ocr = "text_ocr"
    assigning_translator = "assigning_translator"
    assigned_translator = "assigned_translator"
    in_progress = "in_progress"
    pm_confirmation = "pm_confirmation"
    sent_back = "sent_back"
    completed = "completed"

class WorkflowStep(Enum):
    translation = "translate"
    layout = "layout"
    final_layout = "final-layout"

class Project(ProjectBase):
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    created_by: UUID
    version: str
    project_data: Dict[str, Any] = {}
    current_page: int
    num_pages: int
    current_workflow_step: str
    current_project_step: ProjectStep
    source_language: str
    desired_language: str
    is_public: bool
    tags: List[str]
    thumbnail_url: Optional[str] = None
    file_size: int
    last_synced_at: datetime.datetime
    sync_status: str
    local_version: int
    server_version: int
    deadline: datetime.datetime
    delivery_date: datetime.datetime
    client_name: str
    assigned_translator: Optional[UUID] = None
    class Config:
        from_attributes = True 