import {PageBase} from "~/base/page"
import {AdminGuard} from "~/guards/admin"
import {StartPage} from "./start"

type IBroadcastSession = {
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

export class BroadcastPage extends PageBase {
  static data = this.buildData((step?: string, action?: string) => [step, action])

  async hookBeforeRoute() {
    return AdminGuard.isAdmin(this)
  }

  async handleCallbackQueryData() {
    await this.bindex.show(`-`, false)
  }

  async handleCommandText() {
    await this.bindex.show(`-`, false)
  }

  async handleSessionArgsCallbackQueryData() {
    const [step, action] = this.callbackQueryDataArgs
    if (step === Base.index && action) {
      await this.bindex.process(action)
    }
  }

  async handleSessionFreeText() {
    const draftText = this.msg!.text!.trim()
    await this.binfoConfirmText.show(draftText)
  }

  async handleSessionFreePhoto() {
    const photos = this.msg!.photo
    const lastPhoto = photos?.[photos.length - 1]
    const fileId = lastPhoto?.file_id
    if (!fileId) {
      return null
    }

    const caption = this.msg?.caption?.trim()
    await this.binfoConfirmPhoto.show(fileId, caption)
  }

  async handleSessionFreeVideo() {
    const video = this.msg!.video!
    const fileId = video?.file_id
    if (!fileId) {
      return null
    }

    const caption = this.msg?.caption?.trim()
    await this.binfoConfirmVideo.show(fileId, caption)
  }

  async handleSessionFreeAnimation() {
    const animation = this.msg!.animation!
    const fileId = animation.file_id
    if (!fileId) {
      return null
    }

    const caption = this.msg?.caption?.trim()
    await this.binfoConfirmAnimation.show(fileId, caption)
  }

  bindex = {
    show: async (draftText: string, isEmpty = false) => {
      await this.setSession([this.methodSessionFreeText(), this.methodSessionFreePhoto(), this.methodSessionFreeVideo(), this.methodSessionFreeAnimation()], {position: `form`})
      const kb = this.inlineKeyboardT([this.data.callbackQueryData(Base.index, `hybrid`), this.data.callbackQueryData(Base.index, `cancel`), StartPage], `1-2`, Base.index)
      const da = {draftText, isEmpty}
      await this.renderAuto(kb, da, Base.index)
    },
    process: async (action: string) => {
      const {position, draftText, mediaType, fileId, caption} = (this.temp.session?.params as IBroadcastSession) ?? {}
      if (position !== `confirm`) {
        return
      }

      if (action === `edit`) {
        await this.bindex.show(mediaType ? `-` : draftText || `-`, false)
      } else if (action === `send`) {
        if (!draftText && !mediaType) {
          return await this.bindex.show(`-`, true)
        }

        const subscribers = await this.db.subs.list()
        if (subscribers.length === 0) {
          return await this.binfoEmptySubs.show()
        }

        const ids = subscribers.map((item) => item.id)
        const langs = subscribers.map((item) => item.language || `default`)
        let res: Awaited<ReturnType<typeof this.renderBroadcast>>
        if (mediaType && fileId) {
          if (mediaType === `photo`) {
            res = await this.binfoDeliverPhoto.show(ids, langs, fileId, caption)
          } else if (mediaType === `video`) {
            res = await this.binfoDeliverVideo.show(ids, langs, fileId, caption)
          } else {
            res = await this.binfoDeliverAnimation.show(ids, langs, fileId, caption)
          }
        } else {
          res = await this.binfoDeliverText.show(ids, langs, draftText)
        }

        await this.bsuccess.show(res.successCount, res.totalCount)
      } else if (action === `cancel`) {
        await this.binfoCancel.show()
      } else if (action === `hybrid`) {
        await this.binfoHybridMediaNotAvailable.show()
      }
    }
  }

  binfoHybridMedia = {
    show: async () => {
      await this.setSession([this.methodSessionFreeText(), this.methodSessionFreePhoto(), this.methodSessionFreeVideo(), this.methodSessionFreeAnimation()], {position: `form`})
      const kb = this.inlineKeyboardT([this.data.callbackQueryData(Base.index, `cancel`), StartPage], `2`, Base.infoHybridMedia)
      await this.renderAuto(kb, {}, Base.infoHybridMedia)
    }
  }

  binfoHybridMediaNotAvailable = {
    show: async () => {
      await this.clearSession()
      await this.renderAuto(this.bkbHome.show(), {}, Base.infoHybridMediaNotAvailable)
    }
  }

  binfoConfirmText = {
    show: async (draftText: string) => {
      await this.setSessionArgsCallbackQueryData({position: `confirm`, draftText})
      await this.renderAuto(this.bkbConfirm.show(), {draftText}, Base.infoConfirmText)
    }
  }

  binfoConfirmPhoto = {
    show: async (fileId: string, caption?: string) => {
      await this.setSessionArgsCallbackQueryData({position: `confirm`, mediaType: `photo`, fileId, caption})
      await this.renderPhoto(this.bkbConfirm.show(), {fileId, caption}, Base.infoConfirmPhoto)
    }
  }

  binfoConfirmVideo = {
    show: async (fileId: string, caption?: string) => {
      await this.setSessionArgsCallbackQueryData({position: `confirm`, mediaType: `video`, fileId, caption})
      await this.renderVideo(this.bkbConfirm.show(), {fileId, caption}, Base.infoConfirmVideo)
    }
  }

  binfoConfirmAnimation = {
    show: async (fileId: string, caption?: string) => {
      await this.setSessionArgsCallbackQueryData({position: `confirm`, mediaType: `animation`, fileId, caption})
      await this.renderAnimation(this.bkbConfirm.show(), {fileId, caption}, Base.infoConfirmAnimation)
    }
  }

  bsuccess = {
    show: async (successCount: number, totalCount: number) => {
      await this.clearSession()
      await this.renderAuto(this.bkbHome.show(), {successCount, totalCount}, Base.success)
    }
  }

  binfoEmptySubs = {
    show: async () => {
      await this.clearSession()
      await this.renderAuto(this.bkbHome.show(), {}, Base.infoEmptySubs)
    }
  }

  binfoCancel = {
    show: async () => {
      await this.clearSession()
      await this.renderAuto(this.bkbHome.show(), {}, Base.infoCancel)
    }
  }

  bkbHome = {
    show: () => {
      return this.inlineKeyboardT([StartPage], `1`, Base.kbHome)
    }
  }

  bkbConfirm = {
    show: () => {
      const s1 = Base.index
      return this.inlineKeyboardT([this.data.callbackQueryData(s1, `send`), this.data.callbackQueryData(s1, `edit`), this.data.callbackQueryData(s1, `cancel`), StartPage], `2-2`, Base.kbConfirm)
    }
  }

  binfoDeliverText = {
    show: async (ids: number[], langs: string[], draftText?: string) => {
      return await this.renderBroadcast(ids, langs, null, {message: draftText}, Base.infoDeliverText)
    }
  }

  binfoDeliverPhoto = {
    show: async (ids: number[], langs: string[], fileId: string, caption?: string) => {
      return await this.renderBroadcastMedia(ids, langs, null, {fileId, caption}, Base.infoDeliverPhoto)
    }
  }

  binfoDeliverVideo = {
    show: async (ids: number[], langs: string[], fileId: string, caption?: string) => {
      return await this.renderBroadcastMedia(ids, langs, null, {fileId, caption}, Base.infoDeliverVideo)
    }
  }

  binfoDeliverAnimation = {
    show: async (ids: number[], langs: string[], fileId: string, caption?: string) => {
      return await this.renderBroadcastMedia(ids, langs, null, {fileId, caption}, Base.infoDeliverAnimation)
    }
  }

  static template = `
    <g-base id="${Base.kbHome}">
      ${this.kbk.home()}
    </g-base>
    <g-base id="${Base.kbConfirm}">
      <g-keyboard type="inline">✅ Send, ✏️ Edit, ${this.kbl.cancelHome.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">✅ Kirim, ✏️ Edit, ${this.kbl.cancelHome.id}</g-keyboard>
    </g-base>
    <g-base id="${Base.index}">
      <g-keyboard type="inline">📰 Hybrid Media, ${this.kbl.cancelHome.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">📰 Media Hibrid, ${this.kbl.cancelHome.id}</g-keyboard>
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
      <g-message>{{message}}</g-message>
      <g-message lang="id">{{message}}</g-message>
    </g-base>
    <g-base id="${Base.infoDeliverPhoto}">
      <g-media type="photo" src="{{fileId}}">{{caption}}</g-media>
      <g-media lang="id" type="photo" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.infoDeliverVideo}">
      <g-media type="video" src="{{fileId}}">{{caption}}</g-media>
      <g-media lang="id" type="video" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.infoDeliverAnimation}">
      <g-media type="animation" src="{{fileId}}">{{caption}}</g-media>
      <g-media lang="id" type="animation" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
  `
}
