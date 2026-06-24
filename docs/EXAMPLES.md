# Code Examples

This document provides practical examples of how to work with the clean architecture in this project.

## Adding a New Feature: Tags

Let's walk through adding a complete new feature following clean architecture principles.

### Step 1: Domain Layer

First, define the business entities and rules:

```typescript
// src/domain/entities/Tag.ts
export class Tag {
  private constructor(
    private readonly _id: string,
    private _name: string,
    private _color: string
  ) {
    this.validate();
  }

  static create(id: string, name: string, color: string): Tag {
    return new Tag(id, name, color);
  }

  private validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Tag name cannot be empty');
    }
    if (this._name.length > 50) {
      throw new Error('Tag name cannot exceed 50 characters');
    }
    if (!/^#[0-9A-F]{6}$/i.test(this._color)) {
      throw new Error('Color must be a valid hex code');
    }
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get color(): string {
    return this._color;
  }
}
```

```typescript
// src/domain/repositories/ITagRepository.ts
import { Tag } from '../entities/Tag';

export interface ITagRepository {
  save(tag: Tag): Promise<void>;
  findById(id: string): Promise<Tag | null>;
  findAll(): Promise<Tag[]>;
  delete(id: string): Promise<boolean>;
}
```

### Step 2: Application Layer

Create use cases and DTOs:

```typescript
// src/application/dtos/TagDTO.ts
export interface CreateTagInputDTO {
  name: string;
  color: string;
}

export interface TagOutputDTO {
  id: string;
  name: string;
  color: string;
}
```

```typescript
// src/application/use-cases/CreateTagUseCase.ts
import { Tag } from '@/domain/entities/Tag';
import { NoteId } from '@/domain/value-objects/NoteId';
import { ITagRepository } from '@/domain/repositories/ITagRepository';
import { CreateTagInputDTO, TagOutputDTO } from '../dtos/TagDTO';

export class CreateTagUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(input: CreateTagInputDTO): Promise<TagOutputDTO> {
    const tagId = NoteId.generate(); // Reuse existing value object
    const tag = Tag.create(tagId.toString(), input.name, input.color);
    
    await this.tagRepository.save(tag);
    
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
    };
  }
}
```

### Step 3: Infrastructure Layer

Implement the repository:

```typescript
// src/infrastructure/persistence/InMemoryTagRepository.ts
import { Tag } from '@/domain/entities/Tag';
import { ITagRepository } from '@/domain/repositories/ITagRepository';

export class InMemoryTagRepository implements ITagRepository {
  private tags: Map<string, Tag> = new Map();

  async save(tag: Tag): Promise<void> {
    this.tags.set(tag.id, tag);
  }

  async findById(id: string): Promise<Tag | null> {
    return this.tags.get(id) || null;
  }

  async findAll(): Promise<Tag[]> {
    return Array.from(this.tags.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.tags.delete(id);
  }
}
```

Update the DI container:

```typescript
// src/infrastructure/di/container.ts (add to existing file)
import { ITagRepository } from '@/domain/repositories/ITagRepository';
import { InMemoryTagRepository } from '../persistence/InMemoryTagRepository';
import { CreateTagUseCase } from '@/application/use-cases/CreateTagUseCase';

class DIContainer {
  private tagRepository: ITagRepository;

  constructor() {
    this.tagRepository = new InMemoryTagRepository();
  }

  getTagRepository(): ITagRepository {
    return this.tagRepository;
  }

  getCreateTagUseCase(): CreateTagUseCase {
    return new CreateTagUseCase(this.getTagRepository());
  }
}
```

### Step 4: Interfaces Layer

Validate the payload with a zod schema and route every error through the shared
`mapError`, so the new resource gets the same uniform envelope as Notes (see
[API.md → Validation & error handling](./API.md#validation--error-handling)).

```typescript
// src/interfaces/http/validation/tagSchemas.ts
import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required' }),
  color: z.string().trim().min(1, { message: 'Color is required' }),
});
```

```typescript
// src/interfaces/http/controllers/TagController.ts
import { container } from '@/infrastructure/di/container';
import { ControllerResult, ok, mapError } from '@/interfaces/http/apiResponse';
import { createTagSchema } from '@/interfaces/http/validation/tagSchemas';

export class TagController {
  static async createTag(body: unknown): Promise<ControllerResult> {
    try {
      const input = createTagSchema.parse(body); // throws ZodError → 400
      const useCase = container.getCreateTagUseCase();
      const result = await useCase.execute(input);
      return ok(result, 201);
    } catch (error) {
      return mapError(error); // ZodError / DomainException / unknown → uniform
    }
  }
}
```

```typescript
// src/app/api/v1/tags/route.ts
import { NextRequest } from 'next/server';
import { TagController } from '@/interfaces/http/controllers/TagController';
import { toNextResponse } from '@/interfaces/http/apiResponse';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const result = await TagController.createTag(body);
  return toNextResponse(result);
}
```

## Testing Examples

### Testing Domain Logic

Domain tests don't need any infrastructure:

```typescript
// tests/domain/entities/Note.test.ts
import { Note } from '@/domain/entities/Note';

describe('Note Entity', () => {
  it('should create a valid note', () => {
    const note = Note.create('123', 'My Note', 'Content here');
    
    expect(note.id).toBe('123');
    expect(note.title).toBe('My Note');
    expect(note.content).toBe('Content here');
  });

  it('should throw error for empty title', () => {
    expect(() => {
      Note.create('123', '', 'Content');
    }).toThrow('Note title cannot be empty');
  });

  it('should calculate word count correctly', () => {
    const note = Note.create('123', 'Title', 'Hello world test');
    expect(note.getWordCount()).toBe(3);
  });
});
```

### Testing Use Cases

Use cases can be tested with mock repositories:

```typescript
// tests/application/use-cases/CreateNoteUseCase.test.ts
import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { Note } from '@/domain/entities/Note';

class MockNoteRepository implements INoteRepository {
  private notes: Note[] = [];

  async save(note: Note): Promise<void> {
    this.notes.push(note);
  }

  async findById(id: string): Promise<Note | null> {
    return this.notes.find(n => n.id === id) || null;
  }

  // ... implement other methods
}

describe('CreateNoteUseCase', () => {
  it('should create a note', async () => {
    const mockRepo = new MockNoteRepository();
    const useCase = new CreateNoteUseCase(mockRepo);

    const result = await useCase.execute({
      title: 'Test Note',
      content: 'Test content'
    });

    expect(result.title).toBe('Test Note');
    expect(result.content).toBe('Test content');
    expect(result.id).toBeDefined();
  });
});
```

## Common Patterns

### Pattern 1: Repository Pattern

Always define interface in domain, implement in infrastructure:

```typescript
// Domain: Contract only
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
}

// Infrastructure: Implementation
export class PostgresUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const row = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return row ? this.toDomain(row) : null;
  }
}
```

### Pattern 2: Value Objects

Use for domain concepts that are compared by value:

```typescript
export class Email {
  private constructor(private readonly value: string) {
    this.validate();
  }

  static create(value: string): Email {
    return new Email(value);
  }

  private validate(): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) {
      throw new Error('Invalid email format');
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

### Pattern 3: Domain Services

For logic that doesn't belong to a single entity:

```typescript
export class NoteCollaborationService {
  static merge(notes: Note[]): Note {
    const mergedContent = notes
      .map(note => note.content)
      .join('\n\n---\n\n');
    
    return Note.create(
      NoteId.generate().toString(),
      'Merged Notes',
      mergedContent
    );
  }

  static findDuplicates(notes: Note[]): Note[][] {
    // Logic for finding similar notes
  }
}
```

### Pattern 4: DTOs for Decoupling

Never expose domain entities directly:

```typescript
// ❌ BAD: Controller returns entity
export class NoteController {
  async getNote(id: string): Promise<Note> {
    return await repository.findById(id);
  }
}

// ✅ GOOD: Controller returns DTO
export class NoteController {
  async getNote(id: string): Promise<NoteOutputDTO> {
    const note = await useCase.execute({ id });
    return note; // Already a DTO from use case
  }
}
```

## Migration Example

### Switching from In-Memory to PostgreSQL

1. Create new repository implementation:

```typescript
// src/infrastructure/persistence/PostgresNoteRepository.ts
import { Pool } from 'pg';
import { Note } from '@/domain/entities/Note';
import { INoteRepository } from '@/domain/repositories/INoteRepository';

export class PostgresNoteRepository implements INoteRepository {
  constructor(private pool: Pool) {}

  async save(note: Note): Promise<void> {
    await this.pool.query(
      'INSERT INTO notes (id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET title = $2, content = $3, updated_at = $5',
      [note.id, note.title, note.content, note.createdAt, note.updatedAt]
    );
  }

  async findById(id: string): Promise<Note | null> {
    const result = await this.pool.query(
      'SELECT * FROM notes WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return Note.reconstitute(
      row.id,
      row.title,
      row.content,
      row.created_at,
      row.updated_at
    );
  }

  // ... implement other methods
}
```

2. Update DI container (one line change!):

```typescript
// src/infrastructure/di/container.ts
getNoteRepository(): INoteRepository {
  // Before (registered default):
  // return new SqliteNoteRepository();

  // After:
  return new PostgresNoteRepository(this.getDbPool());
}
```

**That's it!** No changes needed in domain, application, or interfaces layers.

## Best Practices

1. **Start with Domain**: Always begin with entities and business rules
2. **One Use Case, One File**: Each use case should be in its own file
3. **Thin Controllers**: Controllers should be ~20 lines max
4. **No Leaky Abstractions**: Never expose ORM types or HTTP types to inner layers
5. **Test Domain First**: Most tests should be on domain and application layers
6. **Use Dependency Injection**: Never create dependencies inside classes
7. **Validate at Boundaries**: Input validation in controllers, business validation in domain
