

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_compileMediaSrc](./gramstax.templateengine._compilemediasrc.md)

## TemplateEngine.\_compileMediaSrc() method

Wraps a compiled string `src` fn so bare placeholders pass objects by reference.

**Signature:**

```typescript
static _compileMediaSrc(rawSrc: string, stringFn: (data?: ITemplateData) => string): (data?: ITemplateData) => string | InputFile | Buffer | Uint8Array;
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

rawSrc


</td><td>

string


</td><td>

Raw `src` attribute value from the parsed template.


</td></tr>
<tr><td>

stringFn


</td><td>

(data?: ITemplateData) =&gt; string


</td><td>

Existing compiled string renderer for this `src`.


</td></tr>
</tbody></table>

**Returns:**

(data?: ITemplateData) =&gt; string \| InputFile \| Buffer \| Uint8Array

Renderer yielding either the string output or the raw object.

## Remarks

Strings, `null`, and `undefined` fall through to the existing compiled fn (byte-identical output, same escaping and `''` fallback). Non-string values (pre-built `InputFile`, `Buffer`, `Uint8Array`) bypass stringify and reach grammY intact.

