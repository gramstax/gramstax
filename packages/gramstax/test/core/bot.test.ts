import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import { Gramstax } from "../../src/core/bot"
import { TemplateManager } from "../../src/template/manager"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { existsSync } from "node:fs"

const TEST_DIR = join(process.cwd(), `packages/gramstax/test/bot_views`)

// Mock Gramstax to override pageLoads
class TestGramstax extends Gramstax {
  pageLoads() {
    // Return page structure matching our test templates
    return {
      static: {
        textCommand: {
          cmd1: { name: `cmd1` }
        }
      },
      dynamic: []
    } as any
  }
}

describe(`Gramstax.pageSyncDescription (Integration)`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  })

  const createBot = () => {
    // Use real TemplateManager with test directory
    const realTm = new TemplateManager({ path: [TEST_DIR] })

    const bot = new TestGramstax({
      token: `dummy_token`,
      deploy: `test`,
      templateManager: realTm,
      log: false
    })

    // Mock grammy bot api
    bot.bot = {
      api: {
        getMyCommands: mock(async () => []),
        setMyCommands: mock(async () => true)
      }
    } as any

    return { bot, realTm }
  }

  it(`should sync commands from template file`, async () => {
    // Write a real template file
    await writeFile(
      join(TEST_DIR, `cmd1.html`),
      `
      <base>
        <description>Default Description</description>
        <description lang="es">Descripción en Español</description>
        <description scope="private">Private Description</description>
      </base>
    `
    )

    const { bot } = createBot()

    // Mock current commands (empty)
    const getMyCommands = bot.bot.api.getMyCommands as any
    const setMyCommands = bot.bot.api.setMyCommands as any
    getMyCommands.mockResolvedValue([])

    await bot.pageSyncDescription(bot.pages)

    expect(getMyCommands).toHaveBeenCalled()

    // Verify setMyCommands calls based on file content

    // 1. Default scope, Default lang (mapped to undefined)
    expect(setMyCommands).toHaveBeenCalledWith([{ command: `cmd1`, description: `Default Description` }], { scope: { type: `default` }, language_code: undefined })

    // 2. Default scope, ES lang
    expect(setMyCommands).toHaveBeenCalledWith([{ command: `cmd1`, description: `Descripción en Español` }], { scope: { type: `default` }, language_code: `es` })

    // 3. Private scope, Default lang (mapped to undefined)
    // Note: If no lang specified on <description scope="private">, it defaults to "default" lang
    expect(setMyCommands).toHaveBeenCalledWith([{ command: `cmd1`, description: `Private Description` }], { scope: { type: `private` }, language_code: undefined })
  })

  it(`should skip sync if template matches remote`, async () => {
    await writeFile(
      join(TEST_DIR, `cmd1.html`),
      `
      <base>
        <description>Match Me</description>
      </base>
    `
    )

    const { bot } = createBot()
    const setMyCommands = bot.bot.api.setMyCommands as any
    const getMyCommands = bot.bot.api.getMyCommands as any

    // Mock remote to match local template
    getMyCommands.mockImplementation(async (args: any) => {
      if (args.scope.type === `default` && args.language_code === undefined) {
        return [{ command: `cmd1`, description: `Match Me` }]
      }
      return []
    })

    await bot.pageSyncDescription(bot.pages)

    expect(setMyCommands).not.toHaveBeenCalled()
  })

  it(`should include commands with default description when syncing specific language`, async () => {
    // cmd1 has both default and ES
    // cmd2 has only default
    await writeFile(
      join(TEST_DIR, `cmd1.html`),
      `
      <base>
        <description>Cmd1 Default</description>
        <description lang="es">Cmd1 ES</description>
      </base>
    `
    )
    await writeFile(
      join(TEST_DIR, `cmd2.html`),
      `
      <base>
        <description>Cmd2 Default</description>
      </base>
    `
    )

    const { bot } = createBot()

    // Mock pages to include both commands
    ;(bot as any).pageLoads = () => ({
      static: {
        textCommand: {
          cmd1: { name: `cmd1` },
          cmd2: { name: `cmd2` }
        }
      },
      dynamic: []
    })
    bot.pages = bot.pageLoads()

    const setMyCommands = bot.bot.api.setMyCommands as any
    const getMyCommands = bot.bot.api.getMyCommands as any
    getMyCommands.mockResolvedValue([])

    await bot.pageSyncDescription(bot.pages)

    // Expect ES sync to include BOTH cmd1 (ES) and cmd2 (Default fallback)
    expect(setMyCommands).toHaveBeenCalledWith(
      expect.arrayContaining([
        { command: `cmd1`, description: `Cmd1 ES` },
        { command: `cmd2`, description: `Cmd2 Default` }
      ]),
      { scope: { type: `default` }, language_code: `es` }
    )
  })
})
