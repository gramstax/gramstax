import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class TestStickerPage extends CtxCore {
  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    const kb = this.kb()
    await this.editSticker(kb)
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media lang="en" type="sticker" src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzkwMDVreGl2d3o4aTkzNnp4cXprcmNsZDZpdTFnZnpiNjl3MXZrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/OODdDyv4DwkNNTpMWS/giphy.gif"></media>
      <media lang="id" type="sticker" src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzkwMDVreGl2d3o4aTkzNnp4cXprcmNsZDZpdTFnZnpiNjl3MXZrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/OODdDyv4DwkNNTpMWS/giphy.gif"></media>
    </base>
  `
}
