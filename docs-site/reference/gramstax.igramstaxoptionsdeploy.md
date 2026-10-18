---
title: "IGramstaxOptionsDeploy"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxOptionsDeploy](./gramstax.igramstaxoptionsdeploy.md)

## IGramstaxOptionsDeploy type

Per-deploy-method nested deploy options.

**Signature:**

```typescript
type IGramstaxOptionsDeploy = {
    serverless?: IGramstaxServerlessDeployOptions;
    webhook?: IGramstaxWebhookDeployOptions;
    polling?: IGramstaxPollingDeployOptions;
    raw?: IGramstaxRawDeployOptions;
    test?: IGramstaxTestDeployOptions;
};
```
**References:** [IGramstaxServerlessDeployOptions](./gramstax.igramstaxserverlessdeployoptions.md), [IGramstaxWebhookDeployOptions](./gramstax.igramstaxwebhookdeployoptions.md), [IGramstaxPollingDeployOptions](./gramstax.igramstaxpollingdeployoptions.md), [IGramstaxRawDeployOptions](./gramstax.igramstaxrawdeployoptions.md), [IGramstaxTestDeployOptions](./gramstax.igramstaxtestdeployoptions.md)

## Remarks

At most one branch may be non-empty (a branch is non-empty when it holds at least one key whose value is not `undefined` — explicit-`undefined` equals absent). Zero branches are allowed only when `deploy` is `polling`, `raw`, or `test`. The single non-empty branch (if any) must equal `deploy`, else the loader throws. Unknown branch names and unknown fields inside each branch are rejected.

## Example


```typescript
const webhook: IGramstaxOptionsDeploy = {webhook: {url: `https://example.com/bot`, secretToken: `s3cr3t`}}
const serverless: IGramstaxOptionsDeploy = {serverless: {'cloudflare-mod': {url: `https://example.com/webhook`, secretToken: `s3cr3t`}}}
const polling: IGramstaxOptionsDeploy = {polling: {maxRetries: 5}}
```

