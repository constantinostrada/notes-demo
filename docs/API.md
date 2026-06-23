# API Documentation

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### List All Notes

```http
GET /api/notes
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
GET /api/notes?q=search+query
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
GET /api/notes/:id
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
POST /api/notes
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
PUT /api/notes/:id
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
DELETE /api/notes/:id
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

### Status Codes

- `200` - Success (GET, PUT)
- `201` - Created (POST)
- `204` - No Content (DELETE)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Using the API

### cURL Examples

**Create a note:**
```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Note","content":"Hello World"}'
```

**List all notes:**
```bash
curl http://localhost:3000/api/notes
```

**Get a specific note:**
```bash
curl http://localhost:3000/api/notes/UUID-HERE
```

**Update a note:**
```bash
curl -X PUT http://localhost:3000/api/notes/UUID-HERE \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'
```

**Delete a note:**
```bash
curl -X DELETE http://localhost:3000/api/notes/UUID-HERE
```

**Search notes:**
```bash
curl http://localhost:3000/api/notes?q=hello
```

### JavaScript/TypeScript Examples

**Using fetch:**
```typescript
// Create note
const response = await fetch('/api/notes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Note',
    content: 'Content here'
  })
});
const result = await response.json();

// List notes
const response = await fetch('/api/notes');
const result = await response.json();
const notes = result.data.notes;

// Search notes
const query = 'search term';
const response = await fetch(`/api/notes?q=${encodeURIComponent(query)}`);
const result = await response.json();
```
