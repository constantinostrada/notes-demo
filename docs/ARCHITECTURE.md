# Architecture Documentation

## Overview

This project implements **Clean Architecture** (also known as Hexagonal Architecture or Ports & Adapters). The primary goal is to create a system that is:

- **Independent of frameworks**: Business logic doesn't depend on Next.js, React, or any other framework
- **Testable**: Business logic can be tested without UI, database, or external services
- **Independent of UI**: UI can change without affecting business logic
- **Independent of database**: Business logic doesn't know if data is stored in MongoDB, PostgreSQL, or memory
- **Independent of external services**: Business logic doesn't know about external APIs, AI services, etc.

## Layer Structure

```
src/
├── domain/              # Enterprise Business Rules (Inner Circle)
├── application/         # Application Business Rules
├── infrastructure/      # Frameworks & Drivers (Outer Circle)
└── interfaces/          # Interface Adapters (Outer Circle)
```

## The Dependency Rule

**Source code dependencies must only point inward.**

```
┌─────────────────────────────────────────┐
│           interfaces/                    │  ← HTTP, UI, CLI
│  ┌───────────────────────────────────┐  │
│  │      infrastructure/              │  │  ← DB, APIs, External Services
│  │  ┌─────────────────────────────┐  │  │
│  │  │    application/             │  │  │  ← Use Cases, DTOs
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │     domain/           │  │  │  │  ← Entities, Business Rules
│  │  │  │                       │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

        Dependencies point INWARD →
```

## Layer Responsibilities

### 1. Domain Layer (Core)

**Location**: `src/domain/`

**Responsibility**: Contains all enterprise business rules and domain logic. This is the heart of the application.

**Contents**:
- **Entities** (`entities/`): Objects with identity and lifecycle
  - Example: `Note` entity with title validation, word count calculation
- **Value Objects** (`value-objects/`): Immutable objects compared by value
  - Example: `NoteId` with UUID validation
- **Repository Interfaces** (`repositories/`): Contracts for data access (no implementation)
  - Example: `INoteRepository` defines `save()`, `findById()`, etc.
- **Domain Services** (`services/`): Logic that doesn't fit in a single entity
  - Example: `NoteService` with operations across multiple notes
- **Domain Exceptions** (`exceptions/`): Domain-specific errors

**Rules**:
- ✅ Can import: Only other domain files
- ❌ Cannot import: Application, Infrastructure, Interfaces, or any external library
- ❌ No database code, HTTP code, or framework dependencies
- ❌ No `console.log`, no `process.env`

**Example**:
```typescript
// ✅ GOOD: Pure business logic
export class Note {
  updateTitle(newTitle: string): void {
    if (newTitle.length > 200) {
      throw new Error('Title too long');
    }
    this._title = newTitle;
  }
}

// ❌ BAD: Database concern
export class Note {
  async save() {
    await db.notes.update(this); // WRONG!
  }
}
```

### 2. Application Layer

**Location**: `src/application/`

**Responsibility**: Orchestrates domain objects to fulfill application-specific use cases. Knows WHAT to do, not HOW.

**Contents**:
- **Use Cases** (`use-cases/`): One class per use case with `execute()` method
  - Example: `CreateNoteUseCase`, `UpdateNoteUseCase`
- **DTOs** (`dtos/`): Data Transfer Objects for input/output contracts
  - Example: `CreateNoteInputDTO`, `NoteOutputDTO`
- **Mappers** (`mappers/`): Convert domain entities ↔ DTOs
  - Example: `NoteMapper.toDTO(note)`
- **Ports** (`ports/`): Interfaces for external services (if needed)

**Rules**:
- ✅ Can import: Domain layer and other application files
- ❌ Cannot import: Infrastructure or Interfaces
- ❌ No implementation details (no SQL, no HTTP, no file I/O)
- Each use case receives dependencies via constructor (Dependency Injection)

**Example**:
```typescript
// ✅ GOOD: Orchestrates domain logic
export class CreateNoteUseCase {
  constructor(private noteRepository: INoteRepository) {}
  
  async execute(input: CreateNoteInputDTO): Promise<NoteOutputDTO> {
    const noteId = NoteId.generate();
    const note = Note.create(noteId.toString(), input.title, input.content);
    await this.noteRepository.save(note);
    return NoteMapper.toDTO(note);
  }
}

// ❌ BAD: Contains business logic
export class CreateNoteUseCase {
  async execute(input: CreateNoteInputDTO) {
    if (input.title.length > 200) { // WRONG! Belongs in domain
      throw new Error('Title too long');
    }
  }
}
```

### 3. Infrastructure Layer

**Location**: `src/infrastructure/`

**Responsibility**: Implements the interfaces defined in domain/application. All I/O operations live here.

**Contents**:
- **Repository Implementations** (`persistence/`): Real data storage
  - `SqliteNoteRepository` — the registered default (file-backed, persistent)
  - `InMemoryNoteRepository` — lightweight test/dev double
- **Database Clients** (`persistence/`): connection setup, schema bootstrap
- **External Services** (`external/`): HTTP clients, API wrappers
- **Dependency Injection** (`di/`): Container that wires everything together

See [Storage](#storage-sqlite) for the storage decision and where the DB lives.

**Rules**:
- ✅ Can import: Domain, Application, and third-party libraries
- ✅ Can use: `process.env`, database clients, HTTP clients
- ❌ No business logic
- Must implement interfaces from domain/application

**Example**:
```typescript
// ✅ GOOD: Implements interface, handles persistence
export class InMemoryNoteRepository implements INoteRepository {
  private notes: Map<string, Note> = new Map();
  
  async save(note: Note): Promise<void> {
    this.notes.set(note.id, note);
  }
}

// ❌ BAD: Contains business logic
export class InMemoryNoteRepository implements INoteRepository {
  async save(note: Note): Promise<void> {
    if (note.title.length > 200) { // WRONG! Belongs in domain
      throw new Error('Title too long');
    }
    this.notes.set(note.id, note);
  }
}
```

### 4. Interfaces Layer (Adapters)

**Location**: `src/interfaces/`

**Responsibility**: Entry points to the application. Translates external requests into use case calls.

**Contents**:
- **HTTP Controllers** (`http/controllers/`): Thin adapters for API routes
  - Example: `NoteController` validates input, calls use case, formats response
- **API Routes** (`src/app/api/`): Next.js route handlers
- **UI Components** (`components/`): React components (presentational only)
- **Pages** (`src/app/`): Next.js pages

**Rules**:
- ✅ Can import: Application layer (use cases, DTOs)
- ✅ Can import: Framework types (Request, Response, etc.)
- ❌ Cannot import: Infrastructure directly
- ❌ No business logic
- Controllers should be thin (~20 lines max)

**Example**:
```typescript
// ✅ GOOD: Thin adapter
export class NoteController {
  static async createNote(body: unknown) {
    if (!body || typeof body !== 'object') {
      return { error: 'Invalid input', status: 400 };
    }
    
    const useCase = container.getCreateNoteUseCase();
    const result = await useCase.execute(body);
    return { data: result, status: 201 };
  }
}

// ❌ BAD: Contains business logic
export class NoteController {
  static async createNote(body: unknown) {
    const note = Note.create(...); // WRONG! Use case should do this
    if (note.isEmpty()) { // WRONG! Business logic in controller
      return { error: 'Empty note' };
    }
  }
}
```

## Data Flow

### Example: Creating a Note

```
1. User submits form in UI (interfaces/components/NoteForm.tsx)
   ↓
2. POST request to /api/v1/notes (app/api/v1/notes/route.ts)
   ↓
3. Controller validates input (interfaces/http/controllers/NoteController.ts)
   ↓
4. Controller calls Use Case (application/use-cases/CreateNoteUseCase.ts)
   ↓
5. Use Case creates Entity (domain/entities/Note.ts)
   ↓  [Entity validates business rules]
   ↓
6. Use Case calls Repository (domain/repositories/INoteRepository.ts interface)
   ↓
7. Repository Implementation saves (infrastructure/persistence/SqliteNoteRepository.ts)
   ↓
8. Use Case returns DTO (application/dtos/NoteDTO.ts)
   ↓
9. Controller formats response
   ↓
10. UI displays result
```

## Dependency Injection

Dependencies are wired together in `src/infrastructure/di/container.ts`:

```typescript
class DIContainer {
  getNoteRepository(): INoteRepository {
    return new SqliteNoteRepository(); // Swap here for Postgres, etc.
  }
  
  getCreateNoteUseCase(): CreateNoteUseCase {
    return new CreateNoteUseCase(this.getNoteRepository());
  }
}
```

This allows swapping implementations without changing business logic:
- `SqliteNoteRepository` — registered default (persistent, file-backed)
- `InMemoryNoteRepository` — fast, ephemeral double for tests
- A future `PostgresNoteRepository` would only change this one line

## Storage (SQLite)

**Decision**: the app persists notes in a local **SQLite** database via Node's
built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) module
(`DatabaseSync`) — a synchronous, zero-server driver that ships with the Node
runtime. SQLite needs no external service, keeps the demo self-contained, and
gives real durability across restarts.

**History**: this previously used the external
[`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) package. We
migrated to `node:sqlite` to drop the third-party (and native-build) dependency
entirely now that the engine is bundled with Node (≥ 22.5, used here on Node
24). The driver swap is fully contained in `SqliteNoteRepository`; no other
layer was touched. Two API differences were bridged locally: `node:sqlite` has
no `.pragma()` helper (PRAGMAs run via `db.exec('PRAGMA …')`) and no
`db.transaction()` helper (a small private `transaction()` method drives
`BEGIN`/`COMMIT`/`ROLLBACK` by hand). `node:sqlite` is currently flagged
experimental by Node and emits a startup warning.

**Where the DB lives**: a single file at **`data/notes.db`** (project root),
created automatically on first run along with its parent directory. The path is
configurable via the `SQLITE_DB_PATH` environment variable; set it to
`:memory:` for an ephemeral database (handy in tests). The `data/` directory and
`*.db` files are git-ignored.

**Schema**: the `notes` table is created automatically (`CREATE TABLE IF NOT
EXISTS`) when the repository is first constructed — there is no separate
migration step. Timestamps are stored as epoch-millisecond integers and mapped
back to `Date`s when reconstituting domain entities.

**Boundary**: all SQL lives inside `SqliteNoteRepository`. It maps domain
`Note` entities → rows on write and rows → entities (via `Note.reconstitute`)
on read. No SQL, rows, or the database handle ever cross into the
`application/` or `domain/` layers, so those layers remain unaware that SQLite
is used at all. (`node:sqlite` is a built-in Node module, so it's marked as an
external server package in `next.config.js` to keep webpack from bundling it.)

## Benefits

### 1. Testability
Test business logic without infrastructure:
```typescript
const mockRepo = new MockNoteRepository();
const useCase = new CreateNoteUseCase(mockRepo);
const result = await useCase.execute({ title: 'Test', content: '' });
```

### 2. Flexibility
Swap implementations easily:
- Change database: Replace repository implementation
- Change framework: Replace interfaces layer
- Add new feature: Start in domain, work outward

### 3. Maintainability
- Each layer has clear responsibility
- Business logic is isolated and protected
- Changes in outer layers don't affect inner layers

### 4. Team Collaboration
- Different teams can work on different layers
- Domain experts can focus on domain layer
- Frontend developers focus on interfaces layer

## Common Questions

**Q: Where does validation go?**
- Business rules → Domain (e.g., title length limit)
- Input format → Interfaces (e.g., is JSON valid?)

**Q: Can application import infrastructure?**
- No! Application defines interfaces, infrastructure implements them

**Q: Can I skip layers?**
- No! Always respect the dependency rule

**Q: What if my use case is simple?**
- Still create it. Even simple use cases benefit from clear boundaries

## Further Reading

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Hexagonal Architecture by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
