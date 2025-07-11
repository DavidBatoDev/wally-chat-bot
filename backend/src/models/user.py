from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from uuid import UUID
import datetime


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    full_name: str
    is_translator: bool = False
    avatar_url: Optional[str] = None


class User(UserBase):
    id: UUID
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class Profile(BaseModel):
    id: UUID = Field(..., description="This should be the same as the user's ID from auth.users")
    full_name: str
    is_translator: bool = False
    updated_at: datetime.datetime
    created_at: datetime.datetime
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True 