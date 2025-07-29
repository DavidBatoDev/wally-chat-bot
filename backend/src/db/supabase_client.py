from supabase import create_client, Client
from core.config import settings

# Use the provided Supabase credentials
supabase_url = "https://ylvmwrvyiamecvnydwvj.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsdm13cnZ5aWFtZWN2bnlkd3ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA5MjkzMSwiZXhwIjoyMDYyNjY4OTMxfQ.6PehkE7I_Q9j8EzzSUC6RGi7Z9QykHcY6Qa20eiLKtM"

try:
    supabase: Client = create_client(supabase_url, supabase_key)
    print("Supabase client initialized successfully")
except Exception as e:
    print(f"Error initializing Supabase client: {e}")
    supabase: Client = None 