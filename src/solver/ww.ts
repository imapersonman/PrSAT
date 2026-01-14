import { EvaluatorOutput, ModelEntry, RawActiveSolver, RawSolverData, RawSolverResult, SolverData, StagedSolver } from ".";
import { UnionToTagMap } from "../tag_map";
import { ConstraintOrRealExpr, PrSat } from "../types";
import { assert_exists, fallthrough } from "../utils";
import { BaseSolver } from "./basic";

// We do not want to throw here!

export type ToSolvingWebWorker =
  | { tag: 'start', request_id: number, constraints: PrSat['Constraint'][], regular: boolean }
  | { tag: 'go', request_id: number }
  | { tag: 'cancel', request_id: number }
  | { tag: 'evaluate', request_id: number, model_index: number, c_or_re: ConstraintOrRealExpr }

export type FromSolvingWebWorkerSolver =
  | { tag: 'started', request_id: number, data: RawSolverData }
  | { tag: 'finished', request_id: number, result: RawSolverResult, model_index?: number }  // model_index is set iff result is sat!
  | { tag: 'evaluated', request_id: number, output: EvaluatorOutput }
  | { tag: 'unexpected', request_id: number, message: string }
  | { tag: 'exception', request_id: number, error: Error }
export type FromSolvingWebWorkerSolverMap = UnionToTagMap<'tag', FromSolvingWebWorkerSolver>

const post_message = (message: FromSolvingWebWorkerSolver): void => self.postMessage(message)
const base_solver = new BaseSolver()
let next_model_index = 0
const model_map = new Map<number, Record<number, ModelEntry>>()
// let current_active_solver: RawActiveSolver | undefined = undefined
let current_staged_solver: { stage: StagedSolver, active_solver: RawActiveSolver | undefined } | undefined = undefined

await base_solver.initialize()

self.onmessage = async (message) => {
  const msg = message.data as ToSolvingWebWorker  // todo: (more) validation!
  if (!('request_id' in msg)) {
    throw new Error('\'request_id\' missing from msg in WebWorker!')
  }
  if (typeof msg.request_id !== 'number') {
    throw new Error(`request_id should be a number, but is instead a ${typeof msg.request_id}!`)
  }

  try {
    if (msg.tag === 'start') {
      if (current_staged_solver !== undefined && current_staged_solver.active_solver !== undefined) {
        // post_message({ tag: 'unexpected', request_id: msg.request_id, message: 'Trying to start a new solve when one is still in progress!' })
        post_message({ tag: 'exception', request_id: msg.request_id, error: new Error('Trying to stage a new solve when another has already been staged and a current solve is in progress!') })
      } else {
        // current_active_solver = await base_solver.start(msg.constraints, msg.regular)
        // current_active_solver.promise
        //   .then((r) => finish_solve(msg.request_id, r))
        //   .catch((e) => post_message({ tag: 'exception', request_id: msg.request_id, error: e }))

        const stage = await base_solver.start(msg.constraints, msg.regular)
        current_staged_solver = { stage, active_solver: undefined }
        post_message({ tag: 'started', request_id: msg.request_id, data: stage.data })
      }
    } else if (msg.tag === 'go') {
      if (current_staged_solver === undefined) {
        post_message({ tag: 'exception', request_id: msg.request_id, error: new Error('Trying to start a solve that hasn\'t been staged yet!') })
      } else if (current_staged_solver.active_solver !== undefined) {
        post_message({ tag: 'exception', request_id: msg.request_id, error: new Error('Trying to start a staged solve that\'s already been started!') })
      } else {
        const stage = current_staged_solver.stage
        const { promise, abort_controller } = stage.make_promise()
        const mod_promise: Promise<RawSolverResult> = promise
          .then((r) => { finish_solve(msg.request_id, r); return r })
          .catch<RawSolverResult>((e) => { post_message({ tag: 'exception', request_id: msg.request_id, error: e }); return promise })  // EEWWW
        current_staged_solver.active_solver = {
          data: stage.data,
          promise: mod_promise,
          abort_controller,
        }
      }
    } else if (msg.tag === 'cancel') {
      if (current_staged_solver === undefined) {
        post_message({ tag: 'unexpected', request_id: msg.request_id, message: 'Trying to cancel a solve that hasn\'t been staged!' })
      } else if (current_staged_solver.active_solver === undefined) {
        post_message({ tag: 'unexpected', request_id: msg.request_id, message: 'Trying to cancel a solve that has been staged but not started!!' })
      } else {
        // current_active_solver.abort_controller.abort()
        // await current_active_solver.promise
        // post_message({ tag: 'finished', request_id: msg.request_id, result: ['cancelled', undefined] })

        const active_solver = current_staged_solver.active_solver
        active_solver.abort_controller.abort()
        await active_solver.promise
        post_message({ tag: 'finished', request_id: msg.request_id, result: ['cancelled', undefined] })
      }
    } else if (msg.tag === 'evaluate') {
      const model = assert_exists(model_map.get(msg.model_index), `Can't find model at model_index ${msg.model_index}!`)
      const output = await base_solver.evaluate(model, msg.c_or_re)
      post_message({ tag: 'evaluated', request_id: msg.request_id, output })
    } else {
      fallthrough('self.on_message', msg)
    }
  } catch (e: any) {
    post_message({ tag: 'exception', request_id: msg.request_id, error: e })
  }
}

const finish_solve = (request_id: number, result: RawSolverResult): void => {
  const [status, data] = result
  if (status === 'sat') {
    const model_index = next_model_index++
    post_message({ tag: 'finished', request_id, result, model_index })
    model_map.set(model_index, data)
  } else {
    post_message({ tag: 'finished', request_id, result })
  }
  // current_active_solver = undefined
  current_staged_solver = undefined
}
