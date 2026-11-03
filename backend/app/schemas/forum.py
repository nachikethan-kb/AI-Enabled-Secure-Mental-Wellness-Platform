from pydantic import BaseModel, Field


class ForumPostCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    content: str = Field(min_length=3, max_length=3000)


class ForumPostItem(BaseModel):
    id: int
    title: str
    content: str
    author_name: str
    created_at: str


class ForumPostListResponse(BaseModel):
    items: list[ForumPostItem]
