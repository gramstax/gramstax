import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static forText = `f-text`
  static forPhoto = `f-photo`
  static forVideo = `f-video`
  static forAudio = `f-audio`
  static forDocument = `f-document`
  static forAnimation = `f-animation`
  static forVoice = `f-voice`
  static forVideoNote = `f-video_note`
  static forSticker = `f-sticker`
  static forLocation = `f-location`
  static forContact = `f-contact`
}

class Helper {
  static kbStep1(ctx: EchoPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    return kb
  }
}

class Main {
  static async showStep1Form(ctx: EchoPage) {
    const bi = Base.step1
    const kb = Helper.kbStep1(ctx)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: EchoPage) {
    throw ctx
  }

  static async showForText(ctx: EchoPage) {
    const text = ctx.msgText
    if (text.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kbStep1(ctx)
    const da = {text}
    const bi = Base.forText
    await ctx.reply(kb, da, bi)
  }

  static async showForPhoto(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileIdLargest = ctx.msgPhoto[ctx.msgPhoto.length - 1].file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kbStep1(ctx)
    const da = {caption, fileId: fileIdLargest}
    const bi = Base.forPhoto
    await ctx.replyPhoto(kb, da, bi)
  }

  static async showForVideo(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgVideo.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kbStep1(ctx)
    const da = {caption, fileId}
    const bi = Base.forVideo
    await ctx.replyVideo(kb, da, bi)
  }

  static async showForAudio(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgAudio.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kbStep1(ctx)
    const da = {caption, fileId}
    const bi = Base.forAudio
    await ctx.replyAudio(kb, da, bi)
  }

  static async showForDocument(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgDocument.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kbStep1(ctx)
    const da = {caption, fileId}
    const bi = Base.forDocument
    await ctx.replyDocument(kb, da, bi)
  }

  static async showForAnimation(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgAnimation.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kbStep1(ctx)
    const da = {caption, fileId}
    const bi = Base.forAnimation
    await ctx.replyAnimation(kb, da, bi)
  }

  static async showForVoice(ctx: EchoPage) {
    const caption = ctx.msgCaption
    const fileId = ctx.msgVoice.file_id
    if (caption?.startsWith(`/`)) {
      return null
    }

    const kb = Helper.kbStep1(ctx)
    const da = {caption, fileId}
    const bi = Base.forVoice
    await ctx.replyVoice(kb, da, bi)
  }

  static async showForVideoNote(ctx: EchoPage) {
    // not support caption
    const fileId = ctx.msgVideoNote.file_id
    const kb = Helper.kbStep1(ctx)
    const da = {fileId}
    const bi = Base.forVideoNote
    await ctx.replyVideoNote(kb, da, bi)
  }

  static async showForSticker(ctx: EchoPage) {
    // not support caption
    const fileId = ctx.msgSticker.file_id
    const kb = Helper.kbStep1(ctx)
    const da = {fileId}
    const bi = Base.forSticker
    await ctx.replySticker(kb, da, bi)
  }

  static async showForLocation(ctx: EchoPage) {
    // not support caption
    const {latitude, longitude} = ctx.msgLocation
    const kb = Helper.kbStep1(ctx)
    const da = {latitude, longitude}
    const bi = Base.forLocation
    await ctx.replyLocation(kb, da, bi)
  }

  static async showForContact(ctx: EchoPage) {
    // not support caption
    const {first_name, last_name, phone_number, user_id, vcard} = ctx.msgContact
    const kb = Helper.kbStep1(ctx)
    const da = {first_name, last_name, phone_number, user_id, vcard}
    const bi = Base.forContact
    await ctx.replyContact(kb, da, bi)
  }
}

// Echo page responds to any free text input.
export class EchoPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleFreeText() {
    await Main.showForText(this)
  }

  async handleFreePhoto() {
    await Main.showForPhoto(this)
  }

  async handleFreeVideo() {
    await Main.showForVideo(this)
  }

  async handleFreeAudio() {
    await Main.showForAudio(this)
  }

  async handleFreeDocument() {
    await Main.showForDocument(this)
  }

  async handleFreeAnimation() {
    await Main.showForAnimation(this)
  }

  async handleFreeVoice() {
    await Main.showForVoice(this)
  }

  async handleFreeVideoNote() {
    await Main.showForVideoNote(this)
  }

  async handleFreeSticker() {
    await Main.showForSticker(this)
  }

  async handleFreeLocation() {
    await Main.showForLocation(this)
  }

  async handleFreeContact() {
    await Main.showForContact(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.home()}
      <g-message>
        🔁 Echo Tips

        Send any message or media and the bot will echo it back. Use this to test formatting, media handling, or message flow.
      </g-message>
      ${this.kbk.home(`id`)}
      <g-message lang="id">
        🔁 Tips Echo

        Kirim pesan atau media dan bot akan menggema. Gunakan ini untuk menguji format, penanganan media, atau alur pesan.
      </g-message>
    </g-base>

    <g-base id="${Base.forText}">
      <g-message>
        {{text}}
      </g-message>
    </g-base>

    <g-base id="${Base.forPhoto}">
      <g-media type="photo" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.forVideo}">
      <g-media type="video" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.forAudio}">
      <g-media type="audio" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.forDocument}">
      <g-media type="document" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.forAnimation}">
      <g-media type="animation" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.forVoice}">
      <g-media type="voice" src="{{fileId}}">
        {{caption}}
      </g-media>
    </g-base>

    <g-base id="${Base.forVideoNote}">
      <g-media type="video_note" src="{{fileId}}"></g-media>
    </g-base>

    <g-base id="${Base.forSticker}">
      <g-media type="sticker" src="{{fileId}}"></g-media>
    </g-base>

    <g-base id="${Base.forLocation}">
      <g-media type="location" latitude="{{latitude}}" longitude="{{longitude}}"></g-media>
    </g-base>

    <g-base id="${Base.forContact}">
      <g-media type="contact" phone="{{phone_number}}" first_name="{{first_name}}" last_name="{{last_name}}" vcard="{{vcard}}"></g-media>
    </g-base>
  `
}
