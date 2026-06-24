# API Documentation

## Base URL

```
http://localhost:3000/api/v1
```

## Conventions & Decisions

These conventions are intentional and apply to every endpoint.

### Route convention

- **Versioned** under a `/api/v{n}` prefix so the contract can evolve without
  breaking existing clients. The current version is **`v1`**.
- **Resource-oriented & plural**: the collection is `/notes`, a single item is
  `/notes/:id`.
- **HTTP verb = intent**: `GET` reads, `POST` creates, `PUT` updates,
  `DELETE` removes.

| Operation     | Method & Path              | Use case            |
| ------------- | -------------------------- | ------------------- |
| List notes    | `GET /api/v1/notes`        | `ListNotesUseCase`  |
| Search notes  | `GET /api/v1/notes?q=...`  | `SearchNotesUseCase`|
| Create note   | `POST /api/v1/notes`       | `CreateNoteUseCase` |
| Get note      | `GET /api/v1/notes/:id`    | `GetNoteUseCase`    |
| Update note   | `PUT /api/v1/notes/:id`    | `UpdateNoteUseCase` |
| Delete note   | `DELETE /api/v1/notes/:id` | `DeleteNoteUseCase` |

The route convention lives in code in `src/interfaces/http/apiRoutes.ts` and is
reused by the frontend so client and server never drift.

### Response envelope (consistent JSON)

The HTTP status code is authoritative — clients branch on `response.ok`.

**Success (2xx)** — the payload is wrapped under `data`:

```json
{ "data": { ... } }
```

**Error (4xx / 5xx)** — a single, reusable error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload is invalid",
    "details": [{ "path": "title", "message": "Title is required" }]
  }
}
```

- `error.code` — stable, machine-readable identifier (branch on this, not the
  message). See the table below.
- `error.message` — human-readable summary.
- `error.details` — optional, field-level issues (present for validation
  errors; each entry is `{ path, message }`).

**`204 No Content`** (successful `DELETE`) returns an **empty body**.

### Validation & error handling

- Incoming payloads are validated with **[zod](https://zod.dev)** schemas
  (`src/interfaces/http/validation/noteSchemas.ts`). A schema failure →
  `400 VALIDATION_ERROR` with per-field `details`.
- **Business invariants** (e.g. title length) are enforced by the domain entity
  and surface as `DomainException`s.
- A single mapper (`mapError` in `src/interfaces/http/apiResponse.ts`) is the
  **only** place that turns an error into a response, so every endpoint is
  uniform. The mapping:

| Thrown error            | Status | `error.code`       |
| ----------------------- | ------ | ------------------ |
| zod `ZodError`          | `400`  | `VALIDATION_ERROR` |
| `NoteNotFoundException` | `404`  | `NOTE_NOT_FOUND`   |
| `InvalidNoteException`  | `422`  | `INVALID_NOTE`     |
| other `DomainException` | `400`  | `DOMAIN_ERROR`     |
| anything else (bug)     | `500`  | `INTERNAL_ERROR`   |

> `500 INTERNAL_ERROR` never leaks internal exception messages to the client.

### How use cases are resolved (DI)

Route handlers are thin transport adapters. They do **not** instantiate use
cases or repositories directly. Instead:

```
Next route handler (src/app/api/v1/notes/...)
  → NoteController (src/interfaces/http/controllers/NoteController.ts)
    → validates payload (zod) → container.getXxxUseCase()
      → UseCase(noteRepository)
  → toNextResponse(result)   (serializes the uniform envelope)
```

The `NoteController` validates input, asks the DI container for the use case,
calls `execute()`, and routes every error through `mapError`. This keeps the
presentation layer free of business logic and unaware of which repository or
implementation backs the use cases.

### Status codes

- `200` — Success (GET, PUT)
- `201` — Created (POST)
- `204` — No Content (DELETE)
- `400` — Bad Request (invalid/malformed payload — `VALIDATION_ERROR`)
- `404` — Not Found (`NOTE_NOT_FOUND`)
- `422` — Unprocessable Entity (well-formed but breaks a business rule —
  `INVALID_NOTE`)
- `500` — Internal Server Error (`INTERNAL_ERROR`)

---

## Endpoints

### List All Notes

```http
GET /api/v1/notes?page=1&limit=20&sort=-createdAt&tag=work
```

**Query Parameters** — all optional, each with a sensible default:

| Param   | Type   | Default       | Notes                                                                 |
| ------- | ------ | ------------- | --------------------------------------------------------------------- |
| `page`  | int    | `1`           | 1-based page number. Must be `>= 1`.                                   |
| `limit` | int    | `20`          | Page size. Must be between `1` and `100`.                             |
| `sort`  | enum   | `-createdAt`  | One of `createdAt`, `-createdAt`, `updatedAt`, `-updatedAt`, `title`, `-title`. A leading `-` means **descending**; `title` sorts case-insensitively. |
| `tag`   | string | _(none)_      | Filters to notes carrying this tag (matched case-insensitively).      |

Invalid params (e.g. `page=0`, `limit=999`, `sort=bogus`) are rejected with
`400 VALIDATION_ERROR` and per-field `details`.

**Response (200)** — a page of notes plus pagination metadata:
```json
{
  "data": {
    "notes": [
      {
        "id": "uuid",
        "title": "Note Title",
        "content": "Note content...",
        "tags": ["work"],
        "wordCount": 42,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false,
      "sort": "-createdAt"
    }
  }
}
```

- `total` — total notes matching the (optional) tag filter, ignoring pagination.
- `totalPages` — `ceil(total / limit)` (`0` when there are no matches).
- `hasNextPage` / `hasPreviousPage` — convenience flags for paging UIs.
- `sort` — echoes the effective sort token applied.

### Search Notes

```http
GET /api/v1/notes?q=search+query
```

**Query Parameters**
- `q` - Search query (searches in title and content)

**Response (200)**
```json
{
  "data": {
    "notes": [...],
    "total": 1
  }
}
```

### Get Single Note

```http
GET /api/v1/notes/:id
```

**Response (200)**
```json
{
  "data": {
    "id": "uuid",
    "title": "Note Title",
    "content": "Note content...",
    "wordCount": 42,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Response (404)**
```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note with id {id} not found"
  }
}
```

### Create Note

```http
POST /api/v1/notes
```

**Request Body**
```json
{
  "title": "Note Title",
  "content": "Note content..."
}
```

**Validation**
- `title` — required, must be a non-empty string (schema-validated → `400`)
- `title` — must be ≤ 200 characters (business rule → `422 INVALID_NOTE`)
- `content` — optional string (defaults to `""`)

**Response (201)**
```json
{
  "data": {
    "id": "uuid",
    "title": "Note Title",
    "content": "Note content...",
    "wordCount": 2,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Response (400 — invalid payload)**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload is invalid",
    "details": [{ "path": "title", "message": "Title is required" }]
  }
}
```

### Update Note

```http
PUT /api/v1/notes/:id
```

**Request Body**
```json
{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

**Validation**: both fields are optional, but **at least one** must be present;
only provided fields are updated.

**Response (200)**
```json
{
  "data": {
    "id": "uuid",
    "title": "Updated Title",
    "content": "Updated content...",
    "wordCount": 2,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:30:00.000Z"
  }
}
```

**Error Response (404)**
```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note with id {id} not found"
  }
}
```

### Delete Note

```http
DELETE /api/v1/notes/:id
```

**Response**: `204 No Content` with an empty body.

**Error Response (404)**
```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note with id {id} not found"
  }
}
```

## Error Responses

All endpoints share the reusable error envelope and the code/status mapping
documented in [Validation & error handling](#validation--error-handling):

```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOTE_NOT_FOUND | INVALID_NOTE | DOMAIN_ERROR | INTERNAL_ERROR",
    "message": "Human-readable summary",
    "details": [{ "path": "field", "message": "why it failed" }]
  }
}
```

## Using the API

### cURL Examples

**Create a note:**
```bash
curl -X POST http://localhost:3000/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Note","content":"Hello World"}'
```

**List all notes:**
```bash
curl http://localhost:3000/api/v1/notes
```

**List notes — paginated & sorted (page 2, 10 per page, title A→Z):**
```bash
curl "http://localhost:3000/api/v1/notes?page=2&limit=10&sort=title"
```

**List notes — filtered by tag, newest first:**
```bash
curl "http://localhost:3000/api/v1/notes?tag=work&sort=-createdAt"
```

**Get a specific note:**
```bash
curl http://localhost:3000/api/v1/notes/UUID-HERE
```

**Update a note:**
```bash
curl -X PUT http://localhost:3000/api/v1/notes/UUID-HERE \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'
```

**Delete a note:**
```bash
curl -X DELETE http://localhost:3000/api/v1/notes/UUID-HERE
```

**Search notes:**
```bash
curl http://localhost:3000/api/v1/notes?q=hello
```

### JavaScript/TypeScript Examples

**Using fetch (branch on `response.ok`):**
```typescript
// Create note
const response = await fetch('/api/v1/notes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'My Note', content: 'Content here' }),
});
const result = await response.json();
if (response.ok) {
  const note = result.data;
} else {
  console.error(result.error.code, result.error.message);
}

// List notes
const listRes = await fetch('/api/v1/notes');
const listJson = await listRes.json();
const notes = listJson.data.notes;
```

> Tip: in app code, import the route helpers from
> `src/interfaces/http/apiRoutes.ts` (`notesApi.collection()`,
> `notesApi.resource(id)`, `notesApi.search(q)`) instead of hardcoding paths.
