# route-handlers

Page handlers stay thin; step logic lives in `g*` show/process pairs.

## Why

Fat handlers mix routing, validation, rendering, and business logic — untestable and unrepeatable across steps. `g*` objects make each step independently renderable and processable, which is exactly what e2e tests drive.

## Incorrect

```typescript
async handleCallbackQueryData() {
  const balance = await store.get(this.from.id) // business logic in handler
  if (balance < amount) { /* inline error render */ }
  await this.render(kb, {balance}) // rendering mixed in
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

## Notes

- Every `g*` object MUST have `show` AND `process` — even when the step expects no input, define `process` as a void noop (`process: () => {}`). Uniform shape keeps AI-generated code consistent: every step is always renderable and processable without special cases.
- Name the object after the step (`gamount`, `gconfirm`); feedback views go last (`gsuccess`, `gfailed`, `gerror`, `gwarn`, `ginfo`).
- Manipulate data via `this.buildData` at the very top of the handler when needed, before rendering.
