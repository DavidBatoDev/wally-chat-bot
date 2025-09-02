# Environment Variables Configuration

## Required Environment Variables

### For the Puppeteer Service (backend/puppeteer/.env)

```bash
# Service Configuration
NODE_ENV=development
OCR_CAPTURE_PORT=3001

# Puppeteer Configuration
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage

# Supabase (required for /capture-and-ocr-to-supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### For the Frontend (Next.js app .env.local)

```bash
# OCR Capture Service URL (Puppeteer service)
NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL=http://localhost:3001

# OCR API URL (your existing OCR backend)
NEXT_PUBLIC_OCR_API_URL=http://localhost:8000/api/ocr/process

# Optional: API Key for OCR service
NEXT_PUBLIC_OCR_API_KEY=your-api-key-here
```

## Setup Instructions

1. **Start the Puppeteer Service:**

   ```bash
   cd backend/puppeteer
   npm install
   npm run dev
   ```

2. **Configure Frontend Environment:**

   - Create or update `.env.local` in your Next.js app root
   - Add the required environment variables above

3. **Test the Service:**
   - Health check: `http://localhost:3001/health`
   - Status: `http://localhost:3001/status`
   - Store to Supabase: POST `http://localhost:3001/capture-and-ocr-to-supabase`
     - Body (JSON):
       ```json
       {
         "projectId": "<uuid>",
         "captureUrl": "http://localhost:3000/capture-project/<id>",
         "pageNumbers": "1,2,3",
         "viewTypes": ["original","translated"],
         "ocrApiUrl": "http://localhost:8000/projects/process-file",
         "projectData": { /* optional ProjectState */ }
       }
       ```
     - Effect: Captures pages, runs OCR, serializes to TextFields compatible with the editor, and merges into `projects.project_data.elementCollections` in Supabase.

## Troubleshooting

- **Service not starting:** Check if port 3001 is available
- **Puppeteer errors:** Ensure Chrome/Chromium is installed
- **Frontend connection errors:** Verify `NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL` is correct
- **OCR API errors:** Verify `NEXT_PUBLIC_OCR_API_URL` points to your existing OCR service
- **Supabase errors:** Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Use a Service Role key only on trusted backend services.

