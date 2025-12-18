import { expect, Page } from "@playwright/test"
import * as TestId from './test_ids'
import FF from '../src/fitelson_files/outputs/probability_table_generator_inputs_2'
import { generate_constraint_sets } from "../src/fitelson_files/stuff"

const URL = 'http://localhost:5173/'
const DEFAULT_TIMEOUT = 20_000

const to_load = async (page: Page): Promise<void> => {
  await page.goto(URL)
  await expect(page.getByTestId(TestId.z3_status)).toBeEmpty({ timeout: DEFAULT_TIMEOUT })
}

// const g = generate_constraint_sets(FF)
// for (const constraints_set of g) {
//   constraints_set
// }
