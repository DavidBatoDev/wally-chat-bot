# Message Sender Types

"sender" tells you who generated the payload and how the client should treat it.
Below is a quick reference you can bake into both your back-end logic and the React renderer.

## Sender Types Reference

| Sender | Produced by | Typical kinds | Show in UI? | Bubble side / style | Should you embed in rag_memory? |
|--------|-------------|---------------|-------------|---------------------|--------------------------------|
| user | Human on the front end | text, file, action | Yes | Right-aligned, "user" theme | Probably yes (these are the primary long-term facts) |
| assistant | LLM-orchestrator replies | any (text, file_card, buttons, inputs, …) | Yes | Left-aligned, "bot" theme | Usually no (the bot knows what it said) |
| system | Internal scaffolding prompts, status notes | Mostly text | No (or behind a dev flag) | — | No |
| model | Raw chain-of-thought or step-printing from the LLM | text | No (debug console only) | — | No |
| tools | A tool execution result serialised as a message | text, file_card, etc. | Optional – show when useful (e.g. "Here's your extracted table") | Left-aligned, different accent | Maybe (only if it's knowledge you'll reuse) |

## Why hide system / model?
They're token ballast for the LLM, not user-facing content. Exposing them clutters the chat.

## How to reflect this in your React code

### 1. Extend the base type

```typescript
type Sender = 'user' | 'assistant' | 'system' | 'model' | 'tools';

interface BaseMsg {
  id: string;
  sender: Sender;          // NEW!
  timestamp: string;
  status?: 'sending' | 'error';
}
```

All discriminated kinds (TextMsg, FileCardMsg, …) now inherit sender.

### 2. Normaliser tweak

```typescript
const base = {
  id: row.id,
  sender: row.sender as Sender,
  timestamp: formatTime(row.created_at)
};
```

### 3. Renderer switch

```tsx
const isUserSide = msg.sender === 'user';
const isHidden = msg.sender === 'system' || msg.sender === 'model';
if (isHidden) return null;     // don't render

return (
  <div className={clsx('bubble', isUserSide ? 'user' : 'bot', msg.kind)}>
    {/* now branch by kind exactly as before */}
  </div>
);
```

Add a subtle variant for tools if you like:

```css
.bubble.tools { border-left: 4px solid var(--brand-purple); }
```

### 4. Gating embeddings

In _should_embed() (Python):

```python
def _should_embed(sender: str, kind: str) -> bool:
    return sender == "user" and kind == "text"
```

That keeps vector storage lean without losing user facts.

## Quick mental model

- **Sender** → "whose voice is this?" (UI placement, memory policy)
- **Kind** → "what UI widget renders it?" (buttons, file card, plain text)

Together they give you a 2-axis contract that scales cleanly as you add more interactive pieces.
