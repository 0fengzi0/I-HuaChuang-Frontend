import { expect, test } from '@playwright/test'

test('loads the studio and main routes with demo data', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect(page).toHaveURL(/#\/studio$/)
  await expect(page.getByRole('heading', { name: '想生成什么图片？' })).toBeVisible()
  await expect(page.locator('.resolution-toggle')).toBeVisible()

  await page.getByLabel('描述你想要的画面').fill('蓝橙油墨在暖白色光桌上扩散')
  await page.getByRole('button', { name: /开始生成/ }).click()
  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.locator('.compact-editor')).toBeVisible()
  await expect(page.getByText('你的图片已生成', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: /生成另一张/ })).toBeVisible()

  await page.getByRole('button', { name: '重新创作，清空当前内容' }).click()
  await expect(page.locator('.workspace')).toHaveCount(0)
  await expect(page.getByLabel('描述你想要的画面')).toHaveValue('')

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
