# Social Media OCR Backend

AI-powered backend system for Social Media OCR application with Canva-like interface.

## Overview

This backend provides a comprehensive API for handling image uploads, OCR processing using Google Document AI, and layout management for a social media OCR application. Users can upload social media screenshots, process them with AI to extract text and UI elements, and manipulate the results in a canvas-like interface.

## Features

- **Image Upload & Management**: Upload and manage social media images with Supabase Storage
- **OCR Processing**: Extract text and layout information using Google Document AI
- **Layout Management**: Create and edit canvas layouts with extracted elements
- **User Authentication**: JWT-based authentication with Supabase Auth integration
- **Real-time Processing**: Asynchronous OCR processing with status tracking
- **RESTful API**: Clean, well-documented API endpoints
- **Rate Limiting**: Built-in rate limiting and security middleware
- **Database Management**: PostgreSQL with SQLAlchemy ORM

## Tech Stack

- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth + JWT
- **Storage**: Supabase Storage
- **OCR**: Google Document AI
- **ORM**: SQLAlchemy
- **Validation**: Pydantic
- **Testing**: pytest

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/change-password` - Change password

### Images
- `POST /api/v1/images/upload` - Upload image
- `GET /api/v1/images/` - List user images
- `GET /api/v1/images/{id}` - Get image details
- `PUT /api/v1/images/{id}` - Update image metadata
- `DELETE /api/v1/images/{id}` - Delete image

### OCR Processing
- `POST /api/v1/ocr/process/{image_id}` - Process image with OCR
- `GET /api/v1/ocr/results/{image_id}` - Get OCR results
- `GET /api/v1/ocr/results/` - List OCR results
- `DELETE /api/v1/ocr/results/{image_id}` - Delete OCR result

### Layout Management
- `POST /api/v1/layouts/` - Create layout
- `GET /api/v1/layouts/` - List layouts
- `GET /api/v1/layouts/{id}` - Get layout details
- `PUT /api/v1/layouts/{id}` - Update layout
- `PUT /api/v1/layouts/{id}/canvas` - Update canvas elements
- `DELETE /api/v1/layouts/{id}` - Delete layout

### Users
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `GET /api/v1/users/{id}` - Get user by ID

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SocMedOCR/wally-soc-med/backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp environment.example .env
   # Edit .env with your configuration
   ```

5. **Configure services**
   - Set up Supabase project and get credentials
   - Set up Google Cloud Project and enable Document AI
   - Create service account and download credentials
   - Set up PostgreSQL database

## Configuration

### Environment Variables

Copy `environment.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/soc_med_ocr

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Google Document AI
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your-processor-id
GOOGLE_DOCUMENT_AI_LOCATION=us

# Security
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
APP_NAME=Social Media OCR Backend
APP_VERSION=1.0.0
DEBUG=True
ENVIRONMENT=development
```

## Usage

### Development Server

```bash
# Start development server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Or use the main.py directly
python src/main.py
```

### Production Server

```bash
# Start production server
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Database Setup

The application will automatically create database tables on startup. For manual database management:

```python
from src.database.connection import db_manager

# Create tables
db_manager.create_tables()

# Reset database (caution: deletes all data)
db_manager.reset_database()

# Health check
db_manager.health_check()
```

## Usage Examples

### Upload and Process Image

```python
import requests

# Upload image
with open('social_media_screenshot.png', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/api/v1/images/upload',
        files={'file': f},
        headers={'Authorization': 'Bearer YOUR_JWT_TOKEN'}
    )
    image_data = response.json()

# Process with OCR
response = requests.post(
    f'http://localhost:8000/api/v1/ocr/process/{image_data["id"]}',
    headers={'Authorization': 'Bearer YOUR_JWT_TOKEN'}
)
ocr_result = response.json()
```

### Create Layout from OCR

```python
# Create layout
layout_data = {
    "name": "My Social Media Layout",
    "image_id": image_data["id"],
    "canvas_width": 800,
    "canvas_height": 600,
    "elements": ocr_result["canvas_elements"]
}

response = requests.post(
    'http://localhost:8000/api/v1/layouts/',
    json=layout_data,
    headers={'Authorization': 'Bearer YOUR_JWT_TOKEN'}
)
layout = response.json()
```

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=src

# Run specific test file
pytest tests/test_auth.py
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── settings.py          # Application settings
│   │   └── database/
│   │   │   ├── base.py              # Database base configuration
│   │   │   └── connection.py        # Database connection management
│   │   └── middleware/
│   │   │   ├── error_handling.py    # Error handling middleware
│   │   │   └── rate_limiting.py     # Rate limiting middleware
│   │   └── models/
│   │   │   ├── users.py             # User model
│   │   │   ├── images.py            # Image model
│   │   │   ├── layouts.py           # Layout and LayoutElement models
│   │   │   └── ocr_results.py       # OCR result model
│   │   └── routers/
│   │   │   ├── auth.py              # Authentication endpoints
│   │   │   ├── users.py             # User management endpoints
│   │   │   ├── images.py            # Image management endpoints
│   │   │   ├── ocr.py               # OCR processing endpoints
│   │   │   └── layouts.py           # Layout management endpoints
│   │   └── schemas/
│   │   │   ├── auth_schemas.py      # Authentication schemas
│   │   │   ├── user_schemas.py      # User schemas
│   │   │   ├── image_schemas.py     # Image schemas
│   │   │   ├── layout_schemas.py    # Layout schemas
│   │   │   └── ocr_schemas.py       # OCR schemas
│   │   └── services/
│   │   │   ├── auth_service.py      # Authentication service
│   │   │   ├── supabase_service.py  # Supabase integration
│   │   │   ├── google_document_ai_service.py  # Google Document AI service
│   │   │   └── layout_service.py    # Layout processing service
│   │   └── main.py                  # FastAPI application entry point
│   ├── requirements.txt             # Python dependencies
│   ├── environment.example          # Environment variables template
│   └── README.md                   # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue in the repository or contact the development team. 