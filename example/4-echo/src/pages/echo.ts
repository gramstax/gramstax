import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  kb(baseId?: string) {
    return this.inlineKeyboard(
      (k, a) => {
        return k.text(a[0]!, StartPage.data.callback())
      },
      {baseId}
    )
  }

  // Inline button to show echo usage tips.
  async callback() {
    const kb = this.kb()
    await this.edit(kb)
  }

  // Catch-all for text inputs that are not matched by other pages.
  async textFree() {
    const text = this.msgText
    if (text.startsWith(`/`)) {
      return null
    }

    const bi = `echo-result-text`
    const kb = this.kb(bi)
    const data = {text}
    await this.reply(kb, data, bi)
  }

  async photoFree() {
    const caption = this.msgCaption
    const fileIdLargest = this.msgPhoto[this.msgPhoto.length - 1].file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const bi = `echo-result-photo`
    const kb = this.kb(bi)
    const data = {caption, fileId: fileIdLargest}
    await this.replyPhoto(kb, data, bi)
  }

  async videoFree() {
    const caption = this.msgCaption
    const fileId = this.msgVideo.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const bi = `echo-result-video`
    const kb = this.kb(bi)
    const data = {caption, fileId}
    await this.replyVideo(kb, data, bi)
  }

  async audioFree() {
    const caption = this.msgCaption
    const fileId = this.msgAudio.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const bi = `echo-result-audio`
    const kb = this.kb(bi)
    const data = {caption, fileId}
    await this.replyAudio(kb, data, bi)
  }

  async documentFree() {
    const caption = this.msgCaption
    const fileId = this.msgDocument.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const bi = `echo-result-document`
    const kb = this.kb(bi)
    const data = {caption, fileId}
    await this.replyDocument(kb, data, bi)
  }

  async animationFree() {
    const caption = this.msgCaption
    const fileId = this.msgAnimation.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const bi = `echo-result-animation`
    const kb = this.kb(bi)
    const data = {caption, fileId}
    await this.replyAnimation(kb, data, bi)
  }

  async voiceFree() {
    const caption = this.msgCaption
    const fileId = this.msgVoice.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const bi = `echo-result-voice`
    const kb = this.kb(bi)
    const data = {caption, fileId}
    await this.replyVoice(kb, data, bi)
  }

  async videoNoteFree() {
    // not support caption
    const fileId = this.msgVideoNote.file_id
    const bi = `echo-result-video_note`
    const kb = this.kb(bi)
    const data = {fileId}
    await this.replyVideoNote(kb, data, bi)
  }

  async stickerFree() {
    // not support caption
    const fileId = this.msgSticker.file_id
    const bi = `echo-result-sticker`
    const kb = this.kb(bi)
    const data = {fileId}
    await this.replySticker(kb, data, bi)
  }

  async locationFree() {
    // not support caption
    const {latitude, longitude} = this.msgLocation
    const bi = `echo-result-location`
    const kb = this.kb(bi)
    const data = {latitude, longitude}
    await this.replyLocation(kb, data, bi)
  }

  async contactFree() {
    // not support caption
    const {first_name, last_name, phone_number, user_id, vcard} = this.msgContact
    const bi = `echo-result-contact`
    const kb = this.kb(bi)
    const data = {first_name, last_name, phone_number, user_id, vcard}
    await this.replyContact(kb, data, bi)
  }

  static template = `
    <base>
      ${this.kbk.back(`default`)}
      <message>
        Echo Tips:
        - Send any message
        - The bot repeats the same message
      </message>
    </base>

    <base id="echo-result-text">
      ${this.kbk.home(`default`)}
      <message>
        Echo: {{text}}
      </message>
    </base>

    <base id="echo-result-photo">
      ${this.kbk.home(`default`)}
      <media type="photo" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="echo-result-video">
      ${this.kbk.home(`default`)}
      <media type="video" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="echo-result-audio">
      ${this.kbk.home(`default`)}
      <media type="audio" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="echo-result-document">
      ${this.kbk.home(`default`)}
      <media type="document" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="echo-result-animation">
      ${this.kbk.home(`default`)}
      <media type="animation" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="echo-result-voice">
      ${this.kbk.home(`default`)}
      <media type="voice" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="echo-result-video_note">
      ${this.kbk.home(`default`)}
      <media type="video_note" src="{{fileId}}"></media>
    </base>

    <base id="echo-result-sticker">
      ${this.kbk.home(`default`)}
      <media type="sticker" src="{{fileId}}"></media>
    </base>

    <base id="echo-result-location">
      ${this.kbk.home(`default`)}
      <media type="location" latitude="{{latitude}}" longitude="{{longitude}}"></media>
    </base>

    <base id="echo-result-contact">
      ${this.kbk.home(`default`)}
      <media type="contact" phone="{{phone_number}}" first_name="{{first_name}}" last_name="{{last_name}}" vcard="{{vcard}}"></media>
    </base>
  `
}
