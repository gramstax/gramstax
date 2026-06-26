import {join} from "node:path"
import {BotCore} from "../src/core/bot.js"
import {TemplateManager} from "gramstax"
import {MockTelegramServer} from "gramstax"

let sharedEnv = null

export async function getEnv() {
  if (sharedEnv) return sharedEnv

  const mockServer = new MockTelegramServer({log: false})
  await mockServer.start()

  const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
  const cwd = process.cwd()
  process.chdir(join(import.meta.dir, `..`))

  const botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3003/webhook/e2e`,
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

export function gmsg(page, AGBaseId, data, ALang = `default`) {
  return sharedEnv.botCore.templateManager.getGMessage(page, AGBaseId, ALang, data)
}

export function gkb(page, AGBaseId, AType = `inline`, data, ALang = `default`) {
  return sharedEnv.botCore.templateManager.getGKeyboard(page, AGBaseId, ALang, AType, data)
}

export function buttonLabels(resp) {
  return resp?.body?.reply_markup?.inline_keyboard?.flat().map((b) => b.text) ?? []
}

export function gmedia(page, AGBaseId, data, ALang = `default`) {
  return sharedEnv.botCore.templateManager.getGMedia(page, AGBaseId, ALang, data)
}
