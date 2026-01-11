# PageManager

The `PageManager` class provides static utilities for loading and managing page modules dynamically.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `PageManager` static methods for page loading.
> - **Usage:** Used internally by `Gramstax` to load page classes from the `src/pages` directory.
> - **Module format:** Pages must export a class (not default export) that extends `Ctx`.

&nbsp;

## Static Methods

### `.getFilePath()`

Returns the default pages directory path.

- **returns: string**
- **ai_notes:** Returns `join(process.cwd(), 'src', 'pages')`.

```typescript
import { PageManager } from "gramstax";

const pagesPath = PageManager.getFilePath();
// => "/path/to/project/src/pages"
```

&nbsp;

### `.getFileSync(path?, positionModule?)`

Synchronously load a single page module.

| parameter      | type   | required | default         | description                 | ai_notes                                      |
| -------------- | ------ | -------- | --------------- | --------------------------- | --------------------------------------------- |
| path           | string | no       | `getFilePath()` | Path to the page file       | **If omitted:** uses default pages directory. |
| positionModule | number | no       | `0`             | Index of the exported class | **Purpose:** when file has multiple exports.  |

- **returns: typeof Ctx**
- **throws:** Error if file has no exports.

```typescript
const StartPage = PageManager.getFileSync(
  "/path/to/project/src/pages/start.ts"
);
```

&nbsp;

### `.getFile(path?, positionModule?)`

Asynchronously load a single page module with cache busting.

| parameter      | type   | required | default         | description                 | ai_notes                                        |
| -------------- | ------ | -------- | --------------- | --------------------------- | ----------------------------------------------- |
| path           | string | no       | `getFilePath()` | Path to the page file       | **If omitted:** uses default pages directory.   |
| positionModule | number | no       | `0`             | Index of the exported class | **Cache busting:** appends timestamp to import. |

- **returns: Promise\<typeof Ctx\>**

```typescript
const StartPage = await PageManager.getFile(
  "/path/to/project/src/pages/start.ts"
);
```

&nbsp;

### `.getFileManySync(path?, positionModule?)`

Synchronously load all page modules from a directory.

| parameter      | type   | required | default         | description                 | ai_notes                                       |
| -------------- | ------ | -------- | --------------- | --------------------------- | ---------------------------------------------- |
| path           | string | no       | `getFilePath()` | Path to the pages directory | **If omitted:** uses default pages directory.  |
| positionModule | number | no       | `0`             | Index of the exported class | **Purpose:** when files have multiple exports. |

- **returns: Array\<{ path: string; page: typeof Ctx }\>**
- **throws:** Error if directory does not exist.

```typescript
const pages = PageManager.getFileManySync();
// => [{ path: "/path/to/start.ts", page: StartPage }, ...]
```

&nbsp;

### `.clearCacheRequire(path?)`

Clear the require cache for all page modules.

| parameter | type   | required | default         | description                 | ai_notes                                    |
| --------- | ------ | -------- | --------------- | --------------------------- | ------------------------------------------- |
| path      | string | no       | `getFilePath()` | Path to the pages directory | **Purpose:** enable hot-reloading of pages. |

- **returns: boolean**
- **throws:** Error if directory does not exist.

```typescript
PageManager.clearCacheRequire();
```
