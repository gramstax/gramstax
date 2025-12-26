# 09 - Thread Management

> Background tasks, worker threads, and bi-directional RPC.

---

## Table of Contents

- [Architecture](#architecture)
- [Implementation](#implementation)
- [Single File Export](#single-file-export)
- [Thread Pooling](#thread-pooling)

---

## Architecture

Gramstax uses a bi-directional communication system based on the JSON-RPC pattern:

- **ThreadMain**: Manages worker life cycle in main thread.
- **ThreadSub**: Base for worker logic in child thread.
- **ThreadExport**: Helper for unified development.

---

## Implementation

### 1. Define Worker

Create a class extending `ThreadSub`.

```typescript
class MyJob extends ThreadSub {
  public async processTask(data: any) {
    // heavy logic
    return { success: true };
  }
}
```

### 2. Define Manager

Launch via `ThreadMain`.

```typescript
const manager = new ThreadMain("./path/to/script.ts");
const result = await manager.sendRequest("processTask", [data]);
```

---

## Single File Export

The recommended pattern is using `ThreadExport.init`.

```typescript
// src/jobs/my-job.ts
export const MyJob = ThreadExport.init({
  path: __filename,
  CSub: MyJobCore,
  wrap: (main) => ({
    execute: (data: any) => main.sendRequest("processTask", [data]),
  }),
});

// Usage in Page
await MyJob.execute(data);
```

---

## Thread Pooling

Orchestrate multiple workers with `ThreadMainPool`.

```typescript
const pool = new ThreadMainPool([thread1, thread2]);
await pool.broadcastRequest("rehash", []);
```

| Method             | Description              |
| ------------------ | ------------------------ |
| `broadcastRequest` | Call method on all subs  |
| `killAll`          | Terminate every worker   |
| `add`              | Add worker to management |

---

## Navigation

| Previous                                       | Next |
| ---------------------------------------------- | ---- |
| [08-best-practices.md](./08-best-practices.md) | -    |
