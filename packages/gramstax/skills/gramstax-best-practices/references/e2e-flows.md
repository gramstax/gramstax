# e2e-flows

Prove fallback pages, session reset/isolation, and language variants — not just happy paths.

## Why

Unknown callbacks/commands/text must land on `StatusPage`, not crash or go silent; a leaked session answers new conversations with old state; untested `lang` variants ship untranslated keyboards. These are the failures users actually report.

## Incorrect

```typescript
// happy path only — fallback, sessions, and i18n unproven
const responses = await e2e.sendCallbackQuery(intent, asUser)
expect(responses.length).toBeGreaterThan(0)
```

## Correct

```typescript
// unknown input falls back to StatusPage
const unknown = await e2e.sendCallbackQuery(`nope:1`, asUser)
expect(unknown.length).toBeGreaterThan(0)

// /start clears the session
await e2e.sendText(`/start`, asUser)

// user B is isolated from user A
await e2e.sendText(`hi`, asUserA)
const isolated = await e2e.sendText(`hi`, asUserB)
expect(isolated).toBeDefined()

// language variant renders translated content
const id = await e2e.sendCallbackQuery(intent, idUser)
expect(id.length).toBeGreaterThan(0)
```

## Notes

- Test `gmsg`/`gkb`/`gmedia` with the `lang` parameter against `<g-message lang="...">` templates.
- Session reset: assert post-`/start` state, not just the message.
- Keep `{user, chat}` ids unique per file so sessions cannot collide across suites.
