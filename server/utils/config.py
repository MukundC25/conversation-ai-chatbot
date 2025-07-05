import os
from typing import List
from pydantic import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    # OpenAI settings
    openai_api_key: str = ""
    openai_model: str = "gpt-3.5-turbo"
    
    # Vector database settings
    vector_db_type: str = "faiss"  # faiss or chromadb
    vector_db_path: str = "./vector_store"
    
    # CORS settings
    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # File upload settings
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    upload_dir: str = "./uploads"
    
    # Optional database settings
    mongodb_url: str = ""
    database_name: str = "chatbot_db"
    
    # Optional authentication settings
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()

def get_settings() -> Settings:
    """Get application settings"""
    return settings
