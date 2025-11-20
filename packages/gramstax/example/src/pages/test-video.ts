import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class TestVideoPage extends CtxCore {
  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    const kb = this.kb()
    await this.editVideo(kb)
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media lang="en" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        This is a caption text for media <b>video</b>
      </media>

      <media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        Ini adalah caption text untuk media <b>video</b>
      </media>
    </base>
  `
}
