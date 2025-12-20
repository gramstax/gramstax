import { PageBase } from "~/base"
import { StartPage } from "./start"

export class TestVideoNotePage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editVideoNote(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Back</keyboard>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
      <media lang="en" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
      <media lang="id" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
    </base>
  `
}
