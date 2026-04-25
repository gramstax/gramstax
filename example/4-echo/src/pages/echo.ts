import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static text: `r-text`
  static photo: `r-photo`
  static video: `r-video`
  static audio: `r-audio`
  static document: `r-document`
  static animation: `r-animation`
  static voice: `r-voice`
  static videoNote: `r-video_note`
  static sticker: `r-sticker`
  static location: `r-location`
  static contact: `r-contact`
}

class Helper {
  static kb(ctx: EchoPage) {
    return ctx.inlineKeyboardT([StartPage])
  }
}

class Perform {
  static async entryPoint(ctx: EchoPage) {
    const kb = Helper.kb(ctx)
    await ctx.edit(kb)
  }

  static async forText(ctx: EchoPage) {
    const text = ctx.msgText
    if (text.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kb(ctx)
    const da = {text}
    const bi = Base.text
    await ctx.reply(kb, da, bi)
  }

  static async forPhoto(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileIdLargest = ctx.msgPhoto[ctx.msgPhoto.length - 1].file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kb(ctx)
    const da = {caption, fileId: fileIdLargest}
    const bi = Base.photo
    await ctx.replyPhoto(kb, da, bi)
  }

  static async forVideo(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgVideo.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kb(ctx)
    const da = {caption, fileId}
    const bi = Base.video
    await ctx.replyVideo(kb, da, bi)
  }

  static async forAudio(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgAudio.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kb(ctx)
    const da = {caption, fileId}
    const bi = Base.audio
    await ctx.replyAudio(kb, da, bi)
  }

  static async forDocument(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgDocument.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kb(ctx)
    const da = {caption, fileId}
    const bi = Base.document
    await ctx.replyDocument(kb, da, bi)
  }

  static async forAnimation(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgAnimation.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kb(ctx)
    const da = {caption, fileId}
    const bi = Base.animation
    await ctx.replyAnimation(kb, da, bi)
  }

  static async forVoice(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgVoice.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kb(ctx)
    const da = {caption, fileId}
    const bi = Base.voice
    await ctx.replyVoice(kb, da, bi)
  }

  static async forVideoNote(ctx: EchoPage) {
    // not support caption
    const fileId = ctx.msgVideoNote.file_id
    const kb = Helper.kb(ctx)
    const da = {fileId}
    const bi = Base.videoNote
    await ctx.replyVideoNote(kb, da, bi)
  }

  static async forSticker(ctx: EchoPage) {
    // not support caption
    const fileId = ctx.msgSticker.file_id
    const kb = Helper.kb(ctx)
    const da = {fileId}
    const bi = Base.sticker
    await ctx.replySticker(kb, da, bi)
  }

  static async forLocation(ctx: EchoPage) {
    // not support caption
    const {latitude, longitude} = ctx.msgLocation
    const kb = Helper.kb(ctx)
    const da = {latitude, longitude}
    const bi = Base.location
    await ctx.replyLocation(kb, da, bi)
  }

  static async forContact(ctx: EchoPage) {
    // not support caption
    const {first_name, last_name, phone_number, user_id, vcard} = ctx.msgContact
    const kb = Helper.kb(ctx)
    const da = {first_name, last_name, phone_number, user_id, vcard}
    const bi = Base.contact
    await ctx.replyContact(kb, da, bi)
  }
}

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  async handleFreeText() {
    await Perform.forText(this)
  }

  async handleFreePhoto() {
    await Perform.forPhoto(this)
  }

  async handleFreeVideo() {
    await Perform.forVideo(this)
  }

  async handleFreeAudio() {
    await Perform.forAudio(this)
  }

  async handleFreeDocument() {
    await Perform.forDocument(this)
  }

  async handleFreeAnimation() {
    await Perform.forAnimation(this)
  }

  async handleFreeVoice() {
    await Perform.forVoice(this)
  }

  async handleFreeVideoNote() {
    await Perform.forVideoNote(this)
  }

  async handleFreeSticker() {
    await Perform.forSticker(this)
  }

  async handleFreeLocation() {
    await Perform.forLocation(this)
  }

  async handleFreeContact() {
    await Perform.forContact(this)
  }

  static template = `
    <base>
      ${this.kbk.home(`default`)}
      <message>
        🔁 Echo Tips

        Send any message or media and the bot will echo it back. Use this to test formatting, media handling, or message flow.
      </message>
    </base>

    <base id="${Base.text}">
      <message>
        💬 Echoed message

        {{text}}
      </message>
    </base>

    <base id="${Base.photo}">
      <media type="photo" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.video}">
      <media type="video" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.audio}">
      <media type="audio" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.document}">
      <media type="document" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.animation}">
      <media type="animation" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.voice}">
      <media type="voice" src="{{fileId}}">
        {{caption}}
      </media>
    </base>

    <base id="${Base.videoNote}">
      <media type="video_note" src="{{fileId}}"></media>
    </base>

    <base id="${Base.sticker}">
      <media type="sticker" src="{{fileId}}"></media>
    </base>

    <base id="${Base.location}">
      <media type="location" latitude="{{latitude}}" longitude="{{longitude}}"></media>
    </base>

    <base id="${Base.contact}">
      <media type="contact" phone="{{phone_number}}" first_name="{{first_name}}" last_name="{{last_name}}" vcard="{{vcard}}"></media>
    </base>
  `
}
