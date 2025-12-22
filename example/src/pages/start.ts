import { MapPage } from "./map"
import { HelpPage } from "./help"
import { PageBase } from "~/base/page"
import { CounterPage } from "./count"
import { LanguagePage } from "./language"
import { InputTextPage } from "./input-text"
import { TestErrorPage } from "./test-error"
import { TestVoicePage } from "./test-voice"
import { TestPhotoPage } from "./test-photo"
import { TestVideoPage } from "./test-video"
import { TestAudioPage } from "./test-audio"
import { TestContactPage } from "./test-contact"
import { TestStickerPage } from "./test-sticker"
import { TestLocationPage } from "./test-location"
import { TestDocumentPage } from "./test-document"
import { TestAnimationPage } from "./test-animation"
import { TestVideoNotePage } from "./test-video-note"
import { TestErrorInputPage } from "./test-error-input"

export class StartPage extends PageBase {
  public static data = this.buildData((con: string = ``) => con)

  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return (
        kb
          //
          .text(arr[0]!, CounterPage.data.callbackData())
          .text(arr[1]!, HelpPage.data.callbackData())
          .row()
          .text(arr[2]!, LanguagePage.data.callbackData())
          .text(arr[3]!, TestPhotoPage.data.callbackData())
          .row()
          .text(arr[4]!, TestVideoPage.data.callbackData())
          .text(arr[5]!, TestAudioPage.data.callbackData())
          .row()
          .text(arr[6]!, TestDocumentPage.data.callbackData())
          .text(arr[7]!, TestAnimationPage.data.callbackData())
          .row()
          .text(arr[8]!, TestVoicePage.data.callbackData())
          .text(arr[9]!, TestVideoNotePage.data.callbackData())
          .row()
          .text(arr[10]!, TestStickerPage.data.callbackData())
          .text(arr[11]!, TestLocationPage.data.callbackData())
          .row()
          .text(arr[12]!, TestContactPage.data.callbackData())
          .text(arr[13]!, TestErrorPage.data.callbackData())
          .row()
          .text(arr[14]!, TestErrorInputPage.data.callbackData())
          .text(arr[15]!, InputTextPage.data.callbackData())
          .row()
          .text(arr[16]!, MapPage.data.callbackData())
          .row()
          .text(arr[17]!, this.data.callbackData())
      )
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
    <base>
      <description>Default description command start</description>
      <description lang="en">[EN] Description command start</description>
      <description lang="id">[ID] Deskripsi perintah start</description>      
      <keyboard type="inline">Counter, Help, Language, Test Photo, Test Video, Test Audio, Test Document, Test Animation, Test Voice, Test VideoN, Test Sticker, Test Location, Test Contact, Test Error, Test ErrorI, Input Text, Map Data, Refresh</keyboard>
      <keyboard lang="en" type="inline">Counter, Help, Language, Test Photo, Test Video, Test Audio, Test Document, Test Animation, Test Voice, Test VideoN, Test Sticker, Test Location, Test Contact, Test Error, Test ErrorI, Input Text, Map Data, Refresh</keyboard>
      <keyboard lang="id" type="inline">Kounter, Bantuan, Bahasa, Test Foto, Test Video, Test Suara, Test Dokumen, Test Animasi, Test Suara, Test VideoN, Test Stiker, Test Lokasi, Test Kontak, Test Salah, Test SalahI, Masukkan Teks, Peta Data, Segarkan</keyboard>

      <message>
        {{time}}

        Hi {{firstName}}, welcome to bot.

        This is test gramstax
      </message>

      <message lang="en">
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
