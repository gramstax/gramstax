---
title: "IGramstaxConfig"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxConfig](./gramstax.igramstaxconfig.md)

## IGramstaxConfig type

Author-written `gramstax.config.ts` shape.

**Signature:**

```typescript
type IGramstaxConfig = {
    token?: string;
    deploy?: string;
    optionsDeploy?: IGramstaxOptionsDeploy;
    mediaRoots?: string[] | null;
    botConfig?: BotConfig<Context>;
    autoRetry?: boolean;
    autoRetryOptions?: {
        maxRetryAttempts?: number;
        retryOnInternalServerErrors?: boolean;
    };
    rateLimit?: IRateLimitOptions;
    throttle?: APIThrottlerOptions;
    updateTimeoutMs?: number;
    skipDuplicateUpdate?: boolean;
    maxTextLength?: number;
    statusServerPort?: number;
    statusServerHostname?: string;
    optionsPage?: {
        shortCallbackQueryData?: boolean;
    };
    cacheSession?: IGramstaxCacheSessionRef;
    cacheKeyboard?: IGramstaxCacheKeyboardRef;
    templateManager?: IGramstaxTemplateManagerRef;
    log?: IGramstaxLogRef;
    sessionLock?: IGramstaxSessionLockRef;
};
```
**References:** [IGramstaxOptionsDeploy](./gramstax.igramstaxoptionsdeploy.md), [IRateLimitOptions](./gramstax.iratelimitoptions.md), [IGramstaxCacheSessionRef](./gramstax.igramstaxcachesessionref.md), [IGramstaxCacheKeyboardRef](./gramstax.igramstaxcachekeyboardref.md), [IGramstaxTemplateManagerRef](./gramstax.igramstaxtemplatemanagerref.md), [IGramstaxLogRef](./gramstax.igramstaxlogref.md), [IGramstaxSessionLockRef](./gramstax.igramstaxsessionlockref.md)

## Remarks

Every field is optional so `gramstax build` stays zero-config: a missing file (or an empty default export) yields `{deploy: "polling"}`. Unknown top-level fields are rejected by the loader. CLI flags win over file values at merge time.

Mirrors `IGramstaxParams` for the file-serializable subset — instance values (`CacheExternal`, `Map`, `TemplateManager`, `LoggingHelper`) become path-refs or builtin params in their `*Ref` slot types.

## Example


```typescript
const config: IGramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: process.env.DEPLOY ?? `polling`,
  optionsDeploy: {webhook: {url: `https://example.com/bot`, secretToken: `s3cr3t`}}
}
```

