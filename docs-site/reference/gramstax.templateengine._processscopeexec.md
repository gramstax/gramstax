

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_processScopeExec](./gramstax.templateengine._processscopeexec.md)

## TemplateEngine.\_processScopeExec() method

Scope: `{~~}` Transforms inline execution blocks `{~ jscode ~}` into JavaScript expressions.

**Signature:**

```typescript
static _processScopeExec(template: string): string;
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

template


</td><td>

string


</td><td>

The template string containing `{~ code ~}` expressions


</td></tr>
</tbody></table>

**Returns:**

string

The template with inline execution blocks converted to executable expressions

## Remarks

This internal method converts inline execution syntax into self-invoking JavaScript expressions. It first attempts direct execution, then falls back to `with(data)` scope. Returns an empty string on any error. By design this executes developer-authored template code (templates are code, only `data` values are untrusted input); no strict/no-script mode is provided.

## Example


```typescript
const template = 'Total: {~ data?.count ?? 0 ~}';
const processed = TemplateEngine._processExec(template);
// Result: 'Total: ${(() => { try { return data?.count ?? 0 } catch(e) { try { with(data || {}) { return data?.count ?? 0 } } catch(ee) { return '' } } })()}'
```

