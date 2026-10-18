---
title: "TemplateManager.getGVenue()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getGVenue](./gramstax.templatemanager.getgvenue.md)

## TemplateManager.getGVenue() method

Gets compiled from block \<g-venue>.

**Signature:**

```typescript
getGVenue(key: string, AGBaseId?: string, ALang?: string, data?: Record<string, unknown>): GVenueResult;
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

[GVenueResult](./gramstax.gvenueresult.md)

[GVenueResult](./gramstax.gvenueresult.md) with the venue payload flat under `kind: "venue"`

## Remarks

Retrieves the compiled venue function for the specified template and language, then executes it with the provided data to generate the venue payload.

## Example


```typescript
const venue = tm.getGVenue("cafe-page", "default", "en", {name: "Cafe"})
// => {kind: "venue", title: "Cafe", address: "...", latitude: "-6.2", longitude: "106.8"}
```

