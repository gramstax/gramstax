---
title: "Gramstax.hookTrace()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [hookTrace](./gramstax.gramstax.hooktrace.md)

## Gramstax.hookTrace() method

Optional OTel-style trace export hook.

**Signature:**

```typescript
/** @virtual */
hookTrace?(span: {
        name: string;
        durationMs: number;
        attributes: Record<string, unknown>;
    }): void;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

span


</td><td>

&#123; name: string; durationMs: number; attributes: Record&lt;string, unknown&gt;; &#125;


</td><td>

The trace span with `name`, `durationMs`, and `attributes`.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Sibling hooks: `hookSendError` (per-send failures) and `hookUpdateError` (dead updates). Routing rule: retry-queue ← `hookSendError`, Sentry ← `hookUpdateError`, dashboard ← `hookTrace`.

## Example


```typescript
class MyBot extends Gramstax {
  override hookTrace(span: {name: string; durationMs: number; attributes: Record<string, unknown>}): void {
    tracer.export(span)
  }
}
```

