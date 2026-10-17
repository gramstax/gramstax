import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `i`
  static ftext = `f-text`
  static fphoto = `f-photo`
  static fvideo = `f-video`
  static faudio = `f-audio`
  static fdocument = `f-document`
  static fanimation = `f-animation`
  static fvoice = `f-voice`
  static fvideoNote = `f-video_note`
  static fsticker = `f-sticker`
  static flocation = `f-location`
  static fcontact = `f-contact`
}

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleFreeText() {
    await this.gftext.show()
  }

  async handleFreePhoto() {
    await this.gfphoto.show()
  }

  async handleFreeVideo() {
    await this.gfvideo.show()
  }

  async handleFreeAudio() {
    await this.gfaudio.show()
  }

  async handleFreeDocument() {
    await this.gfdocument.show()
  }

  async handleFreeAnimation() {
    await this.gfanimation.show()
  }

  async handleFreeVoice() {
    await this.gfvoice.show()
  }

  async handleFreeVideoNote() {
    await this.gfvideoNote.show()
  }

  async handleFreeSticker() {
    await this.gfsticker.show()
  }

  async handleFreeLocation() {
    await this.gflocation.show()
  }

  async handleFreeContact() {
    await this.gfcontact.show()
  }

  helper = {
    indexKeyboard: () => this.inlineKeyboardT([StartPage], `1`, Base.index)
  }
  gindex = {
    show: async () => {
      await this.renderText({AGBaseId: Base.index, keyboard: this.helper.indexKeyboard()})
    },
    process: () => {}
  }
  gftext = {
    show: async () => {
      const text = this.msg!.text!
      if (text.startsWith(`/`)) {
        return null
      }

      await this.renderText({AGBaseId: Base.ftext, keyboard: this.helper.indexKeyboard(), data: {text}})
    },
    process: () => {}
  }
  gfphoto = {
    show: async () => {
      const caption = this.msg?.caption
      const photos = this.msg!.photo!
      const fileIdLargest = photos[photos.length - 1]!.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      await this.renderPhoto({AGBaseId: Base.fphoto, keyboard: this.helper.indexKeyboard(), data: {caption, fileId: fileIdLargest}})
    },
    process: () => {}
  }
  gfvideo = {
    show: async () => {
      const caption = this.msg?.caption
      const fileId = this.msg!.video!.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      await this.renderVideo({AGBaseId: Base.fvideo, keyboard: this.helper.indexKeyboard(), data: {caption, fileId}})
    },
    process: () => {}
  }
  gfaudio = {
    show: async () => {
      const caption = this.msg?.caption
      const fileId = this.msg!.audio!.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      await this.renderAudio({AGBaseId: Base.faudio, keyboard: this.helper.indexKeyboard(), data: {caption, fileId}})
    },
    process: () => {}
  }
  gfdocument = {
    show: async () => {
      const caption = this.msg?.caption
      const fileId = this.msg!.document!.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      await this.renderDocument({AGBaseId: Base.fdocument, keyboard: this.helper.indexKeyboard(), data: {caption, fileId}})
    },
    process: () => {}
  }
  gfanimation = {
    show: async () => {
      const caption = this.msg?.caption
      const fileId = this.msg!.animation!.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      await this.renderAnimation({AGBaseId: Base.fanimation, keyboard: this.helper.indexKeyboard(), data: {caption, fileId}})
    },
    process: () => {}
  }
  gfvoice = {
    show: async () => {
      const caption = this.msg?.caption
      const fileId = this.msg!.voice!.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      await this.renderVoice({AGBaseId: Base.fvoice, keyboard: this.helper.indexKeyboard(), data: {caption, fileId}})
    },
    process: () => {}
  }
  gfvideoNote = {
    show: async () => {
      // not support caption
      const fileId = this.msg!.video_note!.file_id
      await this.renderVideoNote({AGBaseId: Base.fvideoNote, keyboard: this.helper.indexKeyboard(), data: {fileId}})
    },
    process: () => {}
  }
  gfsticker = {
    show: async () => {
      // not support caption
      const fileId = this.msg!.sticker!.file_id
      await this.renderSticker({AGBaseId: Base.fsticker, keyboard: this.helper.indexKeyboard(), data: {fileId}})
    },
    process: () => {}
  }
  gflocation = {
    show: async () => {
      // not support caption
      const {latitude, longitude} = this.msg!.location!
      await this.renderLocation({AGBaseId: Base.flocation, keyboard: this.helper.indexKeyboard(), data: {latitude, longitude}})
    },
    process: () => {}
  }
  gfcontact = {
    show: async () => {
      // not support caption
      const {first_name, last_name, phone_number, user_id, vcard} = this.msg!.contact!
      await this.renderContact({AGBaseId: Base.fcontact, keyboard: this.helper.indexKeyboard(), data: {first_name, last_name, phone_number, user_id, vcard}})
    },
    process: () => {}
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.home()}
      <g-message>
        🔁 Echo Tips

        Send any message or media and the bot will echo it back. Use this to test formatting, media handling, or message flow.
      </g-message>
      <g-message lang="id">
        🔁 Tips Echo

        Kirim pesan atau media dan bot akan menggema. Gunakan ini untuk menguji format, penanganan media, atau alur pesan.
      </g-message>
    </g-base>
    <g-base id="${Base.ftext}">
      <g-message>{{text}}</g-message>
    </g-base>
    <g-base id="${Base.fphoto}">
      <g-media type="photo" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.fvideo}">
      <g-media type="video" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.faudio}">
      <g-media type="audio" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.fdocument}">
      <g-media type="document" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.fanimation}">
      <g-media type="animation" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.fvoice}">
      <g-media type="voice" src="{{fileId}}">{{caption}}</g-media>
    </g-base>
    <g-base id="${Base.fvideoNote}">
      <g-media type="video_note" src="{{fileId}}"></g-media>
    </g-base>
    <g-base id="${Base.fsticker}">
      <g-media type="sticker" src="{{fileId}}"></g-media>
    </g-base>
    <g-base id="${Base.flocation}">
      <g-media type="location" latitude="{{latitude}}" longitude="{{longitude}}"></g-media>
    </g-base>
    <g-base id="${Base.fcontact}">
      <g-media type="contact" phone="{{phone_number}}" first_name="{{first_name}}" last_name="{{last_name}}" vcard="{{vcard}}"></g-media>
    </g-base>
  `
}
