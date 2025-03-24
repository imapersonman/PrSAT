import { Context, init, Model, Z3HighLevel, Z3LowLevel } from "z3-solver"
import { match_s, S, spv, clause } from "./s"
import { constraint_to_string, constraints_to_smtlib_string, parse_s, TruthTable } from "./pr_sat"
// import { Res } from "../utils"
import { PrSat } from "./types"

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

const model_to_state_value_array = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>): Promise<number[]> => {
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

const evaluate_constraint = (state_value_array: number[], constraint: Constraint): boolean => {
  if (constraint.tag === 'equal') {
    // return evaluate_real_expr(state_value_array, constraint.left) === evaluate_real_expr(state_value_array, constraint.right)
    return Math.abs(evaluate_real_expr(state_value_array, constraint.left) - evaluate_real_expr(state_value_array, constraint.right)) <= tolerance
  } else if (constraint.tag === 'not_equal') {
    // return evaluate_real_expr(state_value_array, constraint.left) !== evaluate_real_expr(state_value_array, constraint.right)
    return Math.abs(evaluate_real_expr(state_value_array, constraint.left) - evaluate_real_expr(state_value_array, constraint.right)) > tolerance
  } else if (constraint.tag === 'less_than') {
    return evaluate_real_expr(state_value_array, constraint.left) < evaluate_real_expr(state_value_array, constraint.right)
  } else if (constraint.tag === 'less_than_or_equal') {
    return evaluate_real_expr(state_value_array, constraint.left) <= evaluate_real_expr(state_value_array, constraint.right)
  } else if (constraint.tag === 'greater_than') {
    return evaluate_real_expr(state_value_array, constraint.left) > evaluate_real_expr(state_value_array, constraint.right)
  } else if (constraint.tag === 'greater_than_or_equal') {
    return evaluate_real_expr(state_value_array, constraint.left) >= evaluate_real_expr(state_value_array, constraint.right)
  } else if (constraint.tag === 'negation') {
    return !evaluate_constraint(state_value_array, constraint.constraint)
  } else if (constraint.tag === 'conjunction') {
    return evaluate_constraint(state_value_array, constraint.left) && evaluate_constraint(state_value_array, constraint.right)
  } else if (constraint.tag === 'disjunction') {
    return evaluate_constraint(state_value_array, constraint.left) || evaluate_constraint(state_value_array, constraint.right)
  } else if (constraint.tag === 'conditional') {
    return !evaluate_constraint(state_value_array, constraint.left) || evaluate_constraint(state_value_array, constraint.right)
  } else if (constraint.tag === 'biconditional') {
    return evaluate_constraint(state_value_array, constraint.left) === evaluate_constraint(state_value_array, constraint.right)
  } else {
    throw new Error('evaluate_constraint fallthrough')
  }
}

const evaluate_real_expr = (state_value_array: number[], expr: RealExpr): number => {
  if (expr.tag === 'literal') {
    return expr.value
  } else if (expr.tag === 'variable') {
    throw new Error('not evaluating real variables yet!')
  } else if (expr.tag === 'probability' || expr.tag === 'given_probability') {
    throw new Error('not evaluating probabilities yet!')
  } else if (expr.tag === 'state_variable_sum') {
    return expr.indices.map((i) => state_value_array[i]).reduce((a, b) => a + b, 0)
  } else if (expr.tag === 'negative') {
    return -evaluate_real_expr(state_value_array, expr.expr)
  } else if (expr.tag === 'power') {
    return Math.pow(evaluate_real_expr(state_value_array, expr.base), evaluate_real_expr(state_value_array, expr.exponent))
  } else if (expr.tag === 'plus') {
    return evaluate_real_expr(state_value_array, expr.left) + evaluate_real_expr(state_value_array, expr.right)
  } else if (expr.tag === 'minus') {
    return evaluate_real_expr(state_value_array, expr.left) - evaluate_real_expr(state_value_array, expr.right)
  } else if (expr.tag === 'multiply') {
    return evaluate_real_expr(state_value_array, expr.left) * evaluate_real_expr(state_value_array, expr.right)
  } else if (expr.tag === 'divide') {
    return evaluate_real_expr(state_value_array, expr.numerator) / evaluate_real_expr(state_value_array, expr.denominator)
  } else {
    throw new Error('evaluate_real_expr fallthrough')
  }
}

const validate_model = async <CtxKey extends string>(constraints: Constraint[], ctx: Context<CtxKey>, model: Model<CtxKey>): Promise<[number[], boolean[]]> => {
  const state_value_array = await model_to_state_value_array(ctx, model)
  return [state_value_array, constraints.map((c) => evaluate_constraint(state_value_array, c))]
}

export const pr_sat = async <CtxKey extends string>(
  ctx: Context<CtxKey>,
  constraints: Constraint[],
  regular: boolean = false,
// ): Promise<Res<[TruthTable, Model<CtxKey>], {}>> => {
): Promise<{ status: 'sat', all_constraints: Constraint[], tt: TruthTable, model: Model<CtxKey> } | { status: 'unsat' | 'unknown', all_constraints: Constraint[], tt: TruthTable, model: undefined }> => {
  const { Solver } = ctx
  const solver = new Solver();

  const [tt, all_constraints, smtlib_string] = constraints_to_smtlib_string(constraints, regular)
  solver.fromString(smtlib_string)
  const result = await solver.check()

  if (result === 'sat') {
    const model = solver.model();
    const [state_value_array, validation] = await validate_model(all_constraints, ctx, model)
    if (!validation.every((v) => v)) {
      console.log(validation)
      console.log(state_value_array)
      console.log(all_constraints.map(constraint_to_string))
      throw new Error('Constraints found to be satisfiable but the internal check for satisfiability given the model failed!')
    }
    // return [true, [tt, model]]
    return { status: 'sat', all_constraints, tt, model }
  } else {
    return { status: result, all_constraints, tt, model: undefined }
  }
}

