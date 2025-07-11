from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    GOOGLE_PROJECT_ID: str
    GOOGLE_DOCUMENT_AI_PROCESSOR_ID: str
    GOOGLE_DOCUMENT_AI_LOCATION: str = "us"

    # By setting extra to 'ignore', Pydantic will not raise an error for
    # additional variables present in the .env file.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings() 