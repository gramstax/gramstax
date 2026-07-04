import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {AdminGuard} from "~/guards/admin"

type BroadcastSession = {
  draftText?: string
  fileId?: string
  caption?: string
  mediaType?: `photo` | `video` | `animation`
  position?: `form` | `confirm`
  isHybridMedia?: `1` | `0`
}

class Base {
  static index = `i`
  static infoHybridMedia = `i-hybrid-media`
  static infoHybridMediaNotAvailable = `i-hybrid-media-not-available`
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
    const s1 = Base.index
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(s1, `send`), ctx.data.callbackData(s1, `edit`), ctx.data.callbackData(s1, `cancel`), StartPage], `2-2`, bi)
    return kb
  }

  static kbHome(ctx: BroadcastPage) {
    const bi = Base.kbHome
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    return kb
  }

  static getSessionParams(ctx: BroadcastPage) {
    return (ctx.temp.session?.params as BroadcastSession) ?? {}
  }
}

class Main {
  static async showStep1Form(ctx: BroadcastPage, draftText: string, isEmpty = false, edit = true) {
    await ctx.setSession([ctx.methodSessionFreeText(), ctx.methodSessionFreePhoto(), ctx.methodSessionFreeVideo(), ctx.methodSessionFreeAnimation()], {position: `form`})
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(bi, `hybrid`), ctx.data.callbackData(bi, `cancel`), StartPage], `1-2`, bi)
    const da = {draftText, isEmpty}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Form(ctx: BroadcastPage, action: string) {
    const {position, draftText, mediaType, fileId, caption} = Helper.getSessionParams(ctx)
    if (position !== `confirm`) {
      return
    }

    if (action === `edit`) {
      await Main.showStep1Form(ctx, mediaType ? `-` : draftText || `-`, false, true)
    } else if (action === `send`) {
      if (!draftText && !mediaType) {
        return await Main.showStep1Form(ctx, `-`, true, true)
      }

      const subscribers = await ctx.db.subs.list()
      if (subscribers.length === 0) {
        return await Main.showInfoEmptySubs(ctx)
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

      await Main.showSuccess(ctx, res.successCount, res.totalCount)
    } else if (action === `cancel`) {
      await Main.showInfoCancel(ctx)
    } else if (action === `hybrid`) {
      await Main.showInfoHybridMediaNotAvailable(ctx)
    }
  }

  static async showInfoHybridMedia(ctx: BroadcastPage) {
    await ctx.setSession([ctx.methodSessionFreeText(), ctx.methodSessionFreePhoto(), ctx.methodSessionFreeVideo(), ctx.methodSessionFreeAnimation()], {position: `form`})
    const bi = Base.infoHybridMedia
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(bi, `cancel`), StartPage], `2`, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async showInfoHybridMediaNotAvailable(ctx: BroadcastPage) {
    await ctx.clearSession()
    const bi = Base.infoHybridMediaNotAvailable
    const kb = Helper.kbHome(ctx)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

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
    await ctx.setSessionArgsCallbackData({position: `confirm`, draftText})
    await ctx.reply(kb, da, bi)
  }

  static async showInfoConfirmAnimation(ctx: BroadcastPage) {
    const animation = ctx.msgAnimation
    const fileId = animation.file_id
    if (!fileId) {
      return null
    }

    const caption = ctx.msgCaption?.trim()
    const bi = Base.infoConfirmAnimation
    const kb = Helper.kbConfirm(ctx)
    const da = {fileId, caption}
    await ctx.setSessionArgsCallbackData({position: `confirm`, mediaType: `animation`, fileId, caption})
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
    await ctx.setSessionArgsCallbackData({position: `confirm`, mediaType: `photo`, fileId, caption})
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
    await ctx.setSessionArgsCallbackData({position: `confirm`, mediaType: `video`, fileId, caption})
    await ctx.replyVideo(kb, da, bi)
  }
}

export class BroadcastPage extends PageBase {
  static data = this.buildData((step?: string, action?: string) => [step, action])

  async hookBeforeRoute() {
    return AdminGuard.isAdmin(this)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, `-`, false, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, `-`, false, false)
  }

  async handleSessionArgsCallbackData() {
    const [step, action] = this.callbackDataArgs
    if (step === Base.index) {
      await Main.processStep1Form(this, action!)
    }
  }

  async handleSessionFreeText() {
    await Main.showInfoConfirmText(this)
  }

  async handleSessionFreePhoto() {
    await Main.showInfoConfirmPhoto(this)
  }

  async handleSessionFreeVideo() {
    await Main.showInfoConfirmVideo(this)
  }

  async handleSessionFreeAnimation() {
    await Main.showInfoConfirmAnimation(this)
  }

  static template = `
    <g-base id="${Base.kbHome}">
      ${this.kbk.home()}
    </g-base>

    <g-base id="${Base.kbConfirm}">
      <g-keyboard>✅ Send, ✏️ Edit, ${this.kbl.cancelHome.default}</g-keyboard>
      <g-keyboard lang="id">✅ Kirim, ✏️ Edit, ${this.kbl.cancelHome.id}</g-keyboard>
    </g-base>

    <g-base id="${Base.index}">
      <g-keyboard>📰 Hybrid Media, ${this.kbl.cancelHome.default}</g-keyboard>
      <g-keyboard lang="id">📰 Media Hibrid, ${this.kbl.cancelHome.id}</g-keyboard>
      <g-message>
        📣 Broadcast Message

        {~isEmpty ? "⚠️ Message cannot be empty.\\n" : ""~}
        Current draft: {{draftText}}

        Send the announcement text now. This will be delivered to every subscriber who is currently active.
        You can also send a photo, video, or animation with an optional caption.
      </g-message>
      <g-message lang="id">
        📣 Pesan Siaran

        {~isEmpty ? "⚠️ Pesan tidak boleh kosong.\\n" : ""~}
        Draf saat ini: {{draftText}}

        Kirim teks siaran sekarang. Pesan ini akan dikirim ke semua pelanggan yang aktif.
        Anda juga dapat mengirim foto, video, atau animasi dengan caption opsional.
      </g-message>
    </g-base>

    <g-base id="${Base.infoHybridMedia}">
      ${this.kbk.cancelHome()}
      <g-message>
        📣 Broadcast Message With Bundle Media Hybrid

        {~isEmpty ? "⚠️ Message cannot be empty.\\n" : ""~}
        Current draft: {{draftText}}

        Send the announcement media now. This will be delivered to every subscriber who is currently active.
        Onlt can send a photo, video, or animation with an optional caption.
        You can send mix foto, video and animation.
      </g-message>
      <g-message lang="id">
        📣 Pesan Siaran Dengan Bandle Media Hibrid

        {~isEmpty ? "⚠️ Pesan tidak boleh kosong.\\n" : ""~}
        Draf saat ini: {{draftText}}

        Kirim media siaran sekarang. Pesan ini akan dikirim ke semua pelanggan yang aktif.
        Hanya dapat mengirim foto, video, atau animasi dengan caption opsional.
        Anda dapat mengirim campuran foto, video dan animasi.
      </g-message>
    </g-base>

    <g-base id="${Base.infoHybridMediaNotAvailable}">
      <g-message>
        Bundle media hybrid for now not available.
      </g-message>
      <g-message lang="id">
        Bandel media hibrid untuk sekarang tidak terseda.
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      <g-message>
        🎉 Broadcast sent

        Delivered to {{successCount}}/{{totalCount}} subscribers.
        You can send another update anytime from the admin route.
      </g-message>
      <g-message lang="id">
        🎉 Siaran terkirim

        Dikirim ke {{successCount}}/{{totalCount}} pelanggan.
        Anda bisa mengirim pembaruan lagi kapan saja lewat rute admin.
      </g-message>
    </g-base>

    <g-base id="${Base.infoConfirmAnimation}">
      ${this.kbk.broadcastConfirm()}
      <g-media type="animation" src="{{fileId}}">
        🆗 Confirm broadcast animation

        caption: {{caption}}
      </g-media>
      <g-media lang="id" type="animation" src="{{fileId}}">
        🆗 Konfirmasi siaran animasi

        caption: {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.infoConfirmPhoto}">
      ${this.kbk.broadcastConfirm()}
      <g-media type="photo" src="{{fileId}}">
        🆗 Confirm broadcast photo

        caption: {{caption}}
      </g-media>
      <g-media lang="id" type="photo" src="{{fileId}}">
        🆗 Konfirmasi siaran foto

        caption: {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.infoConfirmText}">
      ${this.kbk.broadcastConfirm()}
      <g-message>
        🆗 Confirm broadcast text

        text: {{draftText}}

        Review the message carefully. Once sent, it will be delivered to all subscribers.
      </g-message>
      <g-message lang="id">
        🆗 Konfirmasi siaran text

        text: {{draftText}}

        Tinjau pesan dengan saksama. Setelah dikirim, pesan akan diterima oleh semua pelanggan.
      </g-message>
    </g-base>

    <g-base id="${Base.infoConfirmVideo}">
      ${this.kbk.broadcastConfirm()}
      <g-media type="video" src="{{fileId}}">
        🆗 Confirm broadcast video

        caption: {{caption}}
      </g-media>
      <g-media lang="id" type="video" src="{{fileId}}">
        🆗 Konfirmasi siaran video

        caption: {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.infoEmptySubs}">
      <g-message>
        📭 No subscribers yet.
        There is no one to broadcast to at the moment.
      </g-message>
      <g-message lang="id">
        📭 Belum ada pelanggan.
        Belum ada penerima untuk siaran saat ini.
      </g-message>
    </g-base>

    <g-base id="${Base.infoCancel}">
      <g-message>
        ✖️ Broadcast cancelled.
        Draft discarded. You can restart the broadcast flow anytime.
      </g-message>
      <g-message lang="id">
        ✖️ Siaran dibatalkan.
        Draf dibatalkan. Anda dapat memulai siaran lagi kapan saja.
      </g-message>
    </g-base>

    <g-base id="${Base.infoDeliverText}">
      <g-message>
        {{message}}
      </g-message>
      <g-message lang="id">
        {{message}}
      </g-message>
    </g-base>

    <g-base id="${Base.infoDeliverPhoto}">
      <g-media type="photo" src="{{fileId}}">
        {{caption}}
      </g-media>
      <g-media lang="id" type="photo" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.infoDeliverVideo}">
      <g-media type="video" src="{{fileId}}">
        {{caption}}
      </g-media>
      <g-media lang="id" type="video" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.infoDeliverAnimation}">
      <g-media type="animation" src="{{fileId}}">
        {{caption}}
      </g-media>
      <g-media lang="id" type="animation" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>
  `
}
