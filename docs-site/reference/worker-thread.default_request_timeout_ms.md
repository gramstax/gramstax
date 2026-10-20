---
title: "DEFAULT_REQUEST_TIMEOUT_MS"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [DEFAULT\_REQUEST\_TIMEOUT\_MS](./worker-thread.default_request_timeout_ms.md)

## DEFAULT\_REQUEST\_TIMEOUT\_MS variable

Default timeout in milliseconds applied to every `makeRequest` call that does not pass an explicit `timeoutMs`. `0` disables the timeout (requests wait indefinitely). Can be overridden per instance via `defaultTimeoutMs` or per call via `timeoutMs`.

**Signature:**

```typescript
DEFAULT_REQUEST_TIMEOUT_MS = 30000
```
