import { Context, Expr, init, Model, Z3HighLevel, Z3LowLevel } from "z3-solver"
import { match_s, S, spv, clause, s_to_string, default_clause } from "./s"
import { constraints_to_smtlib_string, eliminate_state_variable_index, enrich_constraints, parse_s, real_expr_to_smtlib, translate, TruthTable, variables_in_constraints, state_index_id, constraint_to_smtlib, translate_constraint, translate_real_expr, free_variables_in_constraint_or_real_expr as free_sentence_variables_in_constraint_or_real_expr, LetterSet, free_real_variables_in_constraint_or_real_expr, VariableLists, div0_conditions_in_constraint_or_real_expr } from "./pr_sat"
import { ConstraintOrRealExpr, PrSat } from "./types"
import { as_array, assert, assert_exists, assert_result, fallthrough, Res } from "./utils"

// type RealExpr = PrSat['RealExpr']
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

// const model_to_state_values = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>): Promise<Record<number, number>> => {
//   const values_map: Record<number, number> = {}
//   const { simplify } = ctx
//   for (const decl of model.decls()) {
//     if (decl.arity() !== 0) {
//       // throw new Error(`model includes a function declaration with arity not equal to zero!\nname: ${decl.name()}`)
//       continue
//     }
//     const name = decl.name().toString()
//     if (name.length < 3) {
//       throw new Error(`Expected model entry name to be of length at least 3!\nname: ${name.length}`)
//     }
//     const index_str = name.substring(2)
//     const index = parseInt(index_str)
//     if (isNaN(index)) {
//       throw new Error(`Expected model entry name to be of the form s_<number>!\nname: ${name}`)
//     }

//     const value_expr = await simplify(model.eval(decl.call()))
//     const parsed_s = parse_s(value_expr.sexpr())
//     const value = parse_and_evaluate(parsed_s)
//     values_map[index] = value
//   }

//   const values: number[] = []
//   for (let i = 0; i < Object.keys(values_map).length; i++) {
//     values.push(values_map[i])
//   }
//   return values
// }

export type ModelAssignmentOutput =
  | { tag: 'literal', value: number }
  | { tag: 'negative', inner: ModelAssignmentOutput }
  | { tag: 'rational', numerator: ModelAssignmentOutput, denominator: ModelAssignmentOutput }
  | { tag: 'root-obj', index: number, a: ModelAssignmentOutput, b: ModelAssignmentOutput, c: ModelAssignmentOutput }
  | { tag: 'generic-root-obj', index: number, coefficients: number[] }
  | { tag: 'unknown', s: S }

export const constraint_or_real_expr_to_smtlib = (tt: TruthTable, c_or_re: ConstraintOrRealExpr): S => {
  if (c_or_re.tag === 'constraint') {
    const t = translate_constraint(tt, c_or_re.constraint)
    return constraint_to_smtlib(t)
  } else if (c_or_re.tag === 'real_expr') {
    const t = translate_real_expr(tt, c_or_re.real_expr)
    return real_expr_to_smtlib(t)
  } else {
    return fallthrough('constraint_or_real_expr_to_smtlib', c_or_re)
  }
}

export type FancyEvaluatorOutput =
  | { tag: 'undeclared-vars', variables: VariableLists }
  | { tag: 'div0' }
  | { tag: 'result', result: ModelAssignmentOutput }

// const constraint_contains_div0 = (c: Constraint): boolean => {
//   const sub = constraint_contains_div0
//   const sub_real = real_expr_contains_div0
//   if (c.tag === 'biconditional') {
//     return sub(c.left) || sub(c.right)
//   } else if (c.tag === 'conditional') {
//     return sub(c.left) || sub(c.right)
//   } else if (c.tag === 'conjunction') {
//     return sub(c.left) || sub(c.right)
//   } else if (c.tag === 'disjunction') {
//     return sub(c.left) || sub(c.right)
//   } else if (c.tag === 'equal') {
//     return sub_real(c.left) || sub_real(c.right)
//   } else if (c.tag === 'greater_than') {
//     return sub_real(c.left) || sub_real(c.right)
//   } else if (c.tag === 'greater_than_or_equal') {
//     return sub_real(c.left) || sub_real(c.right)
//   } else if (c.tag === 'less_than') {
//     return sub_real(c.left) || sub_real(c.right)
//   } else if (c.tag === 'less_than_or_equal') {
//     return sub_real(c.left) || sub_real(c.right)
//   } else if (c.tag === 'negation') {
//     return sub(c.constraint)
//   } else if (c.tag === 'not_equal') {
//     return sub_real(c.left) || sub_real(c.right)
//   } else {
//     return fallthrough('constraint_contains_div0', c)
//   }
// }

// const real_expr_contains_div0 = (e: RealExpr): boolean => {
//   if (e.tag === 'divide') {
//     return 
//   } else if (e.tag === 'given_probability') {
//   } else if (e.tag === 'literal') {
//   } else if (e.tag === 'minus') {
//   } else if (e.tag === 'multiply') {
//   } else if (e.tag === 'negative') {
//   } else if (e.tag === 'plus') {
//   } else if (e.tag === 'power') {
//   } else if (e.tag === 'probability') {
//   } else if (e.tag === 'state_variable_sum') {
//   } else if (e.tag === 'variable') {
//   } else {
//     return fallthrough('real_expr_contains_div0', e)
//   }
// }

// const constraint_or_real_expr_contains_div0 = (c_or_re: ConstraintOrRealExpr): boolean => {
//   if (c_or_re.tag === 'constraint') {
//     return constraint_contains_div0(c_or_re.constraint)
//   } else if (c_or_re.tag === 'real_expr') {
//     return real_expr_contains_div0(c_or_re.real_expr)
//   } else {
//     return fallthrough('constraint_or_real_expr_contains_div0', c_or_re)
//   }
// }

export const fancy_evaluate_constraint_or_real_expr = async <CtxKey extends string>(ctx: Context<CtxKey>, tt: TruthTable, model_outputs: Record<number, ModelAssignmentOutput>, c_or_re: ConstraintOrRealExpr): Promise<FancyEvaluatorOutput> => {
  const { Solver } = ctx
  const solver = new Solver()
  const lines: S[] = []

  const free_sentence_vars = free_sentence_variables_in_constraint_or_real_expr(c_or_re, new LetterSet(), new LetterSet([...tt.letters()]))
  const free_real_vars = free_real_variables_in_constraint_or_real_expr(c_or_re, new Set)

  if (!free_sentence_vars.is_empty() || free_real_vars.size > 0) {
    return { tag: 'undeclared-vars', variables: { sentence: [...free_sentence_vars], real: [...free_real_vars] } }
  }

  for (const [state_index, output] of Object.entries(model_outputs)) {
    const index = assert_result(parse_int(state_index))
    const id = state_index_id(index)
    lines.push(['declare-const', id, 'Real'])

    const output_as_s = model_assignment_output_to_s(output)
    lines.push(['assert', ['=', id, output_as_s]])
  }

  const div0_constraints = div0_conditions_in_constraint_or_real_expr(c_or_re)
  for (const c of div0_constraints) {
    const translated = translate_constraint(tt, c)
    const as_smtlib = constraint_to_smtlib(translated)
    lines.push(['assert', as_smtlib])
  }

  const c_or_re_as_s = constraint_or_real_expr_to_smtlib(tt, c_or_re)
  const result_index = tt.n_states() + 1
  const result_id = state_index_id(result_index)  // Here's to hoping '_' isn't used as an id haha oops.
  const type = c_or_re.tag === 'constraint' ? 'Bool' : 'Real'
  lines.push(['declare-const', result_id, type])
  lines.push(['assert', ['=', result_id, c_or_re_as_s]])

  const smtlib_string = lines.map((s) => s_to_string(s, false)).join('\n')
  console.log(smtlib_string)
  solver.fromString(smtlib_string)
  const result = await solver.check()

  if (result === 'sat') {
    const z3_model = solver.model()
    const full_model = await model_to_assignments(ctx, z3_model)
    const final_result = assert_exists(full_model[result_index], 'Missing result index!')
    return { tag: 'result', result: final_result }
  } else {
    return { tag: 'div0' }
  }
}

const int_to_s = (i: number): S => {
  if (i < 0) {
    return ['-', (-i).toString()]
  } else {
    return i.toString()
  }
}

export const poly_s = (cs: number[]) => {
  if (cs.length === 0) {
    return '0'
  } else if (cs.length === 1) {
    return int_to_s(cs[0]).toString()
  } else if (cs.length === 2) {
    return ['+', ['*', int_to_s(cs[0]), 'x'], cs[1].toString()]
  } else {
    const ret: S = ['+']
    for (const [index, c] of cs.entries()) {
      const exp = cs.length - index - 1
      if (exp === 0) {
        ret.push(int_to_s(c))
      } else if (exp === 1) {
        if (c === 1) {
          ret.push('x')
        } else if (c === 0) {
          // skip!
        } else {
          ret.push(['*', int_to_s(c), 'x'])
        }
      } else {
        if (c === 1) {
          ret.push(['^', 'x', exp.toString()])
        } else if (c === -1) {
          ret.push(['-', ['^', 'x', exp.toString()]])
        } else if (c === 0) {
          // skip!
        } else {
          ret.push(['*', int_to_s(c), ['^', 'x', exp.toString()]])
        }
      }
    }
    return ret
  }
}

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
  } else if (output.tag === 'generic-root-obj') {
    const terms_str = output.coefficients.map((c, index) => {
      const exp = output.coefficients.length - index
      if (exp === 0) {
        return c
      } else if (exp === 1) {
        return `${c} * x`
      } else if (exp >= 2) {
        return `${c} * x^${exp}`
      } else {
        throw new Error('fallthrough!')
      }
    }).join(' + ')
    return `(root-obj ${output.index} (${terms_str}))`
  } else if (output.tag === 'unknown') {
    return s_to_string(output.s, false)
  } else {
    return fallthrough('model_assignment_output_to_string', output)
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

// const parse_s_integer = (term: S): number | undefined => {
//   const a = spv('a')
//   return match_s(term, [
//     clause({ a: 'string' }, ['-', a], (m) => {
//       return -assert_result(parse_int(m('a')))
//     }),
//     clause({ a: 'string' }, a, (m) => {
//       return assert_result(parse_int(m('a')))
//     }),
//   ])
// }

// [number, integer]
const parse_poly_term = (term: S): [number, number] => {
  const c = spv('c')
  const exp = spv('exp')
  const pi = (s: string): number => assert_result(parse_int(s))
  return match_s(term, [
    clause<{ c: 'string' }, [number, number]>({ c: 'string' }, c, (m) => {
      const [is_int, as_int] = parse_int(m('c'))
      if (is_int) {
        return [as_int, 0]
      } else {
        // Then we just saw an 'x' and we should return 1 for both the coefficient and the degree.
        return [1, 1]
      }
    }),
    clause<{ c: 'string' }, [number, number]>({ c: 'string' }, ['-', c], (m) => {
      const [is_int, as_int] = parse_int(m('c'))
      if (is_int) {
        return [-as_int, 0]
      } else {
        return [-1, 1]
      }
    }),
    clause<{ exp: 'string' }, [number, number]>({ exp: 'string' }, ['^', 'x', exp], (m) => {
      return [1, pi(m('exp'))]
    }),
    clause<{ exp: 'string' }, [number, number]>({ exp: 'string' }, ['-', ['^', 'x', exp]], (m) => {
      return [-1, pi(m('exp'))]
    }),
    clause<{ c: 'string' }, [number, number]>({ c: 'string' }, ['*', c, 'x'], (m) => {
      return [pi(m('c')), 1]
    }),
    clause<{ c: 'string' }, [number, number]>({ c: 'string' }, ['*', ['-', c], 'x'], (m) => {
      return [-pi(m('c')), 1]
    }),
    clause<{ c: 'string', exp: 'string' }, [number, number]>({ c: 'string', exp: 'string' }, ['*', c, ['^', 'x', exp]], (m) => {
      return [pi(m('c')), assert_result(parse_int(m('exp')))]
    }),
    clause<{ c: 'string', exp: 'string' }, [number, number]>({ c: 'string', exp: 'string' }, ['*', ['-', c], ['^', 'x', exp]], (m) => {
      return [-pi(m('c')), assert_result(parse_int(m('exp')))]
    }),
  ])
}

export const parse_to_assignment = (s: S): ModelAssignmentOutput => {
  // const [a, b, c, d] = [spv('a'), spv('b'), spv('c'), spv('d')]
  const [a, b] = [spv('a'), spv('b')]
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
    // clause<{ a: 's', b: 's', c: 's', d: 'string' }, ModelAssignmentOutput>(
    //   { a: 's', b: 's', c: 's', d: 'string' },
    //   ['root-obj', ['+', ['*', a, ['^', 'x', '2']], ['*', b], c], d],
    //   (m) => {
    //     const af = parse_to_assignment(m('a'))
    //     const bf = parse_to_assignment(m('b'))
    //     const cf = parse_to_assignment(m('c'))
    //     const di = assert_result(parse_int(m('d')))

    //     return { tag: 'root-obj', index: di, a: af, b: bf, c: cf }
    //   }),
      default_clause<ModelAssignmentOutput>((s) => {
        const t = s('s')
        if (Array.isArray(t) && t.length > 2 && t[0] === 'root-obj') {
          // super-hacky but it's fine.
          // it's of the form
          // ['root-obj', ['+'], index]
          const sum_s = assert_exists(as_array(t[1]), 'missing sum in root-obj!')
          if (sum_s.length <= 1) {
            throw new Error('sum_s in root-obj doesn\'t have enough terms!')
          }
          assert(sum_s[0] === '+', `first element of sum isn\'t '+', but is instead '${sum_s[0]}'!`)

          const coefficients: number[] = []
          const n_terms = sum_s.length - 1  // -1 to exclude leading '+'.
          let expected_exp = n_terms
          for (let term_index = 0; term_index < n_terms; term_index++) {
            const term = assert_exists(sum_s[1 + term_index], `term missing at index ${1 + term_index!}`)
            // A term could be:
            // - a number,
            // - a number times x, or
            // - a number times x raised to some power.
            const [c, exp] = parse_poly_term(term)
            if (expected_exp === exp) {
              coefficients.push(c)
            } else if (expected_exp > exp) {
              expected_exp--
              while (expected_exp > exp) {
                coefficients.push(0)
                expected_exp--
              }
              coefficients.push(c)
            } else {
              // throw new Error('Expected expected_exp to be >= exp!')
              coefficients.push(c)
              expected_exp = exp
            }
          }
          
          const index_s = assert_exists(t[2], 'missing index!')
          const index = typeof index_s === 'string' ? assert_result(parse_int(index_s))
            : typeof index_s === 'number' ? index_s
            : -1
          return { tag: 'generic-root-obj', coefficients, index }
        } else {
          return { tag: 'unknown', s: s('s') }
        }
      })
  ])
}

export const model_assignment_output_to_s = (output: ModelAssignmentOutput): S => {
  const sub = (output: ModelAssignmentOutput): S => model_assignment_output_to_s(output)
  if (output.tag === 'literal') {
    return output.value.toString()
  } else if (output.tag === 'negative') {
    return ['-', sub(output.inner)]
  } else if (output.tag === 'rational') {
    return ['/', sub(output.numerator), sub(output.denominator)]
  } else if (output.tag === 'root-obj') {
    return ['root-obj', ['+', ['*', sub(output.a), ['^', 'x', '2']], ['*', sub(output.b), 'x'], sub(output.c)], '2']
  } else if (output.tag === 'generic-root-obj') {
    const terms = output.coefficients.map((c, index) => {
      const exp = output.coefficients.length - index
      if (exp === 0) {
        return c
      } else if (exp === 1) {
        return ['*', c, 'x']
      } else if (exp >= 2) {
        // return `${c} * x^${exp}`
        return ['*', c, ['^', 'x', exp]]
      } else {
        throw new Error('fallthrough!')
      }
    })
    return ['root-obj', ['+', ...terms], output.index]
  } else if (output.tag === 'unknown') {
    return output.s
  } else {
    return fallthrough('model_assignment_output_to_s', output)
  }
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

export type SolverOptions = {
  regular: boolean
  timeout_ms: number
}

export type SolverReturn =
  | { status: 'sat', all_constraints: Constraint[], tt: TruthTable, state_values: Record<number, number>, model: Record<number, ModelAssignmentOutput> }
  | { status: 'unsat' | 'unknown', all_constraints: Constraint[], tt: TruthTable, state_values: Record<number, number>, model: undefined }

const DEFAULT_SOLVER_OPTIONS: SolverOptions = {
  regular: false,
  timeout_ms: 30_000,
}

// const fill_solver_options = (defaults: SolverOptions, partial: Partial<SolverOptions> | undefined): SolverOptions =>
//   ({ ...defaults, ...partial })

export const pr_sat_with_options = async <CtxKey extends string>(
  ctx: Context<CtxKey>,
  tt: TruthTable,
  constraints: Constraint[],
  options?: Partial<SolverOptions>,
): Promise<SolverReturn> => {
  const { regular, timeout_ms } = { ...DEFAULT_SOLVER_OPTIONS, ...options }
  const { Solver } = ctx
  const solver = new Solver();
  solver.set("timeout", timeout_ms)

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
    // const other_state_values = await model_to_state_values(ctx, model)
    // const state_values = {
    //   ...other_state_values,
    //   [index_to_eliminate]: evaluate_real_expr(tt, other_state_values, redef),
    // }
    // const validation = validate_model(translated, state_values, tt)
    // if (!validation.every((v) => v)) {
    //   console.log(validation)
    //   console.log(state_values)
    //   console.log(translated.map(constraint_to_string))
    //   throw new Error('Constraints found to be satisfiable but the internal check for satisfiability given the model failed!')
    // }

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
    const next_solver = new Solver()
    next_solver.fromString(next_solver_smtlib_string)
    const result = await next_solver.check()
    assert(result === 'sat')
    const final_model = next_solver.model()
    const assignments = await model_to_assignments(ctx, final_model)

    return { status: 'sat', all_constraints: translated, tt, state_values: {}, model: assignments }
  } else {
    return { status: result, all_constraints: translated, tt, state_values: {}, model: undefined }
  }

}

export const pr_sat_with_truth_table = async <CtxKey extends string>(
  ctx: Context<CtxKey>,
  tt: TruthTable,
  constraints: Constraint[],
  regular: boolean = false,
): Promise<SolverReturn> => {
  return await pr_sat_with_options(ctx, tt, constraints, { regular })
}

export const pr_sat = async <CtxKey extends string>(
  ctx: Context<CtxKey>,
  constraints: Constraint[],
  regular: boolean = false,
): Promise<SolverReturn> => {
  const tt = new TruthTable(variables_in_constraints(constraints))
  return pr_sat_with_truth_table(ctx, tt, constraints, regular)
}

