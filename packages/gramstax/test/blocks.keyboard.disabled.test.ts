import {describe, expect, it} from "bun:test"
import {InlineKeyboard, Keyboard} from "grammy"

describe(`markup 10.3 via grammY native (disabled + force_reply)`, () => {
  it(`InlineKeyboard.disabled renders disabled: DisabledButton via grammy`, () => {
    const kb = (new InlineKeyboard() as unknown as {disabled: (t: string) => unknown}).disabled(`Nope`) as unknown as {inline_keyboard: unknown[][]}
    const row = kb.inline_keyboard[0] as unknown as Array<{text: string; disabled: Record<string, never>}>
    expect(row[0]!.text).toBe(`Nope`)
    expect(row[0]!.disabled).toEqual({})
  })

  it(`InlineKeyboard passthrough typed {text, disabled: DisabledButton} works`, () => {
    const kb = new InlineKeyboard().add({text: `Nope`, disabled: {}} as unknown as never)
    const row = (kb as unknown as {inline_keyboard: unknown[][]}).inline_keyboard[0] as unknown as Array<{text: string; disabled: Record<string, never>}>
    expect(row[0]!.disabled).toEqual({})
  })

  it(`force_reply sets markup on InlineKeyboardMarkup`, () => {
    const kb = (new InlineKeyboard().text(`OK`, `ok`) as unknown as {forceReply: (b: boolean) => unknown}).forceReply(true) as unknown as {force_reply: boolean}
    expect(kb.force_reply).toBe(true)
  })

  it(`force_reply sets markup on ReplyKeyboardMarkup`, () => {
    const kb = (new Keyboard().text(`OK`) as unknown as {forceReply: (b: boolean) => unknown}).forceReply(true) as unknown as {force_reply: boolean}
    expect(kb.force_reply).toBe(true)
  })
})
