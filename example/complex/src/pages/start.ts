import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {KbbePage} from "./kbbe"
import {CounterPage} from "./counter"
import {LanguagePage} from "./language"
import {BlockMapPage} from "./block-map"
import {InputTextPage} from "./input-text"
import {TestErrorPage} from "./test-error"
import {TestVoicePage} from "./test-voice"
import {TestPhotoPage} from "./test-photo"
import {TestVideoPage} from "./test-video"
import {TestAudioPage} from "./test-audio"
import {BlockSwitchPage} from "./block-switch"
import {BlockImportPage} from "./block-import"
import {TestContactPage} from "./test-contact"
import {TestStickerPage} from "./test-sticker"
import {TestLocationPage} from "./test-location"
import {TestDocumentPage} from "./test-document"
import {CounterThreadPage} from "./counter-thread"
import {TestAnimationPage} from "./test-animation"
import {TestVideoNotePage} from "./test-video-note"
import {InputText2Page} from "./input-text-2"

export class StartPage extends PageBase {
  static data = this.buildData((rdm?: string) => rdm)

  kb() {
    return this.ikb((k, a) => {
      return k //
        .text(a[0]!, CounterPage.data.callbackData())
        .text(a[1]!, CounterThreadPage.data.callbackData())
        .row()
        .text(a[2]!, HelpPage.data.callbackData())
        .text(a[3]!, LanguagePage.data.callbackData())
        .row()
        .text(a[4]!, TestPhotoPage.data.callbackData())
        .text(a[5]!, TestVideoPage.data.callbackData())
        .row()
        .text(a[6]!, TestAudioPage.data.callbackData())
        .text(a[7]!, TestDocumentPage.data.callbackData())
        .row()
        .text(a[8]!, TestAnimationPage.data.callbackData())
        .text(a[9]!, TestVoicePage.data.callbackData())
        .row()
        .text(a[10]!, TestVideoNotePage.data.callbackData())
        .text(a[11]!, TestStickerPage.data.callbackData())
        .row()
        .text(a[12]!, TestLocationPage.data.callbackData())
        .text(a[13]!, TestContactPage.data.callbackData())
        .row()
        .text(a[14]!, TestErrorPage.data.callbackData())
        .text(a[15]!, InputText2Page.data.callbackData())
        .row()
        .text(a[16]!, InputTextPage.data.callbackData())
        .text(a[17]!, BlockMapPage.data.callbackData())
        .row()
        .text(a[18]!, BlockImportPage.data.callbackData())
        .text(a[19]!, BlockSwitchPage.data.callbackData())
        .row()
        .text(a[20]!, KbbePage.data.callbackData())
        .text(a[21]!, this.data.callbackData())
    })
  }
  async internal(condition = 1) {
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
    await this.internal(1)
  }
  async text() {
    await this.internal(1)
  }
  async textPayload() {
    await this.internal(1)
  }
  async textCommand() {
    await this.internal(1)
  }
  async textCommandPayload() {
    await this.internal(1)
  }
  async callback() {
    await this.internal(2)
  }
  async callbackPayload() {
    await this.internal(3)
  }
  static template = /*jsx*/ `
    <base id="kb-for-block-import">
      ${this.kbc.refreshBack()}
    </base>
    <base id="for-block-import">
      <import src="start" base="kb-for-block-import" />
      <message>
        This message and keyboard import from start.ts for file block-import.ts use block import

        Random: {{number}}
      </message>
      <message lang="id">
        Pesan ini dan keyboard di import dari start.ts untuk file block-import.ts menggunakan block import

        Acak: {{number}}
      </message>
    </base>
    <base>
      <description>Default description command start</description>
      <description lang="en">[EN] Description command start</description>
      <description lang="id">[ID] Deskripsi perintah start</description>
      <keyboard>Counter, Counter Thread, Help, Language, Test Photo, Test Video, Test Audio, Test Document, Test Animation, Test Voice, Test VideoN, Test Sticker, Test Location, Test Contact, Test Error, Input Text2, Input Text, Block Map, Block Import, Block Switch, Kbbe, Refresh</keyboard>
      <keyboard lang="id">Kounter, Kounter Thread, Bantuan, Bahasa, Test Foto, Test Video, Test Suara, Test Dokumen, Test Animasi, Test Suara, Test VideoN, Test Stiker, Test Lokasi, Test Kontak, Test Salah, Masukkan Teks2, Masukkan Teks, Blok Map, Blok Import, Blok Switch, Kbbe, Segarkan</keyboard>
      <message>
        {{time}}

        Hi {{firstName}}, welcome to bot.

        This is test gramstax
      </message>
      <message lang="id">
        {{time}}

        Hi {{firstName}}, selamat datang di bot

        Ini adalah test gramstax
      </message>
    </base>
  `
}
