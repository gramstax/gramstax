import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class TestAudioPage extends CtxCore {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editAudio(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media lang="en" type="audio" src="https://www.w3schools.com/html/horse.ogg">
        This is a caption text for media <b>audio</b>
      </media>

      <media lang="id" type="audio" src="https://www.w3schools.com/html/horse.ogg">
        Ini adalah caption text untuk media <b>suara</b>
      </media>
    </base>
  `
}
