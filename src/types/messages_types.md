# Message Types Schema

Below is a compact but expressive JSON contract you can adopt for the messages.body column.
Every payload is valid JSON B, so Postgres can index or cast pieces easily, yet it keeps the "happy path" (plain text) dirt-simple.that we can put in our Body Field

## 0. Shared envelope

Each message type can optionally include the keys below:

| Key | Type | Purpose |
|-----|------|---------|
| v | int | Payload schema version (start at 1) |
| id | UUID | A client-side identifier (helps front-end dedupe optimistic writes) |
| refers_to | UUID | Links back to a triggering message (e.g., buttons → action) |

If you don't need them yet, leave them out—JSONB is sparse.

## 1. kind="text"

```json
{
  "text": "Show me all invoices from last quarter."
}
```

Keep it literal—fast to read and no extra parsing.

## 2. kind="file" (user or assistant uploads a file)

```jsonc
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Q4_invoices.pdf",
  "mime": "application/pdf",
  "size": 482133,          // bytes
  "bucket": "user-uploads",
  "object_key": "abc/def/Q4_invoices.pdf",
  "url": "https://…/user_uploads/abc/def/Q4_invoices.pdf",   // presigned; optional
  "pages": 17              // extra, if you already parsed it
}
```

## 3. kind="file_card" (rich preview sent by the assistant)

```jsonc
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Invoice batch Q4 2024",
  "thumbnail": "https://…/thumb.png",
  "summary": "17 pages · 22 invoices · total ₱1.2 M",
  "status": "ready",          // ready | processing | error
  "actions": [
    { "label": "Extract data", "action": "extract_invoice_data" },
    { "label": "Translate to English", "action": "translate_pdf" }
  ]
}
```

## 4. kind="buttons" (assistant asks the user to choose)

```jsonc
{
  "prompt": "What would you like to do next?",
  "buttons": [
    { "label": "Summarize document",  "action": "summarize_doc" },
    { "label": "Translate",           "action": "translate_doc" },
    { "label": "Cancel",              "action": "cancel", "style": "secondary" }
  ]
}
```

Front-end rule: click ⇒ POST /messages/action with:

```json
{ "action": "<action>", "values": {} }
```

## 5. kind="inputs" (assistant needs structured data)

```jsonc
{
  "prompt": "Fill in the translation details:",
  "inputs": [
    {
      "name": "target_lang",
      "label": "Target language",
      "type": "select",
      "options": ["en", "es", "fr", "de", "ja"]
    },
    {
      "name": "formality",
      "label": "Formality",
      "type": "radio",
      "options": ["formal", "informal"],
      "default": "formal"
    }
  ],
  "submit_label": "Translate"
}
```

On submit the client sends:

```json
{
  "action": "translate_doc",
  "values": {
    "target_lang": "ja",
    "formality": "formal"
  }
}
```

## 6. kind="action" (what the back-end actually receives)

```jsonc
{
  "action": "translate_doc",
  "values": {
    "target_lang": "ja",
    "formality": "formal"
  },
  "source_message_id": "e9b1cd29-…"   // optional link to the buttons/inputs msg
}
```

## Why this shape works

- **Typed yet minimal** – every UI component knows exactly what to render.

- **Future-proof** – add keys freely; consumers ignore what they don't need.

- **Server-side querying** – e.g., `body ->> 'action'` for analytics,
  GIN/JSONB index on `body -> 'file_id'` to fetch all messages about a doc.

- **No migrations** – you store JSON in the existing body column; only the
  meaning changes.

Adopt this contract incrementally: start with text & file, then roll out richer kinds as your front-end catches up.
