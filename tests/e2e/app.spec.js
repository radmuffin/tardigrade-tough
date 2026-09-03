const { test, expect } = require('@playwright/test');

test.describe('Tardigrade Tough Web App E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads home page with brand icon and title', async ({ page }) => {
    await expect(page.locator('.brand-title')).toHaveText('TARDIGRADE TOUGH');
    await expect(page.locator('.brand-icon-svg')).toBeVisible();
    await expect(page.locator('#roomNameLabel')).toBeVisible();
  });

  test('switches between primary navigation views', async ({ page }) => {
    // 1. Quests view (default)
    await expect(page.locator('#viewQuests')).toBeVisible();

    // 2. Leaderboard view
    await page.click('#navLeaderboardBtn');
    await expect(page.locator('#viewLeaderboard')).toBeVisible();
    await expect(page.locator('#viewQuests')).not.toBeVisible();

    // 3. Activity feed view
    await page.click('#navActivityBtn');
    await expect(page.locator('#viewActivity')).toBeVisible();

    // 4. Trophy Room view
    await page.click('#navTrophyBtn');
    await expect(page.locator('#viewTrophy')).toBeVisible();
    await expect(page.locator('#trophyCanvas')).toBeVisible();
  });

  test('toggles active goal dioramas between Pando, Everest, and Caribou', async ({ page }) => {
    await expect(page.locator('#heroGoalTitle')).toContainText('Pando');

    // Switch to Everest — wait for tab to become active before asserting title
    await page.click('#goalTabEverest');
    await page.locator('#goalTabEverest.active, #goalTabEverest[aria-selected="true"]').waitFor({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('#heroGoalTitle')).toContainText('Everest', { timeout: 10000 });
    await expect(page.locator('#heroGoalTarget')).toContainText('29,031');

    // Switch to Caribou — wait for tab to become active before asserting title
    await page.click('#goalTabCaribou');
    await page.locator('#goalTabCaribou.active, #goalTabCaribou[aria-selected="true"]').waitFor({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('#heroGoalTitle')).toContainText('Caribou', { timeout: 10000 });
    await expect(page.locator('#heroGoalTarget')).toContainText('3,000');
  });

  test('updates impact value when adjusting stepper weight and reps', async ({ page }) => {
    const weightInput = page.locator('#stepperWeight');
    const repsInput = page.locator('#stepperReps');
    const impactVal = page.locator('#computedImpactVal');

    // Default: 135 lbs x 10 reps = 1,350 lbs
    await expect(impactVal).toContainText('1,350 lbs');

    // Click +10 lbs button
    await page.click('#wtPlusBtn');
    await expect(weightInput).toHaveValue('145');
    await expect(impactVal).toContainText('1,450 lbs');

    // Click +5 reps preset chip
    await page.click('.preset-chip-rep[data-val="5"]');
    await expect(repsInput).toHaveValue('5');
    await expect(impactVal).toContainText('725 lbs');
  });

  test('opens and parses data in Google Sheet importer modal', async ({ page }) => {
    // Navigate to Activity page
    await page.click('#navActivityBtn');
    await page.click('#openImportModalBtn');

    // Modal is visible
    await expect(page.locator('#importModal')).toBeVisible();

    // Paste sample sheet data
    const pasteArea = page.locator('#importPasteArea');
    await pasteArea.fill('10\t10\n25\t10\n118\t5\n208\t40');

    // Summary box reflects parsed values
    await expect(page.locator('#importSummaryBox')).toBeVisible();
    await expect(page.locator('#importSummaryText')).toContainText('4 sets');
    await expect(page.locator('#executeImportBtn')).toBeEnabled();

    // Close modal
    await page.click('#closeImportBtn');
    await expect(page.locator('#importModal')).not.toBeVisible();
  });

  test('toggles theme between dark and light modes in profile modal', async ({ page }) => {
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();

    // Enable Light Mode
    await page.click('#themeLightBtn');
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Enable Dark Mode
    await page.click('#themeDarkBtn');
    const htmlThemeDark = await page.locator('html').getAttribute('data-theme');
    expect(htmlThemeDark).toBe('dark');

    await page.click('#closeProfileBtn');
  });

  test('submits cheer reaction via tap', async ({ page }) => {
    const cheerBtn = page.locator('.cheer-btn[data-emoji="🔥"]');
    await expect(cheerBtn).toBeVisible();
    await cheerBtn.click();
    // Verify cheer button responds
    await expect(cheerBtn).toBeEnabled();
  });
});
