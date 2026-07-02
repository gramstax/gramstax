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
