from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from db.supabase_client import supabase
from models.user import UserCreate
from models.token import Token
from gotrue.errors import AuthApiError

router = APIRouter()


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserCreate):
    try:
        # Sign up the user in Supabase Auth
        user_response = supabase.auth.sign_up({
            "email": user_in.email,
            "password": user_in.password,
        })

        if not user_response.user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create user")

        user_id = user_response.user.id

        # Insert user profile into the 'profiles' table
        profile_data = {
            "id": user_id,
            "full_name": user_in.full_name,
            "is_translator": user_in.is_translator,
            "avatar_url": user_in.avatar_url,
        }
        
        profile_response = supabase.table('profiles').insert(profile_data).execute()

        if profile_response.data is None and profile_response.error is not None:
             # If profile creation fails, you might want to delete the auth user
             # This part is complex due to user permissions. For now, we raise an error.
             # In a production scenario, you'd handle this more gracefully.
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not create profile: {profile_response.error.message}")


        return {"message": "User created successfully. Please check your email for verification."}

    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": form_data.username,
            "password": form_data.password,
        })
        if response.session and response.session.access_token:
            return {"access_token": response.session.access_token, "token_type": "bearer"}
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) 