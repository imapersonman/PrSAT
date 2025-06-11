import { test, expect, Page, Locator } from '@playwright/test'
import * as TestId from './test_ids'
import * as Constants from '../src/constants'
import { fallthrough } from '../src/utils'

const URL = 'http://localhost:5173/'
const DEFAULT_TIMEOUT = 20_000

const to_load = async (page: Page): Promise<void> => {
  await page.goto(URL)
  await expect(page.getByTestId(TestId.z3_status)).toBeEmpty({ timeout: DEFAULT_TIMEOUT })
}

const find_model = async (page: Page, with_result: 'sat' | 'unsat' | 'unknown') => {
  const state_display = page.getByTestId(TestId.state_display_id)
  await page.getByTestId(TestId.find_model).click()
  // Right after we click, we want to be searching!
  await state_display.getByText(Constants.SEARCH).isVisible()

  if (with_result === 'sat') {
    await state_display.getByText(Constants.SAT).isVisible()
  } else if (with_result === 'unsat') {
    await state_display.getByText(Constants.UNSAT).isVisible()
  } else if (with_result === 'unknown') {
    await state_display.getByText(Constants.UNKNOWN).isVisible()
  } else {
    fallthrough('find_model', with_result)
  }
}

test('single constraint', async ({ page }) => {
  await to_load(page)
  const test_ids = TestId.generic_multi_input('constraints')

  const single_input = page.getByTestId(test_ids.split.single.get(0))
  await single_input.getByTestId(test_ids.split.input).fill('Pr(A & B) = Pr(A) * Pr(B)')
  await page.getByTestId(TestId.find_model).click()
  await page.getByTestId(TestId.regular_toggle).check()
  await page.getByTestId(TestId.find_model).click()

  await expect(page.getByTestId(TestId.model_table)).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  await expect(page.getByText(Constants.SAT)).toBeVisible()
});

test('adding a bunch of constraints', async ({ page }) => {
  await to_load(page)
  const test_ids = TestId.generic_multi_input('constraints')

  const n_constraints = 10
  for (let cindex = 0; cindex < n_constraints; cindex++) {
    const si = page.getByTestId(test_ids.split.single.get(cindex))
    await expect(si).toBeVisible()
    await si.getByTestId(test_ids.split.newline).click()
  }

  const si = page.getByTestId(test_ids.split.single.get(n_constraints - 1))
  await expect(si).toBeVisible()
})

test('adding then removing a bunch of constraints', async ({ page }) => {
  await to_load(page)
  const test_ids = TestId.generic_multi_input('constraints')

  const n_constraints = 10
  for (let cindex = 0; cindex < n_constraints; cindex++) {
    const si = page.getByTestId(test_ids.split.single.get(cindex))
    await expect(si).toBeVisible()
    await si.getByTestId(test_ids.split.newline).click()
  }

  const si = page.getByTestId(test_ids.split.single.get(n_constraints - 1))
  await expect(si).toBeVisible()

  for (let cindex = 0; cindex < n_constraints; cindex++) {
    const si = page.getByTestId(test_ids.split.single.get(cindex))
    await expect(si).toBeVisible()
    await si.getByTestId(test_ids.split.close).click()
    await expect(si).not.toBeVisible()
  }
})

test('multiple constraints', async ({ page }) => {
  await to_load(page)
  const single_inputs: Locator[] = []
  const test_ids = TestId.generic_multi_input('constraints')

  single_inputs.push(page.getByTestId(test_ids.split.single.get(0)))
  await expect(single_inputs[0]).toBeVisible()
  await single_inputs[0].getByTestId(test_ids.split.input).fill('Pr(A & B & C) = Pr(A) * Pr(B) * Pr(C)')
  await single_inputs[0].getByTestId(test_ids.split.newline).click()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(1)))
  await expect(single_inputs[1]).toBeVisible()
  await single_inputs[1].getByTestId(test_ids.split.input).fill('Pr(A & B) = Pr(A) * Pr(B)')
  await single_inputs[1].getByTestId(test_ids.split.newline).click()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(2)))
  await expect(single_inputs[2]).toBeVisible()
  await single_inputs[2].getByTestId(test_ids.split.input).fill('Pr(A & C) = Pr(A) * Pr(C)')
  await single_inputs[2].getByTestId(test_ids.split.newline).click()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(3)))
  await expect(single_inputs[3]).toBeVisible()
  await single_inputs[3].getByTestId(test_ids.split.input).fill('Pr(B & C) = Pr(B) * Pr(C)')

  await find_model(page, 'sat')
  await expect(page.getByTestId(TestId.model_table)).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  await expect(page.getByText(Constants.SAT)).toBeVisible()
})

test('weird model', async ({ page }) => {
  await to_load(page)
  const single_inputs: Locator[] = []
  const test_ids = TestId.generic_multi_input('constraints')

  page.getByTestId(TestId.regular_toggle).check()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(0)))
  await expect(single_inputs[0]).toBeVisible()
  await single_inputs[0].getByTestId(test_ids.split.input).fill('Pr(A & B & C) > Pr(A & B) * Pr(C)')
  await single_inputs[0].getByTestId(test_ids.split.newline).click()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(1)))
  await expect(single_inputs[1]).toBeVisible()
  await single_inputs[1].getByTestId(test_ids.split.input).fill('Pr(A & B) = Pr(A) * Pr(B)')
  await single_inputs[1].getByTestId(test_ids.split.newline).click()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(2)))
  await expect(single_inputs[2]).toBeVisible()
  await single_inputs[2].getByTestId(test_ids.split.input).fill('Pr(A & C) = Pr(A) * Pr(C)')
  await single_inputs[2].getByTestId(test_ids.split.newline).click()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(3)))
  await expect(single_inputs[3]).toBeVisible()
  await single_inputs[3].getByTestId(test_ids.split.input).fill('Pr(B & C) = Pr(B) * Pr(C)')
  await single_inputs[3].getByTestId(test_ids.split.newline).click()

  single_inputs.push(page.getByTestId(test_ids.split.single.get(4)))
  await expect(single_inputs[4]).toBeVisible()
  await single_inputs[4].getByTestId(test_ids.split.input).fill('Pr(A & B) = Pr(C)')

  await page.waitForTimeout(Constants.DEFAULT_DEBOUNCE_MS)  // Wait for all the inputs to update correctly.

  await find_model(page, 'sat')
  // await expect(page.getByTestId(TestId.state_display_id)).toBeVisible()
  // await expect(page.getByText(Constants.SAT)).toBeVisible({ timeout: DEFAULT_TIMEOUT })  // Done searching for the model.
  await expect(page.getByTestId(TestId.exception_id)).not.toBeVisible()
})

test('show and hide batch input', async ({ page }) => {
  await to_load(page)

  const test_ids = TestId.generic_multi_input('constraints')
  const toggle_button = page.getByTestId(test_ids.toggle)
  const textbox = page.getByTestId(test_ids.batch.textbox)
  const parse_button = page.getByTestId(test_ids.batch.parse)

  await expect(textbox).not.toBeVisible()
  await expect(parse_button).not.toBeVisible()

  await toggle_button.click()
  await expect(textbox).toBeVisible()
  await expect(parse_button).toBeVisible()

  await toggle_button.click()
  await expect(textbox).not.toBeVisible()
  await expect(parse_button).not.toBeVisible()
})

const set_block_input = async (page: Page, test_ids: TestId.GenericMultiInputTestIds, constraints_text: string[]) => {
  const toggle_button = page.getByTestId(test_ids.toggle)
  const textbox = page.getByTestId(test_ids.batch.textbox)
  const parse_button = page.getByTestId(test_ids.batch.parse)

  const originally_visible = await textbox.isVisible()
  if (!originally_visible) {
    await toggle_button.click()
  }

  await textbox.fill(constraints_text.join('\n'))
  await page.waitForTimeout(Constants.DEFAULT_DEBOUNCE_MS)
  await parse_button.click()

  if (!originally_visible) {
    await toggle_button.click()
  }
}

test('parse from batch input', async ({ page }) => {
  await to_load(page)

  const test_ids = TestId.generic_multi_input('constraints')
  const inputs = [
    'Pr(A & B & C) = Pr(A) * Pr(B) * Pr(B)',
    'Pr(A & B) = Pr(A) * Pr(B)',
    'Pr(B & C) = Pr(B) * Pr(C)',
    'Pr(A & C) = Pr(A) * Pr(C)',
  ]

  await set_block_input(page, test_ids, inputs)

  for (const [index, text] of inputs.entries()) {
    const element = page.getByTestId(test_ids.split.single.get(index))
    const element_textbox = element.getByTestId(test_ids.split.input)
    await expect(element_textbox).toBeVisible()
    await expect(element_textbox).toHaveValue(text)
  }
})

test('setting multiple evals at once', async ({ page }) => {
  await to_load(page)

  const constraint_test_ids = TestId.generic_multi_input('constraints')
  await set_block_input(page, constraint_test_ids, ['Pr(A & B) = Pr(A) * Pr(B)'])
  await find_model(page, 'sat')

  const eval_test_ids = TestId.generic_multi_input('eval')
  await set_block_input(page, eval_test_ids, ['Pr(A)', 'Pr(B)'])
  await expect(page.getByText('Exception')).not.toBeVisible()
})

test('detect division by zero', async ({ page }) => {
  await to_load(page)

  const constraint_test_ids = TestId.generic_multi_input('constraints')
  await set_block_input(page, constraint_test_ids, ['Pr(A & B) = Pr(A) * Pr(B)'])
  await find_model(page, 'sat')

  const eval_test_ids = TestId.generic_multi_input('eval')
  await set_block_input(page, eval_test_ids, ['Pr(A) / 0'])
  await expect(page.getByTestId(eval_test_ids.split.single.get(0))).toContainText(Constants.DIV0)
})
