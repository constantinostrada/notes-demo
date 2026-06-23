# Notes Demo

A production-ready note-taking application built with Next.js, TypeScript, and Tailwind CSS, following Clean Architecture principles.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Clean Architecture** - Domain-driven design with clear layer separation

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Copy the example environment file:

```bash
cp .env.example .env.local
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Clean Architecture Layers

This project follows Clean Architecture principles with strict layer separation:

### 📁 Project Structure

```
src/
├── domain/              # Enterprise Business Rules
│   ├── entities/        # Core business objects with identity
│   ├── value-objects/   # Immutable domain concepts
│   ├── repositories/    # Data access interfaces (no implementation)
│   └── services/        # Domain logic that doesn't fit in entities
│
├── application/         # Application Business Rules
│   ├── use-cases/       # Application-specific operations
│   ├── dtos/            # Data Transfer Objects
│   └── ports/           # Interfaces for external services
│
├── infrastructure/      # Frameworks & Drivers
│   ├── repositories/    # Repository implementations
│   ├── persistence/     # Database clients, ORM config
│   └── external/        # Third-party API clients
│
└── interfaces/          # Interface Adapters
    ├── http/            # HTTP controllers and routes
    ├── components/      # React components (presentational)
    └── app/             # Next.js app router pages
```

### 🎯 Layer Responsibilities

#### Domain Layer (`src/domain/`)
- **Purpose**: Contains all business logic and rules
- **Independence**: Zero external dependencies
- **Contents**: Entities, Value Objects, Domain Services, Repository Interfaces
- **Rule**: Never imports from other layers

#### Application Layer (`src/application/`)
- **Purpose**: Orchestrates domain objects to fulfill use cases
- **Dependencies**: Only imports from `domain/`
- **Contents**: Use Cases, DTOs, Application Services
- **Pattern**: Each use case has an `execute(dto)` method

#### Infrastructure Layer (`src/infrastructure/`)
- **Purpose**: Implements interfaces defined in domain/application
- **Dependencies**: Imports from `domain/` and `application/`
- **Contents**: Repository implementations, DB clients, External APIs
- **Rule**: All I/O operations live here

#### Interfaces Layer (`src/interfaces/`)
- **Purpose**: Entry points and adapters to external world
- **Dependencies**: Imports from `application/` (and domain types)
- **Contents**: HTTP routes, Controllers, UI Components
- **Rule**: Thin layer - no business logic

### 🔄 Dependency Flow

```
interfaces → application → domain
infrastructure → application → domain
```

**The Dependency Rule**: Source code dependencies must point only inward. Inner layers know nothing about outer layers.

## Example: Note Feature

### Domain Layer
```typescript
// Entity with business rules
Note entity validates title length and sanitizes content

// Repository interface (contract)
INoteRepository defines data access methods
```

### Application Layer
```typescript
// Use Case orchestrates domain objects
CreateNoteUseCase receives title and content, creates Note entity, saves via repository
```

### Infrastructure Layer
```typescript
// Repository implementation
InMemoryNoteRepository implements INoteRepository with actual data storage
```

### Interfaces Layer
```typescript
// API Route handler
POST /api/notes validates input, calls CreateNoteUseCase, returns response
```

## Benefits of This Architecture

✅ **Testability**: Business logic is isolated and easy to test  
✅ **Maintainability**: Clear separation of concerns  
✅ **Flexibility**: Easy to swap implementations (e.g., change database)  
✅ **Independence**: Business rules don't depend on frameworks  
✅ **Scalability**: Each layer can evolve independently  

## Contributing

When adding new features:

1. Start with the domain - define entities and business rules
2. Create use cases in the application layer
3. Implement infrastructure (if needed)
4. Add interface adapters (API routes, components)
5. Always respect the dependency rule

## License

MIT
