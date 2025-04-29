import { Context, init, Model, Z3HighLevel, Z3LowLevel } from "z3-solver"
import { match_s, S, spv, clause } from "./s"
import { constraint_to_string, constraints_to_smtlib_string, eliminate_state_variable_index, enrich_constraints, parse_s, translate, TruthTable, variables_in_constraints } from "./pr_sat"
// import { Res } from "../utils"
import { PrSat } from "./types"
import { assert_exists } from "./utils"

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

const parse_and_evaluate = (s: S): number => {
  const parse_int = (a: string): number => {
    const as_int = parseInt (a)
    if (isNaN(as_int)) {
      throw new Error(`Parsing '${b}' as int gave a NaN!`)
    } else {
      return as_int
    }
  }

  const parse_float = (a: string): number => {
    const as_float = parseFloat(a)
    if (isNaN(as_float)) {
      throw new Error(`Parsing '${b}' as float gave a NaN!`)
    } else {
      return as_float
    }
  }

  const [a, b, c, d] = [spv('a'), spv('b'), spv('c'), spv('d')]
  return match_s(s, [
    clause<{ a: 'string' }, number>({ a: 'string' }, a, (m) => {
      return parse_float(m('a'))
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
        const di = parse_int(m('d'))

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

// state_values: Record<StateIndex, Value>
const evaluate_real_expr = (state_values: Record<number, number>, expr: RealExpr): number => {
  if (expr.tag === 'literal') {
    return expr.value
  } else if (expr.tag === 'variable') {
    throw new Error('not evaluating real variables yet!')
  } else if (expr.tag === 'probability' || expr.tag === 'given_probability') {
    throw new Error('not evaluating probabilities yet!')
  } else if (expr.tag === 'state_variable_sum') {
    return expr.indices.map((i) => assert_exists(state_values[i])).reduce((a, b) => a + b, 0)
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

export const pr_sat = async <CtxKey extends string>(
  ctx: Context<CtxKey>,
  constraints: Constraint[],
  regular: boolean = false,
): Promise<{ status: 'sat', all_constraints: Constraint[], tt: TruthTable, model: Model<CtxKey> } | { status: 'unsat' | 'unknown', all_constraints: Constraint[], tt: TruthTable, model: undefined }> => {
  const { Solver } = ctx
  const solver = new Solver();

  const variables = variables_in_constraints(constraints)
  const tt = new TruthTable(variables)
  const translated = translate(tt, constraints)
  const index_to_eliminate = tt.n_states() - 1
  const enriched_constraints = enrich_constraints(tt, index_to_eliminate, regular, translated)
  const [state_index_redef, elim_constraints] = eliminate_state_variable_index(tt.n_states(), index_to_eliminate, enriched_constraints)
  console.log('translated', elim_constraints.map(constraint_to_string))

  const smtlib_string = constraints_to_smtlib_string(tt, index_to_eliminate, elim_constraints)
  console.log(smtlib_string)
  solver.fromString(smtlib_string)
  const result = await solver.check()

  if (result === 'sat') {
    const model = solver.model();
    const other_state_values = await model_to_state_values(ctx, model)
    const state_values = {
      ...other_state_values,
      [index_to_eliminate]: evaluate_real_expr(other_state_values, state_index_redef),
    }
    const validation = await validate_model(translated, state_values)
    if (!validation.every((v) => v)) {
      console.log(validation)
      console.log(state_values)
      console.log(translated.map(constraint_to_string))
      throw new Error('Constraints found to be satisfiable but the internal check for satisfiability given the model failed!')
    }
    return { status: 'sat', all_constraints: translated, tt, model }
  } else {
    return { status: result, all_constraints: translated, tt, model: undefined }
  }
}

