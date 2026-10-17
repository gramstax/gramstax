# route-handlers

Page handlers stay thin; step logic lives in `g*` show/process pairs.

## Why

Fat handlers mix routing, validation, rendering, and business logic — untestable and unrepeatable across steps. `g*` objects make each step independently renderable and processable, which is exactly what e2e tests drive.

## Incorrect

```typescript
async handleCallbackQueryData() {
  const balance = await store.get(this.from.id) // business logic in handler
  if (balance < amount) { /* inline error render */ }
  await this.renderText({keyboard: this.inlineKeyboardT([StartPage], `1`), data: {balance}}) // rendering mixed in
  await this.setSessionFreeText({step: `confirm`})
}
```

## Correct

```typescript
async handleCallbackQueryData() {
  await this.gamount.show(true)
}

async handleSessionFreeText() {
  const {step, amount} = Helper.getSessionParams(this)
  if (step === Base.amount) {
    await this.gamount.process(amount)
  }
}

gamount = {
  show: async (edit: boolean) => { /* ... */ },
  process: async (input: string) => { /* ... */ }
}
```

## Reading update data

Text and caption live on `msg`, so reach them through it and always optional-chain — Telegram updates are sparse, and a caption update carries no `text`.

| Getter | Returns | For `"start 123 456"` |
| --- | --- | --- |
| `this.msg?.text` | `string \| undefined` | `"start 123 456"` |
| `this.msg?.caption` | `string \| undefined` | `undefined` on a text update |
| `msgTextArgs` | `string[]` — all tokens | `["123", "456"]` |
| `msgTextArg` | `string` — **first** token | `"123"` |
| `msgCaptionArgs` | `string[]` — all tokens | `["123", "456"]` |
| `msgCaptionArg` | `string` — **first** token | `"123"` |

`msgTextCommandArgs` / `msgTextCommandArg` are the command-payload equivalents. Note the singular getters return `msg*Args[0]`, so they are `undefined` when there are no args.

Arg-bearing handlers are `handleArgsText` and `handleCommandArgsText` — args come **after** the verb.

```typescript
async handleArgsText() {
  const [code, ...rest] = this.msgTextArgs // all tokens
  const first = this.msgTextArg // just the first
  await this.gamount.process(code ?? first)
}

async handleCaptionPhoto() {
  if (this.msg?.caption?.startsWith(`inv_`)) {
    await this.ginvoice.process(this.msg.caption.slice(4))
  }
}
```

Everything here is optional-chained or array-typed because Telegram updates are sparse — a caption update has no `text`, and a non-command text update may have no args.

## Notes

- Every `g*` object MUST have `show` AND `process` — even when the step expects no input, define `process` as a void noop (`process: () => {}`). Uniform shape keeps AI-generated code consistent: every step is always renderable and processable without special cases.
- Name the object after the step (`gamount`, `gconfirm`); feedback views go last (`gsuccess`, `gfailed`, `gerror`, `gwarn`, `ginfo`).
- Manipulate data via `this.buildData` at the very top of the handler when needed, before rendering.
