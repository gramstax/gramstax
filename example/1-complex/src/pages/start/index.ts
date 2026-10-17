import {PageBase} from "~/base/page"
import {StartBlockImportPage} from "./block/import"
import {StartBlockMapPage} from "./block/map"
import {StartBlockSwitchPage} from "./block/switch"
import {StartCounterPage} from "./counter"
import {StartCounterThreadPage} from "./counter/thread"
import {StartHelpPage} from "./help"
import {StartInputTextPage} from "./input/text"
import {StartInputText2Page} from "./input/text/2"
import {StartKeyboardBottomPage} from "./keyboard/bottom"
import {StartLanguagePage} from "./language"
import {StartStreamPage} from "./stream"
import {StartTestAnimationPage} from "./test/animation"
import {StartTestAudioPage} from "./test/audio"
import {StartTestContactPage} from "./test/contact"
import {StartTestDocumentPage} from "./test/document"
import {StartTestErrorPage} from "./test/error"
import {StartTestLocationPage} from "./test/location"
import {StartTestMediaGroupPage} from "./test/media-group"
import {StartTestPhotoPage} from "./test/photo"
import {StartTestStickerPage} from "./test/sticker"
import {StartTestVideoPage} from "./test/video"
import {StartTestVideoNotePage} from "./test/video-note"
import {StartTestVoicePage} from "./test/voice"

class Base {
  static index = `i`
  static keyboardForImport = `keyboard-for-block-import`
  static forImport = `for-block-import`
}

export class StartPage extends PageBase {
  static data = this.buildData((rdm?: string) => [rdm])

  async handleText() {
    await this.gindex.show(1)
  }

  async handleArgsText() {
    await this.gindex.show(1)
  }

  async handleCommandText() {
    await this.gindex.show(1)
  }

  async handleCommandArgsText() {
    await this.gindex.show(1)
  }

  async handleCallbackQueryData() {
    await this.gindex.show(2)
  }

  async handleArgsCallbackQueryData() {
    await this.gindex.show(3)
  }

  helper = {}
  gindex = {
    show: async (condition = 1) => {
      const menuKeyboard = this.inlineKeyboard(
        (k, l) => {
          return k
            .text(l[0]!, StartCounterPage) //
            .text(l[1]!, StartCounterThreadPage)
            .row()
            .text(l[2]!, StartHelpPage)
            .text(l[3]!, StartLanguagePage)
            .row()
            .text(l[4]!, StartTestPhotoPage)
            .text(l[5]!, StartTestMediaGroupPage)
            .row()
            .text(l[6]!, StartTestVideoPage)
            .text(l[7]!, StartTestAudioPage)
            .row()
            .text(l[8]!, StartTestDocumentPage)
            .text(l[9]!, StartTestAnimationPage)
            .row()
            .text(l[10]!, StartTestVoicePage)
            .text(l[11]!, StartTestVideoNotePage)
            .row()
            .text(l[12]!, StartTestStickerPage)
            .text(l[13]!, StartTestLocationPage)
            .row()
            .text(l[14]!, StartTestContactPage)
            .text(l[15]!, StartTestErrorPage)
            .row()
            .text(l[16]!, StartInputText2Page)
            .text(l[17]!, StartInputTextPage)
            .row()
            .text(l[18]!, StartBlockMapPage)
            .text(l[19]!, StartBlockImportPage)
            .row()
            .text(l[20]!, StartBlockSwitchPage)
            .text(l[21]!, StartKeyboardBottomPage)
            .row()
            .text(l[22]!, StartStreamPage)
            .row()
            .text(l[23]!, this)
        },
        {cache: true, AGBaseId: Base.index}
      )
      const welcomeData = {
        firstName: this.from!.first_name,
        time: new Date().toString(),
        thumbsEmojiId: `5368324170671202286`
      }

      await this.clearSession()
      if (condition === 1) {
        await this.renderText({AGBaseId: Base.index, keyboard: menuKeyboard, data: welcomeData, mode: "reply"})
      } else if (condition === 2) {
        await this.renderText({AGBaseId: Base.index, keyboard: menuKeyboard, data: welcomeData, mode: "edit"})
      } else if (condition === 3) {
        await this.deleteMessage()
        await this.renderText({AGBaseId: Base.index, keyboard: menuKeyboard, data: welcomeData, mode: "reply"})
      }
    },
    process: () => {}
  }

  static template = `
    <g-base id="${Base.keyboardForImport}">
      ${this.kbk.refresh_back()}
    </g-base>
    <g-base id="${Base.forImport}">
      <g-import src="start" base="${Base.keyboardForImport}" />
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
