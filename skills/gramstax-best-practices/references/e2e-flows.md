# e2e-flows

Prove fallback pages, session reset/isolation, and language variants — not just happy paths.

## Why

Unknown callbacks/commands/text must land on `StatusPage`, not crash or go silent; a leaked session answers new conversations with old state; an untested access gate is not a gate; untested `lang` variants ship untranslated keyboards. These are the failures users actually report.

## Incorrect

```typescript
// happy path only — fallback, sessions, gate, and i18n unproven
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

## Always test the denial path

A page-level gate (`hookBeforeRoute` on a base class — see `pages-base-classes.md`) returns `false` **silently**. If e2e only exercises the allowed path, a gate that denies everyone, or one that was never wired to the class, still passes. Every gated family needs both directions:

```typescript
// allowed: the page's own content renders
const allowed = await e2e.sendText(`/admin`, adminUser)
expect(allowed.length).toBeGreaterThan(0)

// denied: the handler MUST NOT run, and the denial MUST be visible
await e2e.sendText(`/admin`, plainUser)
const methods = e2e.calls.map((c) => c.method)
expect(methods).not.toContain(`editMessageText`) // the gated render never happened
expect(e2e.lastCall(`answerCallbackQuery`)?.body?.text).toContain(`Forbidden`)
```

The `not.toContain` assertion is the one that matters: it proves the gate blocked the handler rather than the handler rendering something unexpected. A denial that produces **no** call at all is a silent drop and a UX bug — assert the reply exists.

Bot-level gates need the same both-directions treatment in the `BotCore` hook.

## Notes

- Test `gmsg`/`gkb`/`gmedia` with the `lang` parameter against `<g-message lang="...">` templates.
- Session reset: assert post-`/start` state, not just the message.
- A page-level denial does **not** increment `metrics.counts.blocked`, so there is no metric to lean on — assert the calls. See `route-hooks.md`.
- Keep `{user, chat}` ids unique per file so sessions cannot collide across suites.
- Gate fixtures need two distinct users (one allowed, one denied); reusing a single id makes the test pass for the wrong reason.
