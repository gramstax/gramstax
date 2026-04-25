import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {AdminGuard} from "~/guards/admin"

type BroadcastSession = {
  step?: `message` | `confirm`
  draft?: string
  mediaType?: `photo` | `video` | `animation`
  fileId?: string
  caption?: string
}

class Base {
  static prompt = `prompt`
  static confirm = `confirm`
  static confirmPhoto = `confirm-photo`
  static confirmVideo = `confirm-video`
  static confirmAnimation = `confirm-animation`
  static result = `result`
  static empty = `empty`
  static cancelled = `cancelled`
  static deliver = `deliver`
  static deliverPhoto = `deliver-photo`
  static deliverVideo = `deliver-video`
  static deliverAnimation = `deliver-animation`
}

class Helper {
  static promptKb(ctx: BroadcastPage) {
    return ctx.inlineKeyboardT([BroadcastPage.data.callbackData(`cancel`), StartPage], `2`, Base.prompt)
  }

  static confirmKb(ctx: BroadcastPage) {
    return ctx.inlineKeyboardT([BroadcastPage.data.callbackData(`send`), BroadcastPage.data.callbackData(`edit`), BroadcastPage.data.callbackData(`cancel`), StartPage], `2-2`, Base.confirm)
  }

  static homeKb(ctx: BroadcastPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }

  static sessionParams(ctx: BroadcastPage) {
    return (ctx.temp.session?.params as BroadcastSession | undefined) ?? {}
  }

  static deliverMediaBase(mediaType: BroadcastSession[`mediaType`]) {
    if (mediaType === `photo`) return Base.deliverPhoto
    if (mediaType === `video`) return Base.deliverVideo
    return Base.deliverAnimation
  }

  static async replyConfirmMedia(ctx: BroadcastPage, mediaType: NonNullable<BroadcastSession[`mediaType`]>, fileId: string, caption?: string) {
    const kb = Helper.confirmKb(ctx)
    const data = {fileId, caption}

    if (mediaType === `photo`) {
      return await ctx.replyPhoto(kb, data, Base.confirmPhoto)
    }
    if (mediaType === `video`) {
      return await ctx.replyVideo(kb, data, Base.confirmVideo)
    }

    return await ctx.replyAnimation(kb, data, Base.confirmAnimation)
  }
}

class Alert {
  static async emptyDraft(ctx: BroadcastPage, edit = false) {
    await ctx.sessionFreeText({step: `message`})
    const kb = Helper.promptKb(ctx)
    const data = {draft: `-`, isEmpty: true}

    if (edit) return await ctx.edit(kb, data, Base.prompt)
    return await ctx.reply(kb, data, Base.prompt)
  }

  static async result(ctx: BroadcastPage, count: number) {
    const kb = Helper.homeKb(ctx)
    await ctx.edit(kb, {count}, Base.result)
  }

  static async emptySubscribers(ctx: BroadcastPage) {
    await ctx.clearSession()
    const kb = Helper.homeKb(ctx)
    await ctx.edit(kb, {}, Base.empty)
  }

  static async cancelled(ctx: BroadcastPage) {
    await ctx.clearSession()
    const kb = Helper.homeKb(ctx)
    await ctx.edit(kb, {}, Base.cancelled)
  }
}

class Flow {
  static async enter(ctx: BroadcastPage, edit = true) {
    if (!AdminGuard.isAdmin(ctx)) return null

    await ctx.sessionFreeText({step: `message`})
    const kb = Helper.promptKb(ctx)
    const data = {draft: `-`, isEmpty: false}

    if (edit) await ctx.edit(kb, data, Base.prompt)
    else await ctx.reply(kb, data, Base.prompt)
  }

  static async handleArgs(ctx: BroadcastPage) {
    const [action] = ctx.callbackDataArgs
    if (!AdminGuard.isAdmin(ctx)) return null

    if (action === `send`) {
      return await Flow.send(ctx)
    }
    if (action === `edit`) {
      return await Flow.edit(ctx)
    }
    if (action === `cancel`) {
      return await Flow.cancel(ctx)
    }

    await Flow.enter(ctx, true)
  }

  static async freeText(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) return null
    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) return null

    const draft = ctx.msgText?.trim()
    if (!draft) {
      return await Alert.emptyDraft(ctx)
    }

    await ctx.sessionFreeText({step: `confirm`, draft})
    await ctx.reply(Helper.confirmKb(ctx), {draft}, Base.confirm)
  }

  static async freePhoto(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) return null
    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) return null

    const caption = ctx.msgCaption?.trim()
    if (caption?.startsWith(`/`)) return null

    const photos = ctx.msgPhoto
    const lastPhoto = photos?.[photos.length - 1]
    if (!lastPhoto?.file_id) return null

    await ctx.sessionFreeText({step: `confirm`, mediaType: `photo`, fileId: lastPhoto.file_id, caption})
    await Helper.replyConfirmMedia(ctx, `photo`, lastPhoto.file_id, caption)
  }

  static async freeVideo(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) return null
    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) return null

    const caption = ctx.msgCaption?.trim()
    if (caption?.startsWith(`/`)) return null

    const fileId = ctx.msgVideo?.file_id
    if (!fileId) return null

    await ctx.sessionFreeText({step: `confirm`, mediaType: `video`, fileId, caption})
    await Helper.replyConfirmMedia(ctx, `video`, fileId, caption)
  }

  static async freeAnimation(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) return null
    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) return null

    const caption = ctx.msgCaption?.trim()
    if (caption?.startsWith(`/`)) return null

    const fileId = ctx.msgAnimation?.file_id
    if (!fileId) return null

    await ctx.sessionFreeText({step: `confirm`, mediaType: `animation`, fileId, caption})
    await Helper.replyConfirmMedia(ctx, `animation`, fileId, caption)
  }

  static async send(ctx: BroadcastPage) {
    const {draft, mediaType, fileId, caption} = Helper.sessionParams(ctx)
    if (!draft && !mediaType) {
      return await Alert.emptyDraft(ctx, true)
    }

    const subscribers = await ctx.db.listSubscribers()
    if (subscribers.length === 0) {
      return await Alert.emptySubscribers(ctx)
    }

    const ids = subscribers.map((item) => item.id)
    const langs = subscribers.map((item) => item.language || `default`)
    if (mediaType && fileId) {
      await ctx.broadcastMedia(ids, langs, undefined, {fileId, caption}, Helper.deliverMediaBase(mediaType))
    } else {
      await ctx.broadcast(ids, langs, undefined, {message: draft}, Base.deliver)
    }
    await ctx.clearSession()

    await Alert.result(ctx, subscribers.length)
  }

  static async edit(ctx: BroadcastPage) {
    const {draft, mediaType} = Helper.sessionParams(ctx)
    if (mediaType) {
      await ctx.sessionFreeText({step: `message`})
      await ctx.edit(Helper.promptKb(ctx), {draft: `-`, isEmpty: false}, Base.prompt)
      return
    }

    await ctx.sessionFreeText({step: `message`, draft})
    await ctx.edit(Helper.promptKb(ctx), {draft: draft || `-`, isEmpty: false}, Base.prompt)
  }

  static async cancel(ctx: BroadcastPage) {
    await Alert.cancelled(ctx)
  }
}

export class BroadcastPage extends PageBase {
  static data = this.buildData((action?: string) => [action])
  static BASE = Base

  async handleCallbackData() {
    await Flow.enter(this, true)
  }

  async handleCommandText() {
    await Flow.enter(this, false)
  }

  async handleArgsCallbackData() {
    await Flow.handleArgs(this)
  }

  async handleFreeText() {
    await Flow.freeText(this)
  }

  async handleFreePhoto() {
    await Flow.freePhoto(this)
  }

  async handleFreeVideo() {
    await Flow.freeVideo(this)
  }

  async handleFreeAnimation() {
    await Flow.freeAnimation(this)
  }

  async handleSend() {
    return await Flow.send(this)
  }

  async handleEdit() {
    return await Flow.edit(this)
  }

  async handleCancel() {
    return await Flow.cancel(this)
  }

  async startBroadcast(edit: boolean) {
    return await Flow.enter(this, edit)
  }

  private promptKeyboard() {
    return Helper.promptKb(this)
  }

  private confirmKeyboard() {
    return Helper.confirmKb(this)
  }

  private getSessionParams() {
    return Helper.sessionParams(this)
  }

  private getDeliverMediaBase(mediaType: BroadcastSession[`mediaType`]) {
    return Helper.deliverMediaBase(mediaType)
  }

  static template = `
    <base>
      ${this.kbk.home()}
    </base>

    <base id="${this.BASE.prompt}">
      <keyboard>${this.kbl.cancelHome.default}</keyboard>
      <keyboard lang="id">${this.kbl.cancelHome.id}</keyboard>
      <message>
        📣 Broadcast Message

        {~isEmpty ? "⚠️ Message cannot be empty.\\n" : ""~}
        Current draft: {{draft}}

        Send the announcement text now. This will be delivered to every subscriber who is currently active.
        You can also send a photo, video, or animation with an optional caption.
      </message>
      <message lang="id">
        📣 Pesan Siaran

        {~isEmpty ? "⚠️ Pesan tidak boleh kosong.\\n" : ""~}
        Draf saat ini: {{draft}}

        Kirim teks siaran sekarang. Pesan ini akan dikirim ke semua pelanggan yang aktif.
        Anda juga dapat mengirim foto, video, atau animasi dengan caption opsional.
      </message>
    </base>

    <base id="${this.BASE.confirm}">
      <keyboard>✅ Send, ✏️ Edit, ${this.kbl.cancelHome.default}</keyboard>
      <keyboard lang="id">✅ Kirim, ✏️ Edit, ${this.kbl.cancelHome.id}</keyboard>
      <message>
        ✅ Confirm broadcast

        {{draft}}

        Review the message carefully. Once sent, it will be delivered to all subscribers.
      </message>
      <message lang="id">
        ✅ Konfirmasi siaran

        {{draft}}

        Tinjau pesan dengan saksama. Setelah dikirim, pesan akan diterima oleh semua pelanggan.
      </message>
    </base>

    <base id="${this.BASE.confirmPhoto}">
      <media type="photo" src="{{fileId}}">
        ✅ Confirm broadcast media

        {{caption}}
      </media>
      <media lang="id" type="photo" src="{{fileId}}">
        ✅ Konfirmasi siaran media

        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.confirmVideo}">
      <media type="video" src="{{fileId}}">
        ✅ Confirm broadcast media

        {{caption}}
      </media>
      <media lang="id" type="video" src="{{fileId}}">
        ✅ Konfirmasi siaran media

        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.confirmAnimation}">
      <media type="animation" src="{{fileId}}">
        ✅ Confirm broadcast media

        {{caption}}
      </media>
      <media lang="id" type="animation" src="{{fileId}}">
        ✅ Konfirmasi siaran media

        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.result}">
      <message>
        🎉 Broadcast sent

        Delivered to {{count}} subscribers.
        You can send another update anytime from the admin route.
      </message>
      <message lang="id">
        🎉 Siaran terkirim

        Dikirim ke {{count}} pelanggan.
        Anda bisa mengirim pembaruan lagi kapan saja lewat rute admin.
      </message>
    </base>

    <base id="${this.BASE.empty}">
      <message>
        📭 No subscribers yet.
        There is no one to broadcast to at the moment.
      </message>
      <message lang="id">
        📭 Belum ada pelanggan.
        Belum ada penerima untuk siaran saat ini.
      </message>
    </base>

    <base id="${this.BASE.cancelled}">
      <message>
        ✖️ Broadcast cancelled.
        Draft discarded. You can restart the broadcast flow anytime.
      </message>
      <message lang="id">
        ✖️ Siaran dibatalkan.
        Draf dibatalkan. Anda dapat memulai siaran lagi kapan saja.
      </message>
    </base>

    <base id="${this.BASE.deliver}">
      <message>
        📣 {{message}}
      </message>
      <message lang="id">
        📣 {{message}}
      </message>
    </base>

    <base id="${this.BASE.deliverPhoto}">
      <media type="photo" src="{{fileId}}">
        📣 Broadcast update

        {{caption}}
      </media>
      <media lang="id" type="photo" src="{{fileId}}">
        📣 Pembaruan siaran

        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.deliverVideo}">
      <media type="video" src="{{fileId}}">
        📣 Broadcast update

        {{caption}}
      </media>
      <media lang="id" type="video" src="{{fileId}}">
        📣 Pembaruan siaran

        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.deliverAnimation}">
      <media type="animation" src="{{fileId}}">
        📣 Broadcast update

        {{caption}}
      </media>
      <media lang="id" type="animation" src="{{fileId}}">
        📣 Pembaruan siaran

        {{caption}}
      </media>
    </base>
  `
}
