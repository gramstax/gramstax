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

export class BroadcastPage extends PageBase {
  static data = this.buildData((action?: string) => [action])
  static BASE = {
    prompt: `prompt`,
    confirm: `confirm`,
    confirmPhoto: `confirm-photo`,
    confirmVideo: `confirm-video`,
    confirmAnimation: `confirm-animation`,
    result: `result`,
    empty: `empty`,
    cancelled: `cancelled`,
    deliver: `deliver`,
    deliverPhoto: `deliver-photo`,
    deliverVideo: `deliver-video`,
    deliverAnimation: `deliver-animation`
  }

  async callback() {
    await this.startBroadcast(true)
  }

  async textCommand() {
    await this.startBroadcast(false)
  }

  async callbackPayload() {
    const [action] = this.callbackDataPayloads
    if (!AdminGuard.isAdmin(this)) return null

    if (action === `send`) {
      return await this.handleSend()
    }
    if (action === `edit`) {
      return await this.handleEdit()
    }
    if (action === `cancel`) {
      return await this.handleCancel()
    }
    await this.startBroadcast(true)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    const {step} = this.getSessionParams()
    if (step !== `message`) return null

    const draft = this.msgText?.trim()
    if (!draft) {
      await this.sessionTextFree({step: `message`})
      return await this.reply(this.promptKeyboard(), {draft: `-`, isEmpty: true}, BroadcastPage.BASE.prompt)
    }

    await this.sessionTextFree({step: `confirm`, draft})
    await this.reply(this.confirmKeyboard(), {draft}, BroadcastPage.BASE.confirm)
  }

  async photoFree() {
    if (!this.validateSessionTextFree()) return null
    const {step} = this.getSessionParams()
    if (step !== `message`) return null

    const caption = this.msgCaption?.trim()
    if (caption?.startsWith(`/`)) return null

    const photos = this.msgPhoto
    const lastPhoto = photos?.[photos.length - 1]
    if (!lastPhoto?.file_id) return null

    await this.sessionTextFree({step: `confirm`, mediaType: `photo`, fileId: lastPhoto.file_id, caption})
    await this.replyPhoto(this.confirmKeyboard(), {fileId: lastPhoto.file_id, caption}, BroadcastPage.BASE.confirmPhoto)
  }

  async videoFree() {
    if (!this.validateSessionTextFree()) return null
    const {step} = this.getSessionParams()
    if (step !== `message`) return null

    const caption = this.msgCaption?.trim()
    if (caption?.startsWith(`/`)) return null

    const fileId = this.msgVideo?.file_id
    if (!fileId) return null

    await this.sessionTextFree({step: `confirm`, mediaType: `video`, fileId, caption})
    await this.replyVideo(this.confirmKeyboard(), {fileId, caption}, BroadcastPage.BASE.confirmVideo)
  }

  async animationFree() {
    if (!this.validateSessionTextFree()) return null
    const {step} = this.getSessionParams()
    if (step !== `message`) return null

    const caption = this.msgCaption?.trim()
    if (caption?.startsWith(`/`)) return null

    const fileId = this.msgAnimation?.file_id
    if (!fileId) return null

    await this.sessionTextFree({step: `confirm`, mediaType: `animation`, fileId, caption})
    await this.replyAnimation(this.confirmKeyboard(), {fileId, caption}, BroadcastPage.BASE.confirmAnimation)
  }

  private async handleSend() {
    const {draft, mediaType, fileId, caption} = this.getSessionParams()
    if (!draft && !mediaType) {
      await this.sessionTextFree({step: `message`})
      return await this.edit(this.promptKeyboard(), {draft: `-`, isEmpty: true}, BroadcastPage.BASE.prompt)
    }

    const subscribers = await this.db.listSubscribers()
    if (subscribers.length === 0) {
      await this.sessionClear()
      const kb = this.inlineKeyboardT([StartPage])
      return await this.edit(kb, {}, BroadcastPage.BASE.empty)
    }

    const ids = subscribers.map((item) => item.id)
    const langs = subscribers.map((item) => item.language || `default`)
    if (mediaType && fileId) {
      const deliverBase = this.getDeliverMediaBase(mediaType)
      await this.broadcastMedia(ids, langs, undefined, {fileId, caption}, deliverBase)
    } else {
      await this.broadcast(ids, langs, undefined, {message: draft}, BroadcastPage.BASE.deliver)
    }
    await this.sessionClear()

    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, {count: subscribers.length}, BroadcastPage.BASE.result)
  }

  private async handleEdit() {
    const {draft, mediaType} = this.getSessionParams()
    if (mediaType) {
      await this.sessionTextFree({step: `message`})
      await this.edit(this.promptKeyboard(), {draft: `-`, isEmpty: false}, BroadcastPage.BASE.prompt)
      return
    }

    await this.sessionTextFree({step: `message`, draft})
    await this.edit(this.promptKeyboard(), {draft: draft || `-`, isEmpty: false}, BroadcastPage.BASE.prompt)
  }

  private async handleCancel() {
    await this.sessionClear()
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, {}, BroadcastPage.BASE.cancelled)
  }

  private async startBroadcast(edit: boolean) {
    if (!AdminGuard.isAdmin(this)) return null
    await this.sessionTextFree({step: `message`})
    const kb = this.promptKeyboard()
    if (edit) await this.edit(kb, {draft: `-`, isEmpty: false}, BroadcastPage.BASE.prompt)
    else await this.reply(kb, {draft: `-`, isEmpty: false}, BroadcastPage.BASE.prompt)
  }

  private promptKeyboard() {
    return this.inlineKeyboardT([this.data.callback(`cancel`), StartPage], `2`, BroadcastPage.BASE.prompt)
  }

  private confirmKeyboard() {
    return this.inlineKeyboardT([this.data.callback(`send`), this.data.callback(`edit`), this.data.callback(`cancel`), StartPage], `2-2`, BroadcastPage.BASE.confirm)
  }

  private getSessionParams() {
    return (this.session?.params as BroadcastSession | undefined) ?? {}
  }

  private getDeliverMediaBase(mediaType: BroadcastSession[`mediaType`]) {
    if (mediaType === `photo`) return BroadcastPage.BASE.deliverPhoto
    if (mediaType === `video`) return BroadcastPage.BASE.deliverVideo
    return BroadcastPage.BASE.deliverAnimation
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
