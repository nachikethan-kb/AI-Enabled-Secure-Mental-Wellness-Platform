from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.forum_post import ForumPost
from app.models.user import User
from app.schemas.forum import ForumPostCreateRequest, ForumPostItem, ForumPostListResponse

router = APIRouter()


@router.get("/posts", response_model=ForumPostListResponse)
def list_posts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ForumPostListResponse:
    posts = db.query(ForumPost, User).join(User, ForumPost.user_id == User.id).order_by(ForumPost.created_at.desc()).all()
    return ForumPostListResponse(
        items=[
            ForumPostItem(
                id=post.id,
                title=post.title,
                content=post.content,
                author_name=user.full_name,
                created_at=post.created_at.isoformat(),
            )
            for post, user in posts
        ]
    )


@router.post("/posts", response_model=ForumPostItem, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: ForumPostCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ForumPostItem:
    post = ForumPost(user_id=current_user.id, title=payload.title, content=payload.content)
    db.add(post)
    db.commit()
    db.refresh(post)

    return ForumPostItem(
        id=post.id,
        title=post.title,
        content=post.content,
        author_name=current_user.full_name,
        created_at=post.created_at.isoformat(),
    )
