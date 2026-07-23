# PROJECT STRUCTURE RULES

> [!IMPORTANT]
> All new Gramstax projects **MUST** be initialized using the official CLI:
>
> ```bash
> npx create-gramstax@latest
> ```
>
> **DO NOT** create the project structure manually. Use the CLI to ensure proper scaffolding, configuration, and adherence to the Gramstax architecture.

## Standard Directory Layout

A Gramstax project follows a strict directory structure to ensure modularity and ease of maintenance:

| Directory       | Purpose           | Contents & Best Practices                                                                           |
| :-------------- | :---------------- | :-------------------------------------------------------------------------------------------------- |
| **src/base**    | Base Abstractions | Contains core classes like `guard.ts` and `page.ts`. These should rarely be modified by the user.   |
| **src/blocks**  | Template Helpers  | Holds shared UI components like `keyboard.ts`. Use this for UI elements used across multiple pages. |
| **src/core**    | Framework Core    | Runtime entry points such as `bot.ts` and the context (`ctx.ts`).                                   |
| **src/guards**  | Security          | Implementation of access control and input validation guards.                                       |
| **src/helpers** | Project Utilities | Domain-specific helpers like `log.ts` or specialized formatters.                                    |
| **src/pages**   | Application Logic | The primary location for bot pages. Each file represents a specific user interaction state.         |
| **src/utils**   | Generic Utils     | Pure functions and generic utilities (e.g., `array.ts`, `string.ts`).                               |

### Domain-Specific Directories (Optional)

For more complex applications, follow these patterns:

- `src/db`: Centralized database connection and configuration.
- `src/db/repositories`: Data access logic (CRUD operations).
- `src/services`: Orchestration of external APIs or complex business workflows.

## File Naming Convention

### REQUIRED: kebab-case for All Files

Every file inside `src/` **MUST** use `kebab-case`.

| ✅ Correct                  | ❌ Incorrect                   |
| :-------------------------- | :----------------------------- |
| `user-service.ts`           | `userService.ts`               |
| `bot-config.ts`             | `botConfig.ts`                 |
| `telegram-utils.ts`         | `telegramUtils.ts`             |
| `http-request-handler.ts`   | `HttpRequestHandler.ts`        |
| `string-helper.ts`          | `string_helper.ts`             |
| `index.ts`, `start.ts`      | (single word — still kebab)    |

**Rules:**
- Use `kebab-case` for all TypeScript/JavaScript source files.
- File names consist of one or more words separated by hyphens (`-`).
- **FORBIDDEN**: `camelCase`, `PascalCase`, or `snake_case` for file names.
- Single-word files like `start.ts`, `index.ts`, `help.ts` are still valid.

### Parent-Child Structure for Sub-Files

When a file has sub-files that are logically part of it, use the `<parent>-<child>.ts` structure:

```
src/
├── admin.ts              # Main file
├── admin-list.ts         # Child: list
├── admin-list-detail.ts  # Grandchild: detail from list
├── order.ts              # Main file
├── order-create.ts       # Child: create order
└── order-checkout.ts     # Child: checkout order
```

**Rules:**
- Use parent-child only when files have a hierarchical relationship.
- Standalone files (no children) should just use a descriptive name without prefix.
- No hard limit on depth — maximum 5 levels recommended for readability.
