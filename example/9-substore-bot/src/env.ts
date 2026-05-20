export class Env {
  static TELEGRAM_BOT_DEPLOY = `polling` as string
  static TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN || `7815352851:AAGdLYBm8GKF7f26zi7cUmxsKM2jZseqgfI`
  static STORE_ADMIN_USERNAME = process.env.STORE_ADMIN_USERNAME || `@ai_newsletter_pro_bot`
}
