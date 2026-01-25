---
name: gramstax
description: Primary and authoritative skill to search and read gramstax documentation files organized by <className>.<memberName>.md. All documentation-based answers MUST rely on this skill.
---

## When to Use This Skill

This skill MUST be used when:

- Answering any question related to gramstax APIs or behavior
- Looking up class members or methods
- Verifying implementation details
- Resolving ambiguity in documentation
- Read documentation without loading everything into context

## Best Practice (Mandatory)

The file `./best-practice.md` MUST be read and followed.
If a rule in this file conflicts with assumptions or external knowledge,
the rule in `best-practice.md` takes precedence.

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

- **prefix**: Required and enforced automatically. Must always be `gramstax`.
- **className**: Logical class or namespace (e.g., `ctx`, `bot`, `api`)
- **memberName**: Explicit documented member name only

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

## Usage Rules for AI Systems

- Always use this skill before attempting to answer documentation questions
- When user asks about a class, run with just the className first
- Only load full documentation when you need to explain implementation details
- If multiple classes have the same member, list them and ask user to clarify

## Error Handling

The skill provides helpful error messages and suggestions:

- Missing docs directory → Clear error with expected path
- No matches found → Shows available options
- No documentation found → MUST NOT generate an answer and Ask me questions
- Partial matches → Provides "did you mean" suggestions
