---
title: "TemplateManager.getGWidget()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getGWidget](./gramstax.templatemanager.getgwidget.md)

## TemplateManager.getGWidget() method

Gets compiled from block \<g-widget>.

**Signature:**

```typescript
getGWidget(key: string, AGBaseId?: string, ALang?: string, data?: Record<string, unknown>): GWidgetResult;
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

key


</td><td>

string


</td><td>

Template identifier (filename without extension)


</td></tr>
<tr><td>

AGBaseId


</td><td>

string


</td><td>

_(Optional)_ Base block ID matching `<g-base id="...">`


</td></tr>
<tr><td>

ALang


</td><td>

string


</td><td>

_(Optional)_ Target language code (falls back to `default`)


</td></tr>
<tr><td>

data


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_ Template variables for interpolation


</td></tr>
</tbody></table>

**Returns:**

[GWidgetResult](./gramstax.gwidgetresult.md)

[GWidgetResult](./gramstax.gwidgetresult.md) with the widget payload flat under `kind: "widget"`

## Remarks

Retrieves the compiled widget function for the specified template and language, then executes it with the provided data to generate the widget payload. The widget HTML rides raw (no interpolation); only the caption, `chat_data`, `public_data`, `width`, and `height` are interpolated from `data`.

## Example


```typescript
const widget = tm.getGWidget("rate-page", "default", "en", {orderId: "1042"})
// => {kind: "widget", html: "<div>...</div>", caption: "Order <b>#1042</b>", allow_queries: true}
```

