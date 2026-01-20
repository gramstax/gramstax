# Plan for example/7-crud (Gramstax + LMDB)

## Overview

Create a new Gramstax example project demonstrating CRUD operations backed by LMDB database. Uses Bun + TypeScript + Gramstax.

## Project Structure

```
example/7-crud/
├── db/                           # LMDB database files (created at runtime)
├── src/
│   ├── index.ts                  # Entry point
│   ├── env.ts                    # Environment configuration
│   ├── core/
│   │   ├── bot.ts                # Gramstax bot extension
│   │   ├── ctx.ts                # Context with CrudStore
│   │   └── store.ts              # LMDB-backed CRUD store with indexing
│   ├── base/
│   │   ├── page.ts               # Base page class
│   │   └── guard.ts              # Base guard class
│   ├── pages/
│   │   ├── start.ts              # Main menu
│   │   ├── list.ts               # List all items
│   │   ├── create.ts             # Create new item
│   │   ├── update.ts             # Update existing item
│   │   ├── delete.ts             # Delete item
│   │   ├── help.ts               # Help page
│   │   └── general-status.ts     # Error/fallback page
│   ├── utils/
│   │   └── log.ts                # Logging utilities
│   ├── blocks/
│   │   └── keyboard.ts           # Keyboard definitions
│   └── guards/
│       └── __example.ts          # Guard examples
├── package.json
├── tsconfig.json
├── README.md
└── PLAN.md                       # This file
```

## Entity Definition

Default entity: `TodoItem`

```typescript
type TodoItem = {
  id: number           // Auto-incremented
  title: string        // User input
  description: string  // Optional, from input
  createdAt: number    // Timestamp
}
```

Input format for create/update: `title | description` (pipe separator). Description defaults to empty string.

## LMDB Database Design

### Location
- Path: `db/lmdb` (relative to project root)
- Created on first run

### Key/Value Stores

#### 1. Items Store
- Key format: `item:{id}` (e.g., `item:1`, `item:42`)
- Value: JSON stringified `TodoItem`

#### 2. Index Stores

**Primary Index: ID List**
- Key: `index:ids`
- Value: JSON array of all item IDs `[1, 2, 3, ...]`
- Used for listing all items in creation order

**Counter Store**
- Key: `counter:id`
- Value: JSON number representing next ID
- Used for auto-increment: `nextId = counter + 1`

### Operations (in `src/core/store.ts`)

| Operation | LMDB Steps |
|-----------|------------|
| `createItem(title, description)` | 1. Get next ID from `counter:id` 2. Create `TodoItem` 3. Write `item:{id}` 4. Append id to `index:ids` 5. Increment `counter:id` |
| `getItem(id)` | Read `item:{id}`, parse JSON |
| `updateItem(id, title, description)` | Read `item:{id}`, update fields, write back `item:{id}` |
| `deleteItem(id)` | 1. Delete `item:{id}` 2. Remove id from `index:ids` array 3. Write back updated `index:ids` |
| `listItems(limit?, offset?)` | 1. Read `index:ids` 2. Apply pagination (slice) 3. Batch read each `item:{id}` |
| `listCount()` | Read `index:ids`, return array length |

## Gramstax Integration

### Bot Core (`src/core/bot.ts`)

```typescript
export class BotCore extends Gramstax {
  crudStore = new CrudStore()

  createCtx(ct) {
    return new CtxCore({
      ct,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      crudStore: this.crudStore,
      temp: {isAnswer: false, session: {}, data: {}}
    })
  }

  async hookErrorPage(ctx, listenerName, error, isEdit) {
    await new GeneralStatusPage(ctx).toError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  async hookErrorInputNotFoundPage(ctx) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound()
  }
}
```

### Context (`src/core/ctx.ts`)

```typescript
export class CtxCore extends Ctx {
  crudStore: CrudStore
  constructor(params) {
    super({...params})
    this.crudStore = params.crudStore
  }
}
```

## CRUD Pages

### StartPage (`src/pages/start.ts`)
- Inline keyboard buttons: List, Create, Update, Delete, Help
- `/start` and `/menu` commands open menu
- Callback refreshes menu

### ListPage (`src/pages/list.ts`)
- Display all items from `CrudStore.listItems()`
- Format: each item on its own line with `#{id} title`
- Inline "Back to Menu" button
- Future: pagination if list exceeds ~20 items

### CreatePage (`src/pages/create.ts`)
- Callback: start text session (`sessionTextFree`)
- Text input handler:
  - Parse `title | description` format
  - Validate title is non-empty
  - Call `CrudStore.createItem(title, description)`
  - Show success with new item details
- Invalid input: show error with retry option
- Cancel button to return to menu

### UpdatePage (`src/pages/update.ts`)
- Callback: prompt for item ID and new data
- Two-step flow:
  1. Enter `id | title | description` (or just `id` for select mode)
  2. Parse, validate item exists
  3. Update fields and confirm
- Error cases:
  - Item not found → show "Item #X not found"
  - Invalid format → show "Expected format: id \| title \| description"
- Success: show updated item details

### DeletePage (`src/pages/delete.ts`)
- Callback: prompt for item ID
- Text input handler:
  - Parse ID
  - Validate item exists
  - Call `CrudStore.deleteItem(id)`
  - Show confirmation with deleted item title
- Not found error with retry option
- Cancel button to return to menu

### HelpPage (`src/pages/help.ts`)
- Static content explaining:
  - Commands (`/start`, `/menu`)
  - Input formats for create/update
  - Keyboard navigation
- Inline "Back to Menu" button

### GeneralStatusPage (`src/pages/general-status.ts`)
- Reuse from bank-system pattern
- `toError` and `toErrorInputNotFound` methods
- Error template with keyboard

## Templates

### Base Template Pattern

```html
<base>
  <keyboard>List, Create, Update, Delete, Help</keyboard>
  <message>
    Todo Menu
    Select a CRUD operation.
  </message>
</base>
```

### Reuse Default Keyboard
- Define main `<keyboard>` in default `<base>` (no `id`)
- Other `<base>` blocks call inline/bottom keyboard builders without `baseId`

## Dependencies

### `package.json`

```json
{
  "name": "example-7-crud",
  "private": false,
  "scripts": {
    "start": "bun ./src/index.ts",
    "dev": "bun --watch ./src/index.ts"
  },
  "dependencies": {
    "gramstax": "workspace:*",
    "lmdb": "^3.1.4"
  }
}
```

## Configuration

### `src/env.ts`

```typescript
export const env = {
  TELEGRAM_BOT_DEPLOY: `polling` as string,
  TELEGRAM_BOT_TOKEN: `YOUR_TOKEN_HERE` as string
}
```

## Documentation

### `README.md` Sections

1. **Overview**: Gramstax CRUD bot with LMDB persistence
2. **Requirements**: Bun, Telegram bot token
3. **Setup**:
   - Install deps: `bun install` (from repo root)
   - Set token in `src/env.ts`
   - Run: `bun start` (in `example/7-crud`)
4. **Environment Variables**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_DEPLOY`
5. **Commands & Usage**:
   - `/start` or `/menu`: open menu
   - Inline buttons: List, Create, Update, Delete, Help
   - Input formats:
     - Create: `My task | optional description`
     - Update: `id | new title | new description`
     - Delete: `id`
6. **Database Persistence**:
   - LMDB files stored in `db/`
   - Created on first run
   - Persists across bot restarts
7. **File Structure**: brief tree

## Implementation Checklist

- [ ] Create folder structure (`src/core`, `src/pages`, `src/base`, `src/utils`, `src/blocks`, `src/guards`)
- [ ] Create `package.json`, `tsconfig.json`, `env.ts`, `index.ts`
- [ ] Implement `src/core/store.ts` (LMDB + index logic)
- [ ] Implement `src/core/bot.ts` and `src/core/ctx.ts`
- [ ] Implement `src/base/page.ts` and `src/base/guard.ts`
- [ ] Implement `src/pages/start.ts`
- [ ] Implement `src/pages/list.ts`
- [ ] Implement `src/pages/create.ts`
- [ ] Implement `src/pages/update.ts`
- [ ] Implement `src/pages/delete.ts`
- [ ] Implement `src/pages/help.ts`
- [ ] Implement `src/pages/general-status.ts`
- [ ] Create `src/utils/log.ts`
- [ ] Create `src/blocks/keyboard.ts`
- [ ] Create `src/guards/__example.ts`
- [ ] Write `README.md`
- [ ] Test `bun start` locally (manual smoke test)

## Notes

- LMDB is a key/value store; index pattern above enables efficient listing
- Use `open({path: "db/lmdb"})` for DB initialization
- JSON serialization for all values
- Keyboard templates follow repo Prettier rules (2-space, no semicolons, backtick strings)
- Error handling hooks match `example/6-bank-system` pattern
