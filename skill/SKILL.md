---
name: gramstax
description: Efficiently search and read documentation files organized by prefix.className.memberName.md pattern (e.g., gramstax.ctx.reply.md). Use when needing to look up API documentation, class methods, or member documentation without loading entire documentation sets.
---

## When to Use This Skill

Use this skill when you need to:

- Look up documentation for specific class members
- List all available members of a class
- Search for members and get suggestions with proper prefix
- Read documentation without loading everything into context

## For Best Practice (Mandatory and highly recommended)

read file ./best-practice.md

## Documentation File Pattern

This skill expects documentation files following this pattern:

```
docs/
  ├── gramstax.ctx.reply.md
  ├── gramstax.ctx.replyPhoto.md
  ├── gramstax.ctx.replyaction.md
  ├── gramstax.bot.start.md
  └── gramstax.api.users.md
```

Pattern: `prefix.<className>.<memberName>.md`

- **prefix**: Required prefix. already handled automaticly. (default: `gramstax`)
- **className**: The class name (e.g., `ctx`, `bot`, `api`)
- **memberName**: The member/method name (e.g., `reply`, `start`, `users`)

## Commands

### List All Classes

```bash
bun docs-finder.ts
```

Shows all available classes and member counts.

### List Class Members

```bash
bun docs-finder.ts <className>
```

Example: `bun docs-finder.ts gramstax`
Lists all members of the specified class.

### Find Member Across Classes

```bash
bun docs-finder.ts <memberName>
```

Example: `bun docs-finder.ts reply`
Shows which classes have this member.

### Read Specific Documentation

```bash
bun docs-finder.ts <className> <memberName>
```

## Example Usage

```bash
# List all classes
bun docs-finder.ts

# Output:
# 📚 Available Classes (2):
#   • gramstax (5 members)
#   • otherClass (3 members)

# See gramstax members
bun docs-finder.ts gramstax

# Output:
# 📖 Members of 'gramstax' (5):
#   • ctx.reply
#   • ctx.replyPhoto
#   • bot.start
#   ...

# Read specific doc
tsx docs-finder.ts gramstax ctx.reply

# Output:
# ====================================
# 📄 gramstax.ctx.reply
# ====================================
#
# [Full markdown content here...]
```

## Tips for Claude

- Always use this skill before attempting to answer documentation questions
- When user asks about a class, run with just the className first
- Only load full documentation when you need to explain implementation details
- If multiple classes have the same member, list them and ask user to clarify

## Error Handling

The skill provides helpful error messages and suggestions:

- Missing docs directory → Clear error with expected path
- No matches found → Shows available options
- Partial matches → Provides "did you mean" suggestions
