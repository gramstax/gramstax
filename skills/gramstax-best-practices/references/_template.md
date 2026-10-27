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

- Structural (by construction) or measured impact.
- Exceptions, if any.
```

Rules: backticks for identifiers, no semicolons in TS snippets (repo Biome style),
incorrect-before-correct order, every claim structural (traceable to source or
`example/`) unless marked measured.
