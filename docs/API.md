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

Every response — success or error — uses the same envelope:

```json
{ "success": true,  "data": { ... }, "status": 200 }
{ "success": false, "error": "message", "status": 404 }
```

- `success` is a boolean discriminator clients can branch on.
- `data` is present only on success; `error` (a string) only on failure.
- `status` mirrors the HTTP status code, which is also set on the response.

### How use cases are resolved (DI)

Route handlers are thin transport adapters. They do **not** instantiate use
cases or repositories directly. Instead:

```
Next route handler (src/app/api/v1/notes/...)
  → NoteController (src/interfaces/http/controllers/NoteController.ts)
    → container.getXxxUseCase()  (src/infrastructure/di/container.ts)
      → UseCase(noteRepository)
```

The `NoteController` validates input, asks the DI container for the use case,
calls `execute()`, and maps results/exceptions to the response envelope. This
keeps the presentation layer free of business logic and unaware of which
repository or implementation backs the use cases.

### Status codes

- `200` — Success (GET, PUT)
- `201` — Created (POST)
- `204` — No Content (DELETE)
- `400` — Bad Request (validation errors / malformed body)
- `404` — Not Found
- `500` — Internal Server Error

---

## Endpoints

### List All Notes

```http
GET /api/v1/notes
```

**Response**
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": "uuid",
        "title": "Note Title",
        "content": "Note content...",
        "wordCount": 42,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1
  },
  "status": 200
}
```

### Search Notes

```http
GET /api/v1/notes?q=search+query
```

**Query Parameters**
- `q` - Search query (searches in title and content)

**Response**
```json
{
  "success": true,
  "data": {
    "notes": [...],
    "total": 1
  },
  "status": 200
}
```

### Get Single Note

```http
GET /api/v1/notes/:id
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Note Title",
    "content": "Note content...",
    "wordCount": 42,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "status": 200
}
```

**Error Response (404)**
```json
{
  "success": false,
  "error": "Note with id {id} not found",
  "status": 404
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
- `title` is required
- `title` must be between 1-200 characters
- `content` is optional

**Response (201)**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Note Title",
    "content": "Note content...",
    "wordCount": 2,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "status": 201
}
```

**Error Response (400)**
```json
{
  "success": false,
  "error": "Title is required",
  "status": 400
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

**Note**: Both fields are optional. Only provided fields will be updated.

**Response (200)**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Updated Title",
    "content": "Updated content...",
    "wordCount": 2,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:30:00.000Z"
  },
  "status": 200
}
```

**Error Response (404)**
```json
{
  "success": false,
  "error": "Note with id {id} not found",
  "status": 404
}
```

### Delete Note

```http
DELETE /api/v1/notes/:id
```

**Response (204)**
```json
{
  "success": true,
  "status": 204
}
```

**Error Response (404)**
```json
{
  "success": false,
  "error": "Note with id {id} not found",
  "status": 404
}
```

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "status": 400|404|500
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

**Using fetch:**
```typescript
// Create note
const response = await fetch('/api/v1/notes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Note',
    content: 'Content here'
  })
});
const result = await response.json();

// List notes
const response = await fetch('/api/v1/notes');
const result = await response.json();
const notes = result.data.notes;

// Search notes
const query = 'search term';
const response = await fetch(`/api/v1/notes?q=${encodeURIComponent(query)}`);
const result = await response.json();
```

> Tip: in app code, import the route helpers from
> `src/interfaces/http/apiRoutes.ts` (`notesApi.collection()`,
> `notesApi.resource(id)`, `notesApi.search(q)`) instead of hardcoding paths.
