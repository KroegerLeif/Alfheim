import { test, expect } from '@playwright/test'

test.describe('Pantry Frontend E2E Flow', () => {
  test('should load the dashboard and verify key Swiss Design layout blocks', async ({ page }) => {
    // Navigate to root (which next-intl redirects/processes for locale)
    await page.goto('/')

    // Assert URL pathname is either '/' or redirects to '/de' or '/en'
    const url = page.url()
    expect(url).toMatch(/http:\/\/localhost:\d+(\/de|\/en|\/)?/)

    // Verify presence of brand header in sidebar
    const brandHeader = page.locator('text="ALFHEIM // OS"')
    await expect(brandHeader).toBeVisible()

    // Verify navigation sidebar exists
    const sidebar = page.locator('nav')
    await expect(sidebar).toBeVisible()

    // Verify Action cards for Stock In and Stock Out exist
    const stockInCard = page.locator('button:has-text("Stock In")')
    await expect(stockInCard).toBeVisible()

    const stockOutCard = page.locator('button:has-text("Stock Out")')
    await expect(stockOutCard).toBeVisible()
  })

  test('should open the Stock In modal when clicking the Stock In card', async ({ page }) => {
    await page.goto('/')

    // Click the Stock In quick access card
    const stockInCard = page.locator('button:has-text("Stock In")')
    await stockInCard.click()

    // The StockActionModal should mount, displaying the Dialog contents
    const dialogHeader = page.locator('label:has-text("Simulate Barcode")')
    await expect(dialogHeader).toBeVisible()

    const barcodeInput = page.locator('input[placeholder*="Enter EAN"]')
    await expect(barcodeInput).toBeVisible()

    // Close modal via Cancel button
    const cancelButton = page.locator('button:has-text("Cancel")')
    await cancelButton.click()

    // Dialog should be closed (hidden)
    await expect(dialogHeader).toBeHidden()
  })

  test('should support localized routing via next-intl paths', async ({ page }) => {
    // 1. Visit English path (default)
    await page.goto('/')
    const englishLink = page.locator('nav >> text="Inventory"')
    await expect(englishLink).toBeVisible()

    // 2. Visit German path
    await page.goto('/de')
    const germanLink = page.locator('nav >> text="Bestand"')
    await expect(germanLink).toBeVisible()
  })
})
