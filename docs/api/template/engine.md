> **Documentation Info**
>
> - **Last Updated:** 13/01/2025 16:00
> - **Framework Version:** v0.3.20

# TemplateEngine

The `TemplateEngine` class provides static methods for parsing and compiling HTML-like templates into executable functions.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `TemplateEngine` static methods for template parsing.
> - **Internal:** Typically used internally by `TemplateManager`.
> - **Format:** Parses HTML-like syntax with custom blocks.

&nbsp;

## Template Syntax

### Base Block

Container for template sections with optional ID and language variants.

```html
<base id="default">
  <keyboard>Button 1, Button 2</keyboard>
  <message>Hello World</message>
</base>

<base id="error">
  <message>An error occurred</message>
</base>
```

### Message Block

Text content with variable interpolation.

```html
<message>Hello {{name}}!</message> <message lang="id">Halo {{name}}!</message>
```

### Keyboard Block

Comma-separated button labels.

```html
<keyboard>Yes, No</keyboard>
<keyboard type="bottom">Button 1, Button 2</keyboard>
<keyboard lang="id">Ya, Tidak</keyboard>
```

### Description Block

Bot command descriptions for Telegram menu.

```html
<description>Start the bot</description>
<description lang="id">Mulai bot</description>
<description scope="chat_administrators">Admin command</description>
```

### Media Blocks

Various media types.

```html
<photo src="path/to/image.jpg">Caption text</photo>
<video src="path/to/video.mp4">Video caption</video>
<audio src="path/to/audio.mp3">Audio title</audio>
<document src="path/to/file.pdf">Document caption</document>
<animation src="path/to/gif.gif">GIF caption</animation>
<voice src="path/to/voice.ogg" />
<video_note src="path/to/note.mp4" />
<sticker src="sticker_file_id" />
<location latitude="123.456" longitude="78.90" />
<contact phone="+1234567890" first_name="John" last_name="Doe" />
```

### Control Blocks

#### Switch Block

Conditional rendering.

```html
<switch value="{{status}}">
  <case is="active">Active status</case>
  <case is="pending">Pending status</case>
  <default>Unknown status</default>
</switch>
```

#### Map Block

Loop over arrays.

```html
<map for="item" in="{{items}}"> - {{item.name}}: {{item.value}} </map>
```

#### Import Block

Import from another template.

```html
<import src="other-page" base="kb-section" />
```

#### Space Block

Preserve whitespace.

```html
<space>Line 1 Line 2</space>
```

#### Div Block

Text container.

```html
<div>Content here</div>
```

&nbsp;

## Static Methods

### `.compileMessages(template, baseBlocks?)`

Compile message blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: (data) => string } }`
- **ai_notes:** Compiled message functions by base/lang.

### `.compileKeyboards(template, baseBlocks?)`

Compile keyboard blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: { inline, bottom } } }`
- **ai_notes:** Compiled keyboard builders per base/lang.

### `.compileMedia(template, baseBlocks?)`

Compile media blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [lang]: (data) => IMediaBlock } }`
- **ai_notes:** Compiled media builders per base/lang.

### `.compileDescription(template, baseBlocks?)`

Compile description blocks from template.

| parameter  | type   | required | description            | ai_notes                       |
| ---------- | ------ | -------- | ---------------------- | ------------------------------ |
| template   | string | yes      | Raw template string    | HTML-like template source.     |
| baseBlocks | object | no       | Pre-parsed base blocks | Optional reuse of base blocks. |

- **returns: object** - `{ [baseId]: { [scope]: { [lang]: (data) => string } } }`
- **ai_notes:** Compiled description functions by scope.

### `.processImportBlocks(template, resolver, depth?, importCache?)`

Process import blocks recursively.

| parameter   | type     | required | default | description                 | ai_notes                           |
| ----------- | -------- | -------- | ------- | --------------------------- | ---------------------------------- |
| template    | string   | yes      | -       | Template with imports       | Contains `<import>` directives.    |
| resolver    | function | yes      | -       | Function to resolve imports | Returns template content string.   |
| depth       | number   | no       | 0       | Current recursion depth     | Stops at depth limit.              |
| importCache | Map      | no       | -       | Cache for resolved imports  | Optional reuse of resolved blocks. |

- **returns: string** - Template with imports resolved.
- **ai_notes:** Returns template with `<import>` blocks replaced.

&nbsp;

## Variable Interpolation

Variables use double curly braces:

```html
<message> Hello {{ name }}, you have {{ count }} items. </message>
```

Supports nested properties:

```html
<message> User: {{user.name}}, Email: {{user.email}} </message>
```

&nbsp;

## Usage

```typescript
import { TemplateEngine } from "gramstax";

const template = `
  <base>
    <keyboard>Back, Next</keyboard>
    <keyboard lang="id">Kembali, Lanjut</keyboard>
    <message>
      Welcome {{name}}!
      
      Your balance: {{balance}}
    </message>
    <message lang="id">
      Selamat datang {{name}}!
      
      Saldo Anda: {{balance}}
    </message>
  </base>
  
  <base id="error">
    <message>Error: {{error}}</message>
  </base>
`;

const messages = TemplateEngine.compileMessages(template);
const keyboards = TemplateEngine.compileKeyboards(template);

// Get English message
const msg = messages.default.default({ name: "John", balance: "$100" });

// Get Indonesian keyboard
const kb = keyboards.default.id.inline({ name: "John" });
```
