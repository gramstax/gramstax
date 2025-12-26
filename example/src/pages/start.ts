import { HelpPage } from "./help"
import { PageBase } from "~/base/page"
import { CounterPage } from "./counter"
import { LanguagePage } from "./language"
import { BlockMapPage } from "./block-map"
import { InputTextPage } from "./input-text"
import { TestErrorPage } from "./test-error"
import { TestVoicePage } from "./test-voice"
import { TestPhotoPage } from "./test-photo"
import { TestVideoPage } from "./test-video"
import { TestAudioPage } from "./test-audio"
import { BlockImportPage } from "./block-import"
import { TestContactPage } from "./test-contact"
import { TestStickerPage } from "./test-sticker"
import { TestLocationPage } from "./test-location"
import { TestDocumentPage } from "./test-document"
import { CounterThreadPage } from "./counter-thread"
import { TestAnimationPage } from "./test-animation"
import { TestVideoNotePage } from "./test-video-note"
import { TestErrorInputPage } from "./test-error-input"

export class StartPage extends PageBase {
  public static data = this.buildData((con: string = ``) => con)

  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, CounterPage.data.callbackData())
        .text(arr[1]!, CounterThreadPage.data.callbackData())
        .row()
        .text(arr[2]!, HelpPage.data.callbackData())
        .text(arr[3]!, LanguagePage.data.callbackData())
        .row()
        .text(arr[4]!, TestPhotoPage.data.callbackData())
        .text(arr[5]!, TestVideoPage.data.callbackData())
        .row()
        .text(arr[6]!, TestAudioPage.data.callbackData())
        .text(arr[7]!, TestDocumentPage.data.callbackData())
        .row()
        .text(arr[8]!, TestAnimationPage.data.callbackData())
        .text(arr[9]!, TestVoicePage.data.callbackData())
        .row()
        .text(arr[10]!, TestVideoNotePage.data.callbackData())
        .text(arr[11]!, TestStickerPage.data.callbackData())
        .row()
        .text(arr[12]!, TestLocationPage.data.callbackData())
        .text(arr[13]!, TestContactPage.data.callbackData())
        .row()
        .text(arr[14]!, TestErrorPage.data.callbackData())
        .text(arr[15]!, TestErrorInputPage.data.callbackData())
        .row()
        .text(arr[16]!, InputTextPage.data.callbackData())
        .text(arr[17]!, BlockMapPage.data.callbackData())
        .row()
        .text(arr[18]!, BlockImportPage.data.callbackData())
        .row()
        .text(arr[19]!, this.data.callbackData())
    })
  }

  public async internal(condition = 1) {
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

  public async text() {
    await this.internal(1)
  }

  public async textPayload() {
    await this.internal(1)
  }

  public async textCommand() {
    await this.internal(1)
  }

  public async textCommandPayload() {
    await this.internal(1)
  }

  public async callback() {
    await this.internal(2)
  }

  public async callbackPayload() {
    await this.internal(3)
  }

  public static template = /*jsx*/ `
    <base id="ikb-home">
      <keyboard type="inline">.. Home</keyboard>
      <keyboard lang="id" type="inline">.. Beranda</keyboard>
    </base>

    <base id="ikb-cancel">
      <keyboard type="inline">Cancel</keyboard>
      <keyboard lang="id" type="inline">Batal</keyboard>
    </base>

    <base id="ikb-back">
      <keyboard type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>
    </base>

    <base id="ikb-refresh-back">
      <keyboard type="inline">
        Refresh, 
        <import src="start" base="ikb-back" lang="default" block="keyboard" section="value" />
      </keyboard>
      <keyboard lang="id" type="inline">
        Segarkan, 
        <import src="start" base="ikb-back" lang="id" block="keyboard" section="value" />
      </keyboard>
    </base>

    <base id="for-block-import">
      <import src="start" base="ikb-back" />

      <message>
        This message and keyboard import from start.ts for file block-import.ts

        Random: {{number}}
      </message>
      <message lang="id">
        Pesan ini dan keyboard di import dari start.ts untuk file block-import.ts

        Acak: {{number}}
      </message>
    </base>

    <base>
      <description>Default description command start</description>
      <description lang="en">[EN] Description command start</description>
      <description lang="id">[ID] Deskripsi perintah start</description>      
      <keyboard type="inline">Counter, Counter Thread, Help, Language, Test Photo, Test Video, Test Audio, Test Document, Test Animation, Test Voice, Test VideoN, Test Sticker, Test Location, Test Contact, Test Error, Test ErrorI, Input Text, Block Map, Block Import, Refresh</keyboard>
      <keyboard lang="id" type="inline">Kounter, Kounter Thread, Bantuan, Bahasa, Test Foto, Test Video, Test Suara, Test Dokumen, Test Animasi, Test Suara, Test VideoN, Test Stiker, Test Lokasi, Test Kontak, Test Salah, Test SalahI, Masukkan Teks, Blok Map, Blok Import, Segarkan</keyboard>

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
