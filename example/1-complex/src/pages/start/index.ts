import {StartHelpPage} from "./help"
import {PageBase} from "~/base/page"
import {StartCounterPage} from "./counter"
import {LanguagePage} from "~/pages/language"
import {StartBlockMapPage} from "./block/map"
import {InputTextPage} from "~/pages/input-text"
import {TestErrorPage} from "~/pages/test-error"
import {TestVoicePage} from "~/pages/test-voice"
import {TestPhotoPage} from "~/pages/test-photo"
import {TestVideoPage} from "~/pages/test-video"
import {TestAudioPage} from "~/pages/test-audio"
import {InputText2Page} from "~/pages/input-text-2"
import {StartBlockSwitchPage} from "./block/switch"
import {StartBlockImportPage} from "./block/import"
import {TestContactPage} from "~/pages/test-contact"
import {TestStickerPage} from "~/pages/test-sticker"
import {TestLocationPage} from "~/pages/test-location"
import {TestDocumentPage} from "~/pages/test-document"
import {StartCounterThreadPage} from "./counter/thread"
import {TestAnimationPage} from "~/pages/test-animation"
import {TestVideoNotePage} from "~/pages/test-video-note"
import {KeyboardBottomPage} from "~/pages/keyboard-bottom"
import {TestMediaGroupPage} from "~/pages/test-media-group"
import {StreamPage} from "~/pages/stream"

class Base {
  static index = `i`
  static kbForImport = `kb-for-block-import`
  static forImport = `for-block-import`
}

class Helper {
  static kb(ctx: StartPage) {
    return ctx.inlineKeyboard(
      (k, l) => {
        return k
          .text(l[0]!, StartCounterPage.data.callbackQueryData()) //
          .text(l[1]!, StartCounterThreadPage.data.callbackQueryData())
          .row()
          .text(l[2]!, StartHelpPage.data.callbackQueryData())
          .text(l[3]!, LanguagePage.data.callbackQueryData())
          .row()
          .text(l[4]!, TestPhotoPage.data.callbackQueryData())
          .text(l[5]!, TestMediaGroupPage.data.callbackQueryData())
          .row()
          .text(l[6]!, TestVideoPage.data.callbackQueryData())
          .text(l[7]!, TestAudioPage.data.callbackQueryData())
          .row()
          .text(l[8]!, TestDocumentPage.data.callbackQueryData())
          .text(l[9]!, TestAnimationPage.data.callbackQueryData())
          .row()
          .text(l[10]!, TestVoicePage.data.callbackQueryData())
          .text(l[11]!, TestVideoNotePage.data.callbackQueryData())
          .row()
          .text(l[12]!, TestStickerPage.data.callbackQueryData())
          .text(l[13]!, TestLocationPage.data.callbackQueryData())
          .row()
          .text(l[14]!, TestContactPage.data.callbackQueryData())
          .text(l[15]!, TestErrorPage.data.callbackQueryData())
          .row()
          .text(l[16]!, InputText2Page.data.callbackQueryData())
          .text(l[17]!, InputTextPage.data.callbackQueryData())
          .row()
          .text(l[18]!, StartBlockMapPage.data.callbackQueryData())
          .text(l[19]!, StartBlockImportPage.data.callbackQueryData())
          .row()
          .text(l[20]!, StartBlockSwitchPage.data.callbackQueryData())
          .text(l[21]!, KeyboardBottomPage.data.callbackQueryData())
          .row()
          .text(l[22]!, StreamPage.data.callbackQueryData())
          .row()
          .text(l[23]!, ctx.data.callbackQueryData())
      },
      {cache: true, AGBaseId: Base.index}
    )
  }
}

export class StartPage extends PageBase {
  static data = this.buildData((rdm?: string) => [rdm])

  async handleText() {
    await this.bindex.show(1)
  }

  async handleArgsText() {
    await this.bindex.show(1)
  }

  async handleCommandText() {
    await this.bindex.show(1)
  }

  async handleCommandArgsText() {
    await this.bindex.show(1)
  }

  async handleCallbackQueryData() {
    await this.bindex.show(2)
  }

  async handleArgsCallbackQueryData() {
    await this.bindex.show(3)
  }

  bindex = {
    show: async (condition = 1) => {
      const bi = Base.index
      const kb = Helper.kb(this)
      const da = {
        firstName: this.from!.first_name,
        time: new Date().toString(),
        thumbsEmojiId: `5368324170671202286`
      }

      await this.clearSession()
      if (condition == 1) {
        await this.renderRich(kb, da, bi)
      } else if (condition == 2) {
        await this.renderEdit(kb, da, bi)
      } else if (condition == 3) {
        await this.deleteMessage()
        await this.render(kb, da, bi)
      }
    }
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
    <g-base id="${Base.index}">
      <g-description>Default description command /start (you can change this)</g-description>
      <g-description lang="en">[EN] Description command /start (you can change this)</g-description>
      <g-description lang="id">[ID] Deskripsi perintah /start (anda dapat merubah ini)</g-description>
      <g-keyboard type="inline">🔢 Counter, 🧵 Counter Thread, ❓ Help, 🌐 Language, 🖼️ Test Photo, 🖼️ Test Media Group, 🎥 Test Video, 🎧 Test Audio, 📄 Test Document, 🎞️ Test Animation, 🎙️ Test Voice, 🎬 Test VideoN, 😀 Test Sticker, 📍 Test Location, 👤 Test Contact, 🧪 Test Error, 📝 Input Text2, ✍️ Input Text, 🧭 Block Map, 📦 Block Import, 🔀 Block Switch, ⌨️ KB Bottom, ✨ Stream, 🔄 Refresh</g-keyboard>
      <g-keyboard type="inline" lang="id">🔢 Kounter, 🧵 Kounter Thread, ❓ Bantuan, 🌐 Bahasa, 🖼️ Test Foto, 🖼️ Test Media Grup, 🎥 Test Video, 🎧 Test Suara, 📄 Test Dokumen, 🎞️ Test Animasi, 🎙️ Test Suara, 🎬 Test VideoN, 😀 Test Stiker, 📍 Test Lokasi, 👤 Test Kontak, 🧪 Test Salah, 📝 Masukkan Teks2, ✍️ Masukkan Teks, 🧭 Blok Map, 📦 Blok Import, 🔀 Blok Switch, ⌨️ KB Bottom, ✨ Stream, 🔄 Segarkan</g-keyboard>
      <g-message>
        {{time}}

        👋 Welcome, <b>{{firstName}}</b>! <tg-emoji emoji-id="{{thumbsEmojiId}}">👍</tg-emoji>

        This complex example showcases <i>templates</i>, <i>keyboards</i>, <i>media replies</i> and <i>worker threads</i>. Choose a module below to explore a specific feature.

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
        {{time}}

        👋 Selamat datang, <b>{{firstName}}</b>! <tg-emoji emoji-id="{{thumbsEmojiId}}">👍</tg-emoji>

        Contoh kompleks ini menampilkan <i>template</i>, <i>keyboard</i>, <i>balasan media</i> dan <i>worker thread</i>. Pilih modul di bawah untuk mengeksplorasi fitur tertentu.

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
