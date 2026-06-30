import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {CounterPage} from "./counter"
import {LanguagePage} from "./language"
import {BlockMapPage} from "./block-map"
import {InputTextPage} from "./input-text"
import {TestErrorPage} from "./test-error"
import {TestVoicePage} from "./test-voice"
import {TestPhotoPage} from "./test-photo"
import {TestVideoPage} from "./test-video"
import {TestAudioPage} from "./test-audio"
import {InputText2Page} from "./input-text-2"
import {BlockSwitchPage} from "./block-switch"
import {BlockImportPage} from "./block-import"
import {TestContactPage} from "./test-contact"
import {TestStickerPage} from "./test-sticker"
import {TestLocationPage} from "./test-location"
import {TestDocumentPage} from "./test-document"
import {CounterThreadPage} from "./counter-thread"
import {TestAnimationPage} from "./test-animation"
import {TestVideoNotePage} from "./test-video-note"
import {KeyboardBottomPage} from "./keyboard-bottom"
import {TestMediaGroupPage} from "./test-media-group"

class Base {
  static step1 = `s1`
  static kbForImport = `kb-for-block-import`
  static forImport = `for-block-import`
}

class Helper {
  static kb(ctx: StartPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        return k
          .text(l[0]!, CounterPage.data.callbackData()) //
          .text(l[1]!, CounterThreadPage.data.callbackData())
          .row()
          .text(l[2]!, HelpPage.data.callbackData())
          .text(l[3]!, LanguagePage.data.callbackData())
          .row()
          .text(l[4]!, TestPhotoPage.data.callbackData())
          .text(l[5]!, TestMediaGroupPage.data.callbackData())
          .row()
          .text(l[6]!, TestVideoPage.data.callbackData())
          .text(l[7]!, TestAudioPage.data.callbackData())
          .row()
          .text(l[8]!, TestDocumentPage.data.callbackData())
          .text(l[9]!, TestAnimationPage.data.callbackData())
          .row()
          .text(l[10]!, TestVoicePage.data.callbackData())
          .text(l[11]!, TestVideoNotePage.data.callbackData())
          .row()
          .text(l[12]!, TestStickerPage.data.callbackData())
          .text(l[13]!, TestLocationPage.data.callbackData())
          .row()
          .text(l[14]!, TestContactPage.data.callbackData())
          .text(l[15]!, TestErrorPage.data.callbackData())
          .row()
          .text(l[16]!, InputText2Page.data.callbackData())
          .text(l[17]!, InputTextPage.data.callbackData())
          .row()
          .text(l[18]!, BlockMapPage.data.callbackData())
          .text(l[19]!, BlockImportPage.data.callbackData())
          .row()
          .text(l[20]!, BlockSwitchPage.data.callbackData())
          .text(l[21]!, KeyboardBottomPage.data.callbackData())
          .row()
          .text(l[22]!, ctx.data.callbackData())
      },
      {cache: true, AGBaseId: bi}
    )
    return kb
  }
}

class Main {
  static async showStep1Form(ctx: StartPage, condition = 1) {
    const bi = Base.step1
    const kb = Helper.kb(ctx)
    const da = {
      firstName: ctx.userFirstName,
      time: new Date().toString(),
      unixTime: Math.floor(Date.now() / 1000),
      thumbsEmojiId: `5368324170671202286`
    }

    await ctx.clearSession()
    if (condition == 1) {
      await ctx.reply(kb, da, bi)
      // await ctx.replyRich(kb, da, bi)
    } else if (condition == 2) {
      await ctx.edit(kb, da, bi)
    } else if (condition == 3) {
      await ctx.delete()
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
    throw ctx
  }
}

export class StartPage extends PageBase {
  static data = this.buildData((rdm?: string) => [rdm])

  async handleText() {
    await Main.showStep1Form(this, 1)
  }

  async handleArgsText() {
    await Main.showStep1Form(this, 1)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, 1)
  }

  async handleCommandArgsText() {
    await Main.showStep1Form(this, 1)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, 2)
  }

  async handleArgsCallbackData() {
    await Main.showStep1Form(this, 3)
  }

  static template = `
    <g-base id="${Base.kbForImport}">
      ${this.kbk.refresh_back()}
    </g-base>

    <g-base id="${Base.forImport}">
      <g-import src="start" base="${Base.kbForImport}" />
      <g-message>
        🧩 Block import demo

        This message and keyboard are imported from start.ts to demonstrate block import usage.

        Random: {{number}}
      </g-message>
      <g-message lang="id">
        🧩 Demo blok import

        Pesan dan keyboard ini diimpor dari start.ts untuk menunjukkan penggunaan blok import.

        Acak: {{number}}
      </g-message>
    </g-base>
    
    <g-base id="${Base.step1}">
      <g-description>Default description command /start</g-description>
      <g-description lang="en">[EN] Description command /start</g-description>
      <g-description lang="id">[ID] Deskripsi perintah /start</g-description>
      <g-keyboard>🔢 Counter, 🧵 Counter Thread, ❓ Help, 🌐 Language, 🖼️ Test Photo, 🖼️ Test Media Group, 🎥 Test Video, 🎧 Test Audio, 📄 Test Document, 🎞️ Test Animation, 🎙️ Test Voice, 🎬 Test VideoN, 😀 Test Sticker, 📍 Test Location, 👤 Test Contact, 🧪 Test Error, 📝 Input Text2, ✍️ Input Text, 🧭 Block Map, 📦 Block Import, 🔀 Block Switch, ⌨️ KB Bottom, 🔄 Refresh</g-keyboard>
      <g-keyboard lang="id">🔢 Kounter, 🧵 Kounter Thread, ❓ Bantuan, 🌐 Bahasa, 🖼️ Test Foto, 🖼️ Test Media Grup, 🎥 Test Video, 🎧 Test Suara, 📄 Test Dokumen, 🎞️ Test Animasi, 🎙️ Test Suara, 🎬 Test VideoN, 😀 Test Stiker, 📍 Test Lokasi, 👤 Test Kontak, 🧪 Test Salah, 📝 Masukkan Teks2, ✍️ Masukkan Teks, 🧭 Blok Map, 📦 Blok Import, 🔀 Blok Switch, ⌨️ KB Bottom, 🔄 Segarkan</g-keyboard>
      <g-message>
        <tg-time unix="{{unixTime}}" format="wD">{{time}}</tg-time>

        👋 Welcome, <b>{{firstName}}</b>! <tg-emoji emoji-id="{{thumbsEmojiId}}">👍</tg-emoji>

        This complex example showcases <mark><i>templates</i>, <i>keyboards</i>, <i>media replies</i></mark> and <i>worker threads</i>. Choose a module below to explore a specific feature.

        <b>📚 Quick Links:</b>
        <a href="https://github.com/gramstax/gramstax">📖 Documentation</a> · <a href="https://core.telegram.org/bots/api">🤖 Bot API Reference</a>

        <b>🎯 Pro Tips:</b>
        <tg-spoiler>💡 Use <code>/help</code> to see all available commands</tg-spoiler>
        <tg-spoiler>🎁 Try <code>/start</code> multiple times to see different behaviors</tg-spoiler>

        <b>📋 All Commands:</b>
        <details>
          <summary>Click to expand</summary>
          <code>/start</code> — Show welcome message<br/>
          <code>/help</code> — View help and commands<br/>
          <code>/counter</code> — Test counter feature<br/>
          <code>/language</code> — Change language settings
        </details>

        <i>💡 Tip: long-press the message to copy any code snippet</i>
      </g-message>
      <g-message lang="id">
        <tg-time unix="{{unixTime}}" format="wD">{{time}}</tg-time>

        👋 Selamat datang, <b>{{firstName}}</b>! <tg-emoji emoji-id="{{thumbsEmojiId}}">👍</tg-emoji>

        Contoh kompleks ini menampilkan <mark><i>template</i>, <i>keyboard</i>, <i>balasan media</i></mark> dan <i>worker thread</i>. Pilih modul di bawah untuk mengeksplorasi fitur tertentu.

        <b>📚 Tautan Cepat:</b>
        <a href="https://github.com/gramstax/gramstax">📖 Dokumentasi</a> · <a href="https://core.telegram.org/bots/api">🤖 Bot API Reference</a>

        <b>🎯 Tips Pro:</b>
        <tg-spoiler>💡 Gunakan <code>/help</code> untuk melihat semua perintah</tg-spoiler>
        <tg-spoiler>🎁 Coba <code>/start</code> beberapa kali untuk perilaku berbeda</tg-spoiler>

        <b>📋 Semua Perintah:</b>
        <details>
          <summary>Klik untuk memperluas</summary>
          <code>/start</code> — Tampilkan pesan sambutan<br/>
          <code>/help</code> — Lihat bantuan dan perintah<br/>
          <code>/counter</code> — Test fitur counter<br/>
          <code>/language</code> — Ubah pengaturan bahasa
        </details>

        <i>💡 Tip: tekan lama pesan untuk menyalin snippet kode</i>
      </g-message>
    </g-base>
  `
}
