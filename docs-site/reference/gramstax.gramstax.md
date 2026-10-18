---
title: "Gramstax"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md)

## Gramstax class

Main bot framework class for building Telegram bots.

**Signature:**

```typescript
declare class Gramstax<ICtx extends Ctx = Ctx> 
```

## Remarks

Gramstax provides a page-based routing system for handling Telegram updates. It automatically loads page classes from the file system and routes incoming messages and callbacks to the appropriate handlers.

## Example


```typescript
import {Gramstax} from "gramstax"

const bot = new Gramstax({
  token: process.env.BOT_TOKEN!,
  deploy: "polling",
  log: true
})
```

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(params)](./gramstax.gramstax._constructor_.md)


</td><td>


</td><td>

Creates a new Gramstax bot instance.


</td></tr>
</tbody></table>

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[bot](./gramstax.gramstax.bot.md)


</td><td>


</td><td>

Bot&lt;[ICt](./gramstax.ict.md)&gt;


</td><td>

The underlying Bot instance.


</td></tr>
<tr><td>

[botConfig?](./gramstax.gramstax.botconfig.md)


</td><td>


</td><td>

BotConfig&lt;[ICt](./gramstax.ict.md)&gt;


</td><td>

_(Optional)_ Optional bot configuration.


</td></tr>
<tr><td>

[cacheKeyboard](./gramstax.gramstax.cachekeyboard.md)


</td><td>


</td><td>

Map&lt;string, unknown&gt;


</td><td>

In-memory cache for keyboard instances by language.


</td></tr>
<tr><td>

[cacheSession](./gramstax.gramstax.cachesession.md)


</td><td>


</td><td>

[CacheExternal](./gramstax.cacheexternal.md)&lt;[ICacheRpc](./gramstax.icacherpc.md)&gt;


</td><td>

External cache for user session data.


</td></tr>
<tr><td>

[ctxScope](./gramstax.gramstax.ctxscope.md)


</td><td>


</td><td>

[IGramstaxCtxScope](./gramstax.igramstaxctxscope.md)


</td><td>

Forwarded `Ctx` fields, built once in the constructor.


</td></tr>
<tr><td>

[deployType](./gramstax.gramstax.deploytype.md)


</td><td>


</td><td>

\`polling\` \| \`webhook\` \| \`serverless\` \| \`test\` \| \`raw\`


</td><td>

Deploy type


</td></tr>
<tr><td>

[e2e?](./gramstax.gramstax.e2e.md)


</td><td>


</td><td>

[E2eHelper](./gramstax.e2ehelper.md)


</td><td>

_(Optional)_ In-process E2E testing helper.


</td></tr>
<tr><td>

[handlerBotUpdate](./gramstax.gramstax.handlerbotupdate.md)


</td><td>


</td><td>

(...args: unknown\[\]) =&gt; Promise&lt;unknown&gt;


</td><td>

Handler function for processing bot updates.


</td></tr>
<tr><td>

[log](./gramstax.gramstax.log.md)


</td><td>


</td><td>

[LoggingHelper](./gramstax.logginghelper.md) \| undefined


</td><td>

Logger instance for debugging and info output.


</td></tr>
<tr><td>

[mediaRoots?](./gramstax.gramstax.mediaroots.md)


</td><td>


</td><td>

string\[\] \| null


</td><td>

_(Optional)_ Opt-in local-path jail for media uploads.


</td></tr>
<tr><td>

[metrics](./gramstax.gramstax.metrics.md)


</td><td>

`readonly`


</td><td>

[MetricsStore](./gramstax.metricsstore.md)


</td><td>

Runtime metrics snapshot source (observability).


</td></tr>
<tr><td>

[optionsPage](./gramstax.gramstax.optionspage.md)


</td><td>


</td><td>

&#123; shortCallbackQueryData: boolean; &#125;


</td><td>

Page options configuration.


</td></tr>
<tr><td>

[pages](./gramstax.gramstax.pages.md)


</td><td>

`readonly`


</td><td>

ReturnType&lt;typeof this.\_pageLoads&gt;


</td><td>

Loaded and sorted page routes.


</td></tr>
<tr><td>

[ready](./gramstax.gramstax.ready.md)


</td><td>


</td><td>

Promise&lt;void&gt;


</td><td>

Resolves once the startup hooks (`hookBeforeStart`/`hookAfterStart`) complete for constructor-driven modes (`raw`, `test`).


</td></tr>
<tr><td>

[templateManager](./gramstax.gramstax.templatemanager.md)


</td><td>


</td><td>

[TemplateManager](./gramstax.templatemanager.md)


</td><td>

Manages template loading and rendering for pages.


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[\_pageRoutes(ctx, fromListener)](./gramstax.gramstax._pageroutes.md)


</td><td>


</td><td>

Routes an incoming update to the appropriate page handler.


</td></tr>
<tr><td>

[buildCtxParams(ct, extra)](./gramstax.gramstax.buildctxparams.md)


</td><td>


</td><td>

Builds the params for one page `Ctx`, plus optional app extras.


</td></tr>
<tr><td>

[createBot(token)](./gramstax.gramstax.createbot.md)


</td><td>


</td><td>

Creates the Bot instance.


</td></tr>
<tr><td>

[createCtx(ct)](./gramstax.gramstax.createctx.md)


</td><td>


</td><td>

Creates a context instance for handling an update.


</td></tr>
<tr><td>

[getPollingQueueStats()](./gramstax.gramstax.getpollingqueuestats.md)


</td><td>


</td><td>

Live polling queue statistics.


</td></tr>
<tr><td>

[getWebhookQueueStats()](./gramstax.gramstax.getwebhookqueuestats.md)


</td><td>


</td><td>

Get current webhook queue statistics.


</td></tr>
<tr><td>

[hookAfterRoute(ctx, data)?](./gramstax.gramstax.hookafterroute.md)


</td><td>


</td><td>

_(Optional)_ Hook called after routing an update.


</td></tr>
<tr><td>

[hookAfterStart()?](./gramstax.gramstax.hookafterstart.md)


</td><td>


</td><td>

_(Optional)_ Hook called after the bot has started.


</td></tr>
<tr><td>

[hookBeforeRoute(ctx, data)?](./gramstax.gramstax.hookbeforeroute.md)


</td><td>


</td><td>

_(Optional)_ Hook called before routing an update.


</td></tr>
<tr><td>

[hookBeforeStart()?](./gramstax.gramstax.hookbeforestart.md)


</td><td>


</td><td>

_(Optional)_ Hook called before the bot starts.


</td></tr>
<tr><td>

[hookErrorPage(ctx, data)?](./gramstax.gramstax.hookerrorpage.md)


</td><td>


</td><td>

_(Optional)_ Hook called when a page handler throws an error.


</td></tr>
<tr><td>

[hookKeyGenerator(ctx)?](./gramstax.gramstax.hookkeygenerator.md)


</td><td>


</td><td>

_(Optional)_ Hook called to produce the per-update rate-limit key.


</td></tr>
<tr><td>

[hookNotFoundPage(ctx, data)?](./gramstax.gramstax.hooknotfoundpage.md)


</td><td>


</td><td>

_(Optional)_ Hook called when no page handler matches the input.


</td></tr>
<tr><td>

[hookRateLimited(ctx)?](./gramstax.gramstax.hookratelimited.md)


</td><td>


</td><td>

_(Optional)_ Hook called when a user exceeds the configured `rateLimit` window.


</td></tr>
<tr><td>

[hookSendError(args)?](./gramstax.gramstax.hooksenderror.md)


</td><td>


</td><td>

_(Optional)_ Best-effort send-error hook.


</td></tr>
<tr><td>

[hookTrace(span)?](./gramstax.gramstax.hooktrace.md)


</td><td>


</td><td>

_(Optional)_ Optional OTel-style trace export hook.


</td></tr>
<tr><td>

[hookUpdate(event)?](./gramstax.gramstax.hookupdate.md)


</td><td>


</td><td>

_(Optional)_ Hook invoked with a structured success event after every routed update.


</td></tr>
<tr><td>

[hookUpdateError(event)?](./gramstax.gramstax.hookupdateerror.md)


</td><td>


</td><td>

_(Optional)_ Hook invoked with a structured error event for every update failure (errors, timeouts, blocked). Use for log sinks / alerting (Sentry, etc.).


</td></tr>
<tr><td>

[registerCustomRoute(entry)](./gramstax.gramstax.registercustomroute.md)


</td><td>


</td><td>

Registers a custom filter-based route entry with automatic listener subscription.


</td></tr>
<tr><td>

[registerLowPlugin()?](./gramstax.gramstax.registerlowplugin.md)


</td><td>


</td><td>

_(Optional)_ Returns middleware to register as low-level plugins on the bot.


</td></tr>
<tr><td>

[stop()](./gramstax.gramstax.stop.md)


</td><td>


</td><td>

Stop bot


</td></tr>
</tbody></table>

