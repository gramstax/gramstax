# Rule Template

Use this shape when adding a rule file so agents can scan uniformly.

```markdown
# <prefix>-<topic>

One-line verdict first.

## Why

2-4 sentences: cost model, failure mode, or scale at which it bites.

## Incorrect

\`\`\`typescript
// what breaks, in one comment line
<code>
\`\`\`

## Correct

\`\`\`typescript
<code>
\`\`\`

## Notes

- Measured impact (with bench file + command) or "structural, by construction".
- Exceptions, if any.
```

Rules: backticks for identifiers, no semicolons in TS snippets (repo Biome style),
incorrect-before-correct order, every claim either measured (`bench/*.bench.ts`)
or marked structural.
