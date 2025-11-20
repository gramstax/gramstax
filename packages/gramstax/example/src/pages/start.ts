import { CtxCore } from "../core/ctx"
import { HelpPage } from "./help"
import { CounterPage } from "./count"
import { TestPhotoPage } from "./test-photo"
import { TestVideoPage } from "./test-video"

export class StartPage extends CtxCore {
  static data = this.buildData((isFromMedia?: string) => isFromMedia)

  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return (
        kb
          //
          .text(arr[0], CounterPage.data.callbackData())
          .text(arr[1], HelpPage.data.callbackData())
          .row()
          .text(arr[2], TestPhotoPage.data.callbackData())
          .text(arr[3], TestVideoPage.data.callbackData())
          .row()
          .text(arr[4], this.data.callbackData())
      )
    })
  }

  public async internal(condition = 1) {
    const kb = this.kb()
    const da = {
      first_name: this.firstname,
      time: new Date().toString()
    }

    if (condition == 1) {
      await this.reply(kb, da)
    } else if (condition == 2) {
      await this.edit(kb, da)
    } else if (condition == 3) {
      await this.delete()
      await this.reply(kb, da)
    }
  }

  public async textCommand() {
    await this.internal(1)
  }

  public async callback() {
    await this.internal(2)
  }

  public async callbackPayload() {
    await this.internal(3)
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">Counter, Help, Test Photo, Test Video, Refresh</keyboard>
      <keyboard lang="id" type="inline">Kounter, Bantuan, Test Photo, Test Video, Segarkan</keyboard>

      <message lang="en">
        {{time}}

        Hi {{first_name}}, welcome to bot.

        This is test gramstax
      </message>

      <message lang="id">
        {{time}}

        Hi {{first_name}}, selamat datang di bot

        Ini adalah test gramstax
      </message>
    </base>
  `
}
