---
title: "ILmdbEnvOptions.encryptionKey"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [encryptionKey](./lmdb.ilmdbenvoptions.encryptionkey.md)

## ILmdbEnvOptions.encryptionKey property

Encryption key for at-rest encryption (ChaCha8 cipher).

**Signature:**

```typescript
encryptionKey?: string | Buffer;
```

## Remarks

Must be a string or Buffer of exactly 32 bytes/characters.

