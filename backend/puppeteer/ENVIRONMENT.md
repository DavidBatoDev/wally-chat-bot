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

## Troubleshooting

- **Service not starting:** Check if port 3001 is available
- **Puppeteer errors:** Ensure Chrome/Chromium is installed
- **Frontend connection errors:** Verify `NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL` is correct
- **OCR API errors:** Verify `NEXT_PUBLIC_OCR_API_URL` points to your existing OCR service

