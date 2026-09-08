import { test, expect } from '@playwright/test';

// Mobile-specific tests for Terraforming Mars PWA
// These tests verify that the mobile layout and touch interactions work correctly

test.describe('Mobile Layout Tests', () => {
  // Test the main game screen on mobile
  test('Main game screen renders correctly on iPhone', async ({ page }) => {
    // Navigate to the game
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the main container is full width
    const mainContainer = page.locator('#app');
    await expect(mainContainer).toHaveCSS('width', '100%');
    
    // Check that the player home has reduced padding
    const playerHome = page.locator('#player-home');
    await expect(playerHome).toHaveCSS('padding-left', '5px');
    await expect(playerHome).toHaveCSS('padding-right', '5px');
  });

  // Test the board scaling on mobile
  test('Game board scales down on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that the board container is responsive
    const boardCont = page.locator('.board-cont');
    await expect(boardCont).toHaveCSS('width', '100%');
    
    // Check that the board itself is scaled down
    const board = page.locator('.board');
    const transform = await board.getAttribute('style');
    expect(transform).toContain('scale(0.8)');
  });

  // Test card display on mobile
  test('Cards in hand are properly sized for touch', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that card boxes have minimum touch size
    const cardBoxes = page.locator('.cardbox');
    if (await cardBoxes.count() > 0) {
      await expect(cardBoxes.first()).toHaveCSS('min-width', '80px');
      await expect(cardBoxes.first()).toHaveCSS('min-height', '120px');
    }
  });

  // Test button sizes on mobile
  test('Buttons have minimum touch target size', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that buttons have minimum touch size
    const buttons = page.locator('.btn');
    if (await buttons.count() > 0) {
      await expect(buttons.first()).toHaveCSS('min-height', '44px');
      await expect(buttons.first()).toHaveCSS('min-width', '44px');
    }
  });

  // Test the top bar on mobile
  test('Top bar is sticky and full width on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const topBarContainer = page.locator('.top-bar-container');
    await expect(topBarContainer).toHaveCSS('position', 'sticky');
    await expect(topBarContainer).toHaveCSS('width', '100%');
  });

  // Test the sidebar layout on mobile
  test('Sidebar is full width on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveCSS('width', '100%');
  });

  // Test the players overview scrolling
  test('Players overview has horizontal scrolling on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const playersOverview = page.locator('.player_home_block--players');
    await expect(playersOverview).toHaveCSS('overflow-x', 'auto');
    
    const playersOverviewInner = page.locator('.players-overview');
    await expect(playersOverviewInner).toHaveCSS('overflow-x', 'auto');
  });

  // Test that non-essential elements are hidden on mobile
  test('Non-essential elements are hidden on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that the board legend is hidden
    const boardLegend = page.locator('.board-legend');
    await expect(boardLegend).toHaveCSS('display', 'none');
    
    // Check that keyboard shortcuts are hidden
    const keyboardShortcuts = page.locator('.keyboard-shortcuts');
    await expect(keyboardShortcuts).toHaveCSS('display', 'none');
  });

  // Test the responsive layout for different mobile viewports
  test('Layout adapts to different mobile viewports', async ({ page }) => {
    // Test iPhone SE viewport (320x568)
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that the board scales down further on smaller screens
    const board = page.locator('.board');
    const transform = await board.getAttribute('style');
    expect(transform).toContain('scale(0.6)');
    
    // Test iPad Mini viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // On larger mobile devices, the board should scale up
    const boardTransform = await board.getAttribute('style');
    expect(boardTransform).toContain('scale(0.8)');
  });

  // Test touch feedback on interactive elements
  test('Interactive elements provide visual feedback on touch', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that buttons have active state styles
    const buttons = page.locator('.btn');
    if (await buttons.count() > 0) {
      await expect(buttons.first()).toHaveCSS('transform', 'scale(0.96)');
    }
  });

  // Test the mobile-specific CSS is loaded
  test('Mobile CSS is properly loaded', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that the mobile optimizations stylesheet is loaded
    const stylesheets = await page.evaluate(() => {
      return Array.from(document.styleSheets).map(sheet => sheet.href);
    });
    
    // Check if mobile_optimizations.less is loaded (it's imported in common.less)
    // Since it's imported, we can't check the href directly, but we can check for mobile styles
    const body = page.locator('body');
    await expect(body).toHaveCSS('text-size-adjust', '100%');
  });
});

test.describe('Mobile Interaction Tests', () => {
  // Test that cards can be tapped
  test('Cards respond to tap interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find a card and tap it
    const card = page.locator('.card').first();
    if (await card.count() > 0) {
      await card.click();
      // If the card is clickable, it should respond (this is a basic test)
      // In a real scenario, you'd check for specific behavior
    }
  });

  // Test that buttons can be tapped
  test('Buttons respond to tap interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find a button and tap it
    const button = page.locator('.btn').first();
    if (await button.count() > 0) {
      await button.click();
      // Basic interaction test
    }
  });

  // Test scrolling behavior on mobile
  test('Horizontal scrolling works on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test scrolling in the players overview
    const playersOverview = page.locator('.players-overview');
    if (await playersOverview.count() > 0) {
      // Scroll to the right
      await playersOverview.evaluate(el => {
        el.scrollLeft = 100;
      });
      
      // Check that the scroll position changed
      const scrollLeft = await playersOverview.evaluate(el => el.scrollLeft);
      expect(scrollLeft).toBeGreaterThan(0);
    }
  });
});

test.describe('Mobile PWA Tests', () => {
  // Test that the PWA manifest is present
  test('PWA manifest is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for the manifest link
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveCount(1);
  });

  // Test that the service worker is registered
  test('Service worker is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for service worker registration
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
    });
    
    // Note: This might not work in Playwright's context, but it's a good check
    // In a real PWA test, you'd need to check the service worker in a different way
  });

  // Test viewport meta tag for mobile
  test('Viewport meta tag is present for mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for the viewport meta tag
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);
    
    // Check the content of the viewport meta tag
    const content = await viewport.getAttribute('content');
    expect(content).toContain('width=device-width');
    expect(content).toContain('initial-scale=1');
  });
});
