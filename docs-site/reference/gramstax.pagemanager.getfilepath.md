---
title: "PageManager.getFilePath()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [PageManager](./gramstax.pagemanager.md) &gt; [getFilePath](./gramstax.pagemanager.getfilepath.md)

## PageManager.getFilePath() method

Returns the default pages directory path.

**Signature:**

```typescript
static getFilePath(): string;
```
**Returns:**

string

Path to `src/pages` relative to `process.cwd()`.

## Example


```typescript
const pagesPath = PageManager.getFilePath();
// => "/path/to/project/src/pages"
```

