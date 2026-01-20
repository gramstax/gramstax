import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  kb() {
    return this.inlineKeyboardT([StartPage])
  }

  // Inline button to show echo usage tips.
  async callback() {
    const kb = this.kb()
    await this.edit(kb)
  }

  // Catch-all for text inputs that are not matched by other pages.
  async textFree() {
    const text = this.msgText
    if (text.startsWith(`/`)) return null

    const kb = this.kb()
    const data = {text}
    await this.reply(kb, data, `echo-result-text`)
  }

  async photoFree() {
    const caption = this.msgCaption
    const fileIdLargest = this.msgPhoto[this.msgPhoto.length - 1].file_id
    if (caption?.startsWith(`/`)) return null

    const kb = this.kb()
    const data = {caption, fileId: fileIdLargest}
    await this.replyPhoto(kb, data, `echo-result-photo`)
  }

  async videoFree() {
    const caption = this.msgCaption
    const fileId = this.msgVideo.file_id
    if (caption?.startsWith(`/`)) return null

    const kb = this.kb()
    const data = {caption, fileId}
    await this.replyVideo(kb, data, `echo-result-video`)
  }

  async audioFree() {
    const caption = this.msgCaption
    const fileId = this.msgAudio.file_id
    if (caption?.startsWith(`/`)) return null

    const kb = this.kb()
    const data = {caption, fileId}
    await this.replyAudio(kb, data, `echo-result-audio`)
  }

  async documentFree() {
    const caption = this.msgCaption
    const fileId = this.msgDocument.file_id
    if (caption?.startsWith(`/`)) return null

    const kb = this.kb()
    const data = {caption, fileId}
    await this.replyDocument(kb, data, `echo-result-document`)
  }

  async animationFree() {
    const caption = this.msgCaption
    const fileId = this.msgAnimation.file_id
    if (caption?.startsWith(`/`)) return null

    const kb = this.kb()
    const data = {caption, fileId}
    await this.replyAnimation(kb, data, `echo-result-animation`)
  }

  async voiceFree() {
    const caption = this.msgCaption
    const fileId = this.msgVoice.file_id
    if (caption?.startsWith(`/`)) return null

    const kb = this.kb()
    const data = {caption, fileId}
    await this.replyVoice(kb, data, `echo-result-voice`)
  }

  async videoNoteFree() {
    // not support caption
    const fileId = this.msgVideoNote.file_id
    const kb = this.kb()
    const data = {fileId}
    await this.replyVideoNote(kb, data, `echo-result-video_note`)
  }

  async stickerFree() {
    // not support caption
    const fileId = this.msgSticker.file_id
    const kb = this.kb()
    const data = {fileId}
    await this.replySticker(kb, data, `echo-result-sticker`)
  }

  async locationFree() {
    // not support caption
    const {latitude, longitude} = this.msgLocation
    const kb = this.kb()
    const data = {latitude, longitude}
    await this.replyLocation(kb, data, `echo-result-location`)
  }

  async contactFree() {
    // not support caption
    const {first_name, last_name, phone_number, user_id, vcard} = this.msgContact
    const kb = this.kb()
    const data = {first_name, last_name, phone_number, user_id, vcard}
    await this.replyContact(kb, data, `echo-result-contact`)
  }

  static template = `
    <base>
      ${this.kbk.home(`default`)}
      <message>
        Echo Tips:
        - Send any message
        - The bot repeats the same message
      </message>
    </base>
    <base id="echo-result-text">
      <message>
        Echo: {{text}}
      </message>
    </base>
    <base id="echo-result-photo">
      <media type="photo" src="{{fileId}}">
        {{caption}}
      </media>
    </base>
    <base id="echo-result-video">
      <media type="video" src="{{fileId}}">
        {{caption}}
      </media>
    </base>
    <base id="echo-result-audio">
      <media type="audio" src="{{fileId}}">
        {{caption}}
      </media>
    </base>
    <base id="echo-result-document">
      <media type="document" src="{{fileId}}">
        {{caption}}
      </media>
    </base>
    <base id="echo-result-animation">
      <media type="animation" src="{{fileId}}">
        {{caption}}
      </media>
    </base>
    <base id="echo-result-voice">
      <media type="voice" src="{{fileId}}">
        {{caption}}
      </media>
    </base>
    <base id="echo-result-video_note">
      <media type="video_note" src="{{fileId}}"></media>
    </base>
    <base id="echo-result-sticker">
      <media type="sticker" src="{{fileId}}"></media>
    </base>
    <base id="echo-result-location">
      <media type="location" latitude="{{latitude}}" longitude="{{longitude}}"></media>
    </base>
    <base id="echo-result-contact">
      <media type="contact" phone="{{phone_number}}" first_name="{{first_name}}" last_name="{{last_name}}" vcard="{{vcard}}"></media>
    </base>
  `
}
