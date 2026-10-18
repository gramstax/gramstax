

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRedisLockClient](./gramstax.iredislockclient.md)

## IRedisLockClient type

Minimal Redis client surface used by `SessionLock`.

**Signature:**

```typescript
type IRedisLockClient = {
    set(key: string, value: string, options?: {
        PX?: number;
        NX?: boolean;
    }): Promise<string | null>;
    eval(script: string, options: {
        keys: string[];
        arguments: string[];
    }): Promise<unknown>;
};
```

## Remarks

Structurally compatible with the official `@redis/client` (`RedisClientType`) that backs the `@keyv/redis` store — only `set` (with `NX`/`PX`) and `eval` are required. Keeping a minimal structural type decouples the lock from concrete Redis client versions.

