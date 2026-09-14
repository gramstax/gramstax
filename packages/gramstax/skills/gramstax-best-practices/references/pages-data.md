# pages-data

Always define `static data = this.buildData(...)`; declare callback args up front.

## Why

`buildData` is what types `callbackQueryData()` — pages without it cannot wire callbacks safely, and undeclared args turn callback payloads into untyped strings that rot.

## Incorrect

```typescript
export class DepositPage extends PageBase {
  // no static data — callbackQueryData unavailable, callbacks stringly-typed
}
```

## Correct

```typescript
export class DepositPage extends PageBase {
  static data = this.buildData((amount: string) => [amount])
  // callbackQueryData(amount: string): string — required arg, type-checked
}

export class StartPage extends PageBase {
  static data = this.buildData()
  // callbackQueryData(): string — calling with args is a TypeScript error
}
```

## Notes

- Optional args: `buildData((a?: string) => [a])`.
- `intentText`/`intentCommandText` accept per-language maps (`{en: ..., default: ...}`) for i18n routing.
- `optionsPage.shortCallbackQueryData: true` shortens payloads (used by `5-interactive-menu`, `9-substore-bot`).
