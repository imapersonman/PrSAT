import { Arith, Ast, Bool, CheckSatResult, Context, Expr, init, Model, Z3HighLevel, Z3LowLevel } from "z3-solver"
import { match_s, S, spv, clause, s_to_string, default_clause } from "./s"
import { constraints_to_smtlib_lines, eliminate_state_variable_index, enrich_constraints, parse_s, real_expr_to_smtlib, translate, TruthTable, variables_in_constraints, state_index_id, constraint_to_smtlib, translate_constraint, translate_real_expr, free_variables_in_constraint_or_real_expr as free_sentence_variables_in_constraint_or_real_expr, LetterSet, free_real_variables_in_constraint_or_real_expr, VariableLists, div0_conditions_in_constraint_or_real_expr, translate_constraint_or_real_expr, eliminate_state_variable_index_in_constraint_or_real_expr, map_constraint, compute_inverted_redef, eliminate_state_variable_index_in_svs, probability_constraints, constraint_to_string, div0_conditions_in_single_constraint, constraint_builder, real_expr_builder } from "./pr_sat"
import { ConstraintOrRealExpr, PrSat, RealExprMap } from "./types"
import { as_array, assert, assert_exists, assert_result, fallthrough, Res } from "./utils"
import { run_solve_cancel_logic } from "./solve_cancel_logic"

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

export const parse_smtlib2_expr = <CtxKey extends string>(ctx: Context<CtxKey>, real_variables: string[], text: string): Res<Expr<CtxKey>, string> => {
  const real_declarations = real_variables.map((id) => `(declare-const ${id} Real)`).join('\n')
  let expr: Ast<CtxKey>
  const full_text = `${real_declarations}(assert (= ${text} 1))`

  try {
    expr = ctx.ast_from_string(full_text)
  } catch (e: any) {
    return [false, `Text:${full_text}\nMessage:\n${e.message}`]
  }

  if (!ctx.isExpr(expr)) {
    return [false, `not expression: ${expr.sexpr()}`]
  }

  if (!ctx.isBool(expr)) {
    return [false, `not bool: ${expr.sexpr()}`]
  }

  if (!ctx.isEq(expr)) {
    return [false, `not eq (needed to extract expression): ${expr.sexpr()}`]
  }

  if (expr.numArgs() < 1) {
    return [false, `not enough arguments (needed to extract expression): ${expr.sexpr()}`]
  }

  const right_child = expr.children()[0]
  return [true, right_child]
}

export type ModelAssignmentOutput =
  | { tag: 'literal', value: number }
  | { tag: 'negative', inner: ModelAssignmentOutput }
  | { tag: 'rational', numerator: ModelAssignmentOutput, denominator: ModelAssignmentOutput }
  | { tag: 'root-obj', index: number, a: ModelAssignmentOutput, b: ModelAssignmentOutput, c: ModelAssignmentOutput }
  | { tag: 'generic-root-obj', index: number, degree: number, coefficients: number[] }
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
  | { tag: 'bool-result', result: boolean }

// I think any context can be passed in.
export const simpler_abstract_evaluate_constraint_or_real_expr = async <CtxKey extends string>(ctx: Context<CtxKey>, tt: TruthTable, c_or_re: ConstraintOrRealExpr, eval_f: (expr: Expr<CtxKey>) => Promise<ModelAssignmentOutput>): Promise<FancyEvaluatorOutput> => {
  const free_sentence_vars = free_sentence_variables_in_constraint_or_real_expr(c_or_re, new LetterSet(), new LetterSet([...tt.letters()]))
  const free_real_vars = free_real_variables_in_constraint_or_real_expr(c_or_re, new Set)

  if (!free_sentence_vars.is_empty() || free_real_vars.size > 0) {
    return { tag: 'undeclared-vars', variables: { sentence: [...free_sentence_vars], real: [...free_real_vars] } }
  }

  const ma_as_bool = (ma: ModelAssignmentOutput): boolean => {
    return ma.tag === 'literal' && ma.value === 1
  }

  const parsing_real_vars = [...free_real_vars, ...[...tt.state_indices()].map(state_index_id)]

  const div0_constraints = div0_conditions_in_constraint_or_real_expr(c_or_re)
  for (const c of div0_constraints) {
    const translated = translate_constraint(tt, c)
    // const z3_expr = constraint_to_bool(ctx, model, translated)
    const z3_expr = assert_result(parse_smtlib2_expr(ctx, parsing_real_vars, s_to_string(constraint_to_smtlib(translated), false)))
    // const result = model.eval(z3_expr)
    const result = await eval_f(z3_expr)
    // if (result === 'false' || result.sexpr() === '0') {
    if (!ma_as_bool(result) || (result.tag === 'literal' && result.value === 0)) {
      // found a denominator equal to zero!
      return { tag: 'div0' }
    }
  }

  const translated_c_or_re = translate_constraint_or_real_expr(tt, c_or_re)
  // Question: WHY DID I ELIMINATE A VARIABLE HERE THAT'S VERY ODD!
  // Answer: it's kind of a hack.  this whole file is a hack.  wah.
  //         The variable elimination needs to be taken into account somewhere.
  //         It's weird that its here and I don't have it documented anywhere that
  //         "hey don't worry about dealing with variable elimination elsewhere I
  //         already handled that".
  const index_to_eliminate = tt.n_states() - 1  // TODO: put this in a function.
  const [_, eliminated] = eliminate_state_variable_index_in_constraint_or_real_expr(tt.n_states(), index_to_eliminate, translated_c_or_re)
  // const to_evaluate_z3 = constraint_or_real_expr_to_z3_expr(ctx, model, eliminated)
  const to_evaluate_z3 = assert_result(parse_smtlib2_expr(ctx, parsing_real_vars, s_to_string(constraint_or_real_expr_to_smtlib(tt, eliminated), false)))
  if (c_or_re.tag === 'constraint') {
    // const result = model.eval(to_evaluate_z3, true)  // Do I still need model completion?
    const result = await eval_f(to_evaluate_z3)
    // const s = result.sexpr()
    return { tag: 'bool-result', result: ma_as_bool(result) }
  }

  // const output = await expr_to_assignment(ctx, model, to_evaluate_z3)
  const output = await eval_f(to_evaluate_z3)
  // console.log('RESULT', output)

  return { tag: 'result', result: output }
}

// The given Solver should already have all the other variables inside it declared but if not I will CRY.
export const abstract_fancy_evaluate_constraint_or_real_expr = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, tt: TruthTable, c_or_re: ConstraintOrRealExpr, eval_f: (expr: Expr<CtxKey>) => Promise<ModelAssignmentOutput>): Promise<FancyEvaluatorOutput> => {
  const free_sentence_vars = free_sentence_variables_in_constraint_or_real_expr(c_or_re, new LetterSet(), new LetterSet([...tt.letters()]))
  const free_real_vars = free_real_variables_in_constraint_or_real_expr(c_or_re, new Set)

  if (!free_sentence_vars.is_empty() || free_real_vars.size > 0) {
    return { tag: 'undeclared-vars', variables: { sentence: [...free_sentence_vars], real: [...free_real_vars] } }
  }

  const ma_as_bool = (ma: ModelAssignmentOutput): boolean => {
    return ma.tag === 'literal' && ma.value === 1
  }

  const div0_constraints = div0_conditions_in_constraint_or_real_expr(c_or_re)
  for (const c of div0_constraints) {
    const translated = translate_constraint(tt, c)
    const z3_expr = constraint_to_bool(ctx, model, translated)
    const result = model.eval(z3_expr)
    // const result = await eval_f(z3_expr)
    if (result.sexpr() === 'false' || result.sexpr() === '0') {
    // if (!ma_as_bool(result)) {
      // found a denominator equal to zero!
      return { tag: 'div0' }
    }
  }

  const translated_c_or_re = translate_constraint_or_real_expr(tt, c_or_re)
  // WHY DID I ELIMINATE A VARIABLE HERE THAT'S VERY ODD!
  const index_to_eliminate = tt.n_states() - 1  // TODO: put this in a function.
  const [_, eliminated] = eliminate_state_variable_index_in_constraint_or_real_expr(tt.n_states(), index_to_eliminate, translated_c_or_re)
  const to_evaluate_z3 = constraint_or_real_expr_to_z3_expr(ctx, model, eliminated)
  if (c_or_re.tag === 'constraint') {
    const result = model.eval(to_evaluate_z3, true)  // Do I still need model completion?
    // const result = await eval_f(to_evaluate_z3)
    const s = result.sexpr()
    // return { tag: 'bool-result', result: ma_as_bool(result) }
    return { tag: 'bool-result', result: s === 'true' }
  }

  // const output = await expr_to_assignment(ctx, model, to_evaluate_z3)
  const output = await eval_f(to_evaluate_z3)
  // console.log('RESULT', output)

  return { tag: 'result', result: output }
}


export const fancy_evaluate_constraint_or_real_expr = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, tt: TruthTable, c_or_re: ConstraintOrRealExpr): Promise<FancyEvaluatorOutput> => {
  return await abstract_fancy_evaluate_constraint_or_real_expr(ctx, model, tt, c_or_re, async (expr) => expr_to_assignment(ctx, model, expr))
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
    return `${wrap(output.numerator)} / ${wrap(output.denominator)}`
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
      const ma = m('a')
      const as_float = assert_result(parse_float(ma))
      return { tag: 'literal', value: as_float }
    }),
    clause<{ a: 's' }, ModelAssignmentOutput>({ a: 's' }, ['-', a], (m) => {
      const inner = parse_to_assignment(m('a'))
      return { tag: 'negative', inner }
    }),
    clause<{ a: 'string', b: 'string' }, ModelAssignmentOutput>({ a: 'string', b: 'string' }, ['/', a, b], (m) => {
      const numerator = parse_to_assignment(m('a'))
      const denominator = parse_to_assignment(m('b'))
      return { tag: 'rational', numerator, denominator }
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
          let largest_exp = 0
          let previous_exp: number | undefined = undefined
          for (let term_index = 0; term_index < n_terms; term_index++) {
            const term = assert_exists(sum_s[1 + term_index], `term missing at index ${1 + term_index!}`)
            const [c, exp] = parse_poly_term(term)
            if (previous_exp !== undefined && previous_exp <= exp) {
              throw new Error('Expected exponents to monotonically decrease in polynomial!')
            }

            assert(previous_exp === undefined || previous_exp > exp)
            if (previous_exp !== undefined) {
              for (let exp_gap = previous_exp - 1; exp_gap > exp; exp_gap--) {
                coefficients.push(0)
              }
            }
            coefficients.push(c)

            largest_exp = Math.max(largest_exp, exp)
            previous_exp = exp
          }
          
          const index_s = assert_exists(t[2], 'missing index!')
          const index = typeof index_s === 'string' ? assert_result(parse_int(index_s))
            : typeof index_s === 'number' ? index_s
            : -1
          return { tag: 'generic-root-obj', degree: largest_exp, coefficients, index }
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

const abstract_expr_to_assignment = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, expr: Expr<CtxKey>, eval_f: <CK extends string>(expr: Expr<CK>) => Expr<CK>): Promise<ModelAssignmentOutput> => {
  const value_expr = await ctx.simplify(eval_f(expr))
  // const value_expr = await ctx.simplify(ctx.Real.val(-2138))
  const parsed_s = parse_s(value_expr.sexpr())
  const value = parse_to_assignment(parsed_s)
  return value
}

const expr_to_assignment = async <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, expr: Expr<CtxKey>): Promise<ModelAssignmentOutput> => {
  const value_expr = await ctx.simplify(model.eval(expr))
  // const value_expr = model.eval(expr)
  // const value_expr = await ctx.simplify(ctx.Real.val(-2138))
  const parsed_s = parse_s(value_expr.sexpr())
  const value = parse_to_assignment(parsed_s)
  return value

  // return abstract_expr_to_assignment(ctx, model, expr, model.eval)
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

const constraint_or_real_expr_to_z3_expr = <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, c_or_re: ConstraintOrRealExpr): Expr<CtxKey> => {
  if (c_or_re.tag === 'constraint') {
    return constraint_to_bool(ctx, model, c_or_re.constraint)
  } else if (c_or_re.tag === 'real_expr') {
    return real_expr_to_arith(ctx, model, c_or_re.real_expr)
  } else {
    return fallthrough('constraint_or_real_expr_to_z3_expr', c_or_re)
  }
}

export const real_expr_to_arith = <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, expr: RealExpr): Arith<CtxKey> => {
  const sub = (expr: RealExpr): Arith<CtxKey> => real_expr_to_arith(ctx, model, expr)
  if (expr.tag === 'divide') {
    return ctx.Div(sub(expr.numerator), sub(expr.denominator))
  } else if (expr.tag === 'given_probability') {
    throw new Error('Unable to convert conditional probability to a Z3 arith expression!')
  } else if (expr.tag === 'literal') {
    return ctx.Real.val(expr.value)
  } else if (expr.tag === 'minus') {
    return ctx.Sub(sub(expr.left), sub(expr.right))
  } else if (expr.tag === 'multiply') {
    return ctx.Product(sub(expr.left), sub(expr.right))
  } else if (expr.tag === 'negative') {
    return ctx.Neg(sub(expr.expr))
  } else if (expr.tag === 'plus') {
    return ctx.Sum(sub(expr.left), sub(expr.right))
  } else if (expr.tag === 'power') {
    throw new Error('Unable to convert exponent to Z3 arith expression (be careful where real_expr_to_arith is called!)')
  } else if (expr.tag === 'probability') {
    throw new Error('Unable to convert probability to a Z3 arith expression!')
  } else if (expr.tag === 'state_variable_sum') {
    if (expr.indices.length === 0) {
      return ctx.Real.val(0)
    } else {
      const first_var_expr = model.eval(ctx.Const(state_index_id(assert_exists(expr.indices[0], 'Missing expr.indices[0] for some reason!')), ctx.Real.sort()))
      const rest_var_exprs = expr.indices.slice(1).map((state_index) => (ctx.Const(state_index_id(state_index), ctx.Real.sort())))
      return ctx.Sum(first_var_expr, ...rest_var_exprs)
    }
  } else if (expr.tag === 'variable') {
    throw new Error('Unable to convert variable to Z3 arith expression (be careful where real_expr_to_arith is called!)')
  } else {
    return fallthrough('real_expr_to_arith', expr)
  }
}

export const constraint_to_bool = <CtxKey extends string>(ctx: Context<CtxKey>, model: Model<CtxKey>, c: Constraint): Bool<CtxKey> => {
  const sub = (c: Constraint): Bool<CtxKey> => constraint_to_bool(ctx, model, c)
  const sub_real = (e: RealExpr): Arith<CtxKey> => real_expr_to_arith(ctx, model, e)
  if (c.tag === 'biconditional') {
    return ctx.Iff(sub(c.left), sub(c.right))
  } else if (c.tag === 'conditional') {
    return ctx.Implies(sub(c.left), sub(c.right))
  } else if (c.tag === 'conjunction') {
    return ctx.And(sub(c.left), sub(c.right))
  } else if (c.tag === 'disjunction') {
    return ctx.Or(sub(c.left), sub(c.right))
  } else if (c.tag === 'equal') {
    return ctx.Eq(sub_real(c.left), sub_real(c.right))
  } else if (c.tag === 'greater_than') {
    return ctx.GT(sub_real(c.left), sub_real(c.right))
  } else if (c.tag === 'greater_than_or_equal') {
    return ctx.GE(sub_real(c.left), sub_real(c.right))
  } else if (c.tag === 'less_than') {
    return ctx.LT(sub_real(c.left), sub_real(c.right))
  } else if (c.tag === 'less_than_or_equal') {
    return ctx.LE(sub_real(c.left), sub_real(c.right))
  } else if (c.tag === 'negation') {
    return ctx.Not(sub(c.constraint))
  } else if (c.tag === 'not_equal') {
    return ctx.Not(ctx.Eq(sub_real(c.left), sub_real(c.right)))
  } else {
    return fallthrough('constraint_to_bool', c)
  }
}

export const pr_sat = async (
  init_z3: () => Promise<Z3HighLevel & Z3LowLevel>,
  constraints: Constraint[],
  regular: boolean = false,
): Promise<WrappedSolverResult> => {
  const tt = new TruthTable(variables_in_constraints(constraints))
  const result = await pr_sat_wrapped(new WrappedSolver(await init_z3(), init_z3), tt, constraints, { regular })
  return result.solver_output
}

export type WrappedStringBasedSolverResult =
  | {
    status: 'sat'
    state_assignments: Record<number, ModelAssignmentOutput>
    // evaluate(real_variables: string[], text: string): Promise<ModelAssignmentOutput>
    evaluate_smtlib(real_variables: string[], text: string): Promise<ModelAssignmentOutput>
  }
  | { status: 'unsat' }
  | { status: 'unknown' }
  | { status: 'exception', message: string }
  | { status: 'cancelled' }

export type WrappedSolverResult =
  | {
    status: 'sat'
    state_assignments: Record<number, ModelAssignmentOutput>
    evaluate(tt: TruthTable, c_or_re: ConstraintOrRealExpr): Promise<FancyEvaluatorOutput>
    evaluate_smtlib(real_variables: string[], text: string): Promise<ModelAssignmentOutput>
  }
  | { status: 'unsat' }
  | { status: 'unknown' }
  | { status: 'exception', message: string }
  | { status: 'cancelled' }

type SolverOptions2 = {
  regular: boolean
  abort_signal?: AbortSignal
  cancel_fallback?: () => Promise<undefined>
}

const DEFAULT_SOLVER_OPTIONS2: SolverOptions2 = {
  regular: false,
  abort_signal: undefined,
}

// original (as given by the user with all the probabilities)
// translated (no more probabilities, eliminated variable, no division by zero)
// final (any extra stuffs we want).

// I need to organize them in a way that makes it easy to judge if I'm transforming
// them correctly.
// This also needs to be tested.
// The constraints are practically meaningless until the "translated" stage, but even
// this stage might do too much with how I have it set up right now.
// Variable elimination is technically a speed-up, and everything would still work
// properly without it.
// Variable elimination is different than other transformation, though.
// It's a transformation that requires a model transform sometime later, since the
// last step of solving for the eliminated variable is done by my code instead of by z3.

// Let's pretend that we have 3 transformations that require a transformation to the model
// after z3 is finished.
// These transformations are t1, t2, t3.
// The result of t3 is transformed into smtlib faithfully before being passed into z3.
// t3(t2(t1(cs))) --> m
// so (I have to define --> carefully if I'd like to do this but)
// t2(t1(cs)) --> inv_t3(m)
// t1(cs)     --> inv_t2(inv_t3(m))
// cs         --> inv_t1(inv_t2(inv_t3(m)))
// This is a crappy argument "justifying" my intuition that such model transforming constraint
// transformations should be applied in an order found by reversing the order in which the
// constraint transformation is applied.
// That's fine I'm good witht that.
// Let's do something completely irresponsible and have transformations in the following type.

// Given two SplitConstraintsSet<Constraint>s, I'd like to combine them into an smtlib script
// that comes back as unsat iff the inputs are logically equivalent.

// export type SplitConstraintsSet<C extends Constraint | string = Constraint> = {
//   probability: C[]
//   div0: C[]
//   core: C[]
//   extras: C[]
// }

// export const split_constraints_set_to_strings = (cs: SplitConstraintsSet<Constraint>): SplitConstraintsSet<string> => {
//   return {
//     probability: cs.probability.map(constraint_to_string),
//     core: cs.core.map(constraint_to_string),
//     div0: cs.div0.map(constraint_to_string),
//     extras: cs.extras.map(constraint_to_string),
//   }
// }

// export const split_constraints_set_to_constraints = (cs: SplitConstraintsSet<string>): SplitConstraintsSet<Constraint> => {
//   return {
//     probability: cs.probability.map(assert_parse_constraint),
//     core: cs.core.map(assert_parse_constraint),
//     div0: cs.div0.map(assert_parse_constraint),
//     extras: cs.extras.map(assert_parse_constraint),
//   }
// }

// type Transformation = (cs: SplitConstraintsSet) => {
//   set: SplitConstraintsSet,
//   model_mod?: (model: Record<number, ModelAssignmentOutput>) => Record<number, ModelAssignmentOutput>,
// }

// I wanted to just apply the transformations to the "core" set (e.g. not including the probability
// stuff) but then I might do something dumb like leave in a variable, so they'll have to be applied
// to everything.

// There needs to be a way to make sure each transformation made after a certain point keeps the set
// of constraints equivalent to each other.

export type InputConstraints<C extends Constraint | string> = {
  constraints: C[]
  smtlib: string[]
}

export const input_constraints_to_string = (ic: InputConstraints<Constraint>): InputConstraints<string> => {
  return {
    constraints: ic.constraints.map(constraint_to_string),
    smtlib: ic.smtlib,
  }
}

export type PrSATResult = {
  // constraints: {
  //   original: Constraint[]
  //   translated: Constraint[]
  //   extra: Constraint[]
  //   eliminated: Constraint[]
  // }
  // constraints: {
  //   original: Constraint[]
  //   optimized: Constraint[]
  //   // pre: SplitConstraintsSet
  //   // post: SplitConstraintsSet
  // }
  original: InputConstraints<Constraint>
  optimized: InputConstraints<Constraint>
  // smtlib_input: string,
  solver_output: WrappedSolverResult
}

export const transform_constraints_new = (
  tt: TruthTable,
  index_to_eliminate: number,
  constraints: Constraint[],
  regular: boolean,
): {
  translated: Constraint[],
  redef: RealExpr,
} => {
  const translated: Constraint[] = probability_constraints(tt, index_to_eliminate, regular)
  const new_constraints: Constraint[] = []
  const inverted_redef = compute_inverted_redef(tt.n_states(), index_to_eliminate)
  const redef: RealExpr = { tag: 'minus', left: { tag: 'literal', value: 1 }, right: inverted_redef }

  // translated.push(constraint_builder.eq(real_expr_builder.svs([index_to_eliminate]), redef))

  for (const c of constraints) {
    const new_c = map_constraint(c, {
      RealExpr: (e) => {
        if (e.tag === 'probability') {
          const dnf_transformed: RealExprMap['state_variable_sum'] = {
            tag: 'state_variable_sum',
            indices: tt.compute_dnf(e.arg),
          }
          const final: RealExpr = eliminate_state_variable_index_in_svs(
            index_to_eliminate,
            inverted_redef,
            dnf_transformed,
          )
          return final
        } else if (e.tag === 'given_probability') {
          // P(A | B) = P(A & B) / P(B)
          const n: RealExpr = eliminate_state_variable_index_in_svs(
            index_to_eliminate,
            inverted_redef,
            {
              tag: 'state_variable_sum',
              indices: tt.compute_dnf({ tag: 'conjunction', left: e.arg, right: e.given }),  // I could make this faster by taking the intersection, but let's get this working first.
            }
          )
          const d: RealExpr = eliminate_state_variable_index_in_svs(
            index_to_eliminate,
            inverted_redef,
            {
              tag: 'state_variable_sum',
              indices: tt.compute_dnf(e.given),
            }
          )
          if (d.tag !== 'literal' || d.value == 0) {
            // translated.push({ tag: 'negation', constraint: { tag: 'equal', left: d, right: { tag: 'literal', value: 0 } } })
            translated.push({ tag: 'greater_than', left: d, right: { tag: 'literal', value: 0 } })
          }
          // div0_constraints.push({ tag: 'greater_than', left: d, right: { tag: 'literal', value: 0 } })
          return { tag: 'divide', numerator: n, denominator: d }
        } else if (e.tag === 'divide') {
          if (e.denominator.tag !== 'literal' || e.denominator.value === 0) {
            translated.push({ tag: 'negation', constraint: { tag: 'equal', left: e.denominator, right: { tag: 'literal', value: 0 } } })
          }
          return e
        } else {
          return e
        }
      },
    })
    new_constraints.push(new_c)
  }
  
  // console.log('extras only', constraints_to_smtlib_lines(tt, index_to_eliminate, translated).map((s) => s_to_string(s, false)).join('\n'))

  for (const new_c of new_constraints) {
    translated.push(new_c)
  }

  return {
    translated,
    redef,
  }
}

// const initial_split_constraints = (tt: TruthTable, index_to_eliminate: number, core_constraints: Constraint[], regular: boolean): SplitConstraintsSet => {
//   const div0: Constraint[] = []
//   for (const c of core_constraints) {
//     div0.push(...div0_conditions_in_single_constraint(c))
//   }

//   return {
//     core: core_constraints,
//     // I DON'T LIKE THAT I'M ELIMINATING AN INDEX HERE THAT'S SO WEIRD!
//     probability: probability_constraints(tt, index_to_eliminate, regular),
//     div0,
//     extras: [],
//   }
// }

export const transform_constraints_old = (
  tt: TruthTable,
  index_to_eliminate: number,
  constraints: Constraint[],
  regular: boolean
): {
  translated: Constraint[],
  enriched_constraints: Constraint[],
  elim_constraints: Constraint[],
  redef: RealExpr,
} => {
  const translated = translate(tt, constraints)
  // console.log('translated')
  // console.log(constraints_to_smtlib_lines(tt, index_to_eliminate, translated).map((s) => s_to_string(s, false)).join('\n'))
  const enriched_constraints = enrich_constraints(tt, index_to_eliminate, regular, translated)
  const [redef, elim_constraints] = eliminate_state_variable_index(tt.n_states(), index_to_eliminate, enriched_constraints)
  return { translated, enriched_constraints, elim_constraints, redef }
}

type ExampleStage = {
  original: InputConstraints<Constraint>
  optimized: InputConstraints<Constraint>
  go: () => Promise<WrappedSolverResult>
}

export const pr_sat_staged = (solver: WrappedSolver, tt: TruthTable, constraints: Constraint[], options?: Partial<SolverOptions2>): ExampleStage => {
  const { regular, abort_signal, cancel_fallback } = { ...DEFAULT_SOLVER_OPTIONS2, ...(options ?? {}) }
  const index_to_eliminate = tt.n_states() - 1  // Only this works right now!
  const { translated, enriched_constraints, elim_constraints, redef } = transform_constraints_old(tt, index_to_eliminate, constraints, regular)
  const actual_to_use = transform_constraints_new(tt, index_to_eliminate, constraints, regular)
  const smtlib_lines = constraints_to_smtlib_lines(tt, undefined, elim_constraints)
  const smtlib_string = smtlib_lines.map((s) => s_to_string(s, false)).join('\n')

  const original_input_constraints: InputConstraints<Constraint> = {
    constraints: elim_constraints,
    smtlib: smtlib_lines.map((s) => s_to_string(s, false)),
  }
  const optimized_input_constraints: InputConstraints<Constraint> = {
    constraints: actual_to_use.translated,
    smtlib: constraints_to_smtlib_lines(tt, index_to_eliminate, actual_to_use.translated).map((s) => s_to_string(s, false)),
  }

  return {
    original: original_input_constraints,
    optimized: optimized_input_constraints,
    go: async (): Promise<WrappedSolverResult> => {
      // const result = await solver.solve(smtlib_string, abort_signal, cancel_fallback)
      const stringed_result = await solver.solve(smtlib_string, abort_signal, cancel_fallback)
      const result = solver.unstring_result(stringed_result, (ctx, e) => {
        eliminate_state_variable_index_in_constraint_or_real_expr
        const var_id = state_index_id(index_to_eliminate)
        const var_to_eliminate = assert_result(parse_smtlib2_expr(ctx, [var_id], var_id))
        const all_the_real_vars = [...tt.state_indices()].map(state_index_id)
        const redef_as_expr = assert_result(parse_smtlib2_expr(ctx, all_the_real_vars, s_to_string(real_expr_to_smtlib(redef), false)))
        return ctx.substitute(e, [var_to_eliminate, redef_as_expr])
      })
      if (result.status === 'sat') {
        const elim_var_value = await result.evaluate(tt, { tag: 'real_expr', real_expr: redef })
        if (elim_var_value.tag !== 'result') {
          throw new Error('Oh no error when trying to calculate eliminated variable!')
        }

        // Evaluating the simply translated constraints to make sure the extra transformations didn't introduce
        // errors.
        for (const c of translated) {
          const value = await result.evaluate(tt, { tag: 'constraint', constraint: c })
          if (value.tag !== 'bool-result') {
            throw new Error(`Evaluating a constraint doesn\'t return a boolean value for some result!\ntag: ${value.tag}`)
          } else if (!value.result) {
            throw new Error('Evaluating output model is bad oh non!')
          }
        }

        return {
          ...result,
          state_assignments: { ...result.state_assignments, [index_to_eliminate]: elim_var_value.result },
        }
      } else {
        return result
      }
    },
  }
}

const example_stuff = async (solver: WrappedSolver, tt: TruthTable, constraints: Constraint[]) => {
  const stage1 = pr_sat_staged(solver, tt, constraints)
  await stage1.go()
}

export const pr_sat_wrapped = async (
  solver: WrappedSolver,
  tt: TruthTable,
  constraints: Constraint[],
  options?: Partial<SolverOptions2>,
  // constraints_transformed?: (pre: SplitConstraintsSet, post: SplitConstraintsSet) => void,
): Promise<PrSATResult> => {
  const stage = pr_sat_staged(solver, tt, constraints, options)
  return {
    original: stage.original,
    optimized: stage.optimized,
    solver_output: await stage.go(),
  }
  // const { regular, abort_signal, cancel_fallback } = { ...DEFAULT_SOLVER_OPTIONS2, ...(options ?? {}) }

  // // There is a major issue with this.
  // // I'm reluctant to implement more transformations because they're
  // // (a) error prone, and
  // // (b) super tedious.
  // // It would be nice to be able to have a standardized way to implement the transformations I'm interested in
  // // in a way that's not tedious and is easy to reason about.
  // // Here are all the transformations I want to include, starting from a list of Constraint ASTs containing probabilities:
  // // 1) Probability elimination: Converting probabilities (including conditional probabilities) into expressions with
  // //    state indices.
  // //    - This transform needs to be saved so it can be checked later.
  // // 2) Adding probability constraints (e.g. Pr(A) >= 0 & Pr(A) <= 1).
  // // 3) Variable elimination.
  // // 4) Division by zero guards.
  // // 5) Ratio elimination.

  // const index_to_eliminate = tt.n_states() - 1  // Only this works right now!

  // // const translated = translate(tt, constraints)
  // // const enriched_constraints = enrich_constraints(tt, index_to_eliminate, regular, translated)
  // // const [redef, elim_constraints] = eliminate_state_variable_index(tt.n_states(), index_to_eliminate, enriched_constraints)

  // const { translated, enriched_constraints, elim_constraints, redef } = transform_constraints_old(tt, index_to_eliminate, constraints, regular)
  // const actual_to_use = transform_constraints_new(tt, index_to_eliminate, constraints, regular)

  // // if (!are_equal(actual_to_use.translated, elim_constraints)) {
  // //   console.log('\nold')
  // //   console.log(constraints_to_smtlib_lines(tt, index_to_eliminate, elim_constraints).map((s) => s_to_string(s, false)).join('\n'))
  // //   console.log('\nnew')
  // //   console.log(constraints_to_smtlib_lines(tt, index_to_eliminate, actual_to_use.translated).map((s) => s_to_string(s, false)).join('\n'))
  // //   throw new Error('old and new translated don\'t agree!')
  // // }
  // // if (!are_equal(actual_to_use.redef, redef)) {
  // //   throw new Error('old and new redef don\'t agree!')
  // // }

  // // const initial_split = initial_split_constraints(tt, index_to_eliminate, constraints, regular)
  // // const elim_split = eliminate_from_split_constraints(tt, index_to_eliminate, initial_split)

  // // const smtlib_lines = constraints_to_smtlib_lines(tt, index_to_eliminate, elim_constraints)
  // const smtlib_lines = constraints_to_smtlib_lines(tt, undefined, elim_constraints)
  // // const smtlib_lines = constraints_to_smtlib_lines(tt, index_to_eliminate, actual_to_use.translated)
  // const smtlib_string = smtlib_lines.map((s) => s_to_string(s, false)).join('\n')
  // // console.log(smtlib_string)
  // // const result = await solver.solve(smtlib_lines, abort_signal, cancel_fallback)
  // // constraints_transformed?.(enriched_constraints, elim_constraints)
  // // constraints_transformed?.(initial_constraints, elim_constraints)
  // const result = await solver.solve(smtlib_string, abort_signal, cancel_fallback)
  // const original_input_constraints: InputConstraints<Constraint> = {
  //   constraints: elim_constraints,
  //   smtlib: smtlib_lines.map((s) => s_to_string(s, false)),
  // }
  // // const optimized_input_constraints = original_input_constraints
  // const optimized_input_constraints: InputConstraints<Constraint> = {
  //   constraints: actual_to_use.translated,
  //   smtlib: constraints_to_smtlib_lines(tt, index_to_eliminate, actual_to_use.translated).map((s) => s_to_string(s, false)),
  // }
  // // const output_constraints = {
  // //   original: constraints,
  // //   translated,
  // //   extra: enriched_constraints,
  // //   eliminated: elim_constraints,
  // // }

  // if (result.status === 'sat') {
  //   const elim_var_value = await result.evaluate(tt, { tag: 'real_expr', real_expr: redef })
  //   if (elim_var_value.tag !== 'result') {
  //     throw new Error('Oh no error when trying to calculate eliminated variable!')
  //   }

  //   // Evaluating the simply translated constraints to make sure the extra transformations didn't introduce
  //   // errors.
  //   for (const c of translated) {
  //     const value = await result.evaluate(tt, { tag: 'constraint', constraint: c })
  //     if (value.tag !== 'bool-result') {
  //       throw new Error('Evaluating a constraint doesn\'t return a boolean value for some result!')
  //     } else if (!value.result) {
  //       throw new Error('Evaluating output model is bad oh non!')
  //     }
  //   }

  //   return {
  //     // constraints: output_constraints,
  //     original: original_input_constraints,
  //     optimized: optimized_input_constraints,
  //     // smtlib_input: smtlib_string,
  //     solver_output: {
  //       ...result,
  //       state_assignments: { ...result.state_assignments, [index_to_eliminate]: elim_var_value.result },
  //     }
  //   }
  // } else {
  //   return {
  //     // constraints: output_constraints,
  //     original: original_input_constraints,
  //     optimized: optimized_input_constraints,
  //     // smtlib_input: smtlib_string,
  //     solver_output: result,
  //   }
  // }
}

export class WrappedSolver {
  // private z3_worker_interface = new Z3WorkerInterface()

  constructor(private z3_interface: (Z3HighLevel & Z3LowLevel) | undefined, private readonly init: () => Promise<(Z3HighLevel & Z3LowLevel) | undefined>) {}

  private async reinitialize(): Promise<void> {
    const old = this.z3_interface
    this.z3_interface = await this.init()
    // // assumes the previous thing has been shut down.
    // this.z3_worker_interface = new Z3WorkerInterface()
  }

  unstring_result(r: WrappedStringBasedSolverResult, transform: (ctx: Context, expr: Expr) => Expr): WrappedSolverResult {
    const ctx = assert_exists(this.z3_interface, 'Can\'t unstring a result without an defined z3_interface!').Context('main')
    if (r.status === 'sat') {
      const inner_r = r
      return {
        ...r,
        async evaluate(tt, c_or_re) {
          // const s = constraint_or_real_expr_to_smtlib(tt, c_or_re)
          const something = await simpler_abstract_evaluate_constraint_or_real_expr(
            ctx, tt, c_or_re,
            (expr) => {
              const vars = [...tt.variables.real, ...[...tt.state_indices()].map(state_index_id)]
              // const vars: string[] = []
              // const s_string = s_to_string(expr, false)
              const s_string = transform(ctx, expr).sexpr()
              return inner_r.evaluate_smtlib(vars, s_string)
            },
          )
          return something

          // const s = constraint_or_real_expr_to_smtlib(tt, c_or_re)
          // const [success, eval_result] = await inner_r.evaluate([], s_to_string(s, false))
          // if (!success) {
          //   throw new Error(eval_result)  // I should handle this more nicely!
          // }

          // if (c_or_re.tag === 'constraint') {
          //   if (eval_result.tag === 'literal') {
          //     return { tag: 'bool-result', result: eval_result.value === 1 }
          //   } else {
          //     throw new Error(`Evaluating constraint results in non-literal!\nactual: ${model_assignment_output_to_string(eval_result)}`)
          //   }
          // } else {
          //   return { tag: 'result' }
          // }
        },
      }
    } else {
      return r
    }

  }

  // async solve(smtlib_lines: S[], abort_signal?: AbortSignal, cancel_fallback?: () => Promise<undefined>): Promise<WrappedSolverResult> {
  async solve(smtlib_string: string, abort_signal?: AbortSignal, cancel_fallback?: () => Promise<undefined>): Promise<WrappedStringBasedSolverResult> {
    return await run_solve_cancel_logic<WrappedStringBasedSolverResult>(
      async (abort_signal?: AbortSignal): Promise<WrappedStringBasedSolverResult> => {  // on_run
        if (this.z3_interface === undefined) {
          return { status: 'cancelled' }
        }

        const used_ctx = this.z3_interface.Context('main')
        const solver = new used_ctx.Solver('QF_NRA')
        // const smtlib_lines_string = smtlib_lines.map((s) => s_to_string(s, false)).join('\n')
        const smtlib_lines_string = smtlib_string

        try {
          solver.fromString(smtlib_lines_string)
        } catch (e: any) {
          console.error('smtlib_lines:\n', smtlib_lines_string)
          throw e
        }

        // let interrupted = false
        const on_abort = () => used_ctx.interrupt()
        abort_signal?.addEventListener('abort', on_abort)
        
        let result: CheckSatResult
        try {
          result = await solver.check()
        } catch (e: any) {
          return { status: 'exception', message: e.message }
        } finally {
          abort_signal?.removeEventListener('abort', on_abort)
          // return { status: 'exception', message: e.message }
        }

        // try {
          // const result = await solver.check()
          if (result === 'sat') {
            let model: Model
            try {
              model = solver.model()
            } catch (e: any) {
              return { status: 'exception', message: e.message }
            }

            const evaluate = async (tt: TruthTable, c_or_re: ConstraintOrRealExpr): Promise<FancyEvaluatorOutput> => {
              return await fancy_evaluate_constraint_or_real_expr(used_ctx, model, tt, c_or_re)
            }

            const evaluate2 = async (real_variables: string[], text: string): Promise<ModelAssignmentOutput> => {
              const as_expr = assert_result(parse_smtlib2_expr(used_ctx, real_variables, text))
              assert(text === as_expr.sexpr(), `text to evaluate is not the same as resulting expr's sexpr!\ntext: ${text}\nas_expr.sexpr(): ${as_expr.sexpr()}`)
              const ma = await expr_to_assignment(used_ctx, model, as_expr)
              return ma

              // const tt = new TruthTable({ real: [], sentence: [] })  // Empty
              // return await simpler_abstract_evaluate_constraint_or_real_expr(used_ctx, tt, )
            }

            let state_assignments: Record<number, ModelAssignmentOutput>
            try {
              state_assignments = await model_to_assignments(used_ctx, model)
            } catch (e: any) {
              throw e
              return { status: 'exception', message: e.message }
            }

            return {
              status: 'sat',
              // evaluate,
              evaluate_smtlib: evaluate2,
              state_assignments
            }
          } else {
            return { status: result }
          }
        // } catch (e: any) {
        //   throw e
        //   // return { status: 'exception', message: e.message }
        // } finally {
        //   abort_signal?.removeEventListener('abort', on_abort)
        // }

      },
      async () => ({ status: 'cancelled' }),
      async () => {  // on_slow_cancel
        console.log('attempting slow cancel...')
        await cancel_fallback?.()
        await this.reinitialize()
        return { status: 'cancelled' }
      },
      2 * 1000,  // two seconds before slow_cancel
      abort_signal,
    )
  }
}
