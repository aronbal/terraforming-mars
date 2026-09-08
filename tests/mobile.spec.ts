import { test, expect } from '@playwright/test';

// Test mobile layout for Terraforming Mars

test.describe('Mobile Layout Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the game URL
    await page.goto('http://localhost:8080');
    // Set viewport to iPhone 12 dimensions
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('Board should be scaled and scrollable on mobile', async ({ page }) => {
    const board = page.locator('.board-cont');
    await expect(board).toHaveCSS('width', '100%');
    
    // Check if the board is scaled down
    const boardElement = page.locator('.board');
    await expect(boardElement).toHaveCSS('transform', /scale\(0\.8\)/);
  });

  test('Cards in hand should be touch-friendly', async ({ page }) => {
    // Assuming there are cards in hand
    const card = page.locator('.cardbox').first();
    await expect(card).toHaveCSS('min-width', '80px');
    await expect(card).toHaveCSS('min-height', '120px');
  });

  test('Global parameters should be visible and properly spaced', async ({ page }) => {
    const globalParams = page.locator('.mobile-global-parameters');
    await expect(globalParams).toBeVisible();
    
    // Check if parameters are displayed in a row
    const temperature = page.locator('.global-numbers-temperature.mobile-parameter');
    const oxygen = page.locator('.global-numbers-oxygen.mobile-parameter');
    await expect(temperature).toBeVisible();
    await expect(oxygen).toBeVisible();
  });

  test('Players overview should be scrollable horizontally', async ({ page }) => {
    const playersOverview = page.locator('.players-overview');
    await expect(playersOverview).toHaveCSS('overflow-x', 'auto');
    await expect(playersOverview).toHaveCSS('flex-wrap', 'nowrap');
  });

  test('Milestones and awards should be centered and wrapped', async ({ page }) => {
    const milestonesAwards = page.locator('.mobile-milestones-awards');
    await expect(milestonesAwards).toHaveCSS('display', 'flex');
    await expect(milestonesAwards).toHaveCSS('flex-wrap', 'wrap');
    await expect(milestonesAwards).toHaveCSS('justify-content', 'center');
  });

  test('Action buttons should have minimum touch target size', async ({ page }) => {
    const buttons = page.locator('.btn');
    await expect(buttons.first()).toHaveCSS('min-height', '44px');
    await expect(buttons.first()).toHaveCSS('min-width', '44px');
  });

  test('Log panel should be scrollable vertically', async ({ page }) => {
    const logPanel = page.locator('.log-panel');
    await expect(logPanel).toHaveCSS('max-height', '200px');
    await expect(logPanel).toHaveCSS('overflow-y', 'auto');
  });

  test('Colonies should be displayed in a wrapped layout', async ({ page }) => {
    const coloniesCont = page.locator('.player_home_colony_cont');
    await expect(coloniesCont).toHaveCSS('display', 'flex');
    await expect(coloniesCont).toHaveCSS('flex-wrap', 'wrap');
    await expect(coloniesCont).toHaveCSS('justify-content', 'center');
  });

  test('Top bar should be sticky and full-width', async ({ page }) => {
    const topBarContainer = page.locator('.top-bar-container');
    await expect(topBarContainer).toHaveCSS('position', 'sticky');
    await expect(topBarContainer).toHaveCSS('width', '100%');
  });

  test('Sidebar should be full-width on mobile', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveCSS('width', '100%');
  });
});

test.describe('Touch Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('Cards should respond to touch', async ({ page }) => {
    const card = page.locator('.cardbox').first();
    await card.tap();
    // Check if the card has some visual feedback after tap
    // This might need to be adjusted based on actual implementation
    await expect(card).toHaveClass(/active|tapped/);
  });

  test('Buttons should respond to touch', async ({ page }) => {
    const button = page.locator('.btn').first();
    await button.tap();
    // Check if the button has some visual feedback after tap
    await expect(button).toHaveCSS('transform', /scale\(0\.9[0-9]+\)/);
  });
});

test.describe('Responsive Design Tests', () => {
  test('Layout should adapt to different screen sizes', async ({ page }) => {
    // Test on iPhone 12
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:8080');
    
    const board = page.locator('.board');
    await expect(board).toHaveCSS('transform', /scale\(0\.8\)/);
    
    // Test on iPhone 13
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(board).toHaveCSS('transform', /scale\(0\.8\)/);
    
    // Test on Pixel 5
    await page.setViewportSize({ width: 393, height: 851 });
    await page.reload();
    await expect(board).toHaveCSS('transform', /scale\(0\.8\)/);
  });
});
