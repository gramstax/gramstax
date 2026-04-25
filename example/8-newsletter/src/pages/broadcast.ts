import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {AdminGuard} from "~/guards/admin"

type BroadcastSession = {
  step?: `message` | `confirm`
  draft?: string
  fileId?: string
  caption?: string
  mediaType?: `photo` | `video` | `animation`
}

class Base {
  static step1Form = `s1-form`
  static confirm = `confirm`
  static confirmPhoto = `confirm-photo`
  static confirmVideo = `confirm-video`
  static confirmAnimation = `confirm-animation`
  static result = `result`
  static empty = `empty`
  static cancel = `cancel`
  static deliver = `deliver`
  static deliverPhoto = `deliver-photo`
  static deliverVideo = `deliver-video`
  static deliverAnimation = `deliver-animation`
}

class Helper {
  static promptKb(ctx: BroadcastPage) {
    return ctx.inlineKeyboardT([BroadcastPage.data.callbackData(`cancel`), StartPage], `2`, Base.step1Form)
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
    if (mediaType === `photo`) {
      return Base.deliverPhoto
    } else if (mediaType === `video`) {
      return Base.deliverVideo
    } else {
      return Base.deliverAnimation
    }
  }

  static async replyConfirmMedia(ctx: BroadcastPage, mediaType: NonNullable<BroadcastSession[`mediaType`]>, fileId: string, caption?: string) {
    const kb = Helper.confirmKb(ctx)
    const data = {fileId, caption}

    if (mediaType === `photo`) {
      await ctx.replyPhoto(kb, data, Base.confirmPhoto)
    } else if (mediaType === `video`) {
      await ctx.replyVideo(kb, data, Base.confirmVideo)
    } else {
      await ctx.replyAnimation(kb, data, Base.confirmAnimation)
    }
  }
}

class Alert {
  static async infoEmptyDraft(ctx: BroadcastPage, edit = false) {
    await ctx.sessionFreeText({step: `message`})
    const kb = Helper.promptKb(ctx)
    const da = {draft: `-`, isEmpty: true}
    const bi = Base.step1Form
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async result(ctx: BroadcastPage, count: number) {
    const bi = Base.result
    const kb = Helper.homeKb(ctx)
    const da = {count}
    await ctx.edit(kb, da, bi)
  }

  static async emptySubscribers(ctx: BroadcastPage) {
    await ctx.clearSession()
    const bi = Base.empty
    const kb = Helper.homeKb(ctx)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

class Flow {
  static async step1Form(ctx: BroadcastPage, draft: string, edit = true) {
    if (!AdminGuard.isAdmin(ctx)) {
      return null
    }

    await ctx.sessionFreeText({step: `message`})
    const kb = Helper.promptKb(ctx)
    const da = {draft, isEmpty: false}
    const bi = Base.step1Form
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async step1Answer(ctx: BroadcastPage) {
    console.log(ctx)
    //
  }

  static async confirm(ctx: BroadcastPage, draft: string) {
    await ctx.sessionFreeText({step: `confirm`, draft})
    const bi = Base.confirm
    const kb = Helper.confirmKb(ctx)
    const da = {draft}
    await ctx.reply(kb, da, bi)
  }

  static async freeText(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) {
      return null
    }

    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) {
      return null
    }

    const draft = ctx.msgText?.trim()
    if (!draft) {
      await Alert.infoEmptyDraft(ctx)
    } else {
      await Flow.confirm(ctx, draft)
    }
  }

  static async freePhoto(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) {
      return null
    }

    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) {
      return null
    }

    const caption = ctx.msgCaption?.trim()
    if (caption?.startsWith(`/`)) {
      return null
    }

    const photos = ctx.msgPhoto
    const lastPhoto = photos?.[photos.length - 1]
    if (!lastPhoto?.file_id) {
      return null
    }

    await ctx.sessionFreeText({step: `confirm`, mediaType: `photo`, fileId: lastPhoto.file_id, caption})
    await Helper.replyConfirmMedia(ctx, `photo`, lastPhoto.file_id, caption)
  }

  static async freeVideo(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) {
      return null
    }

    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) {
      return null
    }

    const caption = ctx.msgCaption?.trim()
    if (caption?.startsWith(`/`)) {
      return null
    }

    const fileId = ctx.msgVideo?.file_id
    if (!fileId) {
      return null
    }

    await ctx.sessionFreeText({step: `confirm`, mediaType: `video`, fileId, caption})
    await Helper.replyConfirmMedia(ctx, `video`, fileId, caption)
  }

  static async freeAnimation(ctx: BroadcastPage) {
    if (!ctx.isSessionFreeText()) {
      return null
    }

    const {step} = Helper.sessionParams(ctx)
    if (step !== `message`) {
      return null
    }

    const caption = ctx.msgCaption?.trim()
    if (caption?.startsWith(`/`)) {
      return null
    }

    const fileId = ctx.msgAnimation?.file_id
    if (!fileId) {
      return null
    }

    await ctx.sessionFreeText({step: `confirm`, mediaType: `animation`, fileId, caption})
    await Helper.replyConfirmMedia(ctx, `animation`, fileId, caption)
  }
}

class Perform {
  static async actionEdit(ctx: BroadcastPage) {
    const {draft, mediaType} = Helper.sessionParams(ctx)
    await Flow.step1Form(ctx, mediaType ? `-` : draft || `-`, true)
  }

  static async actionSend(ctx: BroadcastPage) {
    const {draft, mediaType, fileId, caption} = Helper.sessionParams(ctx)
    if (!draft && !mediaType) {
      return await Alert.infoEmptyDraft(ctx, true)
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

  static async actionCancel(ctx: BroadcastPage) {
    await ctx.clearSession()
    const bi = Base.cancel
    const kb = Helper.homeKb(ctx)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

export class BroadcastPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

  async handleCallbackData() {
    await Flow.step1Form(this, `-`, true)
  }

  async handleCommandText() {
    await Flow.step1Form(this, `-`, false)
  }

  async handleArgsCallbackData() {
    if (!AdminGuard.isAdmin(this)) {
      return null
    }

    const [action] = this.callbackDataArgs
    if (action === `send`) {
      return await Perform.actionSend(this)
    } else if (action === `edit`) {
      return await Perform.actionEdit(this)
    } else if (action === `cancel`) {
      return await Perform.actionCancel(this)
    } else {
      await Flow.step1Form(this, `-`, true)
    }
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

  static template = `
    <base>
      ${this.kbk.home()}
    </base>

    <base id="${Base.step1Form}">
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

    <base id="${Base.confirm}">
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

    <base id="${Base.confirmPhoto}">
      <media type="photo" src="{{fileId}}">
        ✅ Confirm broadcast media

        {{caption}}
      </media>
      <media lang="id" type="photo" src="{{fileId}}">
        ✅ Konfirmasi siaran media

        {{caption}}
      </media>
    </base>

    <base id="${Base.confirmVideo}">
      <media type="video" src="{{fileId}}">
        ✅ Confirm broadcast media

        {{caption}}
      </media>
      <media lang="id" type="video" src="{{fileId}}">
        ✅ Konfirmasi siaran media

        {{caption}}
      </media>
    </base>

    <base id="${Base.confirmAnimation}">
      <media type="animation" src="{{fileId}}">
        ✅ Confirm broadcast media

        {{caption}}
      </media>
      <media lang="id" type="animation" src="{{fileId}}">
        ✅ Konfirmasi siaran media

        {{caption}}
      </media>
    </base>

    <base id="${Base.result}">
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

    <base id="${Base.empty}">
      <message>
        📭 No subscribers yet.
        There is no one to broadcast to at the moment.
      </message>
      <message lang="id">
        📭 Belum ada pelanggan.
        Belum ada penerima untuk siaran saat ini.
      </message>
    </base>

    <base id="${Base.cancel}">
      <message>
        ✖️ Broadcast cancelled.
        Draft discarded. You can restart the broadcast flow anytime.
      </message>
      <message lang="id">
        ✖️ Siaran dibatalkan.
        Draf dibatalkan. Anda dapat memulai siaran lagi kapan saja.
      </message>
    </base>

    <base id="${Base.deliver}">
      <message>
        📣 {{message}}
      </message>
      <message lang="id">
        📣 {{message}}
      </message>
    </base>

    <base id="${Base.deliverPhoto}">
      <media type="photo" src="{{fileId}}">
        📣 Broadcast update

        {{caption}}
      </media>
      <media lang="id" type="photo" src="{{fileId}}">
        📣 Pembaruan siaran

        {{caption}}
      </media>
    </base>

    <base id="${Base.deliverVideo}">
      <media type="video" src="{{fileId}}">
        📣 Broadcast update

        {{caption}}
      </media>
      <media lang="id" type="video" src="{{fileId}}">
        📣 Pembaruan siaran

        {{caption}}
      </media>
    </base>

    <base id="${Base.deliverAnimation}">
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
