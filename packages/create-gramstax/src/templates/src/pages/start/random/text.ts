import {PageBase} from "~/base/page"
import {StartRandomPage} from "."

const _WORDS = [
  `innovation`,
  `discovery`,
  `adventure`,
  `knowledge`,
  `wisdom`,
  `curiosity`,
  `imagination`,
  `creation`,
  `exploration`,
  `inspiration`,
  `freedom`,
  `harmony`,
  `courage`,
  `patience`,
  `kindness`,
  `brilliance`,
  `serendipity`,
  `resilience`,
  `ambition`,
  `compassion`,
  `optimism`,
  `integrity`,
  `gratitude`,
  `humility`,
  `perseverance`
]

const _ID_WORDS = [
  `inovasi`,
  `penemuan`,
  `petualangan`,
  `pengetahuan`,
  `kebijaksanaan`,
  `rasa ingin tahu`,
  `imajinasi`,
  `kreasi`,
  `eksplorasi`,
  `inspirasi`,
  `kemerdekaan`,
  `keharmonisan`,
  `keberanian`,
  `kesabaran`,
  `kebaikan`,
  `kecerdasan`,
  `keberuntungan`,
  `ketahanan`,
  `ambisi`,
  `kasih sayang`,
  `optimisme`,
  `integritas`,
  `rasa syukur`,
  `kerendahan hati`,
  `ketekunan`
]

export class StartRandomTextPage extends PageBase {
  static data = this.buildData()
  
  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {
    pickRandom: <T>(arr: T[], count: number): T[] => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, count)
    }
  }
  gdefault = {
    show: async () => {
      const count = Math.floor(Math.random() * 3) + 2 // 2–4 words
      const lang = this.from.language_code
      await this.renderText({keyboard: this.inlineKeyboardT([this, StartRandomPage], `2`), data: {
          res: lang === `en` ? this.helper.pickRandom(_WORDS, count).join(` `) : lang === `id` ? this.helper.pickRandom(_ID_WORDS, count).join(` `) : this.helper.pickRandom(_WORDS, count).join(` `)
        }})
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🔁 Regenerate, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">🔁 Regenerasi, ${this.kbl.back.id}</g-keyboard>
      <g-message>
        <b>📝 Random Text</b>

        {{res}}
      </g-message>
      <g-message lang="id">
        <b>📝 Teks Acak</b>

        {{res}}
      </g-message>
    </g-base>
  `
}
