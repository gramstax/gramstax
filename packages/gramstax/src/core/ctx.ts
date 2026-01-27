import {setTimeout} from "node:timers/promises"
import {TemplateManager} from "~/template/manager"
import {InlineKeyboard, Keyboard} from "grammy"
import {CacheExternal, ITCacheRpc} from "~/cache/external"
import type {ITMediaBlock} from "~/template/engine"
import type {
  ITCt,
  ITInBoKb,
  ITData,
  ITOptEdit,
  ITBottomKb,
  ITInlineKb,
  ITOptReply,
  ITOptReplyVoice,
  ITOptReplyVideo,
  ITOptEditMedia1,
  ITOptEditMedia2,
  ITOptReplyAudio,
  ITOptReplyPhoto,
  ITOptReplyContact,
  ITOptReplySticker,
  ITReplyAction,
  ITOptReplyDocument,
  ITOptReplyLocation,
  ITOptReplyAnimation,
  ITOptReplyVideoNote,
  ITBottomKbParams,
  ITInlineKbParams,
  ITBuildDataOptions,
  ITTemp,
  ITPageData,
  ITKbCols,
  ITKbDest,
  ITCtxParams
} from "~/types/t.ctx"

/**
 * The context/page base class that provides access to user data, session management,
 * template rendering, and reply methods.
 *
 * @remarks
 * Extend this class to create page handlers. Define static `template` property for
 * HTML-like templates and static `data` via `Ctx.buildData` for routing configuration.
 *
 * @example Basic Without PageBase
 * ```typescript
 * import {Ctx} from "gramstax" // not recommended, use PageBase with extends Ctx instead
 * import {Menu1Page} from "./menu1"
 * import {Menu2Page} from "./menu2"
 *
 * class StartPage extends Ctx {
 *   async handleCallbackData() {
 *     const kb = this.inlineKeyboardT([Menu1Page, Menu2Page])
 *     await this.reply(kb)
 *   }
 *
 *   static template = `
 *     <base>
 *       <keyboard>Button 1, Button 2</keyboard>
 *       <message>Hello {{name}}!</message>
 *     </base>
 *   `
 * }
 * ```
 *
 * @example Multi Base Id
 * ```typescript
 * import {Ctx} from "gramstax"
 * import {Menu1Page} from "./menu1"
 * import {Menu2Page} from "./menu2"
 *
 * class StartPage extends Ctx {
 *   async handleCallbackData() {
 *     const kb = this.inlineKeyboardT([Menu1Page, Menu2Page], "2", "special-kb")
 *     await this.reply()
 *   }
 *
 *   static template = `
 *     <base id="special-kb">
 *       <keyboard>Button 1, Button 2</keyboard>
 *     </base>
 *     <base>
 *       <message>Hello {{name}}!</message>
 *     </base>
 *   `
 * }
 * ```
 *
 * @public
 */
export class Ctx {
  /**
   * HTML-like template string for the page.
   *
   * @remarks
   * Must contain a `<base></base>` block. Supports template interpolation with `{{variable}}` syntax.
   *
   * @example Basic
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <base>
   *       <keyboard>Button 1, Button 2</keyboard>
   *       <message>Hello {{name}}!</message>
   *     </base>
   *   `
   * }
   * ```
   *
   * @example Multi Id
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <base id="lah">
   *       <keyboard>Button 1, Button 2</keyboard>
   *     </base>
   *     <base>
   *       <message>Hello {{name}}!</message>
   *     </base>
   *   `
   * }
   * ```
   *
   * @example Multi Language
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <base id="lah">
   *       <keyboard>Button 1, Button 2</keyboard>
   *       <keyboard lang="id">Tombol 1, Tombol 2</keyboard>
   *     </base>
   *     <base>
   *       <message>Hello {{name}}!</message>
   *       <message lang="id">Halo {{name}}!</message>
   *     </base>
   *   `
   * }
   * ```
   *
   * @virtual
   * @public
   */
  static template?: string

  /**
   * Page routing data created by `Ctx.buildData`.
   *
   * @remarks
   * Only define when you want to override the intent and have a callback arg.
   * If nothing is needed, let the system handle it automatically.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // For callback arg route only
   *   static data = this.buildData((confirm?: string) => [confirm])
   *
   *   // For callback arg route and text/textCommand trigger
   *   static data = this.buildData({
   *     callbackData: (confirm?: string) => [confirm],
   *     intentText: `my_page`,
   *     intentCommandText: `hello`
   *   })
   * }
   * ```
   *
   * @public
   */
  static data: ITPageData<any>

  /**
   * Instance-level access to the page routing data.
   *
   * @remarks
   * This property mirrors the static `data` property but is accessible via `this.data`
   * within instance methods. Use `this.data.callbackDataData()` internally.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const callbackData = this.data.callbackData("argument_1", "args2")
   *   console.log(callbackData) // "page_name:argument_1:args2"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  data = (this.constructor as Record<any, any>).data as ITPageData<any>

  /**
   * Indicates whether the current user has Telegram Premium.
   *
   * @remarks
   * Returns `false` if the premium status is not available.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   if (this.userIsPremium) {
   *     await this.reply(undefined, {tier: "Premium"})
   *   }
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userIsPremium() {
    return this.ct.from?.is_premium ?? false
  }

  /**
   * Indicates whether the current sender is a bot account.
   *
   * @remarks
   * Returns `false` if the bot status is not available.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   if (this.userIsBot) {
   *     return // Ignore bot messages
   *   }
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userIsBot() {
    return this.ct.from?.is_bot ?? false
  }

  /**
   * The Telegram user ID from the current update context.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   console.log(this.userId) // 12345678
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userId() {
    return this.ct.from?.id as number
  }

  /**
   * The Telegram username from the user profile.
   *
   * @remarks
   * May be `undefined` if the user has not set a username.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   console.log(this.userName) // "gramstax_user"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userName() {
    return this.ct.from?.username as string
  }

  /**
   * The combined first and last name from the user's Telegram profile.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   console.log(this.userFullName) // "Alya Putri"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userFullName() {
    return `${this.ct.from?.first_name} ${this.ct.from?.last_name || ``}`
  }

  /**
   * The user's first name from the Telegram profile.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   console.log(this.userFirstName) // "Alya"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userFirstName() {
    return this.ct.from?.first_name as string
  }

  /**
   * The user's last name from the Telegram profile.
   *
   * @remarks
   * May be `undefined` if the user has not set a last name.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   console.log(this.userLastName) // "Putri"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get userLastName() {
    return this.ct.from?.last_name as string
  }

  /**
   * The user's language code from Telegram (e.g., "en", "id").
   *
   * @remarks
   * This property can be both read and written. Setting this value overrides
   * the language used for template rendering.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   console.log(this.userLanguage) // "en"
   *   this.userLanguage = "id" // Override to Indonesian
   * }
   * ```
   *
   * @public
   */
  get userLanguage() {
    return this.ct.from?.language_code as string
  }
  set userLanguage(v: string) {
    this.ct.from!.language_code = v
  }

  /**
   * The raw message text from the current update.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   console.log(this.msgText) // "Hello World"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgText() {
    return this.ct.message?.text as string
  }

  /**
   * All arg tokens parsed from message text.
   *
   * @remarks
   * Splits the message text by space separator starting from the configured position.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async handleArgsText() {
   *   console.log(this.msgTextArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextArgs() {
    return this.getArgs(this.msgText, `space`, this.data?._positionArgText || this.temp?.data?._positionArgText)
  }

  /**
   * The first arg token parsed from message text.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async handleArgsText() {
   *   console.log(this.msgTextArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextArg() {
    return this.msgTextArgs[0] as string
  }

  /**
   * All arg tokens from a command message.
   *
   * @remarks
   * Splits the message text by space separator starting from position 1.
   *
   * @example
   * ```typescript
   * // Message: "/start 123 456"
   * async handleCommandArgsText() {
   *   console.log(this.msgTextCommandArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandArgs() {
    return this.getArgs(this.msgText, `space`)
  }

  /**
   * The first arg token from a command message.
   *
   * @example
   * ```typescript
   * // Message: "/start 123"
   * async textCommandPayload() {
   *   console.log(this.msgTextCommandPayload) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandArg() {
    return this.msgTextCommandArgs[0] as string
  }

  /**
   * The caption text for media messages.
   *
   * @example
   * ```typescript
   * async photoFree() {
   *   console.log(this.msgCaption) // "<Photo caption>"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaption() {
    return this.ct.message?.caption as string
  }

  /**
   * All arg tokens parsed from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async handleCaptionArgsPhoto() {
   *   console.log(this.msgCaptionArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionArgs() {
    return this.getArgs(this.msgCaption, `space`)
  }

  /**
   * The first arg token from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async photoCaptionPayload() {
   *   console.log(this.msgCaptionPayload) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionArg() {
    return this.msgCaptionArgs[0] as string
  }

  /**
   * All arg tokens from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123 456"
   * async handleCommandCaptionArgsPhoto() {
   *   console.log(this.msgCaptionCommandArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionCommandArgs() {
    return this.getArgs(this.msgCaption, `space`)
  }

  /**
   * The first arg token from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123"
   * async photoCaptionCommandPayload() {
   *   console.log(this.msgCaptionCommandPayload) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionCommandArg() {
    return this.msgCaptionCommandArgs[0] as string
  }

  /**
   * Photo sizes attached to the message.
   *
   * @example
   * ```typescript
   * async photoFree() {
   *   const photos = this.msgPhoto
   *   const largest = photos?.[photos.length - 1]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgPhoto() {
    return this.ct.message?.photo
  }

  /**
   * Video arg attached to the message.
   *
   * @example
   * ```typescript
   * async videoFree() {
   *   const video = this.msgVideo
   *   console.log(video?.file_id)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgVideo() {
    return this.ct.message?.video
  }

  /**
   * Audio arg attached to the message.
   *
   * @example
   * ```typescript
   * async audioFree() {
   *   const audio = this.msgAudio
   *   console.log(audio?.file_id)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgAudio() {
    return this.ct.message?.audio
  }

  /**
   * Document arg attached to the message.
   *
   * @example
   * ```typescript
   * async documentFree() {
   *   const doc = this.msgDocument
   *   console.log(doc?.file_name)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgDocument() {
    return this.ct.message?.document
  }

  /**
   * Animation/GIF arg attached to the message.
   *
   * @example
   * ```typescript
   * async animationFree() {
   *   const anim = this.msgAnimation
   *   console.log(anim?.file_id)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgAnimation() {
    return this.ct.message?.animation
  }

  /**
   * Voice message arg attached to the message.
   *
   * @example
   * ```typescript
   * async voiceFree() {
   *   const voice = this.msgVoice
   *   console.log(voice?.duration)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgVoice() {
    return this.ct.message?.voice
  }

  /**
   * Video note (circular video) attached to the message.
   *
   * @example
   * ```typescript
   * async videoNoteFree() {
   *   const videoNote = this.msgVideoNote
   *   console.log(videoNote?.length)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgVideoNote() {
    return this.ct.message?.video_note
  }

  /**
   * Sticker arg attached to the message.
   *
   * @example
   * ```typescript
   * async stickerFree() {
   *   const sticker = this.msgSticker
   *   console.log(sticker?.emoji)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgSticker() {
    return this.ct.message?.sticker
  }

  /**
   * Location arg attached to the message.
   *
   * @example
   * ```typescript
   * async locationFree() {
   *   const loc = this.msgLocation
   *   console.log(loc?.latitude, loc?.longitude)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgLocation() {
    return this.ct.message?.location
  }

  /**
   * Contact arg attached to the message.
   *
   * @example
   * ```typescript
   * async contactFree() {
   *   const contact = this.msgContact
   *   console.log(contact?.phone_number)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgContact() {
    return this.ct.message?.contact
  }

  /**
   * Web app data attached to the message.
   *
   * @example
   * ```typescript
   * async free() {
   *   const webAppData = this.msgWebAppData
   *   console.log(webAppData?.data)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgWebAppData() {
    return this.ct.message?.web_app_data
  }

  /**
   * Gift arg attached to the message.
   *
   * @example
   * ```typescript
   * async free() {
   *   const gift = this.msgGift
   *   console.log(gift)
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgGift() {
    return this.ct.message?.gift
  }

  /**
   * Raw callback query data from inline keyboard interactions.
   *
   * @example
   * ```typescript
   * async handleArgsCallbackData() {
   *   console.log(this.callbackData) // "menu:settings:ok"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackData() {
    return this.ct.callbackQuery?.data as string
  }

  /**
   * All arg tokens parsed from callback data.
   *
   * @remarks
   * Splits the callback data by colon separator.
   *
   * @example
   * ```typescript
   * // Callback: "menu:settings:ok"
   * async handleArgsCallback() {
   *   console.log(this.callbackDataArgs) // ["settings", "ok"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackDataArgs() {
    return this.getArgs(this.callbackData, `colon`)
  }

  /**
   * The first arg token parsed from callback data.
   *
   * @example
   * ```typescript
   * // Data: "menu:settings:ok"
   * async handleArgsCallback() {
   *   console.log(this.callbackDataArg) // "settings"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackDataArg() {
    return this.callbackDataArgs?.[0] as string
  }

  /**
   * Temporary gets and setter the current session data.
   * @remarks IMPORTANT: this is same as `this.temp.session` if you need set session use session*() or setSession() not from this !
   *
   * @example
   * ```typescript
   * async handleFreeText() {
   *   // both is same
   *   console.log(this.temp.session) // {method: "1-start", params: {random: "1234nhsu37"}}
   *   console.log(this.temp.session) // {method: "1-start", params: {random: "1234nhsu37"}}
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get session() {
    return this.temp.session
  }
  set session(v: ITTemp[`session`]) {
    this.temp.session = v
  }

  /**
   * The grammY context object for low-level Telegram API access.
   *
   * @public
   */
  ct: ITCt

  /**
   * External cache for session storage.
   *
   * @public
   */
  cacheSession: CacheExternal<ITCacheRpc>

  /**
   * Cache for keyboard instances.
   *
   * @public
   */
  cacheKeyboard: Map<any, any>

  /**
   * Template manager for message rendering.
   *
   * @public
   */
  templateManager: TemplateManager

  /**
   * Temporary state storage for the current request.
   *
   * @public
   */
  temp: ITTemp

  /**
   * Creates a new Ctx instance.
   *
   * **note:**
   * For most pages do not define a constructor
   *
   * @param params - The initialization parameters. See {@link ITCtxParams} for details.
   *
   * @public
   */
  constructor(params: ITCtxParams) {
    this.ct = params.ct
    this.cacheSession = params.cacheSession
    this.cacheKeyboard = params.cacheKeyboard
    this.templateManager = params.templateManager
    this.temp = params.temp
  }

  /**
   * Sends a message to multiple users in bulk.
   *
   * @remarks
   * Automatically throttles after 30 messages to respect Telegram rate limits.
   * Uses each user's specified language code for template rendering.
   *
   * @param ids - Array of user IDs to send the message to.
   * @param languageCode - Array of language codes corresponding to each user.
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block message.
   * @param options - Optional grammY send options.
   * @param throwError - If true, throws errors instead of swallowing them.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const userIds = [123456, 789012]
   *   const langs = ["en", "id"]
   *   await this.broadcast(userIds, langs)
   * }
   * ```
   *
   * @public
   */
  async broadcast(ids: number[], languageCode: string[], keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReply, throwError = false) {
    try {
      this.temp.isAnswer = true
      const limitFree = 30
      const msgs = languageCode.map((it) => this.templateManager.getMessage(this.data.name, baseId, it, data))
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index]
        const msg = msgs[index]
        await this.ct.api.sendMessage(id!, msg!, {
          parse_mode: `HTML`,
          reply_markup: keyboard,
          ...options
        })

        if (index + 1 == limitFree) {
          await setTimeout(1200)
        }
      }
    } catch (err) {
      if (throwError) {
        throw err
      }
    }
  }

  /**
   * Sends a media message to multiple users in bulk.
   *
   * @remarks
   * Media type and arg are inferred from the template `<media>` block.
   * Automatically throttles after 30 messages to respect Telegram rate limits.
   * Uses each user's specified language code for template rendering.
   *
   * @param ids - Array of user IDs to send the media to.
   * @param languageCode - Array of language codes corresponding to each user.
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media.
   * @param options - Optional grammY send options for the inferred media type.
   * @param throwError - If true, throws errors instead of swallowing them.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const userIds = [123456, 789012]
   *   const langs = ["en", "id"]
   *   await this.broadcastMedia(userIds, langs)
   * }
   * ```
   *
   * @public
   */
  async broadcastMedia(
    ids: number[],
    languageCode: string[],
    keyboard?: ITInBoKb,
    data?: ITData,
    baseId?: string,
    options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument | ITOptReplyAnimation | ITOptReplyVoice | ITOptReplyVideoNote | ITOptReplySticker | ITOptReplyLocation | ITOptReplyContact,
    throwError = false
  ) {
    try {
      this.temp.isAnswer = true
      const limitFree = 30
      const medias = languageCode.map((it) => this.templateManager.getMedia(this.data.name, baseId, it, data))
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index]
        const med = medias[index]
        if (!med) {
          continue
        }
        const opt = {parse_mode: `HTML`, reply_markup: keyboard, ...options} as Record<any, any>

        if (med.type == `photo`) await this.ct.api.sendPhoto(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `video`) await this.ct.api.sendVideo(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `audio`) await this.ct.api.sendAudio(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `document`) await this.ct.api.sendDocument(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `animation`) await this.ct.api.sendAnimation(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `voice`) await this.ct.api.sendVoice(id!, med.src!, opt)
        if (med.type == `video_note`) await this.ct.api.sendVideoNote(id!, med.src!, opt)
        if (med.type == `sticker`) await this.ct.api.sendSticker(id!, med.src!, opt)
        if (med.type == `location`) await this.ct.api.sendLocation(id!, parseInt(med.latitude!), parseInt(med.longitude!), opt)
        if (med.type == `contact`) await this.ct.api.sendContact(id!, med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})

        if (index + 1 == limitFree) {
          await setTimeout(1200)
        }
      }
    } catch (err) {
      if (throwError) {
        throw err
      }
    }
  }

  /**
   * Sends a text message reply using the page template.
   *
   * @param keyboard - Optional keyboard markup from {@link Ctx.inlineKeyboard} or {@link Ctx.bottomKeyboard}.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block message.
   * @param options - Optional grammY reply options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   // Automatic reply with content from this.template
   *   await this.reply()
   *
   *   // With keyboard builder and data
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.reply(kb, {name: "John"})
   *
   *   // With keyboard short and custom baseId between reply and keyboard
   *   const kb = this.inlineKeyboardT([StartPage], `1`, "my-custom-id")
   *   await this.reply(kb, {name: "John"}, "id-hello-world")
   * }
   * ```
   *
   * @public
   */
  async reply(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReply) {
    this.temp.isAnswer = true
    const msg = this.templateManager.getMessage(this.data.name, baseId, this.userLanguage, data)
    return await this.ct.reply(msg, {
      parse_mode: `HTML`,
      reply_markup: keyboard,
      ...options
    })
  }

  /**
   * Sends a media message reply with dynamic type selection.
   *
   * @remarks
   * This is the base method for all media reply methods. Use specific methods
   * like {@link Ctx.replyPhoto} or {@link Ctx.replyVideo} for simpler usage.
   *
   * @typeParam T - The media type to send.
   * @param type - The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media.
   * @param options - Type-specific options for the media.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyMedia("photo")
   * }
   * ```
   *
   * @public
   */
  async replyMedia<T extends ITMediaBlock[`type`]>(
    type: T,
    keyboard?: ITInBoKb,
    data?: ITData,
    baseId?: string,
    options?: T extends `photo`
      ? ITOptReplyPhoto
      : T extends `video`
        ? ITOptReplyVideo
        : T extends `audio`
          ? ITOptReplyAudio
          : T extends `document`
            ? ITOptReplyDocument
            : T extends `animation`
              ? ITOptReplyAnimation
              : T extends `voice`
                ? ITOptReplyVoice
                : T extends `video_note`
                  ? ITOptReplyVideoNote
                  : T extends `sticker`
                    ? ITOptReplySticker
                    : T extends `location`
                      ? ITOptReplyLocation
                      : T extends `contact`
                        ? ITOptReplyContact
                        : undefined
  ) {
    this.temp.isAnswer = true
    const med = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
    const opt = {parse_mode: `HTML`, reply_markup: keyboard, ...options} as Record<any, any>

    if (type == `photo`) return await this.ct.replyWithPhoto(med.src!, {caption: med.caption!, ...opt})
    if (type == `video`) return await this.ct.replyWithVideo(med.src!, {caption: med.caption!, ...opt})
    if (type == `audio`) return await this.ct.replyWithAudio(med.src!, {caption: med.caption!, ...opt})
    if (type == `document`) return await this.ct.replyWithDocument(med.src!, {caption: med.caption!, ...opt})
    if (type == `animation`) return await this.ct.replyWithAnimation(med.src!, {caption: med.caption!, ...opt})
    if (type == `voice`) return await this.ct.replyWithVoice(med.src!, opt)
    if (type == `video_note`) return await this.ct.replyWithVideoNote(med.src!, opt)
    if (type == `sticker`) return await this.ct.replyWithSticker(med.src!, opt)
    if (type == `location`) return await this.ct.replyWithLocation(parseInt(med.latitude!), parseInt(med.longitude!), opt)
    if (type == `contact`) return await this.ct.replyWithContact(med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})
  }

  /**
   * Sends a photo message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type photo.
   * @param options - Optional photo-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyPhoto()
   * }
   * ```
   *
   * @public
   */
  async replyPhoto(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyPhoto) {
    return this.replyMedia(`photo`, keyboard, data, baseId, options)
  }

  /**
   * Sends a video message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video.
   * @param options - Optional video-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyVideo()
   * }
   * ```
   *
   * @public
   */
  async replyVideo(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVideo) {
    return this.replyMedia(`video`, keyboard, data, baseId, options)
  }

  /**
   * Sends an audio message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type audio.
   * @param options - Optional audio-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyAudio()
   * }
   * ```
   *
   * @public
   */
  async replyAudio(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyAudio) {
    return this.replyMedia(`audio`, keyboard, data, baseId, options)
  }

  /**
   * Sends a document message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type document.
   * @param options - Optional document-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyDocument()
   * }
   * ```
   *
   * @public
   */
  async replyDocument(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyDocument) {
    return this.replyMedia(`document`, keyboard, data, baseId, options)
  }

  /**
   * Sends an animation/GIF message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type animation.
   * @param options - Optional animation-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyAnimation()
   * }
   * ```
   *
   * @public
   */
  async replyAnimation(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyAnimation) {
    return this.replyMedia(`animation`, keyboard, data, baseId, options)
  }

  /**
   * Sends a voice message using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type voice.
   * @param options - Optional voice-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyVoice()
   * }
   * ```
   *
   * @public
   */
  async replyVoice(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVoice) {
    return this.replyMedia(`voice`, keyboard, data, baseId, options)
  }

  /**
   * Sends a video note (circular video) using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video_note.
   * @param options - Optional video note-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyVideoNote()
   * }
   * ```
   *
   * @public
   */
  async replyVideoNote(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyVideoNote) {
    return this.replyMedia(`video_note`, keyboard, data, baseId, options)
  }

  /**
   * Sends a sticker using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type sticker.
   * @param options - Optional sticker-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replySticker()
   * }
   * ```
   *
   * @public
   */
  async replySticker(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplySticker) {
    return this.replyMedia(`sticker`, keyboard, data, baseId, options)
  }

  /**
   * Sends a location using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type location.
   * @param options - Optional location-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyLocation()
   * }
   * ```
   *
   * @public
   */
  async replyLocation(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyLocation) {
    return this.replyMedia(`location`, keyboard, data, baseId, options)
  }

  /**
   * Sends a contact using the page template.
   *
   * @param keyboard - Optional keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type contact.
   * @param options - Optional contact-specific options.
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyContact()
   * }
   * ```
   *
   * @public
   */
  async replyContact(keyboard?: ITInBoKb, data?: ITData, baseId?: string, options?: ITOptReplyContact) {
    return this.replyMedia(`contact`, keyboard, data, baseId, options)
  }

  /**
   * Sends a chat action indicator (typing, uploading, etc.).
   *
   * @param type - The action type (typing, upload_photo, upload_video, etc.).
   * @returns True if the action was sent successfully.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.replyAction("typing")
   *   // Do some work...
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  async replyAction(type: ITReplyAction) {
    return await this.ct.replyWithChatAction(type)
  }

  /**
   * Edits an existing message text using the page template.
   *
   * @remarks
   * If editing fails (e.g., message too old), falls back to sending a new reply
   * unless `fallbackReply` is set to false.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block message.
   * @param options - Optional grammY edit options.
   * @param fallbackReply - If true, sends a reply if edit fails. Default: true.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.edit(kb, {status: "updated"})
   * }
   * ```
   *
   * @public
   */
  async edit(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEdit, fallbackReply = true) {
    try {
      this.temp.isAnswer = true
      const msg = this.templateManager.getMessage(this.data.name, baseId, this.userLanguage, data)
      return await this.ct.editMessageText(msg, {
        parse_mode: `HTML`,
        reply_markup: keyboardInline,
        ...options
      })
    } catch (error) {
      if (fallbackReply) {
        await this.reply(keyboardInline, data, baseId, options)
      } else {
        throw error
      }
    }
  }

  /**
   * Edits an existing media message with dynamic type selection.
   *
   * @remarks
   * For media types that cannot be edited (voice, video_note, sticker, location, contact),
   * the original message is deleted and a new one is sent.
   *
   * @typeParam T - The media type to edit to.
   * @param type - The media type.
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media.
   * @param options1 - Type-specific media options.
   * @param options2 - Additional edit options.
   * @param fallbackReply - If true, sends a reply if edit fails. Default: true.
   * @returns The edited/sent message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editMedia("photo")
   * }
   * ```
   *
   * @public
   */
  async editMedia<T extends ITMediaBlock[`type`]>(
    type: T,
    keyboardInline?: ITInlineKb,
    data?: ITData,
    baseId?: string,
    options1?: T extends `voice`
      ? ITOptReplyVoice
      : T extends `video_note`
        ? ITOptReplyVideoNote
        : T extends `sticker`
          ? ITOptReplySticker
          : T extends `location`
            ? ITOptReplyLocation
            : T extends `contact`
              ? ITOptReplyContact
              : //
                ITOptEditMedia1,
    options2?: ITOptEditMedia2,
    fallbackReply = true
  ) {
    try {
      this.temp.isAnswer = true
      const {src, caption} = this.templateManager.getMedia(this.data.name, baseId, this.userLanguage, data)
      if (type == `voice`) {
        await this.delete()
        return await this.replyVoice(keyboardInline, data, baseId, options1)
      }
      if (type == `video_note`) {
        await this.delete()
        return await this.replyVoice(keyboardInline, data, baseId, options1)
      }
      if (type == `sticker`) {
        await this.delete()
        return await this.replySticker(keyboardInline, data, baseId, options1 as Record<any, any>)
      }
      if (type == `location`) {
        await this.delete()
        return await this.replyLocation(keyboardInline, data, baseId, options1 as Record<any, any>)
      }
      if (type == `contact`) {
        await this.delete()
        return await this.replyContact(keyboardInline, data, baseId, options1 as Record<any, any>)
      }

      return await this.ct.editMessageMedia(
        {
          media: src!,
          caption,
          type,
          parse_mode: `HTML`,
          ...options1
        },
        {reply_markup: keyboardInline, ...options2}
      )
    } catch (error) {
      if (fallbackReply === true) {
        await this.reply(keyboardInline, data, baseId, options2)
      } else {
        throw error
      }
    }
  }

  /**
   * Edits an existing message to show a photo.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type photo.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editPhoto()
   * }
   * ```
   *
   * @public
   */
  async editPhoto(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`photo`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show a video.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editVideo()
   * }
   * ```
   *
   * @public
   */
  async editVideo(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`video`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show an audio.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type audio.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editAudio()
   * }
   * ```
   *
   * @public
   */
  async editAudio(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`audio`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show a document.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type document.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editDocument()
   * }
   * ```
   *
   * @public
   */
  async editDocument(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`document`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Edits an existing message to show an animation.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type animation.
   * @param options1 - Optional media options.
   * @param options2 - Optional edit options.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.editAnimation()
   * }
   * ```
   *
   * @public
   */
  async editAnimation(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options1?: ITOptEditMedia1, options2?: ITOptEditMedia2) {
    return await this.editMedia(`animation`, keyboardInline, data, baseId, options1, options2)
  }

  /**
   * Replaces the current message with a voice message.
   *
   * @remarks
   * Voice messages cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type voice.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editVoice(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
    return await this.editMedia(`voice`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a video note.
   *
   * @remarks
   * Video notes cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type video_note.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editVideoNote(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
    return await this.editMedia(`video_note`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a sticker.
   *
   * @remarks
   * Stickers cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type sticker.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editSticker(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
    return await this.editMedia(`sticker`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a location.
   *
   * @remarks
   * Locations cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type location.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editLocation(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
    return await this.editMedia(`location`, keyboardInline, data, baseId, options)
  }

  /**
   * Replaces the current message with a contact.
   *
   * @remarks
   * Contacts cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup.
   * @param data - Optional template interpolation data.
   * @param baseId - Optional template base ID position for block media type contact.
   * @param options - Optional edit options.
   * @returns The sent message object.
   *
   * @public
   */
  async editContact(keyboardInline?: ITInlineKb, data?: ITData, baseId?: string, options?: ITOptEditMedia2) {
    return await this.editMedia(`contact`, keyboardInline, data, baseId, options)
  }

  /**
   * Deletes the current message.
   *
   * @returns True if the message was deleted successfully.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.delete()
   * }
   * ```
   *
   * @public
   */
  async delete() {
    return await this.ct.deleteMessage()
  }

  /**
   * Answers a callback query with an optional notification.
   *
   * @remarks
   * Should be called in callback handlers to acknowledge the callback query.
   * Errors are silently caught and return null.
   *
   * @param options - Optional answer options (text, show_alert, url, cache_time).
   * @returns True if the answer was sent, or null on error.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.callbackQueryAnswer({text: "Action completed!"})
   *   await this.edit()
   * }
   * ```
   *
   * @public
   */
  async callbackQueryAnswer(options?: Parameters<typeof Ctx.prototype.ct.answerCallbackQuery>[0]) {
    try {
      this.temp.isAnswer = true
      return await this.ct.answerCallbackQuery(options)
    } catch {
      return null
    }
  }

  /**
   * Sets session data for the current user.
   *
   * @remarks
   * Session data is stored in the external cache and persists across requests.
   * Used to maintain state between different page interactions.
   *
   * @param method - The session method name (typically matches a route handler).
   * @param params - The session parameters to store.
   * @param moreRoot - Additional root-level properties to merge.
   * @returns True if the session was set successfully, or null on error.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.setSession("textFree", {step: "awaiting_name"})
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  async setSession(method: string, params: any, moreRoot?: Record<any, any>) {
    try {
      const value = {method, params, ...moreRoot}
      const result = await this.cacheSession.set(`${this.userId}`, value)
      if (result) {
        this.temp.session = value
      }
      return result
    } catch {
      return null
    }
  }

  /**
   * Retrieves session data for the current user.
   *
   * @remarks
   * Fetches the session from external cache and updates the local session property.
   *
   * @returns The session data, or null if not found or on error.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   const session = await this.getSession()
   *   if (session?.params?.step === "awaiting_name") {
   *     // Handle name input
   *   }
   * }
   * ```
   *
   * @public
   */
  async getSession(): Promise<ITCacheRpc | null> {
    try {
      const result = await this.cacheSession.get(`${this.userId}`)
      if (result) this.temp.session = result
      return result || null
    } catch {
      return null
    }
  }

  /**
   * Clears session data for the current user.
   *
   * @remarks
   * Removes the session from external cache and resets the local session property.
   *
   * @returns True if the session was cleared, or null on error.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   await this.clearSession()
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  async clearSession() {
    try {
      const result = await this.cacheSession.delete(`${this.userId}`)
      if (result) this.temp.session = {}
      return result
    } catch {
      return null
    }
  }

  // =============== build data
  /**
   * Creates page routing data configuration.
   *
   * @remarks
   * This method has multiple overloads:
   * - `buildData()` - Returns default page data with no args.
   * - `buildData(callbackData)` - Returns intentCallbackData + args.
   * - `buildData(options)` - Returns page data with custom options.
   *
   * The callback must return an array of arg values that will be joined
   * with the intent using colon separators.
   *
   * @typeParam C - The callback function type.
   * @param callbackData - A function that returns arg values as an array.
   * @returns The page data configuration object.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // Simple callback arg
   *   static data = this.buildData((id: string) => [id])
   *
   *   // With custom intents
   *   static data = this.buildData({
   *     callbackData: (action: string) => [action],
   *     intentText: "my_page",
   *     intentCommandText: "mycommand"
   *   })
   * }
   * ```
   *
   * @public
   */
  static buildData<C extends (...args: any[]) => any>(callbackData: C): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration with options.
   *
   * @param options - Configuration options. See {@link ITBuildDataOptions} for details.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData<C extends (...args: any[]) => any>(options: ITBuildDataOptions): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration with options (no type inference).
   *
   * @param options - Configuration options. See {@link ITBuildDataOptions} for details.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData(options: ITBuildDataOptions): ITPageData<[]>

  /**
   * Creates default page routing data configuration.
   * @public
   */
  static buildData(): ITPageData<[]>
  static buildData(params?: any): ITPageData<any> {
    const isFunc = typeof params === `function`
    const options = isFunc ? {callbackData: params} : params || {}
    const cbd = options.callbackData
    const addPld = this.prototype.addArgs.bind(this.prototype)

    const name = options.name || ``
    const data: ITPageData<any> = {
      name,
      intentText: options.intentText || name,
      intentCommandText: options.intentCommandText || name,
      intentCallbackData: name,
      callbackData: cbd
        ? function (this: {intentCallbackData: string}, ...args: any[]): string {
            console.log({cbd})
            return addPld(this.intentCallbackData, `colon`, cbd(...args))
          }
        : function (this: {intentCallbackData: string}): string {
            return this?.intentCallbackData
          },
      _positionArgText: options.intentText ? options.intentText.split(this.prototype.getSeperatorTag(`space`)).length : (undefined as any)
    }
    return data
  }

  // =============== build keyboard
  /**
   * Helper method to arrange keyboard buttons in a grid layout.
   *
   * @remarks
   * Supports custom column configurations and special handling for the last row.
   *
   * @typeParam T - The keyboard type.
   * @param k - The keyboard instance.
   * @param l - Array of button labels.
   * @param layout - Layout format: "cols" or "cols-lastRow" (e.g., "2" or "3-2").
   * @param cb - Callback to create each button.
   * @returns The keyboard instance with buttons arranged.
   *
   * @example
   * ```typescript
   * const kb = this.keyboardCols(new InlineKeyboard(), ["A", "B", "C"], "2", (e, i) => {
   *   kb.text(e, `btn:${i}`)
   * })
   * ```
   *
   * @public
   */
  keyboardCols<T = any>(k: T, l: string[], layout: ITKbCols, cb: (e: string, i: number) => any): T {
    const [colsStr, lastRowStr] = layout.split(`-`)
    const cols = parseInt(colsStr!)
    const lastRow = lastRowStr ? parseInt(lastRowStr) : null
    const total = l.length
    const kb = k as any
    for (let index = 0; index < total; index++) {
      const e = l[index]!
      cb(e, index)

      // Jika tidak ada spesifikasi lastRow, pakai pola normal
      if (lastRow === null) {
        if ((index + 1) % cols === 0 && index < total - 1) {
          kb.row()
        }
      } else {
        // Ada spesifikasi lastRow
        const remainingButtons = total - (index + 1)

        // Jika sisa tombol sama dengan lastRow, row break sekarang
        if (remainingButtons === lastRow) {
          kb.row()
        }
        // Jika belum mencapai baris terakhir, pakai pola cols normal
        else if (remainingButtons > lastRow && (index + 1) % cols === 0) {
          kb.row()
        }
      }
    }
    return k
  }

  /**
   * Creates a bottom keyboard with template-based text buttons.
   *
   * @remarks
   * Shorthand for {@link Ctx.bottomKeyboard} with automatic text button creation.
   *
   * @param layout - Layout format: "cols" or "cols-lastRow". Default: "1".
   * @param baseId - Optional template base ID position for block keyboard. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param data - Optional template interpolation data.
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const kb = this.bottomKeyboardT("2")
   *   await this.reply(kb)
   * }
   * ```
   *
   * @public
   */
  bottomKeyboardT(layout: ITKbCols = `1`, baseId?: string | null, data?: Record<any, any>) {
    return this.bottomKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, layout, (e) => k.text(e))
      },
      {baseId: baseId ?? undefined, data}
    )
  }

  /**
   * Creates an inline keyboard with template-based buttons linked to page destinations.
   *
   * @remarks
   * Shorthand for {@link Ctx.inlineKeyboard} with automatic callback data from page destinations.
   *
   * @param PageDest - Array of page classes or callback data strings.
   * @param layout - Layout format: "cols" or "cols-lastRow". Default: "1".
   * @param baseId - Optional template base ID position block keyboard. IMPORTANT: If a `<base id="...">` is defined in the template, you must set baseId to the same value. Leaving baseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration.
   * @param data - Optional template interpolation data.
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const kb = this.inlineKeyboardT([SettingsPage, HelpPage], "2")
   *   await this.reply(kb)
   *
   *   // Or with arg
   *   const kb = this.inlineKeyboardT([SettingsPage.data.callbackData(1), HelpPage.data.callbackData(`hi`)], "2")
   *   await this.reply(kb)
   *
   *   // Compare with builder for basic but not recomended because very long syntax, only use builder when needed.!
   *   this.inlineKeyboard((k, a) => k.text(SettingsPage.data.callbackData(), a[0]!).text(HelpPage.data.callbackData(), a[1]!))
   * }
   * ```
   *
   * @public
   */
  inlineKeyboardT(PageDest: ITKbDest[], layout: ITKbCols = `1`, baseId?: string | null, data?: ITData) {
    return this.inlineKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, layout, (e, i) => {
          const page = PageDest[i]!
          const data = typeof page == `string` ? page : page.data.callbackData()
          k.text(e, data)
        })
      },
      {baseId: baseId ?? undefined, data}
    )
  }

  /**
   * Creates an inline keyboard using a builder callback.
   *
   * @remarks
   * The callback receives the keyboard instance and an array of button labels
   * from the template. Supports optional caching for performance.
   *
   * @param callback - Builder function that receives keyboard and labels.
   * @param params - Optional parameters. {@link ITInlineKbParams} for details.
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const kb = this.inlineKeyboard((k, labels) => {
   *     labels.forEach((label, i) => k.text(label, `action:${i}`))
   *     return k
   *   })
   *   await this.reply(kb)
   * }
   * ```
   *
   * @public
   */
  inlineKeyboard(callback: (k: ITInlineKb, l: string[]) => any, params?: ITInlineKbParams): ITInlineKb {
    const tkey = this.data.name
    if (params?.cache === true) {
      const key = `${tkey}:${this.userLanguage}:i`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const ikb = new InlineKeyboard()
        const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `inline`, params?.data)
        const rkb = callback(ikb, arr)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const ikb = new InlineKeyboard()
    const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `inline`, params?.data)
    const rkb = callback(ikb, arr)
    return rkb
  }

  /**
   * Creates a bottom (reply) keyboard using a builder callback.
   *
   * @remarks
   * The callback receives the keyboard instance and an array of button labels
   * from the template. Automatically applies `resized()` to the keyboard.
   *
   * @param callback - Builder function that receives keyboard and labels.
   * @param params - Optional parameters. {@link ITBottomKbParams} for details.
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   const kb = this.bottomKeyboard((k, labels) => {
   *     labels.forEach(label => k.text(label))
   *     return k
   *   })
   *   await this.reply(kb)
   * }
   * ```
   *
   * @public
   */
  bottomKeyboard(callback: (k: ITBottomKb, l: string[]) => any, params?: ITBottomKbParams): ITBottomKb {
    const tkey = this.data.name
    if (params?.cache === true) {
      const key = `${tkey}:${this.userLanguage}:b`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const kb = new Keyboard()
        const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `bottom`, params?.data)
        const rkb = callback(kb, arr)
        rkb.resized(true)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const kb = new Keyboard()
    const arr = this.templateManager.getKeyboard(tkey, params?.baseId, this.userLanguage, `bottom`, params?.data)
    const rkb = callback(kb, arr)
    rkb.resized()
    return rkb
  }

  // =============== manipulation string
  /**
   * Gets the separator character for the specified method.
   *
   * @param mtd - The separator method: "space" or "colon". Default: "space".
   * @returns The separator character (" " or ":").
   *
   * @public
   */
  getSeperatorTag(mtd: `space` | `colon` = `space`) {
    return mtd == `space` ? ` ` : `:`
  }

  /**
   * Checks if a string contains arg separators.
   *
   * @param str - The string to check.
   * @param mtd - The separator method.
   * @returns True if the string contains the separator.
   *
   * @public
   */
  haveArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0]) {
    return str.includes(this.getSeperatorTag(mtd))
  }

  /**
   * Appends arg values to a string using the specified separator.
   *
   * @param str - The base string.
   * @param mtd - The separator method.
   * @param pld - Array of arg values to append.
   * @returns The string with appended args.
   *
   * @public
   */
  addArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], pld: (string | undefined)[]) {
    const sep = this.getSeperatorTag(mtd)
    let out = ``
    for (let i = 0; i < pld.length; i++) {
      const v = pld[i]
      if (v != null && v !== ``) {
        out += sep + v
      }
    }
    return str + out
  }

  /**
   * Extracts arg values from a string.
   *
   * @param str - The string containing args.
   * @param mtd - The separator method.
   * @param positionStart - Starting position for arg extraction. Default: 1.
   * @returns Array of extracted arg values.
   *
   * @public
   */
  getArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionStart: number = 1) {
    if (!str) return []
    const tag = this.getSeperatorTag(mtd)
    return str.split(tag).slice(positionStart)
  }

  /**
   * Extracts the intent portion from a string containing args.
   *
   * @param str - The string to extract intent from.
   * @param mtd - The separator method.
   * @param positionEnd - Number of segments to include in the intent. Default: 1.
   * @returns The intent string.
   *
   * @example
   * ```typescript
   * const intent = this.getIntent("start:123:456", "colon", 1)
   * console.log(intent) // "start"
   * ```
   *
   * @public
   */
  getIntent(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionEnd: number = 1) {
    if (!str) return ``
    const tag = this.getSeperatorTag(mtd)
    const spl = str.split(tag)
    return positionEnd == 1 ? (spl[0] as string) : spl.slice(0, positionEnd).join(tag)
  }

  // =============== most common used function
  /**
   * Transition method for navigating between pages.
   *
   * @remarks
   * Override this method in subclasses to implement page-to-page transitions.
   * This is a placeholder that must be implemented when needed.
   *
   * @param args - Transition parameters.
   * @returns Promise resolving when transition is complete.
   *
   * @virtual
   * @public
   */
  async transition?(...args: any): Promise<any>

  // =============== route function
  /**
   * Route handler for callback queries without args matching `intentCallbackData`.
   *
   * @remarks Triggered by callback query data matching.
   *
   * @example this.callbackData = "start".
   * ```typescript
   * async handleCallbackData() {
   *    this.callbackData // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCallbackData?(): Promise<any>

  /**
   * Route handler for callback queries with args matching `intentCallbackData`.
   *
   * @remarks Triggered by callback data with args.
   *
   * @example this.callbackData = "start:123"
   * ```typescript
   * async handleArgsCallbackData() {
   *    this.callbackData // "start:123"
   *    this.callbackDataArg // "123"
   *    this.callbackDataArgs // ["123"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleArgsCallbackData?(): Promise<any>

  /**
   * Route handler for text messages matching `intentText`.
   *
   * @remarks Triggered by exact text match.
   *
   * @example this.msgText = "start"
   * ```typescript
   * async handleText() {
   *    this.msgText // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleText?(): Promise<any>

  /**
   * Route handler for text messages with args match intent `intentText`.
   *
   * @remarks Triggered by text with space-separated args.
   *
   * @example this.msgText = "start 123 aaa"
   * ```typescript
   * async handleTextArgs() {
   *    this.msgText // "start 123 aaa"
   *    this.msgTextArg // "123"
   *    this.msgTextArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleArgsText?(): Promise<any>

  /**
   * Route handler for command messages match intent `intentCommandText`.
   *
   * @remarks Triggered by text with slash commands.
   *
   * @example this.msgText = "/start"
   * ```typescript
   * async handleCommandText() {
   *    this.msgText // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandText?(): Promise<any>

  /**
   * Route handler for command messages with args match intent `intentCommandText`.
   *
   * @remarks Triggered by text with commands slash with args.
   *
   * @example this.msgText = "/start 123 aaa"
   * ```typescript
   * async handleCommandTextArgs() {
   *    this.msgText // "/start 123 aaa"
   *    this.msgTextArg // "123"
   *    this.msgTextArg // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandArgsText?(): Promise<any>

  /**
   * Route handler for free-form text input.
   *
   * @remarks Triggered by any text not matching other routes, typically used with sessions.
   *
   * @example this.msgText = "hello gramstax, random: 12848s8283n183m"
   * ```typescript
   * async handleFreeText() {
   *    this.msgText // "hello gramstax, random: 12848s8283n183m"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeText?(): Promise<any>

  // photo
  /**
   * Route function for photoCaptio match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption.
   *
   * @example this.data.name = "start" && this.msgPhoto
   * ```typescript
   * async handleCaptionPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionPhoto?(): Promise<any>

  /**
   * Route function for photoCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgPhoto
   * ```typescript
   * async handleCaptionArgsPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsPhoto?(): Promise<any>

  /**
   * Route function for photoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command.
   *
   * @example this.data.name = "/start" && this.msgPhoto
   * ```typescript
   * async handleCommandCaptionPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionPhoto?(): Promise<any>

  /**
   * Route function for photoCaptionCommandPayload with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msgPhoto
   * ```typescript
   * async handleCommandCaptionArgsPhoto() {
   *   this.msgPhoto // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsPhoto?(): Promise<any>

  /**
   * Route handler for free-form photo input.
   *
   * @remarks Triggered by any photo not matching other routes, typically used with sessions.
   *
   * @example this.msgPhoto
   * ```typescript
   * async handleFreePhoto() {
   *    this.msgPhoto // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreePhoto?(): Promise<any>

  // video
  /**
   * Route function for videoCaption match intent `this.data.name`
   *
   * @remarks Triggered by video with caption.
   *
   * @example this.data.name = "start" && this.msgVideo
   * ```typescript
   * async handleCaptionVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionVideo?(): Promise<any>

  /**
   * Route function for videoCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by video with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgVideo
   * ```typescript
   * async handleCaptionArgsVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsVideo?(): Promise<any>

  /**
   * Route function for videoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command.
   *
   * @example this.data.name = "/start" && this.msgVideo
   * ```typescript
   * async handleCommandCaptionVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionVideo?(): Promise<any>

  /**
   * Route function for videoCaptionCommandPayload with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msgVideo
   * ```typescript
   * async handleCommandCaptionArgsVideo() {
   *   this.msgVideo // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsVideo?(): Promise<any>

  /**
   * Route handler for free-form video input.
   *
   * @remarks Triggered by any video not matching other routes, typically used with sessions.
   *
   * @example this.msgVideo
   * ```typescript
   * async handleFreeVideo() {
   *    this.msgVideo // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeVideo?(): Promise<any>

  // audio
  /**
   * Route function for audioCaption match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption.
   *
   * @example this.data.name = "start" && this.msgAudio
   * ```typescript
   * async handleCaptionAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionAudio?(): Promise<any>

  /**
   * Route function for audioCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgAudio
   * ```typescript
   * async handleCaptionArgsAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsAudio?(): Promise<any>

  /**
   * Route function for audioCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command.
   *
   * @example this.data.name = "/start" && this.msgAudio
   * ```typescript
   * async handleCommandCaptionAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionAudio?(): Promise<any>

  /**
   * Route function for audioCaptionCommandPayload with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msgAudio
   * ```typescript
   * async handleCommandCaptionArgsAudio() {
   *   this.msgAudio // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsAudio?(): Promise<any>

  /**
   * Route handler for free-form audio input.
   *
   * @remarks Triggered by any audio not matching other routes, typically used with sessions.
   *
   * @example this.msgAudio
   * ```typescript
   * async handleFreeAudio() {
   *    this.msgAudio // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeAudio?(): Promise<any>

  // document
  /**
   * Route function for documentCaption match intent `this.data.name`
   *
   * @remarks Triggered by document with caption.
   *
   * @example this.data.name = "start" && this.msgDocument
   * ```typescript
   * async handleCaptionDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionDocument?(): Promise<any>

  /**
   * Route function for documentCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by document with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msgDocument
   * ```typescript
   * async handleCaptionArgsDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsDocument?(): Promise<any>

  /**
   * Route function for documentCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command.
   *
   * @example this.data.name = "/start" && this.msgDocument
   * ```typescript
   * async handleCommandCaptionDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionDocument?(): Promise<any>

  /**
   * Route function for documentCaptionCommandPayload with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsDocument() {
   *   this.msgDocument // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsDocument?(): Promise<any>

  /**
   * Route handler for free-form document input.
   *
   * @remarks Triggered by any document not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeDocument() {
   *    this.msgDocument // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeDocument?(): Promise<any>

  // animation
  /**
   * Route function for animationCaption match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async handleCaptionAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionAnimation?(): Promise<any>

  /**
   * Route function for animationCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async handleCaptionArgsAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsAnimation?(): Promise<any>

  /**
   * Route function for animationCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async handleCommandCaptionAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionAnimation?(): Promise<any>

  /**
   * Route function for animationCaptionCommandPayload with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsAnimation() {
   *   this.msgAnimation // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsAnimation?(): Promise<any>

  /**
   * Route handler for free-form animation input.
   *
   * @remarks Triggered by any animation not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeAnimation() {
   *    this.msgAnimation // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeAnimation?(): Promise<any>

  // voice
  /**
   * Route function for voiceCaption match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async handleCaptionVoice() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionVoice?(): Promise<any>

  /**
   * Route function for voiceCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async handleCaptionArgsVoice() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsVoice?(): Promise<any>

  /**
   * Route function for voiceCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async voiceCaptionCommand() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionVoice?(): Promise<any>

  /**
   * Route function for voiceCaptionCommandPayload with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsVoice() {
   *   this.msgVoice // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionPayload // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandCaptionArgsVoice?(): Promise<any>

  /**
   * Route handler for free-form voice input.
   *
   * @remarks Triggered by any voice not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeVoice() {
   *    this.msgVoice // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeVoice?(): Promise<any>

  // video_note
  /**
   * Route handler for free-form video note input.
   * @remarks Triggered by any video note not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeVideoNote() {
   *    this.msgVideoNote // {...}
   * }
   * ```
   * @virtual
   * @public
   */
  async handleFreeVideoNote?(): Promise<any>

  // sticker
  /**
   * Route handler for free-form sticker input.
   *
   * @remarks Triggered by any sticker not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeSticker() {
   *    this.msgSticker // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeSticker?(): Promise<any>

  // location
  /**
   * Route handler for free-form location input.
   *
   * @remarks Triggered by any location not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeLocation() {
   *    this.msgLocation // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeLocation?(): Promise<any>

  // contact
  /**
   * Route handler for free-form contact input.
   *
   * @remarks Triggered by any contact not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeContact() {
   *    this.msgContact // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeContact?(): Promise<any>

  // all
  /**
   * Fallback route handler for any unmatched update.
   *
   * @remarks
   * Triggered when no other route handler matches the current update. Use this for
   * global fallback logic or safety responses.
   *
   * @example
   * ```typescript
   * async handleFree() {
   *   // handle unexpected updates
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFree?(): Promise<any>

  // callback
  /**
   * Session validation methods.
   *
   * @remarks
   * These methods validate whether the current session’s `session.method` matches the value returned by `methodSession*`.
   * Each isSession* method compares the session method with its corresponding `methodSession*` result.
   *
   * @example
   * ```typescript
   * async textFree() {
   *   if (this.isSessionTextFree()) {
   *     // Handle the expected session flow
   *   }
   * }
   * ```
   *
   * @public
   */
  isSessionCallbackData(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCallbackData(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionArgsCallbackData(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionArgsCallbackData(name)
  }
  // text
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionText(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionText(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionArgsText(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionArgsText(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandText(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandText(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandArgsText(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandArgsText(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeText(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeText(name)
  }
  // photo
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionPhoto(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionPhoto(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsPhoto(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionArgsPhoto(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionPhoto(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionPhoto(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsPhoto(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionArgsPhoto(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreePhoto(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreePhoto(name)
  }
  // video
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionVideo(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionVideo(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsVideo(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionArgsVideo(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionVideo(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionVideo(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsVideo(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionArgsVideo(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeVideo(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeVideo(name)
  }
  // audio
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionAudio(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionAudio(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsAudio(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionArgsAudio(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionCommandAudio(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionCommandAudio(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionCommandArgsAudio(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionCommandArgsAudio(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeAudio(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeAudio(name)
  }
  // document
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionDocument(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionDocument(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsDocument(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionArgsDocument(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionDocument(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionDocument(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsDocument(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionArgsDocument(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeDocument(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeDocument(name)
  }
  // animation
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionAnimation(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionAnimation(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsAnimation(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionArgsAnimation(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionAnimation(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionAnimation(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsAnimation(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionArgsAnimation(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeAnimation(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeAnimation(name)
  }
  // voice
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionVoice(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionVoice(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCaptionArgsVoice(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCaptionArgsVoice(name)
  }
  isSessionCommandCaptionVoice(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionVoice(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionCommandCaptionArgsVoice(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionCommandCaptionArgsVoice(name)
  }
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeVoice(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeVoice(name)
  }
  // video note
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeVideoNote(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeVideoNote(name)
  }
  // sticker
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeSticker(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeSticker(name)
  }
  // location
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeLocation(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeLocation(name)
  }
  // contact
  /** {@inheritDoc Ctx.isSessionCallbackData} */
  isSessionFreeContact(method?: string, name?: string) {
    return (method ?? this.temp.session.method) === this.methodSessionFreeContact(name)
  }

  // callback
  /**
   * Session set helper methods.
   *
   * @remarks
   * These methods are shortcuts for {@link Ctx.setSession} with pre-built method names.
   * Each `session*` method sets the session for the corresponding route handler.
   *
   * @example
   * ```typescript
   * async handleCallbackData() {
   *   // Set session to expect textFree input
   *   await this.sessionTextFree({data: "12345"})
   *   await this.reply()
   * }
   * ```
   *
   * @public
   */
  sessionCallbackData(params?: any, name?: string) {
    return this.setSession(this.methodSessionCallbackData(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionArgsCallbackData(params?: any, name?: string) {
    return this.setSession(this.methodSessionArgsCallbackData(name), params)
  }
  // text
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionText(params?: any, name?: string) {
    return this.setSession(this.methodSessionText(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionArgsText(params?: any, name?: string) {
    return this.setSession(this.methodSessionArgsText(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandText(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandText(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandArgsText(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandArgsText(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeText(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeText(name), params)
  }
  // photo
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionPhoto(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionPhoto(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionArgsPhoto(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionArgsPhoto(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionPhoto(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionPhoto(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionArgsPhoto(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionArgsPhoto(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreePhoto(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreePhoto(name), params)
  }
  // video
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionVideo(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionVideo(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionArgsVideo(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionArgsVideo(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionVideo(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionVideo(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionArgsVideo(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionArgsVideo(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeVideo(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeVideo(name), params)
  }
  // audio
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionAudio(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionAudio(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionArgsAudio(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionArgsAudio(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionCommandAudio(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionCommandAudio(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionCommandArgsAudio(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionCommandArgsAudio(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeAudio(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeAudio(name), params)
  }
  // document
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionDocument(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionDocument(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionArgsDocument(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionArgsDocument(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionDocument(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionDocument(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionArgsDocument(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionArgsDocument(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeDocument(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeDocument(name), params)
  }
  // animation
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionAnimation(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionAnimation(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionArgsAnimation(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionArgsAnimation(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionAnimation(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionAnimation(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionArgsAnimation(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionArgsAnimation(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeAnimation(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeAnimation(name), params)
  }
  // voice
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionVoice(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionVoice(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCaptionArgsVoice(params?: any, name?: string) {
    return this.setSession(this.methodSessionCaptionArgsVoice(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionVoice(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionVoice(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionCommandCaptionArgsVoice(params?: any, name?: string) {
    return this.setSession(this.methodSessionCommandCaptionArgsVoice(name), params)
  }
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeVoice(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeVoice(name), params)
  }
  // video note
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeVideoNote(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeVideoNote(name), params)
  }
  // sticker
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeSticker(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeSticker(name), params)
  }
  // location
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeLocation(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeLocation(name), params)
  }
  // contact
  /** {@inheritDoc Ctx.sessionCallbackData} */
  sessionFreeContact(params?: any, name?: string) {
    return this.setSession(this.methodSessionFreeContact(name), params)
  }

  /**
   * Session method name builders.
   *
   * @remarks
   * These methods generate unique session method identifiers used by
   * {@link Ctx.setSession} and validation methods. Each `methodSession*`
   * returns a prefixed string like `"1-PageName"`.
   *
   * @public
   */
  methodSession(prefix: string, name: string | undefined) {
    return `${prefix}-${name || this.data.name}`
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCallbackData(name?: string) {
    return this.methodSession(`1`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionArgsCallbackData(name?: string) {
    return this.methodSession(`2`, name)
  }
  // text method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionText(name?: string) {
    return this.methodSession(`3`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionArgsText(name?: string) {
    return this.methodSession(`4`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandText(name?: string) {
    return this.methodSession(`5`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandArgsText(name?: string) {
    return this.methodSession(`6`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeText(name?: string) {
    return this.methodSession(`7`, name)
  }
  // photo method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionPhoto(name?: string) {
    return this.methodSession(`8`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsPhoto(name?: string) {
    return this.methodSession(`9`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionPhoto(name?: string) {
    return this.methodSession(`10`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsPhoto(name?: string) {
    return this.methodSession(`11`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreePhoto(name?: string) {
    return this.methodSession(`12`, name)
  }
  // video method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionVideo(name?: string) {
    return this.methodSession(`13`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsVideo(name?: string) {
    return this.methodSession(`14`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionVideo(name?: string) {
    return this.methodSession(`15`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsVideo(name?: string) {
    return this.methodSession(`16`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVideo(name?: string) {
    return this.methodSession(`17`, name)
  }
  // audio method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionAudio(name?: string) {
    return this.methodSession(`18`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsAudio(name?: string) {
    return this.methodSession(`19`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionCommandAudio(name?: string) {
    return this.methodSession(`20`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionCommandArgsAudio(name?: string) {
    return this.methodSession(`21`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeAudio(name?: string) {
    return this.methodSession(`22`, name)
  }
  // document method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionDocument(name?: string) {
    return this.methodSession(`23`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsDocument(name?: string) {
    return this.methodSession(`24`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionDocument(name?: string) {
    return this.methodSession(`25`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsDocument(name?: string) {
    return this.methodSession(`26`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeDocument(name?: string) {
    return this.methodSession(`27`, name)
  }
  // animation method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionAnimation(name?: string) {
    return this.methodSession(`28`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsAnimation(name?: string) {
    return this.methodSession(`29`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionAnimation(name?: string) {
    return this.methodSession(`30`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsAnimation(name?: string) {
    return this.methodSession(`31`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeAnimation(name?: string) {
    return this.methodSession(`32`, name)
  }
  // voice method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionVoice(name?: string) {
    return this.methodSession(`33`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsVoice(name?: string) {
    return this.methodSession(`34`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionVoice(name?: string) {
    return this.methodSession(`35`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsVoice(name?: string) {
    return this.methodSession(`36`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVoice(name?: string) {
    return this.methodSession(`37`, name)
  }
  // video note method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVideoNote(name?: string) {
    return this.methodSession(`38`, name)
  }
  // sticker method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeSticker(name?: string) {
    return this.methodSession(`39`, name)
  }
  // location method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeLocation(name?: string) {
    return this.methodSession(`40`, name)
  }
  // contact method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeContact(name?: string) {
    return this.methodSession(`41`, name)
  }
}
