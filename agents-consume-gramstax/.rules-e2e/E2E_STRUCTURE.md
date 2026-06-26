# E2E Test Structure (1-complex pattern)

## File Layout

```
e2e/
  setup.ts           — shared helpers (getEnv, gmsg, gkb, buttonLabels, gmedia)
  blank.test.ts      — page registration check
  start.test.ts      — one file per page, named after the page
  <page>.test.ts
```

## setup.ts Template

```typescript
import { join } from "node:path";
import { BotCore } from "../src/core/bot";
import { TemplateManager } from "gramstax";
import { MockTelegramServer } from "gramstax";

export interface TestEnvironment {
  mockServer: MockTelegramServer;
  botCore: BotCore;
  clearRequests: () => void;
}

let sharedEnv: TestEnvironment | null = null;

export async function getEnv(): Promise<TestEnvironment> {
  if (sharedEnv) return sharedEnv;

  const mockServer = new MockTelegramServer({ log: false });
  await mockServer.start();

  const templateManager = new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)],
  });
  const cwd = process.cwd();
  process.chdir(join(import.meta.dir, `..`));

  const botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:<PORT>/webhook/e2e-<PROJECT>`,
    token: `test-token`,
    log: false,
    templateManager,
    botConfig: { client: { apiRoot: mockServer.apiRoot } },
  });

  process.chdir(cwd);

  const startedAt = Date.now();
  while (!mockServer.webhookUrl && Date.now() - startedAt < 5000) {
    await new Promise((r) => setTimeout(r, 50));
  }

  sharedEnv = {
    mockServer,
    botCore,
    clearRequests: () => mockServer.clearRequests(),
  };

  return sharedEnv;
}

export function gmsg(
  page: string,
  AGBaseId: string,
  data?: Record<string, any>,
  ALang = `default`,
): string {
  return sharedEnv!.botCore.templateManager.getGMessage(
    page,
    AGBaseId,
    ALang,
    data,
  );
}

export function gkb(
  page: string,
  AGBaseId: string,
  AType: `inline` | `bottom` = `inline`,
  data?: Record<string, any>,
  ALang = `default`,
): string[] {
  return sharedEnv!.botCore.templateManager.getGKeyboard(
    page,
    AGBaseId,
    ALang,
    AType,
    data,
  );
}

export function buttonLabels(resp: any): string[] {
  return (
    resp?.body?.reply_markup?.inline_keyboard?.flat().map((b: any) => b.text) ??
    []
  );
}

export function gmedia(
  page: string,
  AGBaseId: string,
  data?: Record<string, any>,
  ALang = `default`,
): Record<string, any> {
  return sharedEnv!.botCore.templateManager.getGMedia(
    page,
    AGBaseId,
    ALang,
    data,
  );
}
```

> For **JavaScript** projects, use `.js` extension, omit TypeScript types.

## Test File Template

### Simple page (callback query navigation)

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { getEnv, type TestEnvironment, gmsg, gkb, buttonLabels } from "./setup";

let env: TestEnvironment;
const intent = `<page-name>`; // matches the class route name

beforeAll(async () => {
  env = await getEnv();
});

beforeEach(() => {
  env.clearRequests();
});

describe(`E2E: <PageName>`, () => {
  it(`show <description>`, async () => {
    await env.mockServer.sendText(`/start`); // navigate from home
    env.clearRequests();

    const responses = await env.mockServer.sendCallbackQuery(intent);
    const responsesId = await env.mockServer.sendCallbackQuery(intent, {
      user: { language_code: `id` },
    });

    expect(responses.length).toBeGreaterThan(0);
    expect(responsesId.length).toBeGreaterThan(0);
    expect(responses[0]!.body?.text).toBe(gmsg(intent, `<g-base id="..">`, {}));
    expect(responsesId[0]!.body?.text).toBe(
      gmsg(intent, `<g-base id="..">`, {}, `id`),
    );
    expect(buttonLabels(responses[0])).toEqual(
      gkb(intent, `<g-base id="..">`, `inline`, {}),
    );
    expect(buttonLabels(responsesId[0])).toEqual(
      gkb(intent, `<g-base id="..">`, `inline`, {}, `id`),
    );
  });
});
```

### Direct text command

```typescript
const responses = await env.mockServer.sendText(`/command`);
const responsesId = await env.mockServer.sendText(`/command`, {
  user: { language_code: `id` },
});

expect(responses[0]!.body?.text).toBe(gmsg(intent, `<g-base id="..">`, {}));
expect(responsesId[0]!.body?.text).toBe(
  gmsg(intent, `<g-base id="..">`, {}, `id`),
);
```

### Media page (editMessageMedia)

```typescript
import { getEnv, gmedia, type TestEnvironment } from "./setup";

await env.mockServer.sendCallbackQuery(intent);

const editMediaReq = env.mockServer.lastRequest(`editMessageMedia`);
expect(editMediaReq!.body?.media?.type).toBe(`photo`);
expect(editMediaReq!.body?.media?.media).toBe(
  gmedia(intent, `<g-base id="..">`, {}).src,
);
expect(editMediaReq!.body?.media?.caption).toBe(
  gmedia(intent, `<g-base id="..">`, {}).caption,
);

// Language variant
env.clearRequests();
await env.mockServer.sendCallbackQuery(intent, {
  user: { language_code: `id` },
});
const editMediaIdReq = env.mockServer.lastRequest(`editMessageMedia`);
expect(editMediaIdReq!.body?.media?.caption).toBe(
  gmedia(intent, `<g-base id="..">`, {}, `id`).caption,
);
```

### Send-based media (sticker, voice, video_note)

```typescript
const sendStickerReq = env.mockServer.lastRequest(`sendSticker`);
expect(sendStickerReq!.body?.sticker).toBe(
  gmedia(intent, `<g-base id="..">`, {}).src,
);

// Language variant
env.clearRequests();
await env.mockServer.sendCallbackQuery(intent, {
  user: { language_code: `id` },
});
const sendStickerIdReq = env.mockServer.lastRequest(`sendSticker`);
expect(sendStickerIdReq!.body?.sticker).toBe(
  gmedia(intent, `<g-base id="..">`, {}, `id`).src,
);
```

### Media group

```typescript
const sendMediaGroupReq = env.mockServer.lastRequest(`sendMediaGroup`);
expect(Array.isArray(sendMediaGroupReq!.body?.media)).toBe(true);
sendMediaGroupReq!.body?.media!.forEach((item: any) => {
  expect(item.type).toBe(`photo`);
});

// Language variant
env.clearRequests();
await env.mockServer.sendCallbackQuery(intent, {
  user: { language_code: `id` },
});
const idReq = env.mockServer.lastRequest(`sendMediaGroup`);
expect(idReq!.body?.media![0]?.caption).toBe(
  gmedia(intent, `<g-base id="..">`, {}, `id`).mediaGroup![0]?.caption,
);
```

## Key Patterns

### 1. Language Variant

Always add an inline `{user: {language_code: 'id'}}` call alongside the default user call:

```typescript
const responses = await env.mockServer.sendCallbackQuery(intent);
const responsesId = await env.mockServer.sendCallbackQuery(intent, {
  user: { language_code: `id` },
});
```

Assert with `gmsg(..., 'id')`, `gkb(..., 'id')`, or `gmedia(..., 'id')`.

### 2. Assertion Rules

- **Exact match** → `toBe(gmsg(intent, AGBaseId, data))`
- **Dynamic content** (timestamps, random numbers, user input) → `toContain`
- **Keyboard labels** → `toEqual(gkb(intent, AGBaseId, type, data))`
- **Media captions/src** → `toBe(gmedia(intent, AGBaseId, data).caption)` / `.src`
- **Always verify** `responses.length > 0` and the response is defined

### 3. Session Isolation

When test files share the same bot instance and cause session conflicts:

```typescript
const asUser = {user: {id: <UNIQUE_ID>}, chat: {id: <UNIQUE_ID>}}
// Use asUser in ALL sendText / sendCallbackQuery calls for that file
```

Or for inline use when only the language differs:

```typescript
{user: {id: <UNIQUE_ID>, language_code: `id`}, chat: {id: <UNIQUE_ID>}}
```

### 4. `lang="id"` Template Pattern

In every page template, add ID variants:

```
<g-keyboard>Button1, Button2</g-keyboard>
<g-keyboard lang="id">Tombol1, Tombol2</g-keyboard>

<g-message>English text</g-message>
<g-message lang="id">Teks Indonesia</g-message>
```

### 5. Flow Tests (multi-step navigation)

```typescript
it(`full flow`, async () => {
  await env.mockServer.sendText(`/start`);
  env.clearRequests();

  // Step 1
  const r1 = await env.mockServer.sendCallbackQuery(`page1`);
  expect(r1[0]!.body?.text).toBe(gmsg(`page1`, `s1`, {}));

  env.clearRequests();

  // Step 2
  const r2 = await env.mockServer.sendText(`user input`);
  expect(r2[0]!.body?.text).toBe(gmsg(`page1`, `s`, { res: `user input` }));
});
```

### 6. `blank.test.ts`

```typescript
describe(`E2E: BlankPage`, () => {
  it(`load as a registered page in the bot`, () => {
    const allPages = env.botCore.pages.all;
    expect(allPages[`blank`]).toBeDefined();
  });
});
```

## Checklist for New Project

- [ ] `e2e/setup.ts` (or `.js`) — singleton env, 4 helpers: `gmsg`, `gkb`, `buttonLabels`, `gmedia`
- [ ] `e2e/blank.test.ts` — page registration
- [ ] `e2e/<page>.test.ts` — one per page
- [ ] `lang="id"` templates in every page's `<g-message>` and `<g-keyboard>`
- [ ] Language variant assertions: `{user: {language_code: 'id'}}` inline
- [ ] `gmsg` for exact text, `toContain` and `toStartWith` for dynamic content only
- [ ] `gmedia()` for media caption/src validation
- [ ] Unique `{user, chat}` IDs per test file when session conflicts
