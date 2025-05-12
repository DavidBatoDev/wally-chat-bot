# Wally-Chat Database Schema Documentation

A self-contained reference for your "Wally-Chat" Supabase schema. It describes each table, its columns, relationships, and the role it plays in your agentic chat + editable-document pipeline.

## 1. Extensions

Before any tables, two Postgres extensions must be enabled (idempotent):

```sql
-- UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Vector embedding support (e.g. OpenAI embeddings, 1536 dimensions)
CREATE EXTENSION IF NOT EXISTS vector;
```

## 2. Authentication & Profiles

### 2.1 auth.users

- Created & managed by Supabase Auth.
- Holds user credentials, email, and the UUID (id) you reference elsewhere.

### 2.2 profiles

One row per authenticated user.

| Column     | Type        | Notes                                     |
| ---------- | ----------- | ----------------------------------------- |
| id         | uuid        | PK, equals auth.users.id                  |
| full_name  | text        | e.g. "Daniel Caparro"                     |
| avatar_url | text        | Link to user's profile picture            |
| created_at | timestamptz | Auto-set when the row is inserted (now()) |

#### Row-Level Security

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self profile" ON profiles
  FOR SELECT USING (id = auth.uid());
```

## 3. Conversations & Messages

### 3.1 conversations

Represents a chat thread.

| Column     | Type        | Notes                                       |
| ---------- | ----------- | ------------------------------------------- |
| id         | uuid        | PK, gen_random_uuid()                       |
| profile_id | uuid        | FK → profiles(id); on delete cascade        |
| title      | text        | Optional user-supplied thread name          |
| summary    | text        | Auto-generated synopsis of the conversation |
| is_active  | boolean     | Soft-close threads when false               |
| created_at | timestamptz | Default now()                               |
| updated_at | timestamptz | Auto-bumped via trigger on new messages     |

#### Trigger

```sql
-- Bumps updated_at whenever a message is added
CREATE FUNCTION touch_conversation() RETURNS trigger AS $$
BEGIN
  UPDATE conversations SET updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION touch_conversation();
```

#### RLS

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON conversations
  FOR ALL USING (profile_id = auth.uid());
```

### 3.2 messages

Every chat turn or "card" within a conversation.

| Column          | Type        | Notes                                                        |
| --------------- | ----------- | ------------------------------------------------------------ |
| id              | uuid        | PK, gen_random_uuid()                                        |
| conversation_id | uuid        | FK → conversations(id) on delete cascade                     |
| sender          | text        | CHECK (sender in ('user','assistant','model'))               |
| kind            | text        | CHECK (kind in ('text','file','action','file_card'))         |
| body            | text        | For kind='text', a plain string; for others, serialized JSON |
| created_at      | timestamptz | Default now()                                                |

#### RLS

```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE profile_id = auth.uid()
    )
  );
```

## 4. File Registries & Versioning

### 4.1 file_objects

Tracks every file stored in your Supabase Storage buckets.

| Column     | Type        | Notes                                                                          |
| ---------- | ----------- | ------------------------------------------------------------------------------ |
| id         | uuid        | PK, gen_random_uuid()                                                          |
| profile_id | uuid        | FK → profiles(id) on delete cascade                                            |
| bucket     | text        | e.g. 'user_uploads', 'documents'                                               |
| object_key | text        | Path within the bucket (e.g. doc/{conv_id}/{uuid}.docx)                        |
| mime_type  | text        | e.g. 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' |
| size_bytes | bigint      | File size for auditing/logging                                                 |
| created_at | timestamptz | Default now()                                                                  |

#### RLS

```sql
ALTER TABLE file_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own files" ON file_objects
  FOR ALL USING (profile_id = auth.uid());
```

### 4.2 doc_versions

Immutable snapshots of an editable document over time.

| Column           | Type        | Notes                                                         |
| ---------------- | ----------- | ------------------------------------------------------------- |
| id               | uuid        | PK, gen_random_uuid()                                         |
| base_file_id     | uuid        | FK → file_objects(id) (the working-copy file)                 |
| rev              | int         | Revision number (1, 2, 3…)                                    |
| placeholder_json | jsonb       | Snapshot of { "{{firstname}}": "David", … } used for that rev |
| llm_log          | jsonb       | (Optional) LLM step logs, diff info, etc.                     |
| created_at       | timestamptz | Default now()                                                 |

#### RLS

```sql
ALTER TABLE doc_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own doc versions" ON doc_versions
  FOR ALL USING (
    base_file_id IN (
      SELECT id FROM file_objects WHERE profile_id = auth.uid()
    )
  );
```

## 5. Templates Catalogue

### templates

Master document templates (read-only to end users).

| Column           | Type        | Notes                                                         |
| ---------------- | ----------- | ------------------------------------------------------------- |
| id               | uuid        | PK, gen_random_uuid()                                         |
| doc_type         | text        | e.g. 'psa_birth_cert', 'invoice'                              |
| variation        | text        | e.g. '1993', 'v2.1'                                           |
| object_key       | text        | Path in public Storage bucket (e.g. psa/1993_v1.docx)         |
| placeholder_json | jsonb       | Template's list of required tokens: { "{{firstname}}":"", … } |
| created_at       | timestamptz | Default now()                                                 |

No RLS needed (templates bucket is public-read, inserts/deletes by service-role only).

## 6. Retrieval-Augmented Generation

### rag_memory

Vector store for semantic retrieval of past chat content.

| Column          | Type         | Notes                                           |
| --------------- | ------------ | ----------------------------------------------- |
| id              | uuid         | PK, gen_random_uuid()                           |
| conversation_id | uuid         | FK → conversations(id)                          |
| content         | text         | The plain text used to generate the embedding   |
| embedding       | vector(1536) | Dense embedding (OpenAI or other)               |
| meta            | jsonb        | Arbitrary metadata (e.g. message ID, timestamp) |
| created_at      | timestamptz  | Default now()                                   |

```sql
-- fast nearest-neighbor lookup
CREATE INDEX IF NOT EXISTS rag_embedding_idx
  ON rag_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

#### RLS

```sql
ALTER TABLE rag_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rag" ON rag_memory
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE profile_id = auth.uid()
    )
  );
```

## 7. Helper Views & Functions

### v_conversation_latest_doc

Returns the latest revision for each working-copy file.

```sql
CREATE OR REPLACE VIEW v_conversation_latest_doc AS
SELECT DISTINCT ON (d.base_file_id) d.*
FROM doc_versions d
ORDER BY d.base_file_id, d.rev DESC;
```

### add_message(...)

RPC wrapper to atomically insert a chat message and its embedding.

```sql
CREATE OR REPLACE FUNCTION add_message(
  _conv uuid,
  _sender text,
  _kind text,
  _body text,
  _embedding vector
) RETURNS void AS $$
BEGIN
  INSERT INTO messages (conversation_id,sender,kind,body)
    VALUES (_conv,_sender,_kind,_body);
  INSERT INTO rag_memory (conversation_id,content,embedding)
    VALUES (_conv,_body,_embedding);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 8. How They Work Together

1. User signs in → row in profiles.
2. User starts chat → new conversations.
3. User uploads a file → stored in Storage → record in file_objects.
4. OCR/LLM pairs placeholders → working DOCX saved to Storage → file_objects + doc_versions rev=1.
5. Assistant inserts a "file_card" message → messages.kind='file_card', JSON payload in body.
6. Client UI subscribes to messages via Realtime → renders a card → on click fetches the signed URL for that version's file and loads it into an in-browser canvas.
7. Each save in the canvas → new doc_versions.rev++ → another file_card message → new card appears.
8. Every text turn also add_message() → messages + rag_memory for later retrieval.

With this documentation, your team has a clear blueprint of each table's purpose, how they reference one another, and the policies that keep data securely scoped to each user. Let me know if you'd like to expand any section or generate ER diagrams!

# ADDITIONS

## 📑 Add-on: agent-style message kinds (buttons, inputs)

The schema already supports rich "file-card" messages.
Below is the incremental change that lets your LLM guide users with button bars (next-action shortcuts) and inline forms (collect missing placeholder values).

### 1. One-line SQL patch

```sql
-- Expand the CHECK enum on messages.kind
alter table messages
  drop constraint if exists msg_kind_ck;

alter table messages
  add constraint msg_kind_ck
  check (kind in (
    'text',          -- plain chat
    'file',          -- raw attachment
    'file_card',     -- opens canvas
    'action',        -- user confirmation / backend ack
    'buttons',       -- assistant bubble with buttons  ← NEW
    'inputs'         -- assistant mini-form bubble     ← NEW
  ));
```

(No other columns change; body stays plain text, so you can stringify any JSON payload.)

### 2. Payload conventions

| kind    | body JSON shape (string-ified)                                                                                       | Front-end renders               | User response                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| buttons | `{ "prompt": "…", "buttons": [ { "label": "Upload new doc", "action": "upload_file" }, … ] }`                        | Chat bubble + clickable buttons | App sends a kind = action message: `{ "action": "upload_file" }`                                          |
| inputs  | `{ "prompt": "Fill missing fields:", "inputs": [ { "key":"mother_occupation","label":"Mother's occupation"} , … ] }` | Chat bubble with text fields    | App sends kind = action: `{ "action":"submit_missing_fields", "values":{ "mother_occupation":"Nurse" } }` |

Backend listens for action rows, calls your external APIs, and replies with the next assistant message (new file_card, another buttons, etc.).

### 3. Optional helper RPCs

```sql
create or replace function post_buttons(
  _conv uuid,
  _prompt text,
  _buttons jsonb           -- e.g. '[{"label":"Upload","action":"upload_file"}]'
) returns void language plpgsql security definer as $$
begin
  insert into messages (conversation_id,sender,kind,body)
  values (
    _conv,'assistant','buttons',
    json_build_object('prompt',_prompt,'buttons',_buttons)::text
  );
end $$;

create or replace function post_inputs(
  _conv uuid,
  _prompt text,
  _inputs jsonb            -- e.g. '[{"key":"mother_occupation","label":"…"}]'
) returns void language plpgsql security definer as $$
begin
  insert into messages (conversation_id,sender,kind,body)
  values (
    _conv,'assistant','inputs',
    json_build_object('prompt',_prompt,'inputs',_inputs)::text
  );
end $$;
```

### 4. Documentation patch (🆕 section)

#### messages.kind values

- `'text'` - Plain chat bubble (body = free-text)
- `'file'` - User-uploaded attachment (body = {"file_id":…})
- `'file_card'` - Structured card that opens an editable canvas (body = {"file_id":…,"version_id":…,"rev":N})
- `'action'` - Client-to-server or server-to-client event acknowledgment (body JSON varies)
- `'buttons'` - Assistant bubble with quick-action buttons (body = {"prompt":…,"buttons":[…]})
- `'inputs'` - Assistant bubble containing a mini-form to capture missing fields (body = {"prompt":…,"inputs":[…]})

No new tables, RLS rules, or Storage buckets are required—the agentic UI is driven entirely by these two additional kind values plus JSON payloads stored as text.
