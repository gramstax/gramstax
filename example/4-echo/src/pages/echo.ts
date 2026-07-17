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

class Helper {
  static kbIndex(ctx: EchoPage) {
    return ctx.inlineKeyboardT([StartPage], `1`, Base.index)
  }
}

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  async handleCallbackData() {
    await this.bindex.show()
  }

  async handleFreeText() {
    await this.bftext.show()
  }

  async handleFreePhoto() {
    await this.bfphoto.show()
  }

  async handleFreeVideo() {
    await this.bfvideo.show()
  }

  async handleFreeAudio() {
    await this.bfaudio.show()
  }

  async handleFreeDocument() {
    await this.bfdocument.show()
  }

  async handleFreeAnimation() {
    await this.bfanimation.show()
  }

  async handleFreeVoice() {
    await this.bfvoice.show()
  }

  async handleFreeVideoNote() {
    await this.bfvideoNote.show()
  }

  async handleFreeSticker() {
    await this.bfsticker.show()
  }

  async handleFreeLocation() {
    await this.bflocation.show()
  }

  async handleFreeContact() {
    await this.bfcontact.show()
  }

  bindex = {
    show: async () => {
      const bi = Base.index
      const kb = Helper.kbIndex(this)
      const da = {}
      await this.edit(kb, da, bi)
    }
  }
  bftext = {
    show: async () => {
      const text = this.msgText
      if (text.startsWith(`/`)) {
        return null
      }

      const kb = Helper.kbIndex(this)
      const da = {text}
      const bi = Base.ftext
      await this.reply(kb, da, bi)
    }
  }
  bfphoto = {
    show: async () => {
      const caption = this.msgCaption
      const fileIdLargest = this.msgPhoto[this.msgPhoto.length - 1].file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      const kb = Helper.kbIndex(this)
      const da = {caption, fileId: fileIdLargest}
      const bi = Base.fphoto
      await this.replyPhoto(kb, da, bi)
    }
  }
  bfvideo = {
    show: async () => {
      const caption = this.msgCaption
      const fileId = this.msgVideo.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      const kb = Helper.kbIndex(this)
      const da = {caption, fileId}
      const bi = Base.fvideo
      await this.replyVideo(kb, da, bi)
    }
  }
  bfaudio = {
    show: async () => {
      const caption = this.msgCaption
      const fileId = this.msgAudio.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      const kb = Helper.kbIndex(this)
      const da = {caption, fileId}
      const bi = Base.faudio
      await this.replyAudio(kb, da, bi)
    }
  }
  bfdocument = {
    show: async () => {
      const caption = this.msgCaption
      const fileId = this.msgDocument.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      const kb = Helper.kbIndex(this)
      const da = {caption, fileId}
      const bi = Base.fdocument
      await this.replyDocument(kb, da, bi)
    }
  }
  bfanimation = {
    show: async () => {
      const caption = this.msgCaption
      const fileId = this.msgAnimation.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      const kb = Helper.kbIndex(this)
      const da = {caption, fileId}
      const bi = Base.fanimation
      await this.replyAnimation(kb, da, bi)
    }
  }
  bfvoice = {
    show: async () => {
      const caption = this.msgCaption
      const fileId = this.msgVoice.file_id
      if (caption?.startsWith(`/`)) {
        return null
      }

      const kb = Helper.kbIndex(this)
      const da = {caption, fileId}
      const bi = Base.fvoice
      await this.replyVoice(kb, da, bi)
    }
  }
  bfvideoNote = {
    show: async () => {
      // not support caption
      const fileId = this.msgVideoNote.file_id
      const kb = Helper.kbIndex(this)
      const da = {fileId}
      const bi = Base.fvideoNote
      await this.replyVideoNote(kb, da, bi)
    }
  }
  bfsticker = {
    show: async () => {
      // not support caption
      const fileId = this.msgSticker.file_id
      const kb = Helper.kbIndex(this)
      const da = {fileId}
      const bi = Base.fsticker
      await this.replySticker(kb, da, bi)
    }
  }
  bflocation = {
    show: async () => {
      // not support caption
      const {latitude, longitude} = this.msgLocation
      const kb = Helper.kbIndex(this)
      const da = {latitude, longitude}
      const bi = Base.flocation
      await this.replyLocation(kb, da, bi)
    }
  }
  bfcontact = {
    show: async () => {
      // not support caption
      const {first_name, last_name, phone_number, user_id, vcard} = this.msgContact
      const kb = Helper.kbIndex(this)
      const da = {first_name, last_name, phone_number, user_id, vcard}
      const bi = Base.fcontact
      await this.replyContact(kb, da, bi)
    }
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
