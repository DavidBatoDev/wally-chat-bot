from supabase import create_client, Client
from core.config import settings

supabase_url = settings.SUPABASE_URL
supabase_key = settings.SUPABASE_SERVICE_KEY

try:
    supabase: Client = create_client(supabase_url, supabase_key)
except Exception as e:
    print(f"Error initializing Supabase client: {e}")
    supabase: Client = None 