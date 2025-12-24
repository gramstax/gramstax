import { PageBase } from "~/base/page"
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
      <import src="start" base="ikb-back" />

      <media type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
      <media lang="id" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
    </base>
  `
}
