from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, projects, pages, templates
from services.db_service import db_service

# This is for Swagger UI auth
from fastapi.openapi.utils import get_openapi
import uvicorn
import logging

logger = logging.getLogger(__name__)

app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(pages.router, prefix="/pages", tags=["Pages"])
app.include_router(templates.router, prefix="/templates", tags=["Templates"])


@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the Wally OCR and Canvas API"}

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint that verifies database connectivity.
    """
    try:
        # Check database health
        db_healthy = db_service.health_check()
        
        if not db_healthy:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        return {
            "status": "healthy",
            "database": "connected",
            "message": "All services are operational"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.get("/db-info", tags=["Database"])
async def database_info():
    """
    Get information about the database service.
    """
    try:
        # Test basic connectivity
        db_healthy = db_service.health_check()
        
        # Get some basic stats
        stats = {}
        try:
            profiles_count = len(db_service.get_records('profiles', limit=1000))
            file_objects_count = len(db_service.get_records('file_objects', limit=1000))
            templates_count = len(db_service.get_records('templates', limit=1000))
            
            stats = {
                "profiles": profiles_count,
                "file_objects": file_objects_count,
                "templates": templates_count
            }
        except Exception as e:
            logger.warning(f"Could not fetch database stats: {e}")
            stats = {"error": "Could not fetch stats"}
        
        return {
            "database_healthy": db_healthy,
            "service_class": db_service.__class__.__name__,
            "client_initialized": db_service._client is not None,
            "table_counts": stats
        }
    except Exception as e:
        logger.error(f"Database info check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get database info: {str(e)}")

# Custom OpenAPI schema for JWT token auth in Swagger UI
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Wally Canvas API",
        version="1.0.0",
        description="API for managing projects, pages, and OCR processing.",
        routes=app.routes,
    )
    
    # Add security scheme for JWT
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your JWT token in the format: 'Bearer &lt;token&gt;'"
        }
    }
    
    # Apply security scheme to all protected endpoints
    for path_item in openapi_schema["paths"].values():
        for method in path_item.values():
            # You could add more sophisticated logic here to only protect specific routes
            # For now, this is a simple approach. A better way is to use security dependencies in routers.
            # However, for user convenience in /docs, we can declare security globally
            # if the endpoint is not an auth endpoint.
             if "Authentication" not in method.get("tags", []):
                    method["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 