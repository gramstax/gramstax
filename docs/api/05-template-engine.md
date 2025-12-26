# TemplateEngine

- **Type:** Class (Static)
- **Description:** Static utility class for parsing and compiling custom HTML-like templates.

## Template Syntax

Gramstax templates use an HTML-like syntax for defining bot content. Templates are organized into blocks, which are processed and compiled into JavaScript functions.

### Core Blocks

#### `<base>`

Used to group related content under a specific identifier.

- **Attributes:**
  - `id`: (Optional) The identifier for this base. Defaults to `default`.
- **Example:**
  ```html
  <base id="welcome">
    <message>Welcome to the bot!</message>
  </base>
  ```

#### `<message>`

Defines the text content for a message.

- **Attributes:**
  - `lang`: (Optional) The language code. Defaults to `default`.
- **Example:**
  ```html
  <message lang="en">Hello!</message> <message lang="id">Halo!</message>
  ```

#### `<keyboard>`

Defines the keyboard buttons for a message. Buttons are separated by commas.

- **Attributes:**
  - `lang`: (Optional) The language code. Defaults to `default`.
  - `type`: (Optional) `inline` (default) or `bottom`.
- **Example:**
  ```html
  <keyboard type="inline"> Help, Settings </keyboard>
  ```

### Advanced Blocks

#### `<media>`

Defines media attachments (photo, video, audio, etc.).

- **Attributes:**
  - `type`: (Required) The media type: `photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact`.
  - `src`: (Required for file-based types) URL or file ID.
  - `lang`: (Optional) The language code. Defaults to `default`.
- **Type-Specific Attributes:**
  - **location**:
    - `latitude`: (Required) Latitude of the location.
    - `longitude`: (Required) Longitude of the location.
  - **contact**:
    - `phone`: (Required) Contact's phone number.
    - `first_name`: (Required) Contact's first name.
    - `last_name`: (Optional) Contact's last name.
    - `vcard`: (Optional) Additional data about the contact in the form of a [vCard](https://en.wikipedia.org/wiki/VCard).
- **Inner Content:** Used as the caption (not supported for `video_note` and `sticker`).

#### `<map>`

Iterates over an array to generate dynamic content.

- **Attributes:**
  - `src`: (Required) The key in the data object containing the array.
  - `join`: (Optional) The string to join the results. Defaults to `\\n`.
- **Variables:**
  - `{{e}}`: Current element.
  - `{{i}}`: Current index.
- **Example:**
  ```html
  <map src="users" join=", ">{{e.name}}</map>
  ```

#### `<import>`

Imports content from another template file.

- **Attributes:**
  - `src`: (Required) Path to the imported template.
  - `block`: (Optional) Specific blocks to extract (e.g., `message`, `keyboard`). Use `all` to import everything.
  - `base`: (Optional) The base ID to extract from. Defaults to `default`.
  - `lang`: (Optional) Specific language to extract. If not provided, all matching blocks are imported.
  - `section`: (Optional) `all` (wrapper + content) or `value` (content only). Defaults to `all`.
- **Important:** Imports are processed before compilation. If an `<import>` tag is placed inside a `<base>`, its content will be compiled as part of that base. Use `lang` to import only specific language blocks from a multi-language template.

### Logic and Variables

- `{{var}}`: Short-hand for variable interpolation.
- `{~ js_code ~}`: Executes JavaScript and returns the result.
- `<script>`: Executes arbitrary JavaScript logic during processing.
- `<space />`: Structural helper removed during compilation.
- `<div>`: Structural helper; content is kept but the tag is removed.

## Methods

### `_escape(str)`

- **Description:** Escapes backslashes and backticks to prevent syntax errors in compiled template literals.
- **Params:**
  - `str`: `[string]` - The string to escape.
- **Returns:** `string` - Escaped string.
- **Example:** `TemplateEngine._escape("Hello \`World\`");`

### `_processVariables(template)`

- **Description:** Replaces moustache-style `{{var}}` with JS template literal `${data.var}` syntax.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `string` - Template with JS interpolation syntax.
- **Example:** `TemplateEngine._processVariables("Hi {{name}}");`

### `_processBaseBlocks(template)`

- **Description:** Extracts `base` tags and returns a map of their IDs to content.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `Record<string, string>` - Map of base ID to content.
- **Example:** `const bases = TemplateEngine._processBaseBlocks('<base id="1">...</base>');`

### `_processScriptBlocks(template)`

- **Description:** Executes code Javascript inside `<script>` tags immediately.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `string` - Template with script blocks removed/processed.
- **Example:** `TemplateEngine._processScriptBlocks("<script>console.log('init')</script>...");`

### `_processSpaceBlocks(template)`

- **Description:** Removes `<space />` tags and add space.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `string` - Cleaned template.
- **Example:** `TemplateEngine._processSpaceBlocks("A <space /> B");`

### `_processDivBlocks(template)`

- **Description:** Removes `<div>` wrappers but keeps content.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `string` - Cleaned template.
- **Example:** `TemplateEngine._processDivBlocks("<div>Content</div>");`

### `_processExec(template)`

- **Description:** Processes `{~ code ~}` blocks for arbitrary JS execution.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `string` - Template with execution logic.
- **Example:** `TemplateEngine._processExec("{~ if(true) 'yes' ~}");`

### `_processMapBlocks(template)`

- **Description:** Transpiles `<map src="arr">` tags into JS `.map()` calls.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `string` - Transpiled template.
- **Example:** `TemplateEngine._processMapBlocks('<map src="users">{{e.name}}</map>');`

### `_processMediaBlocks(template)`

- **Description:** Parses `<media>` tags into metadata objects.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `Record<string, IMediaBlock>` - Map of baseId -> media metadata.
- **Example:** `const media = TemplateEngine._processMediaBlocks('<media type="photo" src="...">');`

### `_processMessageBlocks(template)`

- **Description:** Parses `<message>` tags.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `Record<string, string>` - Map of lang -> content.
- **Example:** `const msgs = TemplateEngine._processMessageBlocks("<message>Hi</message>");`

### `_processDescriptionBlocks(template)`

- **Description:** Parses `<description>` tags.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `Record<string, Record<string, string>>` - Map of lang -> scope -> content.
- **Example:** `const desc = TemplateEngine._processDescriptionBlocks("<description>Desc</description>");`

### `_processKeyboardBlocks(template)`

- **Description:** Parses `<keyboard>` tags.
- **Params:**
  - `template`: `[string]` - The raw template string.
- **Returns:** `Record<string, object>` - Map of lang -> keyboard modes.
- **Example:** `const kbs = TemplateEngine._processKeyboardBlocks("<keyboard>Btn</keyboard>");`

### `_compileToFunction(template, isArray)`

- **Description:** Compiles a processed string into an executable JavaScript function.
- **Params:**
  - `template`: `[string | string[]]` - processed template string/array.
  - `isArray`: `[boolean]` - If true the function returns an array.
- **Returns:** `Function` - `(data) => string | string[]`
- **Example:** `const fn = TemplateEngine._compileToFunction("Hello ${data.name}", false);`

### `compileMedia(template)`

- **Description:** Compiles all media block (`<media>`).
- **Params:**
  - `template`: `[string]` - Raw template string.
- **Returns:** `Record<string, Record<string, Function>>` - Map of baseId -> lang -> compiler function.
- **Example:** `const mediaFns = TemplateEngine.compileMedia(raw);`

### `compileMessages(template)`

- **Description:** Compiles all message block (`<message>`).
- **Params:**
  - `template`: `[string]` - Raw template string.
- **Returns:** `Record<string, Record<string, Function>>`
- **Example:** `const msgFns = TemplateEngine.compileMessages(raw);`

### `compileDescription(template)`

- **Description:** Compiles all description block (`<description>`).
- **Params:**
  - `template`: `[string]` - Raw template string.
- **Returns:** `object` - Compiled functions map.
- **Example:** `const descFns = TemplateEngine.compileDescription(raw);`

### `compileKeyboards(template)`

- **Description:** Compiles all keyboard block (`<keyboard>`).
- **Params:**
  - `template`: `[string]` - Raw template string.
- **Returns:** `object` - Compiled functions map.
- **Example:** `const kbFns = TemplateEngine.compileKeyboards(raw);`

### `_extractBlock(content, blocks?, baseId?, section?)`

- **Description:** internal utility to extract specific blocks/bases from import content.
- **Params:**
  - `content`: `[string]` - File content.
  - `blocks`: `[string | string[]]` - Block names to extract.
  - `baseId`: `[string]` - Base ID.
  - `section`: `["all" | "value"]` - Extraction mode.
- **Returns:** `string`
- **Example:** `const block = TemplateEngine._extractBlock(src, "message");`

### `_processImportBlocks(template)`

- **Description:** Parses `<import>` tags.
- **Params:**
  - `template`: `[string]` - Raw template.
- **Returns:** `object` - Processed template with placeholders and import metadata.
- **Example:** `const { processed, imports } = TemplateEngine._processImportBlocks(src);`

### `processImportBlocks(template, resolver)`

- **Description:** Resolves and inlines `<import src="...">` tags recursively.
- **Params:**
  - `template`: `[string]` - Raw template string.
  - `resolver`: `[(src: string) => string | null]` - Function that returns the content of the imported file.
- **Returns:** `string` - Template with imports inlined.
- **Example:** `const full = TemplateEngine.processImportBlocks(src, (path) => readFileSync(path));`
