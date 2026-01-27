import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  static BASE = {text: `r-text`, photo: `r-photo`, video: `r-video`, audio: `r-audio`, document: `r-document`, animation: `r-animation`, voice: `r-voice`, videoNote: `r-video_note`, sticker: `r-sticker`, location: `r-location`, contact: `r-contact`}

  kb() {
    return this.inlineKeyboardT([StartPage])
  }

  async handleCallbackData() {
    await this.edit(this.kb())
  }

  async handleFreeText() {
    const text = this.msgText
    if (text.startsWith(`/`)) return null

    await this.reply(this.kb(), {text}, EchoPage.BASE.text)
  }

  async handleFreePhoto() {
    const caption = this.msgCaption
    const fileIdLargest = this.msgPhoto[this.msgPhoto.length - 1].file_id
    if (caption?.startsWith(`/`)) return null

    await this.replyPhoto(this.kb(), {caption, fileId: fileIdLargest}, EchoPage.BASE.photo)
  }

  async handleFreeVideo() {
    const caption = this.msgCaption
    const fileId = this.msgVideo.file_id
    if (caption?.startsWith(`/`)) return null

    await this.replyVideo(this.kb(), {caption, fileId}, EchoPage.BASE.video)
  }

  async handleFreeAudio() {
    const caption = this.msgCaption
    const fileId = this.msgAudio.file_id
    if (caption?.startsWith(`/`)) return null

    await this.replyAudio(this.kb(), {caption, fileId}, EchoPage.BASE.audio)
  }

  async handleFreeDocument() {
    const caption = this.msgCaption
    const fileId = this.msgDocument.file_id
    if (caption?.startsWith(`/`)) return null

    await this.replyDocument(this.kb(), {caption, fileId}, EchoPage.BASE.document)
  }

  async handleFreeAnimation() {
    const caption = this.msgCaption
    const fileId = this.msgAnimation.file_id
    if (caption?.startsWith(`/`)) return null

    await this.replyAnimation(this.kb(), {caption, fileId}, EchoPage.BASE.animation)
  }

  async handleFreeVoice() {
    const caption = this.msgCaption
    const fileId = this.msgVoice.file_id
    if (caption?.startsWith(`/`)) return null

    await this.replyVoice(this.kb(), {caption, fileId}, EchoPage.BASE.voice)
  }

  async handleFreeVideoNote() {
    // not support caption
    const fileId = this.msgVideoNote.file_id
    await this.replyVideoNote(this.kb(), {fileId}, EchoPage.BASE.videoNote)
  }

  async handleFreeSticker() {
    // not support caption
    const fileId = this.msgSticker.file_id
    await this.replySticker(this.kb(), {fileId}, EchoPage.BASE.sticker)
  }

  async handleFreeLocation() {
    // not support caption
    const {latitude, longitude} = this.msgLocation
    await this.replyLocation(this.kb(), {latitude, longitude}, EchoPage.BASE.location)
  }

  async handleFreeContact() {
    // not support caption
    const {first_name, last_name, phone_number, user_id, vcard} = this.msgContact
    await this.replyContact(this.kb(), {first_name, last_name, phone_number, user_id, vcard}, EchoPage.BASE.contact)
  }

  static template = `
    <base>
      ${this.kbk.home(`default`)}
      <message>
        🔁 Echo Tips

        Send any message or media and the bot will echo it back. Use this to test formatting, media handling, or message flow.
      </message>
    </base>

    <base id="${this.BASE.text}">
      <message>
        💬 Echoed message

        {{text}}
      </message>
    </base>

    <base id="${this.BASE.photo}">
      <media type="photo" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.video}">
      <media type="video" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.audio}">
      <media type="audio" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.document}">
      <media type="document" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.animation}">
      <media type="animation" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.voice}">
      <media type="voice" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${this.BASE.videoNote}">
      <media type="video_note" src="{{fileId}}"></media>
    </base>

    <base id="${this.BASE.sticker}">
      <media type="sticker" src="{{fileId}}"></media>
    </base>

    <base id="${this.BASE.location}">
      <media type="location" latitude="{{latitude}}" longitude="{{longitude}}"></media>
    </base>

    <base id="${this.BASE.contact}">
      <media type="contact" phone="{{phone_number}}" first_name="{{first_name}}" last_name="{{last_name}}" vcard="{{vcard}}"></media>
    </base>
  `
}
