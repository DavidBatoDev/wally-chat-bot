from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, projects, pages

# This is for Swagger UI auth
from fastapi.openapi.utils import get_openapi
import uvicorn

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


@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the Wally OCR and Canvas API"}

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