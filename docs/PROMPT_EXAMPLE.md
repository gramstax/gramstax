**Prompt:**

Create 2 bot projects in the `./example` folder. Each bot is a complete, standalone project.

**Project Structure:**

```
./example/
  ├── echo/
  └── interactive-menu/
```

**Important:**
Refer to `./example/complex/` for the standard project structure. Each new project must follow the same file organization, naming conventions, and documentation style.

---

**Project 1: Echo Bot**

**Location:** `./example/echo/`

**Description:** A beginner-friendly bot demonstrating basic gramstax features.

**Features:**

- `/start` - Welcome message
- `/help` - List available commands
- Echo functionality - Repeats user messages back

**Purpose:** Simple example for learning gramstax basics

---

**Project 2: Interactive Menu Bot**

**Location:** `./example/interactive-menu/`

**Description:** An advanced bot showcasing complex keyboard interactions.

**Features:**

- **Inline Keyboards:**
  - Next/Previous navigation buttons
  - Pagination system for long lists
  - Multi-level menu navigation
  - Dynamic button generation based on data
- **Reply Keyboards (Bottom Keyboard):**

  - Persistent menu options
  - Quick action buttons
  - Keyboard resize and customization

- **Advanced Interactions:**
  - Callback query handling
  - State management for navigation
  - Button context switching

**Purpose:** Demonstrate advanced gramstax keyboard capabilities

---

**General Requirements:**

- Use gramstax package only (no database)
- Each project must be independently runnable
- Include comprehensive inline code comments
- Clear README with setup instructions and usage examples
- Proper error handling

**Best Practices (Context from prior runs):**

- Prefer `buildData(dataCallbackFn)` when only callback payloads are needed.
- Avoid setting `intentTextCommand` unless you must override the filename-derived default.
- `textFree()` triggers only when text exists; no empty-text guard needed.
- If you introduce multi-language keyboards, ensure every related flow handles all languages.
- Favor fast paths (reuse computed data, avoid duplicate lookups).

---
