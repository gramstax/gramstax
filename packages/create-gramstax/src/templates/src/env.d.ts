declare namespace NodeJS {
  interface ProcessEnv {
    BOT_TOKEN: string
    BOT_DEPLOY: string
    NODE_ENV?: `development` | `production`
    CACHE_SESSION?: string
  }
}
