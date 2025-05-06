wally-chat-bot/
├─ .env.local                 # ⟵ API keys (Gemini, Vision API, Auth secrets…)
├─ next.config.ts
└─ src/
   ├─ app/                    # Next.js App-Router
   │  └─ api/
   │     ├─ auth/             # login, signup, session-check
   │     │  └─ route.ts
   │     │
   │     ├─ document/         # every doc-centric endpoint
   │     │  ├─ upload/        # file receives → cloud storage
   │     │  │  └─ route.ts
   │     │  ├─ layout/        # parse & extract bounding boxes
   │     │  │  └─ route.ts
   │     │  ├─ translate/     # calls Gemini for MT + reflow
   │     │  │  └─ route.ts
   │     │  ├─ form/          # detect fields, toggles, dropdowns
   │     │  │  └─ route.ts
   │     │  └─ export/        # bundle up PDF/DOCX/image
   │     │     └─ route.ts
   │     │
   │     └─ genai/            # any misc Gemini-powered routes (OCR, RAG…)
   │        ├─ ocr/           # vision → OCR
   │        │  └─ route.ts
   │        ├─ rag/           # retrieval-augmented gen
   │        │  └─ route.ts
   │        └─ chat/          # general chat/chat-history
   │           └─ route.ts
   │
   ├─ lib/                    # pure Node-side helpers & clients
   │  ├─ auth/                
   │  │   └─ client.ts        # e.g. NextAuth setup
   │  │
   │  ├─ document/
   │  │   ├─ upload.ts        # S3, GCS, etc.
   │  │   ├─ layout.ts        # PDF parsing, Tesseract, layout SDK
   │  │   ├─ translate.ts     # wraps your Gemini translation calls
   │  │   ├─ form.ts          # form-field detection logic
   │  │   └─ export.ts        # PDFKit or docx-generator
   │  │
   │  └─ genai/               # all your Gemini functions
   │      ├─ client.ts        # init Gemini with your API key
   │      ├─ ocr.ts           # image → text
   │      ├─ text.ts          # chat / prompt → text
   │      ├─ rag.ts           # with retrieval
   │      └─ types.ts
   │
   ├─ hooks/                  # React hook wrappers for each feature
   │  ├─ useAuth.ts
   │  ├─ useUpload.ts
   │  ├─ useLayout.ts
   │  ├─ useTranslate.ts
   │  ├─ useForm.ts
   │  ├─ useExport.ts
   │  └─ useGenAI.ts          # or split into useOCR, useChat, useRAG…
   │
   └─ components/             # UI bits
      ├─ Auth/                # login form, user menu
      ├─ DocumentManager/     # upload button, preview pane
      ├─ LayoutEditor/        # bounding-box controls
      ├─ Translator/          # language picker, live editor
      ├─ FormEditor/          # interactive fields
      ├─ Exporter/            # format options, download button
      └─ Chatbot/             # chat window, message bubbles
