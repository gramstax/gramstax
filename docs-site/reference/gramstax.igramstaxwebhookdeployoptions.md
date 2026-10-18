---
title: "IGramstaxWebhookDeployOptions"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxWebhookDeployOptions](./gramstax.igramstaxwebhookdeployoptions.md)

## IGramstaxWebhookDeployOptions type

Webhook deploy branch of `optionsDeploy`.

**Signature:**

```typescript
type IGramstaxWebhookDeployOptions = {
    url?: string;
    secretToken?: string;
    queue?: IUpdateQueueConfig;
};
```
**References:** [IUpdateQueueConfig](./gramstax.iupdatequeueconfig.md)

## Remarks

Only meaningful when `deploy` is `webhook`. Carries the public URL, the secret token shape, and the queue config that used to live at the root `webhookQueue` field.

## Example


```typescript
const webhook: IGramstaxWebhookDeployOptions = {url: `https://example.com/bot`, secretToken: `s3cr3t`, queue: {enabled: true}}
```

