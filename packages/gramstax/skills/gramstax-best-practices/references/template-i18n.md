# template-i18n

Localize with `lang` variants plus `intentTextMap`; `default` is the fallback, never omit it.

## Why

A missing variant renders nothing (or the wrong language) for that user — and untranslated keyboards still send the default callbacks, so the bot looks broken only for some locales.

## Incorrect

```typescript
// english-only template + hardcoded intent — id users see english, callbacks untyped
const template = `<g-base><g-message>Hello</g-message></g-base>`
```

## Correct

```typescript
const template = `<g-base>
  <g-message>Hello {{name}}</g-message>
  <g-message lang="id">Halo {{name}}</g-message>
  <g-keyboard type="inline" lang="id">🇺🇸 EN, 🇮🇩 ID</g-keyboard>
</g-base>`
```

```typescript
static data = this.buildData({name: `lang`, intentTextMap: {en: `hello`, default: `hello`}})
```

## Notes

- Selection key is the user's `language_code`; fallback chain is base→default then lang→default — always author the `default` variant.
- `intentTextMap` drives both routing text and button labels (`resolvePageTextLang`); keep map keys aligned with template `lang` values.
- Test every locale via `{user: {language_code: 'id'}}` and `gmsg`/`gkb` with the `lang` parameter (see `e2e-flows.md`).
