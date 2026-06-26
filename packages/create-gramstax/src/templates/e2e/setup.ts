import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"

export interface TestEnvironment {
  mockServer: MockTelegramServer
  botCore: BotCore
  clearRequests: () => void
}

let sharedEnv: TestEnvironment | null = null

export async function getEnv(): Promise<TestEnvironment> {
  if (sharedEnv) return sharedEnv

  const mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  const botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3009/webhook/e2e-template`,
    token: `test-token`,
    log: false,
    templateManager,
    botConfig: {client: {apiRoot: mockServer.apiRoot}}
  })

  process.chdir(cwd)

  const startedAt = Date.now()
  while (!mockServer.webhookUrl && Date.now() - startedAt < 5000) {
    await new Promise((r) => setTimeout(r, 50))
  }

  sharedEnv = {
    mockServer,
    botCore,
    clearRequests: () => mockServer.clearRequests()
  }

  return sharedEnv
}

export function msg(page: string, AGBaseId: string, data?: Record<string, any>, ALang = `default`): string {
  return sharedEnv!.botCore.templateManager.getMessage(page, AGBaseId, ALang, data)
}

export function kb(page: string, AGBaseId: string, type: `inline` | `bottom` = `inline`, data?: Record<string, any>, ALang = `default`): string[] {
  return sharedEnv!.botCore.templateManager.getKeyboard(page, AGBaseId, ALang, type, data)
}

export function buttonLabels(resp: any): string[] {
  return resp?.body?.reply_markup?.inline_keyboard?.flat().map((b: any) => b.text) ?? []
}

export function media(page: string, AGBaseId: string, data?: Record<string, any>, ALang = `default`): Record<string, any> {
  return sharedEnv!.botCore.templateManager.getMedia(page, AGBaseId, ALang, data)
}
