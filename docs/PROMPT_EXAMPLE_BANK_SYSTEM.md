**Prompt:**

Create 1 bot project in the `./example` folder. The bot is a complete, standalone project.

**Project Structure:**

```
./example/
  └── bank-system/
```

**Important:**
Refer to `./docs/PROMPT_EXAMPLE.md` for the standard project structure, naming conventions, and documentation style. Each new project must follow the same file organization and README format.

---

**Project: Bank System Bot**

**Location:** `./example/bank-system/`

**Description:** A bank-system bot with transfers, precision handling, and inline keyboard navigation.

**Features:**

- `/start` - Welcome message and inline menu
- `/balance` - Show current balance (6 decimal places)
- `/deposit <amount>` - Add funds
- `/withdraw <amount>` - Deduct funds
- `/transfer <amount> <user>` - Transfer funds to another user
- `/history` - Show recent transactions (in memory)

**Inline Keyboard:**

- Use inline keyboards for all menu navigation (no bottom keyboard).
- Provide buttons for Balance, Deposit, Withdraw, Transfer, History.

**Balance Rules:**

- Use 6 decimal places for display.
- Use full `bigint` parsing for precision (no floating-point arithmetic).
- Store balances as full hex strings.

**Persistence:**

- No database.
- Use in-memory storage only.

**Purpose:** Demonstrate a bank-system workflow with transfers and precise numeric handling.

---

**General Requirements:**

- Use gramstax package only (no database)
- Project must be independently runnable
- Include comprehensive inline code comments
- Clear README with setup instructions and usage examples
- Proper error handling

---
