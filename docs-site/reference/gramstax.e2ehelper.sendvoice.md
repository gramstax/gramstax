---
title: "E2eHelper.sendVoice()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendVoice](./gramstax.e2ehelper.sendvoice.md)

## E2eHelper.sendVoice() method

Simulate a user sending a voice message.

**Signature:**

```typescript
sendVoice(options?: IE2eMediaOptions): Promise<IE2eApiCall[]>;
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

