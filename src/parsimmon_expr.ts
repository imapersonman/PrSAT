// This file is a slightly modified version of the following parsimmon example:
// https://github.com/jneen/parsimmon/blob/master/examples/math.js

import P from 'parsimmon'
// import { test } from 'vitest';
// import { match_s, S, clause, default_clause, spv } from './s';

// This parser supports basic math with + - * / ^, unary negation, factorial,
// and parentheses. It does not evaluate the math, just turn it into a series of
// nested lists that are easy to evaluate.

// You might think that parsing math would be easy since people learn it early
// in school, but dealing with precedence and associativity of operators is
// actually one of the hardest and most tedious things you can do in a parser!
// If you look at a language like JavaScript, it has even more operators than
// math, like = and && and || and ++ and so many more...

///////////////////////////////////////////////////////////////////////

let _ = P.optWhitespace;

// Operators should allow whitespace around them, but not require it. This
// helper combines multiple operators together with names.
//
// Example: operators({Add: "+", Sub: "-"})
//
// Gives back an operator that parses either + or - surrounded by optional
// whitespace, and gives back the word "Add" or "Sub" instead of the character.
export function operators(ops: Record<string, string>) {
  let keys = Object.keys(ops).sort();
  let ps = keys.map(k =>
    P.string(ops[k])
      .trim(_)
      .result(k)
  );
  return P.alt.apply(null, ps);
}

// Takes a parser for the prefix operator, and a parser for the base thing being
// parsed, and parses as many occurrences as possible of the prefix operator.
// Note that the parser is created using `P.lazy` because it's recursive. It's
// valid for there to be zero occurrences of the prefix operator.
export function PREFIX(operatorsParser: P.Parser<any>, nextParser: P.Parser<any>) {
  let parser = P.lazy((): P.Parser<any> => {
    return P.seq(operatorsParser, parser).or(nextParser);
  });
  return parser;
}

// Ideally this function would be just like `PREFIX` but reordered like
// `P.seq(parser, operatorsParser).or(nextParser)`, but that doesn't work. The
// reason for that is that Parsimmon will get stuck in infinite recursion, since
// the very first rule. Inside `parser` is to match parser again. Alternatively,
// you might think to try `nextParser.or(P.seq(parser, operatorsParser))`, but
// that won't work either because in a call to `.or` (aka `P.alt`), Parsimmon
// takes the first possible match, even if subsequent matches are longer, so the
// parser will never actually look far enough ahead to see the postfix
// operators.
export function POSTFIX(operatorsParser: P.Parser<any>, nextParser: P.Parser<any>) {
  // Because we can't use recursion like stated above, we just match a flat list
  // of as many occurrences of the postfix operator as possible, then use
  // `.reduce` to manually nest the list.
  //
  // Example:
  //
  // INPUT  :: "4!!!"
  // PARSE  :: [4, "factorial", "factorial", "factorial"]
  // REDUCE :: ["factorial", ["factorial", ["factorial", 4]]]
  return P.seqMap(nextParser, operatorsParser.many(), (x, suffixes) =>
    suffixes.reduce((acc, x) => [x, acc], x)
  );
}

// Takes a parser for all the operators at this precedence level, and a parser
// that parsers everything at the next precedence level, and returns a parser
// that parses as many binary operations as possible, associating them to the
// right. (e.g. 1^2^3 is 1^(2^3) not (1^2)^3)
export function BINARY_RIGHT(operatorsParser: P.Parser<any>, nextParser: P.Parser<any>) {
  let parser = P.lazy((): P.Parser<any> =>
    nextParser.chain(next =>
      P.seq(operatorsParser, P.of(next), parser).or(P.of(next))
    )
  );
  return parser;
}

// Takes a parser for all the operators at this precedence level, and a parser
// that parsers everything at the next precedence level, and returns a parser
// that parses as many binary operations as possible, associating them to the
// left. (e.g. 1-2-3 is (1-2)-3 not 1-(2-3))
export function BINARY_LEFT(operatorsParser: P.Parser<any>, nextParser: P.Parser<any>) {
  // We run into a similar problem as with the `POSTFIX` parser above where we
  // can't recurse in the direction we want, so we have to resort to parsing an
  // entire list of operator chunks and then using `.reduce` to manually nest
  // them again.
  //
  // Example:
  //
  // INPUT  :: "1+2+3"
  // PARSE  :: [1, ["+", 2], ["+", 3]]
  // REDUCE :: ["+", ["+", 1, 2], 3]
  return P.seqMap(
    nextParser,
    P.seq(operatorsParser, nextParser).many(),
    (first, rest) => {
      return rest.reduce((acc, ch) => {
        let [op, another] = ch;
        return [op, acc, another];
      }, first);
    }
  );
}

// Just match simple integers and turn them into JavaScript numbers. Wraps it up
// in an array with a string tag so that our data is easy to manipulate at the
// end and we don't have to use `typeof` to check it.
let Num = P.regexp(/[0-9]+/)
  .map(str => ["Number", +str])
  .desc("number");

// A basic value is any parenthesized expression or a number.
let Basic = P.lazy((): P.Parser<any> =>
  P.string("(")
    .then(MyMath)
    .skip(P.string(")"))
    .or(Num)
);

type ParseType = (operatorsParser: P.Parser<any>, nextParser: P.Parser<any>) => P.Parser<any>
type ParseTableEntry = { type: ParseType, ops: P.Parser<any> }
export type ParseTable = ParseTableEntry[]

// Now we can describe the operators in order by precedence. You just need to
// re-order the table.
let table: ParseTable = [
  { type: PREFIX, ops: operators({ Negate: "-" }) },
  { type: POSTFIX, ops: operators({ Factorial: "!" }) },
  { type: BINARY_RIGHT, ops: operators({ Exponentiate: "^" }) },
  { type: BINARY_LEFT, ops: operators({ Multiply: "*", Divide: "/" }) },
  { type: BINARY_LEFT, ops: operators({ Add: "+", Subtract: "-" }) }
];

// Start off with Num as the base parser for numbers and thread that through the
// entire table of operator parsers.
let tableParser = table.reduce(
  (acc, level) => level.type(level.ops, acc),
  Basic
);

// The above is equivalent to:
//
// TYPE(operators({...}),
//   TYPE(operators({...}),
//     TYPE(operators({...})),
//       TYPE(operators({...}),
//         TYPE(operators({...}), ...))))
//
// But it's easier if to see what's going on and reorder the precedence if we
// keep it in a table instead of nesting it all manually.

// This is our version of a math expression.
export let MyMath = tableParser.trim(_);

export const make_parser = (basic: P.Parser<any>, table: { type: ParseType, ops: P.Parser<any> }[]): P.Parser<any> => {
  return table.reduce((acc, level) => level.type(level.ops, acc), basic).trim(_)
}
