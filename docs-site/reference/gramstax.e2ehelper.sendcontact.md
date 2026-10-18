---
title: "E2eHelper.sendContact()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendContact](./gramstax.e2ehelper.sendcontact.md)

## E2eHelper.sendContact() method

Simulate a user sending a contact message.

**Signature:**

```typescript
sendContact(options?: IE2eContactOptions): Promise<IE2eApiCall[]>;
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

[IE2eContactOptions](./gramstax.ie2econtactoptions.md)


</td><td>

_(Optional)_ Phone number, name, user, chat, and response options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update.

