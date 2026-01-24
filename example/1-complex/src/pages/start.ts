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

export class StartPage extends PageBase {
  static data = this.buildData((rdm?: string) => [rdm])
  static BASE = {kbForImport: `kb-for-block-import`, forImport: `for-block-import`}

  kb() {
    return this.inlineKeyboard(
      (k, a) => {
        return k //
          .text(a[0]!, CounterPage.data.callback())
          .text(a[1]!, CounterThreadPage.data.callback())
          .row()
          .text(a[2]!, HelpPage.data.callback())
          .text(a[3]!, LanguagePage.data.callback())
          .row()
          .text(a[4]!, TestPhotoPage.data.callback())
          .text(a[5]!, TestVideoPage.data.callback())
          .row()
          .text(a[6]!, TestAudioPage.data.callback())
          .text(a[7]!, TestDocumentPage.data.callback())
          .row()
          .text(a[8]!, TestAnimationPage.data.callback())
          .text(a[9]!, TestVoicePage.data.callback())
          .row()
          .text(a[10]!, TestVideoNotePage.data.callback())
          .text(a[11]!, TestStickerPage.data.callback())
          .row()
          .text(a[12]!, TestLocationPage.data.callback())
          .text(a[13]!, TestContactPage.data.callback())
          .row()
          .text(a[14]!, TestErrorPage.data.callback())
          .text(a[15]!, InputText2Page.data.callback())
          .row()
          .text(a[16]!, InputTextPage.data.callback())
          .text(a[17]!, BlockMapPage.data.callback())
          .row()
          .text(a[18]!, BlockImportPage.data.callback())
          .text(a[19]!, BlockSwitchPage.data.callback())
          .row()
          .text(a[20]!, KeyboardBottomPage.data.callback())
          .text(a[21]!, this.data.callback())
      },
      {cache: true}
    )
  }

  async show(condition = 1) {
    const kb = this.kb()
    const da = {
      firstName: this.userFirstName,
      time: new Date().toString()
    }

    await this.sessionClear()
    if (condition == 1) {
      await this.reply(kb, da)
    } else if (condition == 2) {
      await this.edit(kb, da)
    } else if (condition == 3) {
      await this.delete()
      await this.reply(kb, da)
    }
  }

  async toError() {
    await this.show(1)
  }

  async text() {
    await this.show(1)
  }

  async textPayload() {
    await this.show(1)
  }

  async textCommand() {
    await this.show(1)
  }

  async textCommandPayload() {
    await this.show(1)
  }

  async callback() {
    await this.show(2)
  }

  async callbackPayload() {
    await this.show(3)
  }

  static template = `
    <base id="${this.BASE.kbForImport}">
      ${this.kbk.refreshBack()}
    </base>

    <base id="${this.BASE.forImport}">
      <import src="start" base="${this.BASE.kbForImport}" />
      <message>
        🧩 Block import demo

        This message and keyboard are imported from start.ts to demonstrate block import usage.

        Random: {{number}}
      </message>
      <message lang="id">
        🧩 Demo blok import

        Pesan dan keyboard ini diimpor dari start.ts untuk menunjukkan penggunaan blok import.

        Acak: {{number}}
      </message>
    </base>
    <base>
      <description>Default description command start</description>
      <description lang="en">[EN] Description command start</description>
      <description lang="id">[ID] Deskripsi perintah start</description>
      <keyboard>🔢 Counter, 🧵 Counter Thread, ❓ Help, 🌐 Language, 🖼️ Test Photo, 🎥 Test Video, 🎧 Test Audio, 📄 Test Document, 🎞️ Test Animation, 🎙️ Test Voice, 🎬 Test VideoN, 😀 Test Sticker, 📍 Test Location, 👤 Test Contact, 🧪 Test Error, 📝 Input Text2, ✍️ Input Text, 🧭 Block Map, 📦 Block Import, 🔀 Block Switch, ⌨️ KB Bottom, 🔄 Refresh</keyboard>
      <keyboard lang="id">🔢 Kounter, 🧵 Kounter Thread, ❓ Bantuan, 🌐 Bahasa, 🖼️ Test Foto, 🎥 Test Video, 🎧 Test Suara, 📄 Test Dokumen, 🎞️ Test Animasi, 🎙️ Test Suara, 🎬 Test VideoN, 😀 Test Stiker, 📍 Test Lokasi, 👤 Test Kontak, 🧪 Test Salah, 📝 Masukkan Teks2, ✍️ Masukkan Teks, 🧭 Blok Map, 📦 Blok Import, 🔀 Blok Switch, ⌨️ KB Bottom, 🔄 Segarkan</keyboard>
      <message>
        {{time}}

        👋 Welcome, {{firstName}}

        This complex example showcases templates, keyboards, media replies, and worker threads. Choose a module below to explore a specific feature.
      </message>
      <message lang="id">
        {{time}}

        👋 Selamat datang, {{firstName}}

        Contoh kompleks ini menampilkan template, keyboard, balasan media, dan worker thread. Pilih modul di bawah untuk mengeksplorasi fitur tertentu.
      </message>
    </base>
  `
}
