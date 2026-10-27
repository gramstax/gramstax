# Rule Template

Copy this shape for every new rule file. Keep it tight: verdict first,
one incorrect/correct pair, notes only for non-obvious edges.

```markdown
# <prefix>-<topic>.md

Verdict: <one line — do X / never Y>.

## Why

<2-4 lines. Cite measured evidence or the failing test where possible.>

## Incorrect

```typescript
<minimal code showing the violation>
```

## Correct

```typescript
<minimal code showing the required pattern>
```

## Notes

- <edge case, invariant, or pointer to test/README section>
```
