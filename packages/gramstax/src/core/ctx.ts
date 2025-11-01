import { CacheExternal } from "../cache"
import { setTimeout } from "node:timers/promises"
import { BaseGeneral } from "../base"
import { TemplateManager } from "../template"
import { InlineKeyboard, Keyboard, type Context } from "grammy"

export class Ctx extends BaseGeneral {
  public data = (this as any).constructor.data as { name: string; callbackData: (...args: any) => string | any } // for internal access (this.**). example this.data.callbackData

  public get isPremium() {
    return this.ct.from?.is_premium ?? false
  }
  public get isBot() {
    return this.ct.from?.is_bot ?? false
  }
  public get userid() {
    return this.ct.from?.id as number
  }
  public get username() {
    return this.ct.from?.username as string
  }
  public get fullname() {
    return `${this.ct.from?.first_name || ``}${this.ct.from?.last_name || ``}`
  }
  public get firstname() {
    return this.ct.from?.first_name as string
  }
  public get lastname() {
    return this.ct.from?.last_name as string
  }
  public get msgText() {
    return this.ct.message?.text as string
  }
  public get msgTextIntent() {
    return this.msgText && this.msgText.indexOf(` `) != -1 ? (this.msgText.split(` `)[0] as string) : ``
  }
  public get msgTextPayloads() {
    return this.msgText && this.msgText.indexOf(` `) != -1 ? (this.msgText.split(` `).slice(1) as any[]) : ([] as any[])
  }
  public get msgTextPayload() {
    return this.msgTextPayloads[0] as string
  }
  public get msgCaption() {
    return this.ct.message?.caption as string
  }
  public get msgCaptionIntent() {
    return this.msgCaption && this.msgCaption.indexOf(` `) != -1 ? (this.msgCaption.split(` `)[0] as string) : ``
  }
  public get msgPhoto() {
    return this.ct.message?.photo
  }
  public get msgVideo() {
    return this.ct.message?.video
  }
  public get msgAudio() {
    return this.ct.message?.audio
  }
  public get callbackData() {
    return this.ct.callbackQuery?.data as string
  }
  public get callbackDataIntent() {
    return this.callbackData && this.callbackData.indexOf(`:`) != -1 ? (this.callbackData.split(`:`)[0] as string) : ``
  }
  public get callbackDataPayloads() {
    return this.callbackData && this.callbackData.indexOf(`:`) != -1 ? (this.callbackData.split(`:`).slice(1) as any[]) : ([] as any[])
  }
  public get callbackDataPayload() {
    return this.callbackDataPayloads?.[0] as string
  }
  public get callbackDataParts() {
    return this.callbackDataPayload && this.callbackDataPayload.indexOf(`+`) != -1 ? (this.callbackDataPayload.split(`+`) as any[]) : ([] as any[])
  }
  public get languageCode() {
    return this.ct.from?.language_code as string
  }
  public set languageCode(v: any) {
    ;(this as any).ct.from.language_code = v
  }

  public session: { method?: string; params?: any } = {}
  public constructor(public ct: Context, public templateManager: TemplateManager, public cacheSession: CacheExternal, public cacheKeyboard: Map<any, any>) {
    super()
  }

  public async broadcast(ids: any[], languageCode: any[], keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: any) {
    const limitFree = 30
    const msgs = languageCode.map((it) => this.templateManager.getMessage(this.data.name, baseId, it, data)) as any[]
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]
      const msg = msgs[index]
      await this.ct.api.sendMessage(id, msg, {
        parse_mode: `HTML`,
        reply_markup: keyboard,
        ...options
      })

      if (index + 1 == limitFree) {
        await setTimeout(1200)
      }
    }
  }

  public async reply(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: any) {
    const msg = this.templateManager.getMessage(this.data.name, baseId, this.languageCode, data)
    return await this.ct.reply(msg, {
      parse_mode: `HTML`,
      reply_markup: keyboard,
      ...options
    })
  }

  public async replyAction(type: Parameters<typeof this.ct.replyWithChatAction>[0]) {
    return await this.ct.replyWithChatAction(type)
  }

  public async edit(keyboard?: Keyboard | InlineKeyboard, data?: Record<string, any>, baseId?: string, options?: any) {
    try {
      const msg = this.templateManager.getMessage(this.data.name, baseId, this.languageCode, data)
      return await this.ct.editMessageText(msg, {
        parse_mode: `HTML`,
        reply_markup: keyboard,
        ...options
      })
    } catch (error) {
      await this.reply(keyboard, data, baseId, options)
    }
  }

  public async delete() {
    return await this.ct.deleteMessage()
  }

  public async callbackQueryAnswer(options?: any) {
    try {
      return await this.ct.answerCallbackQuery(options)
    } catch {
      return null
    }
  }

  public async sessionSet(method: string, params: any, ...moreRoot: any) {
    try {
      const value = { method, params, ...moreRoot }
      const result = await this.cacheSession.set(`${this.userid}`, { method, params, ...moreRoot })
      if (result) {
        this.session = value
      }
      return result
    } catch {
      return null
    }
  }

  public async sessionGet(): Promise<{ method: string; params: any; [moreRoot: string]: any } | null> {
    try {
      const result = await this.cacheSession.get(`${this.userid}`)
      if (result) {
        this.session = result
      }
      return result || null
    } catch {
      return null
    }
  }

  public async sessionClear() {
    try {
      const result = await this.cacheSession.delete(`${this.userid}`)
      if (result) {
        this.session = {}
      }
      return result
    } catch {
      return null
    }
  }
}
