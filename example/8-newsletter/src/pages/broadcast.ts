import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {AdminGuard} from "~/guards/admin"

type BroadcastSession = {
  draftText?: string
  fileId?: string
  caption?: string
  mediaType?: `photo` | `video` | `animation`
  position?: `form` | `confirm`
}

class Base {
  static step1 = `s1`
  static infoConfirmText = `i-confirm-text`
  static infoConfirmPhoto = `i-confirm-photo`
  static infoConfirmVideo = `i-confirm-video`
  static infoConfirmAnimation = `i-confirm-animation`
  static success = `s`
  static infoEmptySubs = `i-empty-subs`
  static infoCancel = `i-cancel`
  static infoDeliverText = `i-deliver-text`
  static infoDeliverPhoto = `i-deliver-photo`
  static infoDeliverVideo = `i-deliver-video`
  static infoDeliverAnimation = `i-deliver-animation`
  static kbHome = `kh`
  static kbConfirm = `kc`
}

class Helper {
  static kbConfirm(ctx: BroadcastPage) {
    const bi = Base.kbConfirm
    const s1 = Base.step1
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(s1, `send`), ctx.data.callbackData(s1, `edit`), ctx.data.callbackData(s1, `cancel`), StartPage], `2-2`, bi)
    return kb
  }

  static kbHome(ctx: BroadcastPage, baseId?: string) {
    const bi = baseId ? baseId : Base.kbHome
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    return kb
  }

  static getSessionParams(ctx: BroadcastPage) {
    return (ctx.temp.session?.params as BroadcastSession) ?? {}
  }
}

class Alert {
  static async showSuccess(ctx: BroadcastPage, successCount: number, totalCount: number) {
    await ctx.clearSession()
    const bi = Base.success
    const kb = Helper.kbHome(ctx)
    const da = {successCount, totalCount}
    await ctx.edit(kb, da, bi)
  }

  static async showInfoEmptySubs(ctx: BroadcastPage) {
    await ctx.clearSession()
    const bi = Base.infoEmptySubs
    const kb = Helper.kbHome(ctx)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async showInfoCancel(ctx: BroadcastPage) {
    await ctx.clearSession()
    const bi = Base.infoCancel
    const kb = Helper.kbHome(ctx)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async showInfoConfirmText(ctx: BroadcastPage) {
    const draftText = ctx.msgText.trim()
    const bi = Base.infoConfirmText
    const kb = Helper.kbConfirm(ctx)
    const da = {draftText}
    await ctx.setSession(`multi_session`, {position: `confirm`, draftText})
    await ctx.reply(kb, da, bi)
  }

  static async showInfoConfirmAnimation(ctx: BroadcastPage) {
    const animation = ctx.msgAnimation
    const fileId = animation.file_id
    if (!fileId) {
      return null
    }

    const caption = ctx.msgCaption?.trim()
    const bi = Base.step1
    const kb = Helper.kbConfirm(ctx)
    const da = {fileId, caption}
    await ctx.setSession(`multi_session`, {position: `confirm`, mediaType: `animation`, fileId, caption})
    await ctx.replyAnimation(kb, da, bi)
  }

  static async showInfoConfirmPhoto(ctx: BroadcastPage) {
    const photos = ctx.msgPhoto
    const lastPhoto = photos?.[photos.length - 1]
    const fileId = lastPhoto.file_id
    if (!fileId) {
      return null
    }

    const caption = ctx.msgCaption?.trim()
    const bi = Base.infoConfirmPhoto
    const kb = Helper.kbConfirm(ctx)
    const da = {fileId, caption}
    await ctx.setSession(`multi_session`, {position: `confirm`, mediaType: `photo`, fileId, caption})
    await ctx.replyPhoto(kb, da, bi)
  }

  static async showInfoConfirmVideo(ctx: BroadcastPage) {
    const video = ctx.msgVideo
    const fileId = video?.file_id
    if (!fileId) {
      return null
    }

    const caption = ctx.msgCaption?.trim()
    const bi = Base.infoConfirmVideo
    const kb = Helper.kbConfirm(ctx)
    const da = {fileId, caption}
    await ctx.setSession(`multi_session`, {position: `confirm`, mediaType: `video`, fileId, caption})
    await ctx.replyVideo(kb, da, bi)
  }
}

class Main {
  static async showStep1Form(ctx: BroadcastPage, draftText: string, isEmpty = false, edit = true) {
    if (!AdminGuard.isAdmin(ctx)) {
      return null
    }

    await ctx.setSession(`multi_session`, {position: `form`}) // multi session in 1 object for handleFreeText, handleFree*
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(bi, `cancel`), StartPage], `2`, bi)
    const da = {draftText, isEmpty}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: BroadcastPage, action: string) {
    const {draftText, mediaType, fileId, caption} = Helper.getSessionParams(ctx)
    if (action === `edit`) {
      await Main.showStep1Form(ctx, mediaType ? `-` : draftText || `-`, false, true)
    } else if (action === `send`) {
      if (!draftText && !mediaType) {
        return await Main.showStep1Form(ctx, `-`, true, true)
      }

      const subscribers = await ctx.db.listSubscribers()
      if (subscribers.length === 0) {
        return await Alert.showInfoEmptySubs(ctx)
      }

      const ids = subscribers.map((item) => item.id)
      const langs = subscribers.map((item) => item.language || `default`)
      let res: Awaited<ReturnType<typeof ctx.broadcast>>
      if (mediaType && fileId) {
        const da = {fileId, caption}
        const bi = mediaType === `photo` ? Base.infoDeliverPhoto : mediaType === `video` ? Base.infoDeliverVideo : Base.infoDeliverAnimation

        res = await ctx.broadcastMedia(ids, langs, undefined, da, bi)
      } else {
        const da = {message: draftText}
        const bi = Base.infoDeliverText
        res = await ctx.broadcast(ids, langs, undefined, da, bi)
      }

      await Alert.showSuccess(ctx, res.successCount, res.totalCount)
    } else if (action === `cancel`) {
      await Alert.showInfoCancel(ctx)
    }
  }
}

export class BroadcastPage extends PageBase {
  static data = this.buildData((step?: string, action?: string) => [step, action])

  async handleCallbackData() {
    await Main.showStep1Form(this, `-`, false, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, `-`, false, false)
  }

  async handleArgsCallbackData() {
    if (!AdminGuard.isAdmin(this)) {
      return null
    }

    const [step, action] = this.callbackDataArgs
    if (step === Base.step1) {
      await Main.processStep1Answer(this, action!)
    }
  }

  async handleFreeText() {
    if (!AdminGuard.isAdmin(this)) {
      return null
    }

    const {position} = Helper.getSessionParams(this)
    if (position === `form`) {
      await Alert.showInfoConfirmText(this)
    }
  }

  async handleFreePhoto() {
    if (!AdminGuard.isAdmin(this)) {
      return null
    }

    const {position} = Helper.getSessionParams(this)
    if (position === `form`) {
      await Alert.showInfoConfirmPhoto(this)
    }
  }

  async handleFreeVideo() {
    if (!AdminGuard.isAdmin(this)) {
      return null
    }

    const {position} = Helper.getSessionParams(this)
    if (position === `form`) {
      await Alert.showInfoConfirmVideo(this)
    }
  }

  async handleFreeAnimation() {
    if (!AdminGuard.isAdmin(this)) {
      return null
    }

    const {position} = Helper.getSessionParams(this)
    if (position === `form`) {
      await Alert.showInfoConfirmAnimation(this)
    }
  }

  static template = `
    <base id="${Base.kbHome}">
      ${this.kbk.home()}
    </base>

    <base id="${Base.kbConfirm}">
      <keyboard>✅ Send, ✏️ Edit, ${this.kbl.cancelHome.default}</keyboard>
      <keyboard lang="id">✅ Kirim, ✏️ Edit, ${this.kbl.cancelHome.id}</keyboard>
    </base>

    <base id="${Base.step1}">
      <keyboard>${this.kbl.cancelHome.default}</keyboard>
      <keyboard lang="id">${this.kbl.cancelHome.id}</keyboard>
      <message>
        📣 Broadcast Message

        {~isEmpty ? "⚠️ Message cannot be empty.\\n" : ""~}
        Current draft: {{draftText}}

        Send the announcement text now. This will be delivered to every subscriber who is currently active.
        You can also send a photo, video, or animation with an optional caption.
      </message>
      <message lang="id">
        📣 Pesan Siaran

        {~isEmpty ? "⚠️ Pesan tidak boleh kosong.\\n" : ""~}
        Draf saat ini: {{draftText}}

        Kirim teks siaran sekarang. Pesan ini akan dikirim ke semua pelanggan yang aktif.
        Anda juga dapat mengirim foto, video, atau animasi dengan caption opsional.
      </message>
    </base>

    <base id="${Base.success}">
      <message>
        🎉 Broadcast sent

        Delivered to {{successCount}}/{{totalCount}} subscribers.
        You can send another update anytime from the admin route.
      </message>
      <message lang="id">
        🎉 Siaran terkirim

        Dikirim ke {{successCount}}/{{totalCount}} pelanggan.
        Anda bisa mengirim pembaruan lagi kapan saja lewat rute admin.
      </message>
    </base>

    <base id="${Base.infoConfirmAnimation}">
      ${this.kbk.broadcastConfirm()}
      <media type="animation" src="{{fileId}}">
        🆗 Confirm broadcast animation

        caption: {{caption}}
      </media>
      <media lang="id" type="animation" src="{{fileId}}">
        🆗 Konfirmasi siaran animasi

        caption: {{caption}}
      </media>
    </base>

    <base id="${Base.infoConfirmPhoto}">
      ${this.kbk.broadcastConfirm()}
      <media type="photo" src="{{fileId}}">
        🆗 Confirm broadcast photo

        caption: {{caption}}
      </media>
      <media lang="id" type="photo" src="{{fileId}}">
        🆗 Konfirmasi siaran foto

        caption: {{caption}}
      </media>
    </base>

    <base id="${Base.infoConfirmText}">
      ${this.kbk.broadcastConfirm()}
      <message>
        🆗 Confirm broadcast text

        text: {{draftText}}

        Review the message carefully. Once sent, it will be delivered to all subscribers.
      </message>
      <message lang="id">
        🆗 Konfirmasi siaran text

        text: {{draftText}}

        Tinjau pesan dengan saksama. Setelah dikirim, pesan akan diterima oleh semua pelanggan.
      </message>
    </base>

    <base id="${Base.infoConfirmVideo}">
      ${this.kbk.broadcastConfirm()}
      <media type="video" src="{{fileId}}">
        🆗 Confirm broadcast video

        caption: {{caption}}
      </media>
      <media lang="id" type="video" src="{{fileId}}">
        🆗 Konfirmasi siaran video

        caption: {{caption}}
      </media>
    </base>

    <base id="${Base.infoEmptySubs}">
      <message>
        📭 No subscribers yet.
        There is no one to broadcast to at the moment.
      </message>
      <message lang="id">
        📭 Belum ada pelanggan.
        Belum ada penerima untuk siaran saat ini.
      </message>
    </base>

    <base id="${Base.infoCancel}">
      <message>
        ✖️ Broadcast cancelled.
        Draft discarded. You can restart the broadcast flow anytime.
      </message>
      <message lang="id">
        ✖️ Siaran dibatalkan.
        Draf dibatalkan. Anda dapat memulai siaran lagi kapan saja.
      </message>
    </base>

    <base id="${Base.infoDeliverText}">
      <message>
        {{message}}
      </message>
      <message lang="id">
        {{message}}
      </message>
    </base>

    <base id="${Base.infoDeliverPhoto}">
      <media type="photo" src="{{fileId}}">
        {{caption}}
      </media>
      <media lang="id" type="photo" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.infoDeliverVideo}">
      <media type="video" src="{{fileId}}">
        {{caption}}
      </media>
      <media lang="id" type="video" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.infoDeliverAnimation}">
      <media type="animation" src="{{fileId}}">
        {{caption}}
      </media>
      <media lang="id" type="animation" src="{{fileId}}">
        {{caption}}
      </media>
    </base>
  `
}
