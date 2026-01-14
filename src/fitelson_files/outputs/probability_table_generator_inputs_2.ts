import { ConstraintsFile } from '../stuff'

const file: ConstraintsFile<string> = {
  "constraint_set_blocks": [
    {
      "description": [],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "bad",
            "keep": false,
            "constraints": [
              {
                "tag": "error",
                "error": "At column 1\nexpected '!' '(' '-' 'P(' 'Pr(' 'p(' '~' /[0-9]+(\\.[0-9]+)?/ /[A-Za-z]+/ And expects at least 2 operands! Imp expects at least 2 operands! Or expects at least 2 operands!",
                "line": "'anot% PrSAT 3.0b: The Probability Table Generator (Beta)"
              }
            ]
          }
        }
      ]
    },
    {
      "description": [
        "probability of the conditional vs conditional probability"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X → Y) < Pr(Y | X)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Three Forms of Bayes's Theorem"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(H | E) ≠ (Pr(E | H) * Pr(H)) / ((Pr(E | H) * Pr(H)) + (Pr(E | ~H) * Pr(~H)))"
            ]
          }
        },
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(H | E) / Pr(~H | E) ≠ (Pr(E | H) / Pr(E | ~H)) * (Pr(H) / Pr(~H))"
            ]
          }
        },
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(H | E) ≠ 1 / (1 + ((Pr(E | ~H) / Pr(E | H)) * (Pr(~H) / Pr(H))))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Simpson's Paradox"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X | Y & Z) > Pr(X | Z)",
              "Pr(X | Y & ~Z) > Pr(X | ~Z)",
              "Pr(X | Y) < Pr(X)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "simplify the models with these numerical constraints"
      ],
      "constraint_sets": [
        {
          "continued_from_last": true,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X) = 1 / 2",
              "Pr(Y) = 1 / 2"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "an unsatisfiable triple, resembling Simpson's Paradox"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X | Y & Z) > Pr(X)",
              "Pr(X | Y & ~Z) > Pr(X)",
              "Pr(X | Y) < Pr(X)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "IF direction (I)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(A) = Pr(B)",
              "Pr(A) = 1 / 2",
              "Pr(A | A ↔ B) ≠ Pr(A | ~(A ↔ B))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "IF direction (II)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(A) = Pr(B)",
              "Pr(A) = 1 / 2",
              "Pr(B | A ↔ B) ≠ Pr(B | ~(A ↔ B))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "ONLY IF direction (I)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(A | A ↔ B) = Pr(A | ~(A ↔ B))",
              "Pr(B | A ↔ B) = Pr(B | ~(A ↔ B))",
              "Pr(A) ≠ Pr(B)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "ONLY IF direction (II)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(A | A ↔ B) = Pr(A | ~(A ↔ B))",
              "Pr(B | A ↔ B) = Pr(B | ~(A ↔ B))",
              "Pr(A) ≠ 1 / 2"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Reichenbach's Conjunctive Fork Theorem"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(E1 | E2 & C) = Pr(E1 | C)",
              "Pr(E1 | E2 & ~C) = Pr(E1 | ~C)",
              "Pr(E1 | C) > Pr(E1)",
              "Pr(E2 | C) > Pr(E2)",
              "Pr(E1 | E2) ≤ Pr(E1)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Three props which are pairwise independent but not independent",
        "This produces an irregular model by default",
        "If we ask it for a regular model, it gives irrational numbers"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "both",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X & Y) = Pr(X) * Pr(Y)",
              "Pr(X & Z) = Pr(X) * Pr(Z)",
              "Pr(Y & Z) = Pr(Y) * Pr(Z)",
              "Pr(X & (Y & Z)) ≠ (Pr(X) * Pr(Y)) * Pr(Z)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "If we add this numerical constraint, then it gives a nice urn model"
      ],
      "constraint_sets": [
        {
          "continued_from_last": true,
          "regular": "both",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X) = 1 / 2"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Four props that are 2-wise and 3-wise independent, but not 4-wise independent",
        "It can't solve this one without additional numerical constraints (in up to 3 mins)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X & Y) = Pr(X) * Pr(Y)",
              "Pr(X & Z) = Pr(X) * Pr(Z)",
              "Pr(Y & Z) = Pr(Y) * Pr(Z)",
              "Pr(X & U) = Pr(X) * Pr(U)",
              "Pr(Y & U) = Pr(Y) * Pr(U)",
              "Pr(Z & U) = Pr(Z) * Pr(U)",
              "Pr(X & (Y & Z)) = (Pr(X) * Pr(Y)) * Pr(Z)",
              "Pr(X & (Y & U)) = (Pr(X) * Pr(Y)) * Pr(U)",
              "Pr(X & (Z & U)) = (Pr(X) * Pr(Z)) * Pr(U)",
              "Pr(Y & (Z & U)) = (Pr(Y) * Pr(Z)) * Pr(U)",
              "Pr(X & (Y & (Z & U))) ≠ ((Pr(X) * Pr(Y)) * Pr(Z)) * Pr(U)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "with just this constraint, it gives irrational numbers"
      ],
      "constraint_sets": [
        {
          "continued_from_last": true,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(X) = 1 / 2"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "with one more numerical constraint, it gives a nice urn model"
      ],
      "constraint_sets": [
        {
          "continued_from_last": true,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(Y) = 1 / 2"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Z- measure impossibility (trivial)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(H | E1) > Pr(H)",
              "Pr(H | E2) < Pr(H)",
              "(Pr(H | E1 & E2) - Pr(H | E2)) / Pr(~H | E2) = (Pr(H | E1) - Pr(H)) / Pr(~H)",
              "(Pr(H | E2 & E1) - Pr(H | E1)) / Pr(H | E1) = (Pr(H | E2) - Pr(H)) / Pr(H)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "S-measure impossibility (there are no REGULAR models for this, but there are SOME models)",
        "Note: for any value other than 1/2 there are Regular models..."
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "both",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(H | E1 & E2) - Pr(H | ~E1 & E2) = Pr(H | E1) - Pr(H | ~E1)",
              "Pr(H | E2 & E1) - Pr(H | ~E2 & E1) = Pr(H | E2) - Pr(H | ~E2)",
              "Pr(H | E1) - Pr(H | ~E1) = 1 / 2",
              "Pr(H | E2) - Pr(H | ~E2) = -1 / 2",
              "Pr(H | E1 & E2) - Pr(H | ~(E1 & E2)) ≠ 0"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Wason result verification -- easily solved"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(~B) / Pr(R) ≥ Pr(~B | H) / Pr(R | H)",
              "Pr(~B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "(Pr(B | R) * (Pr(H | R & B) - Pr(H | R))) + (Pr(~B | R) * Pr(H | R)) ≤ (Pr(R | ~B) * Pr(H | ~B)) + (Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B)))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Wason/Rvens problem -- non-triviality model for KO measure.  Finds a simpler model than Mathematica's!"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(~B) / Pr(R) ≥ Pr(~B | H) / Pr(R | H)",
              "Pr(~B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "((Pr(B | R) * ((Pr(B | H & R) - Pr(B | ~H & R)) / (Pr(B | H & R) + Pr(B | ~H & R)))) * ((Pr(B | H & R) - Pr(B | ~H & R)) / (Pr(B | H & R) + Pr(B | ~H & R)))) + ((Pr(~B | R) * ((Pr(~B | H & R) - Pr(~B | ~H & R)) / (Pr(~B | H & R) + Pr(~B | ~H & R)))) * ((Pr(~B | H & R) - Pr(~B | ~H & R)) / (Pr(~B | H & R) + Pr(~B | ~H & R)))) ≥ ((Pr(R | ~B) * ((Pr(R | H & ~B) - Pr(R | ~H & ~B)) / (Pr(R | H & ~B) + Pr(R | ~H & ~B)))) * ((Pr(R | H & ~B) - Pr(R | ~H & ~B)) / (Pr(R | H & ~B) + Pr(R | ~H & ~B)))) + ((Pr(~R | ~B) * ((Pr(~R | H & ~B) - Pr(~R | ~H & ~B)) / (Pr(~R | H & ~B) + Pr(~R | ~H & ~B)))) * ((Pr(~R | H & ~B) - Pr(~R | ~H & ~B)) / (Pr(~R | H & ~B) + Pr(~R | ~H & ~B))))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Wason/Rvens problem -- trying to verify the KO version of the theorem -- hard",
        "It verifies this result -- and in under 30s!  I was not able to get any solver to do this!  Huge."
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(~B) / Pr(R) ≥ Pr(~B | H) / Pr(R | H)",
              "Pr(~B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "((Pr(B | R) * ((Pr(B | H & R) - Pr(B | ~H & R)) / (Pr(B | H & R) + Pr(B | ~H & R)))) * ((Pr(B | H & R) - Pr(B | ~H & R)) / (Pr(B | H & R) + Pr(B | ~H & R)))) + ((Pr(~B | R) * ((Pr(~B | H & R) - Pr(~B | ~H & R)) / (Pr(~B | H & R) + Pr(~B | ~H & R)))) * ((Pr(~B | H & R) - Pr(~B | ~H & R)) / (Pr(~B | H & R) + Pr(~B | ~H & R)))) < ((Pr(R | ~B) * ((Pr(R | H & ~B) - Pr(R | ~H & ~B)) / (Pr(R | H & ~B) + Pr(R | ~H & ~B)))) * ((Pr(R | H & ~B) - Pr(R | ~H & ~B)) / (Pr(R | H & ~B) + Pr(R | ~H & ~B)))) + ((Pr(~R | ~B) * ((Pr(~R | H & ~B) - Pr(~R | ~H & ~B)) / (Pr(~R | H & ~B) + Pr(~R | ~H & ~B)))) * ((Pr(~R | H & ~B) - Pr(~R | ~H & ~B)) / (Pr(~R | H & ~B) + Pr(~R | ~H & ~B))))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Another negative Wason result —- that u(B) > u (~B) does NOT follow from the strong Byesian assumptions.",
        "Finds a nice simple urn model."
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(H | R) = Pr(H | ~R)",
              "Pr(H | B) = Pr(H | ~B)",
              "Pr(~B) > Pr(B)",
              "Pr(B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "((Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) * (Pr(H | R & B) - Pr(H | B))) + ((Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B))) * (Pr(H | ~R & B) - Pr(H | B))) < ((Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B))) * (Pr(H | R & ~B) - Pr(H | ~B))) + ((Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B))) * (Pr(H | ~R & ~B) - Pr(H | ~B)))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "And here is the positive result -- that absence of confirmation bias fills this gap",
        "it can't solve this one -- even in 5 minutes (SMT input  below: ≠ 0 replaced with > 0)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(H | R) = Pr(H | ~R)",
              "Pr(H | B) = Pr(H | ~B)",
              "Pr(~B) > Pr(B)",
              "Pr(B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "Pr(R | B) ≤ Pr(R | ~B)",
              "((Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) * (Pr(H | R & B) - Pr(H | B))) + ((Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B))) * (Pr(H | ~R & B) - Pr(H | B))) ≤ ((Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B))) * (Pr(H | R & ~B) - Pr(H | ~B))) + ((Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B))) * (Pr(H | ~R & ~B) - Pr(H | ~B)))"
            ]
          }
        },
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "bad",
            "keep": false,
            "constraints": [
              {
                "tag": "error",
                "error": "At column 12\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(set-logic QF_NRA)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_0 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_1 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_2 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_3 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_4 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_5 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_6 Real)"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_0 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_1 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_2 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_3 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_4 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_5 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_6 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (<= (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6) 1))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_4) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_2 s_4 s_6) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_2 s_4 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_2) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_2) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_1 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_1 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_4 s_6) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_4 s_6) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (= (/ s_0 (+ s_0 s_4)) 1))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (= (/ (+ s_0 s_4) (+ s_0 s_2 s_4 s_6)) (/ (+ s_1 s_5) (- 1 (+ s_0 s_2 s_4 s_6)))))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (= (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) (+ s_0 s_1 s_2 s_3)))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) (+ s_0 s_2 s_4 s_6)))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_0 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_1 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_5 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_2 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_6 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_3 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (<= (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3)))))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (<= (+ (* (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)))) (* (/ (+ s_1 s_3) (+ s_0 s_1 s_2 s_3)) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))))) (+ (* (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))) (* (/ (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))))))"
              },
              {
                "tag": "error",
                "error": "At column 12\nexpected '!=' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(check-sat)"
              }
            ]
          }
        }
      ]
    },
    {
      "description": [
        "does eliminating ratios help?",
        "nope -- it seems to be the last, big constraint (SMT input directly below)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B & (H & R)) = Pr(H & R)",
              "Pr(H & R) * Pr(~R) = Pr(H & ~R) * Pr(R)",
              "Pr(H & B) * Pr(~B) = Pr(H & ~B) * Pr(B)",
              "Pr(~B) > Pr(B)",
              "Pr(B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "Pr(R & B) * Pr(~B) ≤ Pr(R & ~B) * Pr(B)",
              "((Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) * (Pr(H | R & B) - Pr(H | B))) + ((Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B))) * (Pr(H | ~R & B) - Pr(H | B))) ≤ ((Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B))) * (Pr(H | R & ~B) - Pr(H | ~B))) + ((Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B))) * (Pr(H | ~R & ~B) - Pr(H | ~B)))"
            ]
          }
        },
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "bad",
            "keep": false,
            "constraints": [
              {
                "tag": "error",
                "error": "At column 12\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(set-logic QF_NRA)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_0 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_1 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_2 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_3 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_4 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_5 Real)"
              },
              {
                "tag": "error",
                "error": "At column 16\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(declare-const s_6 Real)"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_0 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_1 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_2 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_3 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_4 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_5 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (>= s_6 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (<= (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6) 1))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_4) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_2 s_4 s_6) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_2 s_4 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_2) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_2) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_1 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_1 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_4 s_6) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_4 s_6) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (= (/ s_0 (+ s_0 s_4)) 1))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (= (/ (+ s_0 s_4) (+ s_0 s_2 s_4 s_6)) (/ (+ s_1 s_5) (- 1 (+ s_0 s_2 s_4 s_6)))))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (= (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3)) (+ s_0 s_1 s_2 s_3)))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (+ s_0 s_1 s_2 s_3) (+ s_0 s_2 s_4 s_6)))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_0 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_1 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_5 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_2 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_6 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_5 s_6)) 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (> s_3 0))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (<= (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3)))))"
              },
              {
                "tag": "error",
                "error": "At column 9\nexpected '!=' ')' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(assert (<= (+ (* (/ (+ s_0 s_2) (+ s_0 s_1 s_2 s_3)) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_0 (+ s_0 s_2)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3)))) (* (/ (+ s_1 s_3) (+ s_0 s_1 s_2 s_3)) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))) (- (/ s_1 (+ s_1 s_3)) (/ (+ s_0 s_1) (+ s_0 s_1 s_2 s_3))))) (+ (* (/ (+ s_4 s_6) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_4 (+ s_4 s_6)) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))) (* (/ (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6)) (- 1 (+ s_0 s_1 s_2 s_3))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3)))) (- (/ s_5 (- 1 (+ s_0 s_1 s_2 s_3 s_4 s_6))) (/ (+ s_4 s_5) (- 1 (+ s_0 s_1 s_2 s_3))))))))"
              },
              {
                "tag": "error",
                "error": "At column 12\nexpected '!=' '*' '+' '-' '/' '<' '<=' '=' '>' '>=' '^' '≠' '≤' '≥'",
                "line": "(check-sat)"
              }
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Maybe if we break this down into cases? Yes!",
        "(1) given B, R confirms H.  Then, Pr(H | R & B) - Pr(H | B) and Pr(H | B) - Pr(H | ~R & B) are non-negative",
        "(2) given ~B, , R confirms H. Then, Pr(H | R & ~B) - Pr(H | ~B) and Pr(H | ~B) - Pr(H | R & ~B) are non-negative",
        "There are 4 cases: (1) & (2).  Then, the final constraint is just the following, and then DOES return UNSAT"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "(Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) + (Pr(~R | B) * (Pr(H | B) - Pr(H | ~R & B))) ≤ (Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B))) + (Pr(~R | ~B) * (Pr(H | ~B) - Pr(H | ~R & ~B)))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Here is a non-triviality model for the full Bayesian assumptions + the full Nickerson ordering + no confirmation bias.  Easily finds a simple urn model."
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(H | R) = Pr(H | ~R)",
              "Pr(H | B) = Pr(H | ~B)",
              "Pr(~B) > Pr(B)",
              "Pr(B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "Pr(R | B) ≤ Pr(R | ~B)",
              "((Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) * (Pr(H | R & B) - Pr(H | B))) + ((Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B))) * (Pr(H | ~R & B) - Pr(H | B))) > ((Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B))) * (Pr(H | R & ~B) - Pr(H | ~B))) + ((Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B))) * (Pr(H | ~R & ~B) - Pr(H | ~B)))",
              "((Pr(B | R) * (Pr(H | R & B) - Pr(H | R))) * (Pr(H | R & B) - Pr(H | R))) + ((Pr(~B | R) * (Pr(H | R & ~B) - Pr(H | R))) * (Pr(H | R & ~B) - Pr(H | R))) > ((Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) * (Pr(H | R & B) - Pr(H | B))) + ((Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B))) * (Pr(H | ~R & B) - Pr(H | B)))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Here is the Wason (positive) confirmation-bias result --- solves it in ~30s)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(~B) / Pr(R) ≥ Pr(~B | H) / Pr(R | H)",
              "Pr(~B) > Pr(B)",
              "Pr(B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "((Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) * (Pr(H | R & B) - Pr(H | B))) + ((Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B))) * (Pr(H | ~R & B) - Pr(H | B))) > ((Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B))) * (Pr(H | R & ~B) - Pr(H | ~B))) + ((Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B))) * (Pr(H | ~R & ~B) - Pr(H | ~B)))",
              "Pr(R | B) ≤ Pr(R | ~B)",
              "(Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) > (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "And, it does  find a non-triviality model for this one (in ~40s)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(~B) / Pr(R) ≥ Pr(~B | H) / Pr(R | H)",
              "Pr(~B) > Pr(B)",
              "Pr(B) > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "((Pr(R | B) * (Pr(H | R & B) - Pr(H | B))) * (Pr(H | R & B) - Pr(H | B))) + ((Pr(~R | B) * (Pr(H | ~R & B) - Pr(H | B))) * (Pr(H | ~R & B) - Pr(H | B))) > ((Pr(R | ~B) * (Pr(H | R & ~B) - Pr(H | ~B))) * (Pr(H | R & ~B) - Pr(H | ~B))) + ((Pr(~R | ~B) * (Pr(H | ~R & ~B) - Pr(H | ~B))) * (Pr(H | ~R & ~B) - Pr(H | ~B)))",
              "Pr(R | B) > Pr(R | ~B)",
              "(Pr(H | R & ~B) - Pr(H | ~B)) * (Pr(H | R & ~B) - Pr(H | ~B)) > (Pr(H | R & B) - Pr(H | B)) * (Pr(H | R & B) - Pr(H | B))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Sidebar on Nickerson's numerical model: Nickerson's numerical assumption that P[H] = 1/2,",
        "which may seem innocuous, actually entails (given only our weak background assumptions",
        "+ the additional assumption that Pr(~Ba)>8/10) that Pr[Ra | Ba]  > Pr[Ra | ~Ba].",
        "Here is a demonstration -- easily verified with Koissi's program"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | H & R) = 1",
              "Pr(~B) / Pr(R) ≥ Pr(~B | H) / Pr(R | H)",
              "Pr(~B) > 8 / 10",
              "8 / 10 > Pr(R)",
              "Pr(H & (R & B)) > 0",
              "Pr(H & (~R & B)) > 0",
              "Pr(H & (~R & ~B)) > 0",
              "Pr(~H & (R & B)) > 0",
              "Pr(~H & (R & ~B)) > 0",
              "Pr(~H & (~R & ~B)) > 0",
              "Pr(~H & (~R & B)) > 0",
              "Pr(H) = 1 / 2",
              "Pr(R | B) ≤ Pr(R | ~B)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Salmon's sufficient condition for AND (verifies this)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | A) > Pr(B)",
              "Pr(C | A) > Pr(C)",
              "Pr(C | A) - Pr(C) = Pr(C | A & B) - Pr(C | B)",
              "Pr(B & C | A) ≤ Pr(B & C)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Salmon's sufficient condition for OR (verifies this -- in under 1m)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | A) > Pr(B)",
              "Pr(C | A) > Pr(C)",
              "Pr(C | A) - Pr(C) = Pr(C | A & B) - Pr(C | B)",
              "Pr(B ∨ C | A) ≤ Pr(B ∨ C)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Our weaker Salmonian sufficient condition for AND (assuming Regularity, case 1 -- easily verified)",
        "This is a nice example to illustrate when Regularity can make a difference"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | A) > Pr(B)",
              "Pr(C | A) > Pr(C)",
              "Pr(C | A & B) ≥ Pr(C | B)",
              "Pr(B & C | A) ≤ Pr(B & C)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Our weaker sufficient condition for OR (assuming Regularity, case 1 -- verifies this too, in under 1m)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(B | A) > Pr(B)",
              "Pr(C | A) > Pr(C)",
              "Pr(C | A) - Pr(C) ≥ Pr(C | A & B) - Pr(C | B)",
              "Pr(B ∨ C | A) ≤ Pr(B ∨ C)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "robustness of our Salmonian condition for OR —- for the m measure",
        "(Koissi's program does this -- none of the others do)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(C | A) > Pr(C)",
              "Pr(B | A) > Pr(B)",
              "Pr(A | C) - Pr(A | ~C) ≥ Pr(A | C & B) - Pr(A | ~C & B)",
              "Pr(B ∨ C | A) ≤ Pr(B ∨ C)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Our Triviality Result (trivial for the program)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(C) = Pr(Q | P)",
              "Pr(C | ~Q) = Pr(Q | P & ~Q)",
              "Pr(C | ~P ∨ Q) = Pr(Q | P & (~P ∨ Q))",
              "Pr(P & (Q ↔ C)) < 1"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Industrial Strength Example with 63 real variables",
        "Example #2: 63 real variables -- solved instantly by PrSAT 3.0b.",
        "Takes 600+ seconds on PrSAT 2.5 random search!"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(A & (B & H)) = (Pr(A) * Pr(B)) * Pr(H | A & B)",
              "Pr(A & (B & ~H)) = (Pr(A) * Pr(B)) * Pr(~H | A & B)",
              "Pr(A & (~B & H)) = (Pr(A) * Pr(~B)) * Pr(H | A & ~B)",
              "Pr(A & (~B & ~H)) = (Pr(A) * Pr(~B)) * Pr(~H | A & ~B)",
              "Pr(~A & (B & H)) = (Pr(~A) * Pr(B)) * Pr(H | ~A & B)",
              "Pr(~A & (B & ~H)) = (Pr(~A) * Pr(B)) * Pr(~H | ~A & B)",
              "Pr(~A & (~B & H)) = (Pr(~A) * Pr(~B)) * Pr(H | ~A & ~B)",
              "Pr(~A & (~B & ~H)) = (Pr(~A) * Pr(~B)) * Pr(~H | ~A & ~B)",
              "Pr(A & (B & H)) = Pr(F & (G & Y))",
              "Pr(A & (B & ~H)) = Pr(F & (G & ~Y))",
              "Pr(A & (~B & H)) = Pr(F & (~G & Y))",
              "Pr(A & (~B & ~H)) = Pr(F & (~G & ~Y))",
              "Pr(~A & (B & H)) = Pr(~F & (G & Y))",
              "Pr(~A & (B & ~H)) = Pr(~F & (G & ~Y))",
              "Pr(~A & (~B & H)) = Pr(~F & (~G & Y))",
              "Pr(~A & (~B & ~H)) = Pr(~F & (~G & ~Y))",
              "Pr(F & (G & Y)) = (Pr(F) * Pr(G | F)) * Pr(Y | F & G)",
              "Pr(F & (G & ~Y)) = (Pr(F) * Pr(G | F)) * Pr(~Y | F & G)",
              "Pr(F & (~G & Y)) = (Pr(F) * Pr(~G | F)) * Pr(Y | F & ~G)",
              "Pr(F & (~G & ~Y)) = (Pr(F) * Pr(~G | F)) * Pr(~Y | F & ~G)",
              "Pr(~F & (G & Y)) = (Pr(~F) * Pr(G | ~F)) * Pr(Y | ~F & G)",
              "Pr(~F & (G & ~Y)) = (Pr(~F) * Pr(G | ~F)) * Pr(~Y | ~F & G)",
              "Pr(~F & (~G & Y)) = (Pr(~F) * Pr(~G | ~F)) * Pr(Y | ~F & ~G)",
              "Pr(~F & (~G & ~Y)) = (Pr(~F) * Pr(~G | ~F)) * Pr(~Y | ~F & ~G)",
              "Pr(H | A) > Pr(H)",
              "Pr(H | B) > Pr(H)",
              "Pr(A & B) = Pr(A) * Pr(B)",
              "Pr(H | F) > Pr(H)",
              "Pr(H | G) > Pr(H)",
              "Pr(A) = Pr(F)",
              "Pr(B) = Pr(G)",
              "Pr(A) = 1 / 6",
              "Pr(B) = 1 / 6",
              "Pr(H) = 1 / 6",
              "Pr(F) = 1 / 6",
              "Pr(G) = 1 / 6",
              "Pr(Y) = 1 / 6",
              "Pr(A & H) / (Pr(A) * Pr(H)) = Pr(F & H) / (Pr(F) * Pr(H))"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Showing d,l are not ordinally equivalent (does not solve this -- in even 2 mins)"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(H1 | E1) - Pr(H1) > Pr(H2 | E2) - Pr(H2)",
              "Pr(E1 | H1) / Pr(E1 | ~H1) < Pr(E2 | H2) / Pr(E2 | ~H2)"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "But, simply adding a single marginal constraint yields a regular model in <30s"
      ],
      "constraint_sets": [
        {
          "continued_from_last": true,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "Pr(H1) = 1 / 2"
            ]
          }
        }
      ]
    },
    {
      "description": [
        "Another approach: eliminate ratios.  This usually helps a lot. Now it solves in under 1m!"
      ],
      "constraint_sets": [
        {
          "continued_from_last": false,
          "regular": "no",
          "constraints": {
            "tag": "good",
            "constraints": [
              "(Pr(H1 & E1) * Pr(E2)) - ((Pr(H1) * Pr(E1)) * Pr(E2)) > (Pr(H2 & E2) * Pr(E1)) - ((Pr(H2) * Pr(E1)) * Pr(E2))",
              "((Pr(E1 & H1) * Pr(E2 & ~H2)) * Pr(H2)) * Pr(~H1) < ((Pr(E2 & H2) * Pr(E1 & ~H1)) * Pr(H1)) * Pr(~H2)"
            ]
          }
        }
      ]
    }
  ]
}
export default file