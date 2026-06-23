# Documentation Index

Complete guide to the Notes Demo project documentation.

## 📚 Documentation Overview

| Document | Purpose | Audience |
|----------|---------|----------|
| [QUICKSTART.md](../QUICKSTART.md) | Get up and running in 5 minutes | Everyone |
| [README.md](../README.md) | Project overview and setup | Everyone |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Deep dive into clean architecture | Developers |
| [API.md](./API.md) | REST API reference | API consumers |
| [EXAMPLES.md](./EXAMPLES.md) | Code examples and patterns | Developers |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How to contribute | Contributors |
| [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) | Complete file tree | Everyone |

## 🎯 Quick Navigation

### I'm New Here
1. Start: [QUICKSTART.md](../QUICKSTART.md)
2. Then: [README.md](../README.md)
3. Next: [ARCHITECTURE.md](./ARCHITECTURE.md)

### I Want to Use the API
- [API.md](./API.md) - Complete endpoint reference

### I Want to Understand the Code
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture principles
2. [EXAMPLES.md](./EXAMPLES.md) - Code patterns
3. [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) - File organization

### I Want to Contribute
1. [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture rules
3. [EXAMPLES.md](./EXAMPLES.md) - Implementation patterns

## 📖 Core Concepts

### Clean Architecture
The project follows Clean Architecture with four layers:

```
interfaces → application → domain
infrastructure → application → domain
```

Learn more: [ARCHITECTURE.md](./ARCHITECTURE.md)

### Layer Responsibilities

| Layer | Purpose | Can Import |
|-------|---------|------------|
| **Domain** | Business rules | Nothing |
| **Application** | Use cases | Domain only |
| **Infrastructure** | I/O operations | Domain + Application |
| **Interfaces** | Entry points | Application only |

### The Dependency Rule

**ABSOLUTE**: Dependencies must only point inward.
- Domain imports nothing
- Application imports only Domain
- Infrastructure and Interfaces import Application (and Domain)

## 🔍 Finding What You Need

### "How do I...?"

**...set up the project?**
→ [QUICKSTART.md](../QUICKSTART.md)

**...create a new feature?**
→ [EXAMPLES.md](./EXAMPLES.md) - See "Adding a New Feature"

**...understand the architecture?**
→ [ARCHITECTURE.md](./ARCHITECTURE.md)

**...use the API?**
→ [API.md](./API.md)

**...run the tests?**
→ [README.md](../README.md) - See "Available Scripts"

**...contribute code?**
→ [CONTRIBUTING.md](../CONTRIBUTING.md)

**...switch from in-memory to a real database?**
→ [EXAMPLES.md](./EXAMPLES.md) - See "Migration Example"

**...find a specific file?**
→ [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)

## 📋 Architecture Contracts

These files define the rules for each layer:

- `CLAUDE.md` (root) - Global architecture contract
- `src/domain/CLAUDE.md` - Domain layer rules
- `src/application/CLAUDE.md` - Application layer rules
- `src/infrastructure/CLAUDE.md` - Infrastructure layer rules
- `src/interfaces/CLAUDE.md` - Interfaces layer rules

**Read these before coding!** They contain the non-negotiable rules.

## 🎓 Learning Path

### Beginner Path
1. **Setup** - [QUICKSTART.md](../QUICKSTART.md) (5 min)
2. **Overview** - [README.md](../README.md) (10 min)
3. **Try the API** - [API.md](./API.md) (15 min)
4. **Explore UI** - Open http://localhost:3000 (10 min)

### Intermediate Path
1. **Architecture Basics** - [ARCHITECTURE.md](./ARCHITECTURE.md) (30 min)
2. **Code Examples** - [EXAMPLES.md](./EXAMPLES.md) (30 min)
3. **File Structure** - [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) (15 min)
4. **Read Source** - Start with `src/domain/entities/Note.ts` (1 hour)

### Advanced Path
1. **All Documentation** - Read everything (2 hours)
2. **Layer Contracts** - Read all CLAUDE.md files (30 min)
3. **Implementation** - Study each layer in depth (4 hours)
4. **Contribute** - Add a new feature (varies)

## 🏗️ Project Structure Quick Reference

```
notes-demo/
├── docs/                    # 📚 You are here
│   ├── INDEX.md            # This file
│   ├── ARCHITECTURE.md     # Architecture deep dive
│   ├── API.md              # API reference
│   └── EXAMPLES.md         # Code examples
│
├── src/
│   ├── domain/             # 🔵 Business logic
│   ├── application/        # 🟢 Use cases
│   ├── infrastructure/     # 🟡 I/O implementations
│   ├── interfaces/         # 🟠 Entry points
│   └── app/                # Next.js app
│
├── QUICKSTART.md           # ⚡ 5-minute setup
├── README.md               # 📖 Project overview
├── CONTRIBUTING.md         # 🤝 How to contribute
└── PROJECT_STRUCTURE.md    # 📁 Complete file tree
```

## 🎯 By Role

### Frontend Developer
- [QUICKSTART.md](../QUICKSTART.md) - Setup
- [API.md](./API.md) - API endpoints
- `src/interfaces/components/` - React components
- `src/app/page.tsx` - Main page

### Backend Developer
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture
- [EXAMPLES.md](./EXAMPLES.md) - Patterns
- `src/domain/` - Business logic
- `src/application/` - Use cases
- `src/infrastructure/` - Repositories

### Full Stack Developer
- All of the above!
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guide

### Architect / Tech Lead
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture principles
- `CLAUDE.md` files - Layer contracts
- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) - Organization

### Product Manager
- [README.md](../README.md) - What the project does
- [API.md](./API.md) - Available features
- [QUICKSTART.md](../QUICKSTART.md) - Try it yourself

## 🔄 Workflow Guides

### Adding a New Feature
1. Read: [EXAMPLES.md](./EXAMPLES.md) - "Adding a New Feature"
2. Follow: Domain → Application → Infrastructure → Interfaces
3. Check: [CONTRIBUTING.md](../CONTRIBUTING.md) - Guidelines

### Fixing a Bug
1. Identify: Which layer has the bug?
2. Check: Relevant `CLAUDE.md` for layer rules
3. Fix: Follow dependency rule
4. Test: Start with domain tests

### Code Review Checklist
1. ✅ Follows dependency rule?
2. ✅ Business logic in domain?
3. ✅ Controllers are thin?
4. ✅ No leaky abstractions?
5. ✅ Tests added?

## 📞 Getting Help

### Documentation Not Clear?
Open an issue with:
- Which document you're reading
- What's confusing
- Suggestions for improvement

### Architecture Questions?
1. Check: [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Check: Relevant `CLAUDE.md` file
3. Check: [EXAMPLES.md](./EXAMPLES.md)
4. Still stuck? Open an issue

### Bug or Issue?
1. Check: Is it documented behavior?
2. Check: [QUICKSTART.md](../QUICKSTART.md) troubleshooting
3. Open an issue with reproduction steps

## 🚀 Next Steps

Choose your path:

**Just want to try it?**
→ [QUICKSTART.md](../QUICKSTART.md)

**Want to learn the architecture?**
→ [ARCHITECTURE.md](./ARCHITECTURE.md)

**Ready to build something?**
→ [EXAMPLES.md](./EXAMPLES.md)

**Want to contribute?**
→ [CONTRIBUTING.md](../CONTRIBUTING.md)

---

*This documentation is for Notes Demo, a clean architecture example built with Next.js, TypeScript, and Tailwind CSS.*
