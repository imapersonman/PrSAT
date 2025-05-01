import { Context, Expr, init, Model, Z3HighLevel, Z3LowLevel } from "z3-solver"
import { match_s, S, spv, clause, s_to_string } from "./s"
import { constraint_to_string, constraints_to_smtlib_string, eliminate_state_variable_index, enrich_constraints, parse_s, real_expr_to_smtlib, translate, TruthTable, variables_in_constraints } from "./pr_sat"
// import { Res } from "../utils"
import { PrSat } from "./types"
import { assert, assert_exists, assert_result, Res } from "./utils"
import { Equiv } from "./tag_map"

type RealExpr = PrSat['RealExpr']
type Constraint = PrSat['Constraint']

export const init_z3 = async (): Promise<Z3HighLevel & Z3LowLevel> => {
    // console.log('Initializing z3...')
    // const init_start = performance.now()
    const z3_interface = await init()
    // const init_end = performance.now()
    // console.log('done!')
    // console.log(`init time: ${(init_end - init_start) / 1000} seconds.`)
    return z3_interface
}

// const parse_and_evaluate = (s: S): number => {
//   const parse_int = (a: string): number => {
//     const as_int = parseInt (a)
//     if (isNaN(as_int)) {
//       throw new Error(`Parsing '${b}' as int gave a NaN!`)
//     } else {
//       return as_int
//     }
//   }

//   const parse_float = (a: string): number => {
//     const as_float = parseFloat(a)
//     if (isNaN(as_float)) {
//       throw new Error(`Parsing '${b}' as float gave a NaN!`)
//     } else {
//       return as_float
//     }
//   }

//   const [a, b, c, d] = [spv('a'), spv('b'), spv('c'), spv('d')]
//   return match_s(s, [
//     clause<{ a: 'string' }, number>({ a: 'string' }, a, (m) => {
//       return parse_float(m('a'))
//     }),
//     clause<{ a: 'string' }, number>({ a: 'string' }, ['-', a], (m) => {
//       return -parse_and_evaluate(m('a'))
//     }),
//     clause<{ a: 'string', b: 'string' }, number>({ a: 'string', b: 'string' }, ['/', a, b], (m) => {
//       return parse_and_evaluate(m('a')) / parse_and_evaluate(m('b'))
//     }),
//     // expect(parse_s('(root-obj (+ (* 8 (^ x 2)) (* 6 x) (- 1)) 2)'))
//     clause<{ a: 's', b: 's', c: 's', d: 'string' }, number>(
//       { a: 's', b: 's', c: 's', d: 'string' },
//       ['root-obj', ['+', ['*', a], ['*', b], c], d],
//       (m) => {
//         const af = parse_and_evaluate(m('a'))
//         const bf = parse_and_evaluate(m('b'))
//         const cf = parse_and_evaluate(m('c'))
//         const di = parse_int(m('d'))

//         // (-b +- sqrt(b^2 - 4ac)) / 2a
//         const det = bf * bf - 4 * af * cf
//         if (det < 0) {
//           throw new Error('Evaluated value to complex number oops!')
//         } else if (di === 1) {
//           return (-bf - Math.sqrt(det)) / (2 * af)
//         } else if (di === 2) {
//           return (-bf + Math.sqrt(det)) / (2 * af)
//         } else {
//           throw new Error(`Unrecognized root index ${di}!`)
//         }
//       }),
//   ])
// }

const model_to_state_values = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>): Promise<Record<number, number>> => {
  const values_map: Record<number, number> = {}
  const { simplify } = ctx
  for (const decl of model.decls()) {
    if (decl.arity() !== 0) {
      // throw new Error(`model includes a function declaration with arity not equal to zero!\nname: ${decl.name()}`)
      continue
    }
    const name = decl.name().toString()
    if (name.length < 3) {
      throw new Error(`Expected model entry name to be of length at least 3!\nname: ${name.length}`)
    }
    const index_str = name.substring(2)
    const index = parseInt(index_str)
    if (isNaN(index)) {
      throw new Error(`Expected model entry name to be of the form s_<number>!\nname: ${name}`)
    }

    const value_expr = await simplify(model.eval(decl.call()))
    const parsed_s = parse_s(value_expr.sexpr())
    const value = parse_and_evaluate(parsed_s)
    values_map[index] = value
  }

  const values: number[] = []
  for (let i = 0; i < Object.keys(values_map).length; i++) {
    values.push(values_map[i])
  }
  return values
}

const tolerance = 0.00000000000001

// state_values: Record<StateIndex, Value>
const evaluate_constraint = (state_values: Record<number, number>, constraint: Constraint): boolean => {
  if (constraint.tag === 'equal') {
    // return evaluate_real_expr(state_value_array, constraint.left) === evaluate_real_expr(state_value_array, constraint.right)
    return Math.abs(evaluate_real_expr(state_values, constraint.left) - evaluate_real_expr(state_values, constraint.right)) <= tolerance
  } else if (constraint.tag === 'not_equal') {
    // return evaluate_real_expr(state_value_array, constraint.left) !== evaluate_real_expr(state_value_array, constraint.right)
    return Math.abs(evaluate_real_expr(state_values, constraint.left) - evaluate_real_expr(state_values, constraint.right)) > tolerance
  } else if (constraint.tag === 'less_than') {
    return evaluate_real_expr(state_values, constraint.left) < evaluate_real_expr(state_values, constraint.right)
  } else if (constraint.tag === 'less_than_or_equal') {
    return evaluate_real_expr(state_values, constraint.left) <= evaluate_real_expr(state_values, constraint.right)
  } else if (constraint.tag === 'greater_than') {
    return evaluate_real_expr(state_values, constraint.left) > evaluate_real_expr(state_values, constraint.right)
  } else if (constraint.tag === 'greater_than_or_equal') {
    return evaluate_real_expr(state_values, constraint.left) >= evaluate_real_expr(state_values, constraint.right)
  } else if (constraint.tag === 'negation') {
    return !evaluate_constraint(state_values, constraint.constraint)
  } else if (constraint.tag === 'conjunction') {
    return evaluate_constraint(state_values, constraint.left) && evaluate_constraint(state_values, constraint.right)
  } else if (constraint.tag === 'disjunction') {
    return evaluate_constraint(state_values, constraint.left) || evaluate_constraint(state_values, constraint.right)
  } else if (constraint.tag === 'conditional') {
    return !evaluate_constraint(state_values, constraint.left) || evaluate_constraint(state_values, constraint.right)
  } else if (constraint.tag === 'biconditional') {
    return evaluate_constraint(state_values, constraint.left) === evaluate_constraint(state_values, constraint.right)
  } else {
    throw new Error('evaluate_constraint fallthrough')
  }
}

const map_at = <Key extends number | string | symbol, Value>(map: Record<Key, Value>, key: Key): Value => {
  return assert_exists(map[key], `Map at key '${key.toString()}' missing!`)
}

// state_values: Record<StateIndex, Value>
const evaluate_real_expr = (state_values: Record<number, number>, expr: RealExpr): number => {
  if (expr.tag === 'literal') {
    return expr.value
  } else if (expr.tag === 'variable') {
    throw new Error('not evaluating real variables yet!')
  } else if (expr.tag === 'probability' || expr.tag === 'given_probability') {
    throw new Error('not evaluating probabilities yet!')
  } else if (expr.tag === 'state_variable_sum') {
    return expr.indices.map((i) => map_at(state_values, i)).reduce((a, b) => a + b, 0)
  } else if (expr.tag === 'negative') {
    return -evaluate_real_expr(state_values, expr.expr)
  } else if (expr.tag === 'power') {
    return Math.pow(evaluate_real_expr(state_values, expr.base), evaluate_real_expr(state_values, expr.exponent))
  } else if (expr.tag === 'plus') {
    return evaluate_real_expr(state_values, expr.left) + evaluate_real_expr(state_values, expr.right)
  } else if (expr.tag === 'minus') {
    return evaluate_real_expr(state_values, expr.left) - evaluate_real_expr(state_values, expr.right)
  } else if (expr.tag === 'multiply') {
    return evaluate_real_expr(state_values, expr.left) * evaluate_real_expr(state_values, expr.right)
  } else if (expr.tag === 'divide') {
    return evaluate_real_expr(state_values, expr.numerator) / evaluate_real_expr(state_values, expr.denominator)
  } else {
    throw new Error('evaluate_real_expr fallthrough')
  }
}

const validate_model = async (constraints: Constraint[], state_values: Record<number, number>): Promise<boolean[]> => {
  return constraints.map((c) => evaluate_constraint(state_values, c))
}

export type ModelAssignmentOutput =
  | { tag: 'literal', value: number }
  | { tag: 'negative', inner: ModelAssignmentOutput }
  | { tag: 'rational', numerator: ModelAssignmentOutput, denominator: ModelAssignmentOutput }
  | { tag: 'root-obj', index: number, a: ModelAssignmentOutput, b: ModelAssignmentOutput, c: ModelAssignmentOutput}
  | { tag: 'unknown', s: S }

export const model_assignment_output_to_string = (output: ModelAssignmentOutput): string => {
  const sub = (output: ModelAssignmentOutput): string => model_assignment_output_to_string(output)
  const wrap = (output: ModelAssignmentOutput, extra_wraps: ModelAssignmentOutput['tag'][] = []): string => {
    if (output.tag === 'literal' || output.tag === 'negative' || extra_wraps.includes(output.tag)) {
      return sub(output)
    } else {
      return `(${sub(output)})`
    }
  }

  if (output.tag === 'literal') {
    return output.value.toString()
  } else if (output.tag === 'negative') {
    return `-${wrap(output.inner)}`
  } else if (output.tag === 'rational') {
    return `${wrap(output.numerator)} / ${output.denominator}`
  } else if (output.tag === 'root-obj') {
    return `(root-obj ${output.index} (${wrap(output.a)} * x^2 + ${wrap(output.b)} * x + ${wrap(output.c)}))`
  } else if (output.tag === 'unknown') {
    return s_to_string(output.s, false)
  } else {
    const check: Equiv<typeof output, never> = true
    void check
    throw new Error('model_assignment_output_to_string fallthrough')
  }
}

// // Should be *mostly* simplified, but still might run into issues so this function is here just in case.
// const simplify_model_assignment_output = (output: ModelAssignmentOutput): ModelAssignmentOutput => {
//   throw new Error('unimplemented')
// }

const parse_int = (a: string): Res<number, string> => {
  const as_int = parseInt (a)
  if (isNaN(as_int)) {
    return [false, `Parsing '${a}' as int gave a NaN!`]
  } else {
    return [true, as_int]
  }
}

const parse_float = (a: string): Res<number, string> => {
  const as_float = parseFloat(a)
  if (isNaN(as_float)) {
    return [false, `Parsing '${a}' as float gave a NaN!`]
  } else {
    return [true, as_float]
  }
}

const parse_and_evaluate = (s: S): number => {
  const [a, b, c, d] = [spv('a'), spv('b'), spv('c'), spv('d')]
  return match_s(s, [
    clause<{ a: 'string' }, number>({ a: 'string' }, a, (m) => {
      return assert_result(parse_float(m('a')))
    }),
    clause<{ a: 'string' }, number>({ a: 'string' }, ['-', a], (m) => {
      return -parse_and_evaluate(m('a'))
    }),
    clause<{ a: 'string', b: 'string' }, number>({ a: 'string', b: 'string' }, ['/', a, b], (m) => {
      return parse_and_evaluate(m('a')) / parse_and_evaluate(m('b'))
    }),
    // expect(parse_s('(root-obj (+ (* 8 (^ x 2)) (* 6 x) (- 1)) 2)'))
    clause<{ a: 's', b: 's', c: 's', d: 'string' }, number>(
      { a: 's', b: 's', c: 's', d: 'string' },
      ['root-obj', ['+', ['*', a], ['*', b], c], d],
      (m) => {
        const af = parse_and_evaluate(m('a'))
        const bf = parse_and_evaluate(m('b'))
        const cf = parse_and_evaluate(m('c'))
        const di = assert_result(parse_int(m('d')))

        // (-b +- sqrt(b^2 - 4ac)) / 2a
        const det = bf * bf - 4 * af * cf
        if (det < 0) {
          throw new Error('Evaluated value to complex number oops!')
        } else if (di === 1) {
          return (-bf - Math.sqrt(det)) / (2 * af)
        } else if (di === 2) {
          return (-bf + Math.sqrt(det)) / (2 * af)
        } else {
          throw new Error(`Unrecognized root index ${di}!`)
        }
      }),
  ])
}

const parse_to_assignment = (s: S): ModelAssignmentOutput => {
  const [a, b, c, d] = [spv('a'), spv('b'), spv('c'), spv('d')]
  return match_s(s, [
    clause<{ a: 'string' }, ModelAssignmentOutput>({ a: 'string' }, a, (m) => {
      const value = assert_result(parse_float(m('a')))
      return { tag: 'literal', value }
    }),
    clause<{ a: 'string' }, ModelAssignmentOutput>({ a: 'string' }, ['-', a], (m) => {
      const inner = parse_to_assignment(m('a'))
      return { tag: 'negative', inner }
    }),
    clause<{ a: 'string', b: 'string' }, ModelAssignmentOutput>({ a: 'string', b: 'string' }, ['/', a, b], (m) => {
      const numerator = parse_to_assignment(m('a'))
      const denominator = parse_to_assignment(m('b'))
      return { tag: 'rational', numerator, denominator }
    }),
    clause<{ a: 's', b: 's', c: 's', d: 'string' }, ModelAssignmentOutput>(
      { a: 's', b: 's', c: 's', d: 'string' },
      ['root-obj', ['+', ['*', a], ['*', b], c], d],
      (m) => {
        const af = parse_to_assignment(m('a'))
        const bf = parse_to_assignment(m('b'))
        const cf = parse_to_assignment(m('c'))
        const di = assert_result(parse_int(m('d')))

        return { tag: 'root-obj', index: di, a: af, b: bf, c: cf }
      }),
  ])
}

const expr_to_assignment = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, expr: Expr<CtxKey>): Promise<ModelAssignmentOutput> => {
  const value_expr = await ctx.simplify(model.eval(expr))
  const parsed_s = parse_s(value_expr.sexpr())
  const value = parse_to_assignment(parsed_s)
  return value
}

export const model_to_assigned_exprs = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>): Promise<[number, Expr<CtxKey>][]> => {
  const assigned_exprs: [number, Expr<CtxKey>][] = []
  for (const decl of model.decls()) {
    if (decl.arity() !== 0) {
      // throw new Error(`model includes a function declaration with arity not equal to zero!\nname: ${decl.name()}`)
      continue
    }
    const name = decl.name().toString()
    if (name.length < 3) {
      throw new Error(`Expected model entry name to be of length at least 3!\nname: ${name.length}`)
    }
    const index_str = name.substring(2)
    const index = parseInt(index_str)
    if (isNaN(index)) {
      throw new Error(`Expected model entry name to be of the form s_<number>!\nname: ${name}`)
    }

    assigned_exprs.push([index, await ctx.simplify(model.eval(decl.call()))])
  }

  return assigned_exprs
}

export const model_to_assignments = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>): Promise<Record<number, ModelAssignmentOutput>> => {
  const assignments_map: Record<number, ModelAssignmentOutput> = {}
  const assigned_exprs = await model_to_assigned_exprs(ctx, model)
  for (const [index, expr] of assigned_exprs) {
    assignments_map[index] = await expr_to_assignment(ctx, model, expr)
  }
  return assignments_map
}

// const real_expr_to_arith = <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, expr: RealExpr): Arith<CtxKey> => {
//   const sub = (expr: RealExpr): Arith<CtxKey> => real_expr_to_arith(ctx, model, expr)
//   if (expr.tag === 'divide') {
//     return ctx.Div(sub(expr.numerator), sub(expr.denominator))
//   } else if (expr.tag === 'given_probability') {
//     throw new Error('Unable to convert conditional probability to a Z3 arith expression!')
//   } else if (expr.tag === 'literal') {
//     return ctx.Real.val(expr.value)
//   } else if (expr.tag === 'minus') {
//     return ctx.Sub(sub(expr.left), sub(expr.right))
//   } else if (expr.tag === 'multiply') {
//     return ctx.Product(sub(expr.left), sub(expr.right))
//   } else if (expr.tag === 'negative') {
//     return ctx.Neg(sub(expr.expr))
//   } else if (expr.tag === 'plus') {
//     return ctx.Sum(sub(expr.left), sub(expr.right))
//   } else if (expr.tag === 'power') {
//     throw new Error('Unable to convert exponent to Z3 arith expression (be careful where real_expr_to_arith is called!)')
//   } else if (expr.tag === 'probability') {
//     throw new Error('Unable to convert probability to a Z3 arith expression!')
//   } else if (expr.tag === 'state_variable_sum') {
//     if (expr.indices.length === 0) {
//       return ctx.Real.val(0)
//     } else {
//       const first_var_expr = assert_exists(model.eval(ctx.Var()))
//       const rest_var_exprs = expr.indices.map((index) => assert_exists(index_to_var_map[expr.indices[index]]))
//       return ctx.Sum(first_var_expr, ...rest_vars_exprs)
//     }
//   } else if (expr.tag === 'variable') {
//     throw new Error('Unable to convert variable to Z3 arith expression (be careful where real_expr_to_arith is called!)')
//   } else {
//     const check: Equiv<typeof expr, never> = true
//     void check
//     throw new Error('real_expr_to_arith fallthrough!')
//   }
// }

export const pr_sat_with_truth_table = async <CtxKey extends string>(
  ctx: Context<CtxKey>,
  tt: TruthTable,
  constraints: Constraint[],
  regular: boolean = false,
): Promise<{ status: 'sat', all_constraints: Constraint[], tt: TruthTable, model: Record<number, ModelAssignmentOutput> } | { status: 'unsat' | 'unknown', all_constraints: Constraint[], tt: TruthTable, model: undefined }> => {
  const { Solver } = ctx
  const solver = new Solver();

  const translated = translate(tt, constraints)
  const index_to_eliminate = tt.n_states() - 1  // Only this works right now!
  // const index_to_eliminate = 0
  const enriched_constraints = enrich_constraints(tt, index_to_eliminate, regular, translated)
  const [redef, elim_constraints] = eliminate_state_variable_index(tt.n_states(), index_to_eliminate, enriched_constraints)

  const smtlib_string = constraints_to_smtlib_string(tt, elim_constraints)
  // console.log(smtlib_string)
  solver.fromString(smtlib_string)
  const result = await solver.check()

  if (result === 'sat') {
    const model = solver.model();
    const other_state_values = await model_to_state_values(ctx, model)
    const state_values = {
      ...other_state_values,
      [index_to_eliminate]: evaluate_real_expr(other_state_values, redef),
    }
    const validation = await validate_model(translated, state_values)
    if (!validation.every((v) => v)) {
      console.log(validation)
      console.log(state_values)
      console.log(translated.map(constraint_to_string))
      throw new Error('Constraints found to be satisfiable but the internal check for satisfiability given the model failed!')
    }

    const assigned_exprs = await model_to_assigned_exprs(ctx, model)
    const next_solver_commands: S[] = []
    for (const [state_index, expr] of assigned_exprs) {
      const v = `s_${state_index}`
      next_solver_commands.push(['declare-const', v, 'Real'])
      next_solver_commands.push(['assert', ['=', v, parse_s(expr.sexpr())]])
    }
    next_solver_commands.push(['declare-const', `s_${index_to_eliminate}`, 'Real'])
    next_solver_commands.push(['assert', ['=', `s_${index_to_eliminate}`, real_expr_to_smtlib(redef)]])
    const next_solver_smtlib_string = next_solver_commands.map((s) => s_to_string(s, false)).join('\n')
    console.log(next_solver_smtlib_string)
    const next_solver = new Solver()
    next_solver.fromString(next_solver_smtlib_string)
    const result = await next_solver.check()
    assert(result === 'sat')
    const final_model = await next_solver.model()
    const assignments = await model_to_assignments(ctx, final_model)

    return { status: 'sat', all_constraints: translated, tt, model: assignments }
  } else {
    return { status: result, all_constraints: translated, tt, model: undefined }
  }
}

export const pr_sat = async <CtxKey extends string>(
  ctx: Context<CtxKey>,
  constraints: Constraint[],
  regular: boolean = false,
): Promise<{ status: 'sat', all_constraints: Constraint[], tt: TruthTable, model: Record<number, ModelAssignmentOutput> } | { status: 'unsat' | 'unknown', all_constraints: Constraint[], tt: TruthTable, model: undefined }> => {
  const tt = new TruthTable(variables_in_constraints(constraints))
  return pr_sat_with_truth_table(ctx, tt, constraints, regular)
}

