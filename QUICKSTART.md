# Quick Start Guide

Get up and running with Notes Demo in 5 minutes.

## Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open your browser
# Navigate to http://localhost:3000
```

That's it! The application is now running with an in-memory database.

## First Steps

### Creating Your First Note

1. Click "New Note" button
2. Enter a title (required)
3. Add content (optional)
4. Click "Create"

### Using the API

```bash
# Create a note
curl -X POST http://localhost:3000/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Note","content":"Hello World"}'

# List all notes
curl http://localhost:3000/api/v1/notes

# Search notes
curl http://localhost:3000/api/v1/notes?q=hello

# Get a specific note
curl http://localhost:3000/api/v1/notes/{NOTE_ID}

# Update a note
curl -X PUT http://localhost:3000/api/v1/notes/{NOTE_ID} \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'

# Delete a note
curl -X DELETE http://localhost:3000/api/v1/notes/{NOTE_ID}
```

## Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check
```

## Project Structure Overview

```
src/
├── domain/              # Business logic & rules (no dependencies)
│   ├── entities/        # Note entity with validation
│   ├── value-objects/   # NoteId value object
│   ├── repositories/    # Repository interfaces
│   └── services/        # Domain services
│
├── application/         # Use cases & orchestration
│   ├── use-cases/       # CreateNote, UpdateNote, etc.
│   ├── dtos/            # Input/Output contracts
│   └── mappers/         # Entity to DTO conversion
│
├── infrastructure/      # I/O implementations
│   ├── persistence/     # SqliteNoteRepository (+ InMemory test double)
│   └── di/              # Dependency injection
│
└── interfaces/          # Entry points & UI
    ├── http/            # API controllers
    ├── components/      # React components
    └── app/             # Next.js pages & routes
```

## Understanding the Flow

When you create a note, this happens:

1. **UI** (`app/page.tsx`) - Form submission
2. **API Route** (`app/api/v1/notes/route.ts`) - Receives HTTP request
3. **Controller** (`interfaces/http/controllers/NoteController.ts`) - Validates input
4. **Use Case** (`application/use-cases/CreateNoteUseCase.ts`) - Orchestrates logic
5. **Entity** (`domain/entities/Note.ts`) - Validates business rules
6. **Repository** (`infrastructure/persistence/SqliteNoteRepository.ts`) - Saves data to SQLite (`data/notes.db`)

Response flows back through the same layers.

## Key Features

✅ **Full CRUD Operations** - Create, Read, Update, Delete notes  
✅ **Search Functionality** - Search notes by title or content  
✅ **Word Count** - Automatic word count for each note  
✅ **Responsive UI** - Works on desktop and mobile  
✅ **Type Safe** - Full TypeScript support  
✅ **Clean Architecture** - Properly layered code  

## Common Tasks

### Add a New Field to Note

1. Update domain entity: `src/domain/entities/Note.ts`
2. Update DTO: `src/application/dtos/NoteDTO.ts`
3. Update mapper: `src/application/mappers/NoteMapper.ts`
4. Update UI component: `src/interfaces/components/NoteCard.tsx`

### Switch to a Real Database

1. Install database client (e.g., `pg` for PostgreSQL)
2. Create new repository: `src/infrastructure/persistence/PostgresNoteRepository.ts`
3. Update DI container: `src/infrastructure/di/container.ts`
4. No changes needed in domain, application, or interfaces!

### Add Authentication

1. Create `User` entity in `src/domain/entities/User.ts`
2. Create authentication use cases in `src/application/use-cases/`
3. Add auth middleware in `src/interfaces/http/middleware/`
4. Protect routes as needed

## Learning Path

**New to Clean Architecture?** Follow this order:

1. Read `README.md` - Project overview
2. Read `docs/ARCHITECTURE.md` - Deep dive into architecture
3. Explore `src/domain/entities/Note.ts` - See business rules
4. Check `src/application/use-cases/CreateNoteUseCase.ts` - Use case pattern
5. Look at `src/interfaces/http/controllers/NoteController.ts` - HTTP adapter
6. Read `docs/EXAMPLES.md` - Practical examples

**Want to contribute?** Read `CONTRIBUTING.md`

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use a different port
PORT=3001 npm run dev
```

### TypeScript Errors
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### ESLint Errors
```bash
# Auto-fix issues
npm run lint -- --fix
```

## Environment Variables

Create `.env.local` for local development:

```bash
cp .env.example .env.local
```

Edit as needed:
```env
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=Notes Demo
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## VS Code Setup

Recommended extensions (auto-suggested):
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

Settings are pre-configured in `.vscode/settings.json`.

## Next Steps

- 📖 Read the [Architecture Guide](docs/ARCHITECTURE.md)
- 🔌 Explore the [API Documentation](docs/API.md)
- 💡 Check out [Code Examples](docs/EXAMPLES.md)
- 🤝 Learn how to [Contribute](CONTRIBUTING.md)

## Getting Help

- Check existing documentation in `/docs`
- Review the architecture contracts in `CLAUDE.md` files
- Look at code examples in `docs/EXAMPLES.md`

## What's Next?

Try these exercises to learn the architecture:

1. **Add a "favorite" flag to notes**
   - Start in domain layer
   - Add use case
   - Update UI

2. **Add note categories**
   - Create Category entity
   - Create relationship in Note entity
   - Implement CRUD for categories

3. **Add export functionality**
   - Create export use case
   - Add download endpoint
   - Add UI button

Happy coding! 🚀
