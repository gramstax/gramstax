

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [destroy](./gramstax.templatemanager.destroy.md)

## TemplateManager.destroy() method

Cleans up resources and closes file watchers.

**Signature:**

```typescript
destroy(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

Promise that resolves after watchers are closed

## Remarks

Call this method when shutting down the bot to properly release file system resources. Clears the template cache as well.

## Example


```typescript
// Cleanup on shutdown
process.on("SIGINT", async () => {
  await tm.destroy()
  process.exit(0)
})
```

