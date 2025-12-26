# 03 - Template Engine

> Template syntax for messages, keyboards, media.

---

## Table of Contents

- [Block Types](#block-types)
- [Variable Syntax](#variable-syntax)
- [Multi-language](#multi-language)
- [HTML Formatting](#html-formatting)

---

## Block Types

### base

Container for template elements.

```html
<base>content</base>
<base id="name">content</base>
```

**Usage:**

```typescript
await this.reply(this.kb()); // Uses id="default"
await this.reply(this.kb(), {}, "name"); // Uses id="name" for reply
await this.reply(this.kb("name"), {}); // Uses id="name" for keyboard
await this.reply(this.kb("name"), {}, "name"); // Uses id="name" for both
```

---

### message

```html
<message>Text with {{variable}}</message>
<message lang="id">Indonesian text</message>
```

---

### keyboard

```html
<keyboard type="inline">Button1, Button2, Button3</keyboard>
<keyboard type="bottom">Button1, Button2</keyboard>
<keyboard lang="id" type="inline">Tombol1, Tombol2</keyboard>
```

**Rules:**

- Buttons separated by commas
- Each button maps to `arr[index]` in `kb()` method

---

### media

```html
<media type="photo" src="URL">Caption</media>
<media type="video" src="URL">Caption</media>
<media type="animation" src="{{dynamicUrl}}">Caption</media>
<media type="location" latitude="40.7" longitude="-74.0"></media>
```

| Type        | Attributes              |
| ----------- | ----------------------- |
| `photo`     | `src`                   |
| `video`     | `src`                   |
| `animation` | `src`                   |
| `document`  | `src`                   |
| `location`  | `latitude`, `longitude` |
| `contact`   | `phone`, `first_name`   |

---

### description

Command description (synced with Telegram).

```html
<description>Command description</description>
<description lang="id">Deskripsi perintah</description>
```

---

### import

Import from another template.

```html
<import src="page-name" /> <import src="page-name" base="base-id" />
```

| Attribute | Required | Description       |
| --------- | -------- | ----------------- |
| `src`     | Yes      | Source file name  |
| `base`    | No       | Base ID to import |

---

### map

Iterate arrays.

```html
<map src="items" join="\\n"> {~i+1~}. {{e.name}} - {{e.price}} </map>
```

| Attribute | Default  | Description |
| --------- | -------- | ----------- |
| `src`     | Required | Array name  |
| `join`    | `""`     | Separator   |

**Variables:** `e` = current item, `i` = index

---

## Variable Syntax

### Basic

```html
<message>Hello {{userName}}!</message>
```

### Expressions

```html
<message>
  Date: {~new Date().toISOString()~} Total: {~price * quantity~}
</message>
```

---

## Multi-language

```html
<message>English (default)</message>
<message lang="id">Indonesian</message>
<message lang="es">Spanish</message>

<keyboard type="inline">Yes, No</keyboard>
<keyboard lang="id" type="inline">Ya, Tidak</keyboard>
```

**Fallback:** Match exact lang → default (no `lang`)

---

## HTML Formatting

| Tag              | Result            |
| ---------------- | ----------------- |
| `<b>`            | **Bold**          |
| `<i>`            | _Italic_          |
| `<u>`            | Underline         |
| `<s>`            | ~~Strikethrough~~ |
| `<code>`         | `Monospace`       |
| `<a href="url">` | Link              |

---

## Navigation

| Previous                             | Next                                           |
| ------------------------------------ | ---------------------------------------------- |
| [02-ctx-class.md](./02-ctx-class.md) | [04-routing-system.md](./04-routing-system.md) |
