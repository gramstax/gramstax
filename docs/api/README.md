> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 12:24:00

> - **Framework Version:** v0.5.1

# API Documentation

This directory contains the detailed API documentation for the **Gramstax** framework.

The folder structure mirrors `packages/gramstax/src` for easy navigation.

&nbsp;

## Index

### cache/

- [external.md](cache/external.md) - `CacheExternal` caching adapter

### core/

- [bot.md](core/bot.md) - Main `Gramstax` bot class
- [ctx.md](core/ctx.md) - `Ctx` context class with session, template, and reply methods

### page/

- [manager.md](page/manager.md) - `PageManager` for dynamic page loading

### template/

- [engine.md](template/engine.md) - `TemplateEngine` for HTML-like template parsing
- [manager.md](template/manager.md) - `TemplateManager` for template compilation and hot-reloading

### utils/

- [log.md](utils/log.md) - `LoggingUtils` enhanced logging utility

### blocks/

- [keyboard.md](blocks/keyboard.md) - `BlockKeyboard` for keyboard template generation

### labels/

- [keyboard.md](labels/keyboard.md) - `LabelKeyboard` keyboard label helpers

### worker-thread/

- [export.md](worker-thread/export.md) - `WorkerThreadExport` unified thread initialization
- [init.md](worker-thread/init.md) - `WorkerThreadInit` worker thread base class
- [launch.md](worker-thread/launch.md) - `WorkerThreadLaunch` worker lifecycle manager
- [pool.md](worker-thread/pool.md) - `WorkerThreadPool` multi-thread manager
- [rpc.md](worker-thread/rpc.md) - `WorkerThreadRpc` RPC handler
- [gateway-client.md](worker-thread/gateway-client.md) - `WorkerThreadGatewayClient` IPC client
- [gateway-server.md](worker-thread/gateway-server.md) - `WorkerThreadGatewayServer` IPC server
