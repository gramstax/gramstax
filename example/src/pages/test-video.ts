import { PageBase } from "~/base"
import { StartPage } from "./start"

export class TestVideoPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editVideo(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Back</keyboard>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        This is a caption text for media <b>video</b>
      </media>

      <media lang="en" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        This is a caption text for media <b>video</b>
      </media>

      <media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        Ini adalah caption text untuk media <b>video</b>
      </media>
    </base>
  `
}
