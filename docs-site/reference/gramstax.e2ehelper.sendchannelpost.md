---
title: "E2eHelper.sendChannelPost()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendChannelPost](./gramstax.e2ehelper.sendchannelpost.md)

## E2eHelper.sendChannelPost() method

Simulate the bot receiving a channel post.

**Signature:**

```typescript
sendChannelPost(text: string, options?: IE2eUpdateOptions): Promise<IE2eApiCall[]>;
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

text


</td><td>

string


</td><td>

The post text.


</td></tr>
<tr><td>

options


</td><td>

[IE2eUpdateOptions](./gramstax.ie2eupdateoptions.md)


</td><td>

_(Optional)_ User, chat, and response options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update.

