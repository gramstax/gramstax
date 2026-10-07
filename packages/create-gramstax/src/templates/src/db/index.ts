import {LmdbEnv, LmdbError, LmdbJobRun} from "@gramstax/lmdb"
import {LogHe} from "~/helpers/log"
import {UserRepository} from "./repositories/user"
import {UserSchema} from "./schema/user"

export class Db extends LmdbEnv {
  /**
   * `maxDbs` is a slot budget, not a database count: every schema, every
   * `.unique()`/`.index()`, and the `__job_run` bookkeeping sub each take one.
   * The package reports through `onWarn` once fewer than 32 slots remain.
   */
  static readonly MAX_DBS = 32

  private static _instance: Db | undefined
  private static _job: ReturnType<LmdbJobRun["start"]> | undefined

  readonly user: UserRepository
  readonly jobRun: LmdbJobRun

  constructor(storePath: string) {
    super({
      path: storePath,
      maxDbs: Db.MAX_DBS,
      compression: true,
      encoding: `msgpack`,
      // @gramstax/lmdb writes nothing to console — it reports here instead, so
      // the application decides where diagnostics end up. With no listener
      // attached they are dropped, which is why a real app wires one up.
      onWarn: (message) => LogHe.warn(`[db] ${message}`)
    })
    this.user = new UserRepository(this.register(UserSchema))
    // Takes its `__job_run` slot eagerly, so construct it only because
    // something below actually schedules a job.
    this.jobRun = new LmdbJobRun(this)
  }

  /** Map pressure, for health checks and the status page. */
  usage() {
    return this.getMapSizeUsed()
  }

  /**
   * Open the process-wide database.
   *
   * Pages reach the store through {@link Db.get} rather than a ctx field,
   * because Gramstax's ctx scope is fixed and cannot carry an app-specific
   * service.
   */
  static open(storePath: string = process.env.DB_PATH ?? `./data`): Db {
    if (Db._instance) return Db._instance
    Db._instance = new Db(storePath)
    return Db._instance
  }

  static get(): Db {
    if (!Db._instance) throw new LmdbError(`Db is not open — call Db.open() during startup before using it`)
    return Db._instance
  }

  /**
   * Open the database and start the restart-safe schedule.
   *
   * The schedule lives here rather than in the worker thread: its run-stamp is a
   * `__job_run` row, so a restart resumes the cadence instead of replaying every
   * tick missed while the process was down.
   */
  static async start(): Promise<void> {
    const db = Db.open()
    Db._job = db.jobRun.start(`nightly-report`, {
      pattern: `0 3 * * *`,
      timezone: `Asia/Jakarta`,
      task: async () => {
        // Real maintenance goes here; reporting keeps a fresh
        // scaffold visibly alive in the logs.
        const usage = db.usage()
        LogHe.info(`[job] nightly-report users=${db.user.count()} map=${usage.used}/${usage.total}`)
      },
      onError: (err) => LogHe.errorMake(err, `Db`, `nightly-report`)
    })
  }

  /** Stop the schedule, then release the env. Safe to call when not started. */
  static async stop(): Promise<void> {
    Db._job?.stop()
    Db._job = undefined
    const open = Db._instance
    Db._instance = undefined
    await open?.close()
  }
}