import { expect, test } from '@playwright/test'

test('loads the demo studio and main routes', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/studio$/)
  await expect(page.getByText('演示', { exact: true })).toBeVisible()

  await page.locator('textarea').first().fill('蓝橙油墨在暖白色光桌上扩散')
  const generateButton = page
    .locator('button:visible')
    .filter({ hasText: '开始生成' })
    .first()
  await expect(generateButton).toBeEnabled()
  await generateButton.evaluate((button: HTMLElement) => button.click())
  await expect(page.locator('body')).toContainText('生成完成', {
    timeout: 12_000,
  })

  for (const [hash, text] of [
    ['#/history', '历史作品'],
    ['#/wallet', '积分与卡密'],
    ['#/admin', '管理后台'],
  ]) {
    await page.goto(hash)
    await expect(page.locator('body')).toContainText(text, {
      timeout: 15_000,
    })
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
