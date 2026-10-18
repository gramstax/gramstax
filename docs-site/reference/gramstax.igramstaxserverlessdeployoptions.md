

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxServerlessDeployOptions](./gramstax.igramstaxserverlessdeployoptions.md)

## IGramstaxServerlessDeployOptions type

Serverless deploy branch of `optionsDeploy`.

**Signature:**

```typescript
type IGramstaxServerlessDeployOptions = {
    "cloudflare-mod": IGramstaxCloudflareModOptions;
} | {
    "aws-lambda-async": IGramstaxAwsLambdaAsyncOptions;
};
```
**References:** [IGramstaxCloudflareModOptions](./gramstax.igramstaxcloudflaremodoptions.md), [IGramstaxAwsLambdaAsyncOptions](./gramstax.igramstaxawslambdaasyncoptions.md)

## Remarks

The adapter name is the KEY. Exactly one key must be present. Each key carries only the fields that adapter actually uses.

The `secretToken` value is validated for shape only — it is NEVER baked into emitted bundles; the deployed function reads the `BOT_WEBHOOK_SECRET` runtime binding instead.

## Example


```typescript
const serverless: IGramstaxServerlessDeployOptions = {'cloudflare-mod': {url: `https://example.com/webhook`, secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``}}
```

