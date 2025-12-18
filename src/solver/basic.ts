import { Context, Model, Z3HighLevel, Z3LowLevel } from "z3-solver"
import { assert_eval_output, EvaluatorOutput, ModelEntry, new_promise, PrSatSolver, RawActiveSolver, RawSolverResult, StagedSolver } from "."
import { ConstraintOrRealExpr, PrSat } from "../types"
import { UnionToTagMap } from "../tag_map"
import { fancy_evaluate_constraint_or_real_expr, FancyEvaluatorOutput, init_z3, model_to_assignments, ModelAssignmentOutput, transform_constraints_new, transform_constraints_old } from "../z3_integration"
import { constraints_to_smtlib_lines, real_expr_builder, TruthTable, variables_in_constraints } from "../pr_sat"
import { S, s_to_string } from "../s"
import { assert_exists, fallthrough, record_keys_2 } from "../utils"

type BaseSolverResult =
  | ['sat', Model]
  | ['unsat', undefined]
  | ['unknown', undefined]

type BaseSolverState =
  | { tag: 'uninitialized' }
  | { tag: 'initialized', z3_interface: Z3HighLevel & Z3LowLevel }
  | { tag: 'has-result', result: BaseSolverResult }
type BaseSolverStateMap = UnionToTagMap<'tag', BaseSolverState>

type PrSatTransform = (constraint: PrSat['Constraint'][]) => [PrSat['Constraint'][], model_transform?: (model: Record<number, ModelEntry>) => Promise<Record<number, ModelEntry>>]
const compress_transforms = (transforms: PrSatTransform[]): PrSatTransform => {
  return (constraints) => {
    // Should be placed into thingy backwards.
    const model_transforms: ((model: Record<number, ModelEntry>) => Promise<Record<number, ModelEntry>>)[] = []
    let current_set = constraints

    for (const t of transforms) {
      const [new_constraints, mt] = t(current_set)
      current_set = new_constraints
      model_transforms.unshift(mt ?? (async (m) => m))
    }

    return [current_set, async (m) => {
      let current_model = m
      for (const mt of model_transforms) {
        current_model = await mt(current_model)
      }
      return m
    }]
  }
}

const original_transform = (
  tt: TruthTable,
  regular: boolean,
  index_to_eliminate: number,
  eval_f: (m: Record<number, ModelEntry>, expr: PrSat['RealExpr']
) => Promise<ModelEntry>): PrSatTransform => {
  return (constraints) => {
    const { elim_constraints, redef } = transform_constraints_old(tt, index_to_eliminate, constraints, regular)
    return [elim_constraints, async (m) => ({ ...m, [index_to_eliminate]: await eval_f(m, redef) })]
  }
}

const optimized_transform_1 = (
  tt: TruthTable,
  regular: boolean,
  index_to_eliminate: number,
  eval_f: (m: Record<number, ModelEntry>, expr: PrSat['RealExpr']
) => Promise<ModelEntry>): PrSatTransform => {
  return (constraints) => {
    const { translated, redef } = transform_constraints_new(tt, index_to_eliminate, constraints, regular)
    return [translated, async (m) => ({ ...m, [index_to_eliminate]: await eval_f(m, redef) })]
  }
}

const model_assignment_to_real_expr = (ma: ModelAssignmentOutput): PrSat['RealExpr'] => {
  const b = real_expr_builder
  // redundant!
  if (ma.tag === 'literal') {
    return b.lit(ma.value)
  } else if (ma.tag === 'negative') {
    return b.neg(model_assignment_to_real_expr(ma.inner))
  } else if (ma.tag === 'rational') {
    return b.divide(model_assignment_to_real_expr(ma.numerator), model_assignment_to_real_expr(ma.denominator))
  } else {
    throw new Error(`model_assignment_to_real_expr case fallthrough: ${ma.tag}`)
  }
}

const model_assignment_to_model_entry = (ma: ModelAssignmentOutput): ModelEntry => {
  const as_lit = (ma: ModelAssignmentOutput): number => {
    if (ma.tag === 'literal') return ma.value
    else throw new Error('Trying to convert ModelAssignmentOutput to literal but it\'t not working!')
  }
  if (ma.tag === 'literal') {
    return { tag: 'real-expr', data: ma }
  } else if (ma.tag === 'negative') {
    return { tag: 'real-expr', data: model_assignment_to_real_expr(ma) }
  } else if (ma.tag === 'rational') {
    return { tag: 'real-expr', data: model_assignment_to_real_expr(ma) }
  } else if (ma.tag === 'root-obj') {
    return { tag: 'root-obj', index: ma.index, degree: 2, coefficients: [BigInt(as_lit(ma.a)), BigInt(as_lit(ma.b)), BigInt(as_lit(ma.c))] }
  } else if (ma.tag === 'generic-root-obj') {
    return { tag: 'root-obj', index: ma.index, degree: ma.degree, coefficients: ma.coefficients.map((c) => BigInt(c)) }
  } else if (ma.tag === 'unknown') {
    return { tag: 'unknown', data: ma.s }
  } else {
    return fallthrough('model_assignment_to_model_entry', ma)
  }
}

const z3_model_to_model_entries = async (ctx: Context, z3_model: Model): Promise<Record<number, ModelEntry>> => {
  const model_assignments = await model_to_assignments(ctx, z3_model)
  const m: Record<number, ModelEntry> = {}
  for (const state_index of record_keys_2(model_assignments)) {
    const ma = assert_exists(model_assignments[state_index])
    m[state_index] = model_assignment_to_model_entry(ma)
  }
  return m
}

const fancy_output_to_evaluator_output = (fancy_output: FancyEvaluatorOutput): EvaluatorOutput => {
  if (fancy_output.tag === 'result') {
    return { tag: 'real-result', value: model_assignment_to_model_entry(fancy_output.result) }
  } else if (fancy_output.tag === 'bool-result') {
    return { tag: 'bool-result', value: fancy_output.result }
  } else {
    return fancy_output
  }
}

const smtlib_lines_to_string = (lines: S[]): string => {
  return lines.map((s) => s_to_string(s, false)).join('\n')
}

export class BaseSolver implements PrSatSolver {
  private state: BaseSolverState = { tag: 'uninitialized' }
  private readonly model_map = new WeakMap<Record<number, ModelEntry>, { truth_table: TruthTable, ctx: Context, model: Model }>()

  private assert<Tag extends BaseSolverState['tag']>(tag: Tag): BaseSolverStateMap[Tag] {
    if (this.state.tag !== tag) {
      throw new Error(`Wrong BaseSolverState tag!\nexpected: ${tag}\nactual: ${this.state.tag}`)
    } else {
      return this.state as any
    }
  }

  async initialize(): Promise<void> {
    this.assert('uninitialized')
    const z3_interface = await init_z3()
    this.state = { tag: 'initialized', z3_interface }
  }

  async deinitialize(): Promise<void> {
    this.state = { tag: 'uninitialized' }
  }

  async start(constraints: PrSat["Constraint"][], regular: boolean): Promise<StagedSolver> {
    const tt = new TruthTable(variables_in_constraints(constraints))
    const index_to_eliminate = tt.n_states() - 1
    const [original_constraints, original_model_transform] = original_transform(
      tt,
      regular,
      index_to_eliminate,
      async (m, e) => assert_eval_output('real-result', await this.evaluate(m, { tag: 'real_expr', real_expr: e })).value
    )(constraints)
    const [optimized_constraints, optimized_model_transform] = optimized_transform_1(
      tt,
      regular,
      index_to_eliminate,
      async (m, e) => assert_eval_output('real-result', await this.evaluate(m, { tag: 'real_expr', real_expr: e })).value
    )(constraints)
    const smtlib_lines = constraints_to_smtlib_lines(tt, index_to_eliminate, optimized_constraints)
    const smtlib = smtlib_lines.map((line) => s_to_string(line, false)).join('\n')

    const abort_controller = new AbortController()
    const { z3_interface } = this.assert('initialized')
    const ctx = z3_interface.Context('main')
    const solver = new ctx.Solver()
    abort_controller.signal.addEventListener('abort', () => ctx.interrupt())
    solver.fromString(smtlib)

    const make_promise = () => ({
      promise: new_promise<RawSolverResult>('solve-response', (resolve) => {
        solver.check()
          .then(async (check_sat_result) => {
            if (check_sat_result === 'sat') {
              const z3_model = solver.model()
              const my_model = await z3_model_to_model_entries(ctx, z3_model)
              const data = { truth_table: tt, ctx, model: z3_model }
              this.model_map.set(my_model, data)
              const transformed_model = await (optimized_model_transform ?? (async (m) => m))(my_model)
              this.model_map.set(transformed_model, data)
              resolve(['sat', transformed_model])
            } else {
              resolve([check_sat_result, undefined])
            }
          })
          // It's kind of odd that I'm resolving no matter what but it's all for state management stuff (maybe rethink??)
          .catch((e) => resolve(['exception', e]))
      }),
      abort_controller,
    })
    
    return {
      data: {
        variables: tt.variables,
        constraints: {
          original: {
            internal: original_constraints,
            smtlib: constraints_to_smtlib_lines(tt, index_to_eliminate, original_constraints).map((s) => s_to_string(s, false))
          },
          // optimized: optimized_constraints,
          optimized: {
            internal: optimized_constraints,
            smtlib: constraints_to_smtlib_lines(tt, index_to_eliminate, optimized_constraints).map((s) => s_to_string(s, false)),
          }
        }
      },
      // abort_controller,
      make_promise,
    }
  }

  async evaluate(m: Record<number, ModelEntry>, c_or_re: ConstraintOrRealExpr): Promise<EvaluatorOutput> {
    const { truth_table, ctx, model: z3_model } = assert_exists(this.model_map.get(m), 'Missing z3 model!')
    const fancy_output = await fancy_evaluate_constraint_or_real_expr(ctx, z3_model, truth_table, c_or_re)
    return fancy_output_to_evaluator_output(fancy_output)
  }
}
