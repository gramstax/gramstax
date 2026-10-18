---
title: "UpdateQueue.capacity()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [UpdateQueue](./gramstax.updatequeue.md) &gt; [capacity](./gramstax.updatequeue.capacity.md)

## UpdateQueue.capacity() method

Number of free slots available right now.

**Signature:**

```typescript
capacity(): number;
```
**Returns:**

number

## Remarks

Used as the `getUpdates` `limit` hint so fetch slows under load instead of over-fetching into a full buffer. Saturates at 0; callers clamp to 1..100. A closed queue reports 0 because it accepts nothing, however much room is physically left in the buffer.

