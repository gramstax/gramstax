---
title: "E2eHelper.sendDocument()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendDocument](./gramstax.e2ehelper.senddocument.md)

## E2eHelper.sendDocument() method

Simulate a user sending a document (file) message.

**Signature:**

```typescript
sendDocument(options?: IE2eMediaOptions): Promise<IE2eApiCall[]>;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

options


</td><td>

[IE2eMediaOptions](./gramstax.ie2emediaoptions.md)


</td><td>

_(Optional)_ Caption, user, chat, and response options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update.

