

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [streamChunks](./gramstax.e2ehelper.streamchunks.md)

## E2eHelper.streamChunks() method

Extract all text chunks from stream API calls.

**Signature:**

```typescript
streamChunks(): string[];
```
**Returns:**

string\[\]

Array of text chunks.

## Remarks

Collects the `text` field from `sendMessageDraft` calls and the HTML markup from `sendRichMessageDraft` and `sendRichMessage` calls — useful for asserting that streamed content matches expected output.

