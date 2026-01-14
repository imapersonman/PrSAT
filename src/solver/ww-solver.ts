import { EvaluatorOutput, ModelEntry, new_promise, PrSatSolver, raw_solver_solver_data_to_data, RawActiveSolver, RawSolverResult, solver_data_to_raw_solver_data, StagedSolver } from ".";
import { PrSat, ConstraintOrRealExpr } from "../types";
import { assert, assert_exists, PromiseFuncs, record_keys_2 } from "../utils";
import { FromSolvingWebWorkerSolver, FromSolvingWebWorkerSolverMap, ToSolvingWebWorker } from "./ww";

// Thank you, https://stackoverflow.com/questions/77324064/union-types-do-not-work-when-combined-with-omit
type DistrOmit<U, K extends keyof U> = U extends any
  ? Omit<U, K>
  : never

type WWPromiseFuncsMap = {
  [K in keyof FromSolvingWebWorkerSolverMap]: {
    any: PromiseFuncs<FromSolvingWebWorkerSolverMap[K]>[]
    expected: { [request_id: number]: PromiseFuncs<FromSolvingWebWorkerSolverMap[K]> }
  }
}

class WorkerListenerHandler {
  private readonly promise_funcs: WWPromiseFuncsMap = {
    started: { any: [], expected: {} },
    finished: { any: [], expected: {} },
    evaluated: { any: [], expected: {} },
    unexpected: { any: [], expected: {} },
    exception: { any: [], expected: {} },
  }
  private global_exception: Error | undefined = undefined
  private next_request_id = 0

  constructor(private readonly worker: Worker) {
    // worker.addEventListener('error', (event) => this.reject_everything(event.error))
    // worker.addEventListener('messsageerror', (_msg) => this.reject_everything(new Error('messageerror and I don\'t know why!')))
    // worker.addEventListener('message', (msg) => {
    //   const message = msg.data as FromSolvingWebWorkerSolver
    //   const all_pfuncs = assert_exists(this.promise_funcs[message.tag])

    //   const expecting_pfuncs = all_pfuncs.expected[message.request_id]
    //   if (expecting_pfuncs !== undefined) {
    //     expecting_pfuncs.resolve(message as any)
    //     delete all_pfuncs.expected[message.request_id]
    //   }

    //   for (const pfuncs of all_pfuncs.any) {
    //     pfuncs.resolve(message as any)
    //   }
    //   all_pfuncs.any = []

    //   if (message.tag === 'exception') {
    //     this.reject_everything(message.error)  // Just burn it all down.
    //   }
    // })
    worker.onerror = (event) => {
      this.reject_everything(event.error)
    }
    worker.onmessageerror = (_msg) => {
      this.reject_everything(new Error('messageerror and I don\'t know why!'))
    }
    worker.onmessage = (msg) => {
      const message = msg.data as FromSolvingWebWorkerSolver
      const all_pfuncs = assert_exists(this.promise_funcs[message.tag])

      const expecting_pfuncs = all_pfuncs.expected[message.request_id]
      if (expecting_pfuncs !== undefined) {
        expecting_pfuncs.resolve(message as any)
        delete all_pfuncs.expected[message.request_id]
      }

      for (const pfuncs of all_pfuncs.any) {
        pfuncs.resolve(message as any)
      }
      all_pfuncs.any = []

      if (message.tag === 'exception') {
        this.reject_everything(message.error)  // Just burn it all down.
      }
    }
  }

  private reject_everything(error: Error): void {
    // The web worker should be written to only throw in cases where something
    //   terrible happened and everything should fail, so we'll go through and
    //   reject all promises.
    for (const tag of record_keys_2(this.promise_funcs)) {
      const all_pfuncs = assert_exists(this.promise_funcs[tag], `this.promise_funcs missing tag '${tag}'!`)
      const pfuncs_map = all_pfuncs.expected

      for (const request_id of record_keys_2(pfuncs_map)) {
        const pfuncs = assert_exists(pfuncs_map[request_id], `this.promise_funcs['${tag}'] is missing request_id = ${request_id}!`)
        pfuncs.reject(error)
      }

      for (const pfuncs of all_pfuncs.any) {
        pfuncs.reject(error)
      }

      all_pfuncs.expected = {}
      all_pfuncs.any = []
    }

    this.global_exception = error
  }

  private register<T extends FromSolvingWebWorkerSolver['tag']>(
    tag: T,
    pfuncs: PromiseFuncs<FromSolvingWebWorkerSolverMap[T]>,
    request_id?: number,
  ) {
    const all_pfuncs = assert_exists(this.promise_funcs[tag], `Missing all pfuncs for message tag '${tag}'!`)
    if (request_id === undefined) {
      all_pfuncs.any.push(pfuncs)
    } else {
      assert(all_pfuncs.expected[request_id] === undefined, `Already made request with id ${request_id}!`)
      all_pfuncs.expected[request_id] = pfuncs
    }
  }

  post_message(message: DistrOmit<ToSolvingWebWorker, 'request_id'>): number {
    const request_id = this.next_request_id++
    this.worker.postMessage({ ...message, request_id })
    return request_id
  }

  wait_for<T extends FromSolvingWebWorkerSolver['tag']>(
    tag: T,
    request_id?: number,  // If missing, we will wait for 
  ): Promise<FromSolvingWebWorkerSolverMap[T]> {
    if (this.global_exception !== undefined) {
      throw this.global_exception  // I can do this because this code is almost certainly running on the main thread.
    } else {
      return new_promise<FromSolvingWebWorkerSolverMap[T]>(`wait-for-'${tag}'`, (resolve, reject) => {
        this.register(tag, { resolve, reject }, request_id)
      })
    }
  }

  terminate(): void {
    this.worker.terminate()
  }
}

export class WebWorkerSolver implements PrSatSolver {
  private web_worker: Worker | undefined = undefined
  private worker_listener_handler: WorkerListenerHandler | undefined = undefined
  private readonly index_to_model = new Map<number, Record<number, ModelEntry>>()
  private readonly model_to_index = new Map<Record<number, ModelEntry>, number>()

  // private assert(): Worker {
  //   return assert_exists(this.web_worker, 'Trying to access uninitialized WebWorker!')
  // }

  private assert(): WorkerListenerHandler {
    return assert_exists(this.worker_listener_handler, 'Trying to access uninitialized WorkerListenerHandler!')
  }

  // private post_message(message: ToSolvingWebWorker) {
  //   this.assert().postMessage(message)
  // }

  async initialize(): Promise<void> {
    console.log()
    assert(this.web_worker === undefined, 'Trying to initialize an already initialized WebWorker!\nDeinitialize first.')
    assert(this.worker_listener_handler === undefined, 'Trying to initialize an already initialized WebListenerHandler!\nDeinitialize first.')

    const worker_url = new URL('./ww.ts', import.meta.url)
    const worker = new Worker(worker_url, { type: 'module' })
    this.web_worker = worker
    this.worker_listener_handler = new WorkerListenerHandler(this.web_worker)
  }

  async deinitialize(): Promise<void> {
    // assert_exists(this.worker_listener_handler, 'Trying to deinitialize an uninitialized WorkerListenerHandler!').terminate()
    // this.worker_listener_handler?.terminate()
    this.assert().terminate()
    this.worker_listener_handler = undefined
    this.web_worker = undefined
    this.index_to_model.clear()
    this.model_to_index.clear()
  }

  async start(constraints: PrSat["Constraint"][], regular: boolean): Promise<StagedSolver> {
    const request_id = this.assert().post_message({ tag: 'start', constraints, regular })
    const abort_controller = new AbortController()
    abort_controller.signal.addEventListener('abort', () => this.assert().post_message({ tag: 'cancel' }))
    const make_promise = () => ({
      promise: new_promise<RawSolverResult>('wait-solve(ww)', (resolve, reject) => {
        this.assert().wait_for('finished')
          .then(({ result, model_index }) => {
            const [status, data] = result
            if (status === 'exception') {
              reject(data)
            } else {
              if (status === 'sat') {
                const mi = assert_exists(model_index, 'Result is sat but missing model_index!')
                this.index_to_model.set(mi, data)
              }
              resolve(result)
            }
          })
          .catch(reject)
      }),
      abort_controller,
    })

    const active_solver = await this.assert().wait_for('started', request_id)
    return {
      // abort_controller,
      data: active_solver.data,
      make_promise,
    }
  }

  async evaluate(model: Record<number, ModelEntry>, c_or_re: ConstraintOrRealExpr): Promise<EvaluatorOutput> {
    const model_index = assert_exists(this.model_to_index.get(model), 'Model doesn\'t have an index!')
    const request_id = this.assert().post_message({ tag: 'evaluate', model_index, c_or_re })
    const response = await this.assert().wait_for('evaluated', request_id)
    return response.output
  }
}