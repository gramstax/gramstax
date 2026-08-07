import {describe, expect, it} from "bun:test"
import {TemplateEngine} from "~/template/engine"

describe(`BOT_API_VERSION`, () => {
  it(`targets Bot API 10.2`, () => {
    expect(TemplateEngine.BOT_API_VERSION).toBe(`10.2`)
  })
})