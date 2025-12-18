import { TruthTable, VariableLists } from "../pr_sat"
import { S } from "../s"
import { run_solve_cancel_logic } from "../solve_cancel_logic"
import { UnionToTagMap } from "../tag_map"
import { make_timeout_timer } from "../timeout_web_worker/interface"
import { ConstraintOrRealExpr, PrSat } from "../types"
import { assert_exists } from "../utils"
import { Promise } from 'bluebird'
Promise.longStackTraces()

const promises_map = new Map<string, Promise<unknown>>()

export const new_promise = <T>(name: string, f: (resolve: (value: PromiseLike<T> | T) => void, reject: (reason?: any) => void) => void): Promise<T> => {
  const p = new Promise<T>((resolve, reject) => {
    f((i) => {
      promises_map.delete(name)
      // console.log('resolved', name, 'left', promises_map.size)
      resolve(i)
    }, (i) => {
      promises_map.delete(name)
      // console.log('rejected', name, 'left', promises_map.size)
      reject(i)
    })
  })
  promises_map.set(name, p)
  // console.log('started', name, 'left', promises_map.size)
  return p
}

export type ModelEntry =
  | { tag: 'real-expr', data: PrSat['RealExpr'] }
  | { tag: 'root-obj', index: number, degree: number, coefficients: bigint[] }
  | { tag: 'unknown', data: S }

export type EvaluatorOutput =
  | { tag: 'undeclared-vars', variables: VariableLists }
  | { tag: 'div0' }
  | { tag: 'real-result', value: ModelEntry }
  | { tag: 'bool-result', value: boolean }
type EvaluatorOutputMap = UnionToTagMap<'tag', EvaluatorOutput>

export const assert_eval_output = <T extends EvaluatorOutput['tag']>(expected: T, output: EvaluatorOutput): EvaluatorOutputMap[T] => {
  if (expected !== output.tag) {
    throw new Error(`Wrong EvaluatorOutput!\nexpected tag: ${expected}\nactual tag: ${output.tag}`)
  } else {
    return output as any
  }
}

export type RawSolverResult =
  | ['sat', model: Record<number, ModelEntry>]
  | ['unsat', undefined]
  | ['unknown', undefined]
  | ['cancelled', undefined]
  | ['exception', Error]

export type SolverResult =
  | ['sat', { model: Record<number, ModelEntry>, evaluate(c_or_re: ConstraintOrRealExpr): Promise<EvaluatorOutput> }]
  | ['unsat', undefined]
  | ['unknown', undefined]
  | ['cancelled', undefined]
  | ['exception', Error]

export type RawSolverData = {
  variables: VariableLists
  constraints: {
    original: {
      internal: PrSat['Constraint'][]
      smtlib: string[]
    }
    optimized: {
      internal: PrSat['Constraint'][]
      smtlib: string[]
    }
  }
}

export type SolverData = {
  truth_table: TruthTable
  constraints: {
    original: {
      internal: PrSat['Constraint'][]
      smtlib: string[]
    }
    optimized: {
      internal: PrSat['Constraint'][]
      smtlib: string[]
    }
  }
}

export type StagedSolver = {
  data: RawSolverData
  make_promise: () => { promise: Promise<RawSolverResult>, abort_controller: AbortController }
}

type ActiveSolver = {
  data: SolverData
  cancel(): void
  wait(timeout_s?: number, on_second?: (seconds_left: number) => Promise<void>): Promise<SolverResult>
}

export type RawActiveSolver = {
  data: RawSolverData
  promise: Promise<RawSolverResult>
  abort_controller: AbortController
}

// It's worth thinking more about the expected behavior from the passed-in PrSatSolver.
// My original conception of this object is that both methods operating on input
//   (start and evaluate) would perform all the requisite transforms inside.
// This makes sense, since a different PrSatSolver might decide to transform things
//   differently.
// But some parts of the transformation are guarunteed to look the same.
// For example, conditional probability elimination is something that needs to be performed
//   no matter what.
// For evaluate, undeclared variable and div0 detection also needs to occur no matter what,
//   but heavily depends on the exact expression being evaluated.

export interface PrSatSolver {
  initialize(): Promise<void>
  deinitialize(): Promise<void>
  // Change name to stage!
  start(constraints: PrSat['Constraint'][], regular: boolean): Promise<StagedSolver>
  // Question with the following function:
  // Should probabilities be eliminated before c_or_re is passed in, or is c_or_re expected to do this?
  // For now we'll say inside the following, but this could change.
  evaluate(model: Record<number, ModelEntry>, c_or_re: ConstraintOrRealExpr): Promise<EvaluatorOutput>
}

type SolverState =
  | { tag: 'exception', last_state: SolverState, error: Error }
  | { tag: 'uninitialized', initialize(): Promise<void> }
  | { tag: 'initializing' }
  | { tag: 'initialized', start(constraints: PrSat['Constraint'][], regular: boolean): Promise<void>, deinitialize(): Promise<void> }
  | { tag: 'deinitializing' }
  | { tag: 'solving', solver: ActiveSolver }
  | { tag: 'staged', data: SolverData, invalidate(): void, go(): void }
  | { tag: 'cancelling', data: SolverData }
  | { tag: 'finished', data: SolverData, result: SolverResult, invalidate(): void }
  | { tag: 'invalidated', last: SolverStateTagMap['finished' | 'staged'], start(constraints: PrSat['Constraint'][], regular: boolean): Promise<void>, deinitialize(): Promise<void> }
type SolverStateTagMap = UnionToTagMap<'tag', SolverState>

const assert_solver_state = <TK extends SolverState['tag']>(tag: TK, state: SolverState): SolverStateTagMap[TK] => {
  if (state.tag === tag) {
    return state as SolverStateTagMap[TK]
  } else if (state.tag === 'exception') {
    throw state.error
  } else {
    throw new Error(`Wrong solver state!\nexpected tag: ${tag}\nactual tag: ${state.tag}`)
  }
}

export const raw_solver_solver_data_to_data = (raw: RawSolverData): SolverData => {
  return {
    truth_table: new TruthTable(raw.variables),
    constraints: raw.constraints,
  }
}

export const solver_data_to_raw_solver_data = (data: SolverData): RawSolverData => {
  return {
    variables: data.truth_table.variables,
    constraints: data.constraints,
  }
}

type SolverStateListener = (state: SolverState, last_state?: SolverState) => void

export class SolverStateMachine {
  private readonly initial_state: SolverState = { tag: 'uninitialized', initialize: () => this.initialize() }
  private state: SolverState = this.initial_state
  private listeners = new Set<SolverStateListener>()

  private static allowed_transitions: Record<SolverState['tag'], Set<SolverState['tag']>> = {
    uninitialized: new Set(['uninitialized', 'initializing']),
    initializing: new Set(['initialized']),
    initialized: new Set(['staged', 'deinitializing']),
    deinitializing: new Set(['uninitialized']),
    solving: new Set(['cancelling', 'finished']),
    staged: new Set(['solving', 'invalidated']),
    // cancelling: new Set(['finished', 'deinitializing']),
    cancelling: new Set(['finished', 'deinitializing']),
    finished: new Set(['invalidated']),
    invalidated: new Set(['staged', 'deinitializing']),
    exception: new Set([]),
  }

  constructor(private readonly solver: PrSatSolver) {
    this.broadcast(this.state, this.state)
  }

  private broadcast(new_state: SolverState, old_state: SolverState): void {
    for (const l of this.listeners) {
      l(new_state, old_state)
    }
  }

  private change_state(new_state: SolverState): void {
    const old_state = this.state
    const possible_next_states = assert_exists(SolverStateMachine.allowed_transitions[old_state.tag])
    if (new_state.tag !== 'exception' && !possible_next_states.has(new_state.tag)) {
      throw new Error(`Old state not allowed to transition to new state!\nold: ${old_state.tag}\nnew: ${new_state.tag}`)
    }

    this.state = new_state
    this.broadcast(new_state, old_state)
  }

  private async initialize(): Promise<void> {
    this.change_state({ tag: 'initializing' })

    try {
      await this.solver?.initialize()
      this.change_state({ tag: 'initialized', start: (cs, r) => this.start(cs, r), deinitialize: () => this.deinitialize() })
    } catch (error: any) {
      this.change_state({ tag: 'exception', last_state: this.state, error })
    }
  }

  private async deinitialize(): Promise<void> {
    this.change_state({ tag: 'deinitializing' })

    try {
      await this.solver?.deinitialize()
      this.change_state(this.initial_state)
    } catch (error: any) {
      this.change_state({ tag: 'exception', last_state: this.state, error })
    }
  }

  // I'm passing in the result to make sure I don't make the result something I don't want it to be.
  private cancel(): SolverResult {
    const active_solver = this.as('solving').solver
    const result: SolverResult = ['cancelled', undefined]

    try {
      this.change_state({ tag: 'cancelling', data: active_solver.data })
      active_solver.cancel()
      // It's redundant
      // this.change_state({ tag: 'finished', data: active_solver.data, result, invalidate: () => this.invalidate() })
    } catch (error: any) {
      this.change_state({ tag: 'exception', last_state: this.state, error })
    }

    return result
  }

  private invalidate(): void {
    this.change_state({ tag: 'invalidated', last: this.as('staged', 'finished'), deinitialize: () => this.deinitialize(), start: (cs, r) => this.start(cs, r) })
  }

  private evaluate(model: Record<number, ModelEntry>, c_or_re: ConstraintOrRealExpr): Promise<EvaluatorOutput> {
    return this.solver.evaluate(model, c_or_re)
  }

  private raw_to_solver_result(raw: RawSolverResult): SolverResult {
    const [status, data] = raw
    if (status === 'sat') {
      return ['sat', { model: data, evaluate: (c_or_re) => this.evaluate(data, c_or_re) }]
    } else {
      return raw
    }
  }

  private raw_to_active_solver(raw: RawActiveSolver): ActiveSolver {
    return {
      data: raw_solver_solver_data_to_data(raw.data),
      cancel: async () => raw.abort_controller.abort(),
      wait: async (timeout_s, on_second) => {
        if (timeout_s !== undefined) {
          const timer = make_timeout_timer()
          const active_timer = timer.start(Math.floor(timeout_s), { on_second })
          raw.abort_controller.signal.addEventListener('abort', () => active_timer.cancel())
        }

        return run_solve_cancel_logic(
          async () => {
            let raw_result: RawSolverResult
            try {
              raw_result = await raw.promise
            } catch (e: any) {
              raw_result = ['exception', e]
            }
            // const raw_result = await raw.promise
            const result = this.raw_to_solver_result(raw_result)
            this.change_state({
              tag: 'finished',
              data: raw_solver_solver_data_to_data(raw.data),
              result,
              invalidate: () => this.invalidate()
            })
            return result
          },  // on_run
          async () => {
            return this.cancel()
          },  // on_cancel
          async () => {
            await this.deinitialize()
            await this.initialize()
            return ['cancelled', undefined]
          },  // on_slow_cancel
          2 * 1000,
          raw.abort_controller.signal,
        )
      }
    }
  }

  private async start(constraints: PrSat['Constraint'][], regular: boolean) {
    try {
      const stage = await this.solver.start(constraints, regular)
      // const active_solver = this.raw_to_active_solver(raw_active_solver)
      // this.change_state({ tag: 'solving', solver: active_solver })
      this.change_state({
        tag: 'staged',
        data: raw_solver_solver_data_to_data(stage.data),
        go: () => this.go(stage),
        invalidate: () => this.invalidate()
      })
    } catch (error: any) {
      this.change_state({ tag: 'exception', last_state: this.state, error })
    }
  }

  private go(stage: StagedSolver): ActiveSolver {
    const { promise, abort_controller } = stage.make_promise()
    const raw_active_solver: RawActiveSolver = {
      data: stage.data,
      promise,
      abort_controller,
    }
    const active_solver = this.raw_to_active_solver(raw_active_solver)
    this.change_state({ tag: 'solving', solver: active_solver })
    return active_solver
  }

  get(): SolverState {
    return this.state
  }

  as<const TK extends SolverState['tag'][]>(...tags: TK): SolverStateTagStuff<TK> {
    const s = this.get()
    for (const t of tags) {
      if (t === s.tag) {
        return s as any
      }
    }
    if (s.tag === 'exception') {
      // throw new Error(`Expected SolverState different from actual!\nexpected: one of ${tags.join(', ')}\nactual: ${s.tag}\nerror: ${s.error.name}\nmessage: ${s.error.message}`)
      throw s.error
    }
    throw new Error(`Expected SolverState different from actual!\nexpected: one of ${tags.join(', ')}\nactual: ${s.tag}`)
  }

  register_listener(listener: SolverStateListener): { unregister(): void } {
    this.listeners.add(listener)
    return { unregister: () => this.listeners.delete(listener) }
  }
}

type SolverStateTagStuff<TK extends SolverState['tag'][]> =
  TK extends [infer H extends SolverState['tag'], ...infer Rest extends SolverState['tag'][]]
    ? SolverStateTagMap[H] | SolverStateTagStuff<Rest>
    // ? [SolverStateTagMap[H], SolverStateTagStuff<Rest>]
  : TK extends []
    ? never
    // ? SolverState
    // ? []
  : never

// type cool = SolverStateTagMap['initialized'] | SolverStateTagMap['invalidated']

// const machine = new SolverStateMachine(new BaseSolver())
// const cool = machine.assert('initialized', 'invalidated')
