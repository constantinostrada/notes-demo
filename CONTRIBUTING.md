# Contributing to Notes Demo

Thank you for your interest in contributing! This project follows Clean Architecture principles with strict layer separation.

## Architecture Rules

Before contributing, please read the architecture documentation:

- `CLAUDE.md` - Global architecture contract
- `src/domain/CLAUDE.md` - Domain layer rules
- `src/application/CLAUDE.md` - Application layer rules
- `src/infrastructure/CLAUDE.md` - Infrastructure layer rules
- `src/interfaces/CLAUDE.md` - Interfaces layer rules

## The Dependency Rule

**ABSOLUTE RULE**: Dependencies must only point inward:

```
interfaces → application → domain
infrastructure → application → domain
```

- `domain/` never imports from other layers
- `application/` only imports from `domain/`
- `infrastructure/` implements interfaces from `domain/` or `application/`
- `interfaces/` orchestrates use cases, contains no business logic

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Run type checking:
   ```bash
   npm run type-check
   ```

4. Run linting:
   ```bash
   npm run lint
   ```

## Adding New Features

Follow this order when adding features:

### 1. Start with Domain Layer

- Define entities with business rules
- Create value objects for domain concepts
- Define repository interfaces (contracts only)
- Add domain services if logic doesn't fit in entities

**Example**: Adding a Tag feature
```typescript
// src/domain/entities/Tag.ts
export class Tag {
  // Entity with validation
}

// src/domain/repositories/ITagRepository.ts
export interface ITagRepository {
  // Contract only, no implementation
}
```

### 2. Application Layer

- Create DTOs for input/output
- Implement use cases with `execute(dto)` method
- Add mappers to convert entities to DTOs

**Example**:
```typescript
// src/application/use-cases/CreateTagUseCase.ts
export class CreateTagUseCase {
  constructor(private tagRepository: ITagRepository) {}
  
  async execute(input: CreateTagInputDTO): Promise<TagOutputDTO> {
    // Orchestrate domain objects
  }
}
```

### 3. Infrastructure Layer

- Implement repository interfaces
- Add database clients or external API adapters
- Handle environment configuration

**Example**:
```typescript
// src/infrastructure/persistence/InMemoryTagRepository.ts
export class InMemoryTagRepository implements ITagRepository {
  // Actual implementation
}
```

### 4. Interfaces Layer

- Add API routes
- Create controllers (thin adapters)
- Build UI components (if needed)

**Example**:
```typescript
// src/app/api/tags/route.ts
export async function POST(request: NextRequest) {
  const controller = new TagController();
  return controller.create(request);
}
```

## Code Style

- Use TypeScript strict mode
- No `any` types (use `unknown` when type is truly unknown)
- Follow ESLint rules
- Use Prettier for formatting
- Write descriptive commit messages

## Testing Guidelines

When adding tests:

- Test domain logic in isolation (no mocks needed)
- Test use cases with repository mocks
- Test controllers with use case mocks
- Infrastructure tests can use real dependencies or test doubles

## Common Mistakes to Avoid

❌ **DON'T**: Import infrastructure into domain
```typescript
// src/domain/entities/Note.ts
import { PrismaClient } from '@prisma/client'; // WRONG!
```

❌ **DON'T**: Put business logic in controllers
```typescript
// src/interfaces/controllers/NoteController.ts
if (note.title.length > 200) { // WRONG! This belongs in domain
  return error;
}
```

❌ **DON'T**: Call use cases from other use cases
```typescript
// src/application/use-cases/ComplexUseCase.ts
const result = await new OtherUseCase().execute(); // WRONG!
```

✅ **DO**: Keep layers pure and respect dependencies
✅ **DO**: Put validation logic in domain entities
✅ **DO**: Make controllers thin adapters
✅ **DO**: Use dependency injection for repositories

## Pull Request Process

1. Ensure your code follows the architecture rules
2. Run `npm run type-check` and fix any errors
3. Run `npm run lint` and fix any warnings
4. Update documentation if adding new features
5. Create a pull request with a clear description

## Questions?

If you're unsure where something belongs:
- Check the layer CLAUDE.md files
- Ask before creating the PR
- When in doubt, prefer domain/application over infrastructure/interfaces

Thank you for contributing! 🎉
