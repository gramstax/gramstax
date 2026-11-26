import {PageBase} from "~/base/page"
import {nextCountFromTap} from "~/utils/tap"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.renderWidget({data: {count: 0}})
  }

  async handleCallbackQueryData() {
    await this.renderWidget({data: {count: 0}})
  }

  async handleFreeWidgetQuery() {
    const count = nextCountFromTap(this.widgetQuery?.data ?? ``)
    if (count === null) {
      await this.renderWidgetAnswer()
      return
    }
    await this.renderWidgetAnswer()
    await this.renderWidget({mode: `update-data`, data: {count}})
  }

  helper = {}
  static template = `
    <g-base>
      <g-widget allow_queries chat_data='{"count": {{{count}}}}' width="400" height="200">
        <g-widget-caption>
          Tap counter — press the button inside the widget and watch the number grow. The widget reads its number from chat_data and redraws whenever the bot pushes new state.
        </g-widget-caption>
        <g-widget-body>
          <style>
            body { margin: 0; font: 15px system-ui; text-align: center; color: var(--tg-theme-text-color); }
            #count { font-size: 48px; font-weight: 700; margin: 16px 0 8px; }
            #tap { font-size: 17px; padding: 10px 28px; }
          </style>
          <div id="count">0</div>
          <button id="tap" type="button">+1 Tap</button>
          <script>
            var W = window.TelegramWidget
            var el = document.getElementById('count')
            function current() { try { return JSON.parse(W.chatData).count || 0 } catch (e) { return 0 } }
            function draw() { el.textContent = current() }
            document.getElementById('tap').addEventListener('click', function () { W.request('tap:' + current()).catch(function () {}) })
            W.onEvent('chatDataChanged', draw)
            draw()
          </script>
        </g-widget-body>
      </g-widget>
      <g-widget lang="id" allow_queries chat_data='{"count": {{{count}}}}' width="400" height="200">
        <g-widget-caption>
          Penghitung ketuk — tekan tombol di dalam widget dan lihat angkanya bertambah. Widget membaca angkanya dari chat_data dan menggambar ulang setiap kali bot mengirim state baru.
        </g-widget-caption>
        <g-widget-body>
          <style>
            body { margin: 0; font: 15px system-ui; text-align: center; color: var(--tg-theme-text-color); }
            #count { font-size: 48px; font-weight: 700; margin: 16px 0 8px; }
            #tap { font-size: 17px; padding: 10px 28px; }
          </style>
          <div id="count">0</div>
          <button id="tap" type="button">+1 Tap</button>
          <script>
            var W = window.TelegramWidget
            var el = document.getElementById('count')
            function current() { try { return JSON.parse(W.chatData).count || 0 } catch (e) { return 0 } }
            function draw() { el.textContent = current() }
            document.getElementById('tap').addEventListener('click', function () { W.request('tap:' + current()).catch(function () {}) })
            W.onEvent('chatDataChanged', draw)
            draw()
          </script>
        </g-widget-body>
      </g-widget>
      <g-widget-answer>
        Counted!
      </g-widget-answer>
      <g-widget-answer lang="id">
        Terhitung!
      </g-widget-answer>
    </g-base>
  `
}
