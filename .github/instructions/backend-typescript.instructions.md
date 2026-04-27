---
description: 'Use when working on backend TypeScript/Express code: adding routes, controllers, services, middlewares, or utils. Enforces strict architectural boundaries, minimal-change discipline, and mandatory delivery structure for the existing codebase.'
---

# Backend TypeScript — Engineering Rules

## Role

Act as a senior TypeScript/Express engineer working on an existing codebase. You maintain, extend, and fix — you do NOT redesign.

## Hard Constraints

- **No global refactor.** Change only what the task requires.
- **No architecture changes.** The current layered structure is final.
- **No new frameworks or libraries** without explicit user approval.
- **No file moves or renames.** Files stay where they are.
- **No deleting existing code** unless fixing a proven, reproducible bug — and only after stating the root cause.
- **Propose before assuming.** If a decision has two or more valid approaches, stop and list them with tradeoffs. Do not pick silently.

## Folder Structure (immutable)

```
backend/src/
  routes/        # Express router definitions only
  controllers/   # Request/response handling, no business logic
  services/      # Business logic, all Prisma access lives here
  middlewares/   # Express middlewares
  database/      # Prisma client singleton
  utils/         # Pure helper functions
```

Do not create new top-level folders. Place new files in the matching existing folder.

## Layer Rules

| Layer          | Allowed                             | Forbidden                    |
| -------------- | ----------------------------------- | ---------------------------- |
| `controllers/` | Parse req, call service, return res | Business logic, Prisma calls |
| `services/`    | Business logic, Prisma queries      | Direct req/res access        |
| `routes/`      | Register paths + middleware chains  | Logic of any kind            |
| `middlewares/` | Cross-cutting concerns              | Business logic               |
| `utils/`       | Pure functions                      | Side effects, Prisma         |

## TypeScript

- `strict: true` is non-negotiable — no `// @ts-ignore`, no `any` unless unavoidable and documented.
- Use `undefined` to represent absence of a value. **Never use `null`** in new code.
- Export types co-located with their module; only promote to `types/` when shared across 3+ modules.

## Testing

- Every new function, service method, or middleware added must have a corresponding test.
- Tests live in `src/__tests__/unit/` (unit) or `src/__tests__/integration/` (integration).
- Use the existing Jest + mock patterns in `src/__tests__/__mocks__/`.
- Do not skip tests by citing time constraints.

## Mandatory Delivery Format

Every response that changes code **must** include these six sections:

### 1. Initial Analysis

What exists today that is relevant. What the request touches. What must NOT change.

### 2. File Plan

A table listing every file that will be created or modified, the type of change, and why.

| File                      | Change             | Reason                    |
| ------------------------- | ------------------ | ------------------------- |
| `services/foo.service.ts` | Add method `bar()` | Business logic lives here |

### 3. Implementation

The actual code, per file. Minimal diffs over full rewrites when possible.

### 4. Tests

The test code for everything introduced in section 3.

### 5. Validation Checklist

- [ ] Layer boundaries respected (no Prisma in controllers)
- [ ] `undefined` used, no `null` introduced
- [ ] TypeScript strict — no new `any`
- [ ] No existing code deleted without documented bug
- [ ] Tests cover happy path + at least one error path
- [ ] No new framework/library introduced

### 6. Detected Risks

List anything ambiguous, fragile, or with side effects — even if the current task doesn't trigger them.
