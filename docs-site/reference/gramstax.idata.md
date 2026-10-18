---
title: "IData"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IData](./gramstax.idata.md)

## IData type

Generic data object for template interpolation.

**Signature:**

```typescript
type IData = Record<string, unknown>;
```

## Remarks

Used throughout Gramstax for passing dynamic data to templates and methods. Accepts any key-value pairs.

## Example


```ts
const data: IData = {name: `John`, count: 3}
await this.renderText({data})
```

