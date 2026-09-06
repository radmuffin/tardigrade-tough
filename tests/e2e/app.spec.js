const { test, expect } = require('@playwright/test');

test.describe('Tardigrade Tough Web App E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body[data-state="ready"]');
  });

  test('loads home page with brand icon and title', async ({ page }) => {
    await expect(page.locator('.brand-title')).toHaveText('TARDIGRADE TOUGH');
    await expect(page.locator('.brand .brand-icon-svg')).toBeVisible();
    await expect(page.locator('#profileBtn')).toBeVisible();
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

  test('renders organized, clean header with user profile hub chip', async ({ page }) => {
    await expect(page.locator('#profileNick')).toBeVisible();
    await expect(page.locator('#profileDot')).toBeVisible();
    await expect(page.locator('.brand-title')).toHaveText('TARDIGRADE TOUGH');
  });

  test('initial active goals report clean zero progress until workouts are logged', async ({ page }) => {
    await expect(page.locator('#heroGoalPct')).toContainText('0.0%');
    await expect(page.locator('#heroGoalCurrent')).toContainText('0 lbs');
  });

  test('supports all workout categories on the leaderboard displayed vertically', async ({ page }) => {
    await page.click('#navLeaderboardBtn');
    await expect(page.locator('#viewLeaderboard')).toBeVisible();

    // Summary Hero Grid is visible
    await expect(page.locator('#lbSummaryAll')).toBeVisible();
    await expect(page.locator('#lbHeroWeight')).toBeVisible();
    await expect(page.locator('#lbHeroDistance')).toBeVisible();
    await expect(page.locator('#lbHeroElevation')).toBeVisible();

    // All three workout category sections are displayed vertically
    await expect(page.locator('.lb-category-section[data-category="weight"]')).toBeVisible();
    await expect(page.locator('.lb-category-section[data-category="distance"]')).toBeVisible();
    await expect(page.locator('.lb-category-section[data-category="elevation"]')).toBeVisible();
  });

  test('toggles active goal dioramas between Pando, Everest, and Caribou', async ({ page }) => {
    await expect(page.locator('#heroGoalTitle')).toContainText('Pando');

    // Switch to Everest
    await page.click('#goalTabEverest');
    await expect(page.locator('#heroGoalTitle')).toContainText('Everest', { timeout: 10000 });
    await expect(page.locator('#heroGoalTarget')).toContainText('29,031');

    // Switch to Caribou
    await page.click('#goalTabCaribou');
    await expect(page.locator('#heroGoalTitle')).toContainText('Caribou', { timeout: 10000 });
    await expect(page.locator('#heroGoalTarget')).toContainText('3,000');
  });

  test('cycles through active goals with arrow navigators in correct direction', async ({ page }) => {
    await page.click('#goalTabPando');
    await expect(page.locator('#heroGoalTitle')).toContainText('Pando');

    // Click right arrow (next) -> moves right to Everest
    await page.click('#nextGoalBtn');
    await expect(page.locator('#heroGoalTitle')).toContainText('Everest');
    await expect(page.locator('#goalTabEverest')).toHaveClass(/active/);

    // Click right arrow (next) -> moves right to Caribou
    await page.click('#nextGoalBtn');
    await expect(page.locator('#heroGoalTitle')).toContainText('Caribou');
    await expect(page.locator('#goalTabCaribou')).toHaveClass(/active/);

    // Click left arrow (prev) -> moves left back to Everest
    await page.click('#prevGoalBtn');
    await expect(page.locator('#heroGoalTitle')).toContainText('Everest');
    await expect(page.locator('#goalTabEverest')).toHaveClass(/active/);

    // Click left arrow (prev) -> moves left back to Pando
    await page.click('#prevGoalBtn');
    await expect(page.locator('#heroGoalTitle')).toContainText('Pando');
    await expect(page.locator('#goalTabPando')).toHaveClass(/active/);
  });

  test('updates impact value when adjusting stepper weight and reps', async ({ page }) => {
    const weightInput = page.locator('#stepperWeight');
    const repsInput = page.locator('#stepperReps');
    const impactVal = page.locator('#computedImpactVal');

    // Stepper starts with no prefilled defaults
    await expect(weightInput).toHaveValue('');
    await expect(repsInput).toHaveValue('');
    await expect(impactVal).toContainText('0 lbs');
    await expect(page.locator('#stepperExercise')).toHaveValue('');

    // Click +10 lbs button
    await page.click('#wtPlusBtn');
    await expect(weightInput).toHaveValue('10');
    await expect(impactVal).toContainText('0 lbs');

    // Click +5 reps preset chip
    await page.click('.preset-chip-rep[data-val="5"]');
    await expect(repsInput).toHaveValue('5');
    await expect(impactVal).toContainText('50 lbs');

    // Click +25 plate chip
    await page.click('.preset-chip[data-delta="+25"]');
    await expect(weightInput).toHaveValue('35');
    await expect(impactVal).toContainText('175 lbs');

    // Click -25 plate chip
    await page.click('.preset-chip[data-delta="-25"]');
    await expect(weightInput).toHaveValue('10');
    await expect(impactVal).toContainText('50 lbs');
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

  test('submits cheer reaction via tap and displays stacked reaction toast at top', async ({ page }) => {
    const cheerBtn = page.locator('.cheer-btn[data-emoji="🔥"]');
    await expect(cheerBtn).toBeVisible();
    await cheerBtn.click();
    // Verify cheer button responds
    await expect(cheerBtn).toBeEnabled();

    // Verify reaction toast appears at top
    const toastContainer = page.locator('#reactionToastContainer');
    const pill = toastContainer.locator('.reaction-toast-pill').first();
    await expect(pill).toBeVisible();
    await expect(pill.locator('.reaction-toast-emoji')).toHaveText('🔥');

    // Tap again to test burst multiplier stacking
    await cheerBtn.click();
    const countBadge = pill.locator('.reaction-toast-count');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toHaveText('×2');
  });

  test('switches between logging modes (Rapid Stepper, Full Workout, Fast-Add)', async ({ page }) => {
    // 1. Rapid Stepper is active by default
    await expect(page.locator('#panelStepper')).toBeVisible();
    await expect(page.locator('#panelWorkout')).not.toBeVisible();
    await expect(page.locator('#panelFastAdd')).not.toBeVisible();

    // 2. Switch to Full Workout
    await page.click('#modeWorkoutBtn');
    await expect(page.locator('#panelWorkout')).toBeVisible();
    await expect(page.locator('#panelStepper')).not.toBeVisible();
    await expect(page.locator('#submitWorkoutBtn')).toBeVisible();
    await expect(page.locator('#addWorkoutRowBtn')).toHaveText('+ Add Exercise');
    await expect(page.locator('#workoutEntriesContainer .workout-entry-row')).toHaveCount(1);

    // 3. Switch to Fast-Add
    await page.click('#modeFastAddBtn');
    await expect(page.locator('#panelFastAdd')).toBeVisible();
    await expect(page.locator('#panelWorkout')).not.toBeVisible();
    await expect(page.locator('#submitFastAddBtn')).toBeVisible();

    // 4. Switch back to Rapid Stepper
    await page.click('#modeStepperBtn');
    await expect(page.locator('#panelStepper')).toBeVisible();
  });

  test('supports room-based URL navigation and loads squad data', async ({ page }) => {
    await page.goto('/r/main');
    await page.waitForSelector('body[data-state="ready"]');
    await expect(page.locator('.brand-title')).toHaveText('TARDIGRADE TOUGH');
    await expect(page.locator('#dioramaCanvas')).toBeVisible();
    await expect(page.locator('#heroGoalTitle')).toBeVisible();
  });

  test('supports squad renaming and updates squad name label in real-time', async ({ page }) => {
    // Navigate to dedicated test squad room to isolate state
    const squadSlug = `test-rename-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await page.goto(`/r/${squadSlug}`);
    await page.waitForSelector('body[data-state="ready"]');

    // Open Crew Hub via profile button and switch to Squad tab
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();
    await page.click('#tabBtnSquad');

    // Verify current squad name input is pre-populated
    const nameInput = page.locator('#editRoomNameInput');
    await expect(nameInput).not.toHaveValue('');

    // Enter a new squad name and save
    await nameInput.fill('Iron Tardigrades');
    await page.click('#saveRoomNameBtn');

    // Verify room header label updates
    await expect(page.locator('#roomNameLabel')).toHaveText('Iron Tardigrades');

    // Close modal
    await page.click('#closeRoomBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();
  });

  test('provides squad invite link and QR code in squad section', async ({ page }) => {
    const squadSlug = `test-share-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await page.goto(`/r/${squadSlug}`);
    await page.waitForSelector('body[data-state="ready"]');

    // Open squad settings hub
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();
    await page.click('#tabBtnSquad');

    // Check squad share link and QR code
    const shareInput = page.locator('#shareRoomUrlInput');
    await expect(shareInput).toBeVisible();
    const val = await shareInput.inputValue();
    expect(val).toContain('/r/');

    const qrImg = page.locator('#roomQrImage');
    await expect(qrImg).toBeVisible();
    const qrSrc = await qrImg.getAttribute('src');
    expect(qrSrc).toContain('/api/qr?url=');

    // Copy button is clickable
    await page.click('#copyRoomUrlBtn');

    await page.click('#closeProfileBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();
  });

  test('in solo mode, shows clean solo badge and hides redundant share squad card', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body[data-state="ready"]');

    // Open squad settings hub
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();
    await page.click('#tabBtnSquad');

    // Solo button says "Solo"
    const soloBtnText = await page.locator('#quickSoloBtn .solo-badge-text').textContent();
    expect(soloBtnText.trim()).toBe('Solo');

    // Share Squad card should be hidden when in solo mode to avoid redundancy
    await expect(page.locator('#shareSquadHubCard')).toBeHidden();

    // Create squad card remains visible
    await expect(page.locator('#createSquadCard')).toBeVisible();

    await page.click('#closeProfileBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();
  });

  test('opens dedicated share app modal from footer share button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body[data-state="ready"]');

    // Click footer share button
    await page.click('#footerShareBtn');
    const shareModal = page.locator('#shareModal');
    await expect(shareModal).toBeVisible();

    // Check app URL and app QR code
    const appUrlInput = page.locator('#shareAppUrlInput');
    await expect(appUrlInput).toBeVisible();
    const val = await appUrlInput.inputValue();
    expect(val.length).toBeGreaterThan(0);

    const appQr = page.locator('#appQrImage');
    await expect(appQr).toBeVisible();
    const qrSrc = await appQr.getAttribute('src');
    expect(qrSrc).toContain('/api/qr?url=');

    // Copy app URL button is clickable
    await page.click('#copyAppUrlBtn');

    // Native share icon button is available
    await expect(page.locator('#nativeShareAppBtn')).toBeVisible();

    // Close button dismisses modal
    await page.click('#closeShareModalBtn');
    await expect(shareModal).not.toBeVisible();
  });

  test('displays personal telemetry stats, PRs, and recent developments in profile view with toggleable edit mode', async ({ page }) => {
    // Open profile hub
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();

    // Mode A: View mode should be visible by default with personal stats & developments
    await expect(page.locator('#profileViewMode')).toBeVisible();
    await expect(page.locator('#profileStatsGrid')).toBeVisible();
    await expect(page.locator('#profileRecentCard')).toBeVisible();
    await expect(page.locator('#startEditProfileBtn')).toBeVisible();

    // Mode B: Edit controls should NOT be visible by default
    await expect(page.locator('#profileEditMode')).not.toBeVisible();

    // Click Edit button to enter edit mode
    await page.click('#startEditProfileBtn');
    await expect(page.locator('#profileEditMode')).toBeVisible();
    await expect(page.locator('#profileViewMode')).not.toBeVisible();
    await expect(page.locator('#nickInput')).toBeVisible();
    await expect(page.locator('#cancelProfileEditBtn')).toBeVisible();

    // Cancel edit returns to view mode without persisting changes
    await page.click('#cancelProfileEditBtn');
    await expect(page.locator('#profileViewMode')).toBeVisible();
    await expect(page.locator('#profileEditMode')).not.toBeVisible();

    await page.click('#closeProfileBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();
  });

  test('supports customizing avatar emoji and accent color in profile hub', async ({ page }) => {
    // Open profile hub
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();

    // Click Edit button to enter edit mode
    await page.click('#startEditProfileBtn');
    await expect(page.locator('#profileEditMode')).toBeVisible();

    // Verify avatar preview is present
    await expect(page.locator('#avatarEditChip')).toBeVisible();
    await expect(page.locator('#avatarEditEmoji')).toBeVisible();

    // Set nickname
    await page.fill('#nickInput', 'IronTitan');

    // Click Gorilla emoji chip
    const gorillaChip = page.locator('.emoji-chip[data-emoji="🦍"]');
    await gorillaChip.click();
    await expect(gorillaChip).toHaveClass(/selected/);
    await expect(page.locator('#avatarEditEmoji')).toHaveText('🦍');

    // Select Teal Beast color
    const tealColor = page.locator('.color-option[data-color="#14b8a6"]');
    await tealColor.click();
    await expect(tealColor).toHaveClass(/selected/);

    // Save profile
    await page.click('#saveProfileBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();

    // Verify header profile chip reflects new nickname and emoji
    await expect(page.locator('#profileNick')).toHaveText('IronTitan');
    await expect(page.locator('#profileDot')).toHaveText('🦍');
    await expect(page.locator('#profileDot')).toHaveClass(/has-emoji/);
  });

  test('supports toggling and customizing initials mode in profile hub', async ({ page }) => {
    // Open profile hub
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();

    // Click Edit button to enter edit mode
    await page.click('#startEditProfileBtn');
    await expect(page.locator('#profileEditMode')).toBeVisible();

    // Initials container should be hidden initially when an emoji is active
    await expect(page.locator('#initialsContainer')).not.toBeVisible();

    // Click toggle initials button to reveal initials input
    await page.click('#toggleInitialsBtn');
    await expect(page.locator('#initialsContainer')).toBeVisible();
    await expect(page.locator('#toggleInitialsBtn')).toHaveClass(/active/);

    // Enter custom initials
    await page.fill('#initialsInput', 'TT');
    await expect(page.locator('#avatarEditEmoji')).toHaveText('TT');

    // Save profile
    await page.click('#saveProfileBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();

    // Verify header profile chip reflects new initials
    await expect(page.locator('#profileDot')).toHaveText('TT');
  });

  test('navigates seamlessly using connective action cards across screens', async ({ page }) => {
    // 1. From Quests, navigate to Leaderboard
    await expect(page.locator('#viewQuests')).toBeVisible();
    await page.locator('#viewQuests .connective-btn[data-target="leaderboard"]').click();
    await expect(page.locator('#viewLeaderboard')).toBeVisible();
    await expect(page.locator('#viewQuests')).not.toBeVisible();

    // 2. From Leaderboard, navigate to Live Activity
    await page.locator('#viewLeaderboard .connective-btn[data-target="activity"]').click();
    await expect(page.locator('#viewActivity')).toBeVisible();
    await expect(page.locator('#viewLeaderboard')).not.toBeVisible();

    // 3. From Activity, navigate back to Quests
    await page.locator('#viewActivity .connective-btn[data-target="quests"]').click();
    await expect(page.locator('#viewQuests')).toBeVisible();
    await expect(page.locator('#viewActivity')).not.toBeVisible();

    // 4. From Quests, navigate to Trophy Room
    await page.locator('#viewQuests .connective-pill-card[data-target="trophy"]').click();
    await expect(page.locator('#viewTrophy')).toBeVisible();
    await expect(page.locator('#viewQuests')).not.toBeVisible();

    // 5. From Trophy Room, navigate back to Quests
    await page.locator('#viewTrophy .connective-btn[data-target="quests"]').click();
    await expect(page.locator('#viewQuests')).toBeVisible();
  });

  test('opens and closes About & Quests lore modal from footer', async ({ page }) => {
    await page.click('#footerAboutBtn');
    await expect(page.locator('#aboutModal')).toBeVisible();
    await expect(page.locator('#aboutModal h3')).toContainText('Tardigrade Tough');
    await expect(page.locator('#aboutModal')).toContainText('Water Bear Philosophy');
    await expect(page.locator('#aboutModal')).toContainText('Pando Aspen Clone');

    await page.click('#closeAboutBtn');
    await expect(page.locator('#aboutModal')).not.toBeVisible();
  });

  test('displays contact section, GitHub repo, and Sally dedication in modal', async ({ page }) => {
    await page.click('#footerAboutBtn');
    await expect(page.locator('#aboutModal')).toBeVisible();
    await expect(page.locator('#aboutStorySection')).toBeVisible();
    await expect(page.locator('#aboutStorySection')).toContainText('Made for Sally');
    await expect(page.locator('#aboutContactSection')).toBeVisible();
    await expect(page.locator('#aboutContactSection')).toContainText('danielspiesman@gmail.com');
    await expect(page.locator('#aboutContactSection')).toContainText('github.com/radmuffin/tardigrade-tough');

    const emailLink = page.locator('a[href^="mailto:danielspiesman@gmail.com"]');
    await expect(emailLink).toBeVisible();

    const ghLink = page.locator('a[href="https://github.com/radmuffin/tardigrade-tough"]');
    await expect(ghLink).toBeVisible();

    await page.click('#closeAboutBtn');
    await expect(page.locator('#aboutModal')).not.toBeVisible();
  });

  test('supports proposing a new quest via wishlist modal and renders on squad wishlist', async ({ page }) => {
    // Navigate to Trophy Room where wishlist is displayed
    await page.click('#navTrophyBtn');
    await expect(page.locator('#viewTrophy')).toBeVisible();

    // Open wishlist modal
    await page.click('#openWishlistBtn');
    await expect(page.locator('#wishlistModal')).toBeVisible();

    const uniqueTitle = `Hoisting the Golden Gate Bridge ${Date.now()}`;

    // Fill form
    await page.fill('#wishlistTitleInput', uniqueTitle);
    await page.selectOption('#wishlistCategorySelect', 'weight');
    await page.fill('#wishlistTargetInput', '887000000');
    await page.fill('#wishlistNotesInput', 'San Francisco suspension landmark');

    // Submit
    await page.click('#submitWishlistBtn');
    await expect(page.locator('#wishlistModal')).not.toBeVisible();

    // Verify it appears in the squad wishlist cards
    const card = page.locator('#wishlistCardsContainer .wishlist-card', { hasText: uniqueTitle }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('887,000,000 lbs');
    await expect(card).toContainText('San Francisco suspension landmark');
    await expect(card.locator('.gh-issue-link')).toBeVisible();
    await expect(card.locator('.activate-quest-btn')).toBeVisible();
  });

  test('navigates directly from Quests view to Trophy Room wishlist using Squad Wishlist button', async ({ page }) => {
    await expect(page.locator('#viewQuests')).toBeVisible();
    await expect(page.locator('#viewWishlistFromQuestsBtn')).toBeVisible();
    await page.click('#viewWishlistFromQuestsBtn');
    await expect(page.locator('#viewTrophy')).toBeVisible();
    await expect(page.locator('#wishlistSection')).toBeVisible();
  });

  test('renders quirky feat milestones and allows shuffling achievements', async ({ page }) => {
    await page.click('#navTrophyBtn');
    await expect(page.locator('#viewTrophy')).toBeVisible();

    // Verify Conquered Feats & Trophies section is visible and title is static
    const section = page.locator('#conqueredTrophiesSection');
    await expect(section).toBeVisible();
    await expect(section.locator('.section-title')).toHaveText('Conquered Feats & Trophies');

    // Verify 4 cards are rendered
    const cards = page.locator('#achievementsGrid .achievement-card');
    await expect(cards).toHaveCount(4);

    // Verify initial milestone items contain expected quirky content
    const firstTitle = await cards.first().locator('.achievement-title').textContent();
    expect(firstTitle).toBeTruthy();

    // Click shuffle and verify cards change/rotate
    const shuffleBtn = page.locator('#shuffleAchievementsBtn');
    await expect(shuffleBtn).toBeVisible();
    await shuffleBtn.click();

    // Verify 4 cards remain and cards rotated
    await expect(cards).toHaveCount(4);
    await expect(cards.first().locator('.achievement-title')).not.toHaveText(firstTitle);
  });


  test('configures PWA manifest, meta tags, and mobile capabilities', async ({ page }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/manifest.json');

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#0b1120');

    const appleMobile = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(appleMobile).toBe('yes');

    const appleIcon = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute('href');
    expect(appleIcon).toBe('/icon-192.png');
  });

  test('supports touch swipe gestures between views', async ({ page }) => {
    await expect(page.locator('#viewQuests')).toBeVisible();

    // Swipe left: Quests -> Leaderboard
    await page.evaluate(() => {
      const startX = 300;
      const endX = 100;
      const y = 300;
      const startEvt = new CustomEvent('touchstart', { bubbles: true, cancelable: true });
      startEvt.touches = [{ clientX: startX, clientY: y }];
      startEvt.changedTouches = [{ clientX: startX, clientY: y }];
      document.body.dispatchEvent(startEvt);

      const endEvt = new CustomEvent('touchend', { bubbles: true, cancelable: true });
      endEvt.touches = [];
      endEvt.changedTouches = [{ clientX: endX, clientY: y }];
      document.body.dispatchEvent(endEvt);
    });
    await expect(page.locator('#viewLeaderboard')).toBeVisible();
    await expect(page.locator('#navLeaderboardBtn')).toHaveClass(/active/);

    // Swipe right: Leaderboard -> Quests
    await page.evaluate(() => {
      const startX = 100;
      const endX = 300;
      const y = 300;
      const startEvt = new CustomEvent('touchstart', { bubbles: true, cancelable: true });
      startEvt.touches = [{ clientX: startX, clientY: y }];
      startEvt.changedTouches = [{ clientX: startX, clientY: y }];
      document.body.dispatchEvent(startEvt);

      const endEvt = new CustomEvent('touchend', { bubbles: true, cancelable: true });
      endEvt.touches = [];
      endEvt.changedTouches = [{ clientX: endX, clientY: y }];
      document.body.dispatchEvent(endEvt);
    });
    await expect(page.locator('#viewQuests')).toBeVisible();
    await expect(page.locator('#navQuestsBtn')).toHaveClass(/active/);
  });

  test('displays squad crew members, leave squad option, and creator controls', async ({ page }) => {
    const squadSlug = `test-crew-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await page.goto(`/r/${squadSlug}`);
    await page.waitForSelector('body[data-state="ready"]');

    // Check leaderboard squad banner is present
    await page.click('#navLeaderboardBtn');
    await expect(page.locator('#lbSquadBannerText')).toBeVisible();
    await expect(page.locator('#lbManageSquadBtn')).toBeVisible();

    // Click manage squad button to open Squad tab
    await page.click('#lbManageSquadBtn');
    await expect(page.locator('#profileModal')).toBeVisible();

    // Verify crew members roster is visible
    await expect(page.locator('#squadMembersCard')).toBeVisible();
    await expect(page.locator('#squadMemberCount')).toHaveText('1');
    await expect(page.locator('#squadMembersList')).toBeVisible();
    await expect(page.locator('#leaveSquadBtn')).toBeVisible();

    // Close modal
    await page.click('#closeRoomBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();
  });

  test('marks workout as private in stepper and confirms privacy badge', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body[data-state="ready"]');

    // Toggle incognito private workout button inside submit-btn-group
    const privacyBtn = page.locator('label[for="stepperPrivate"]');
    await expect(privacyBtn).toBeVisible();
    await privacyBtn.click();
    await expect(page.locator('#stepperPrivate')).toBeChecked();

    // Log a workout
    await page.selectOption('#stepperExercise', 'Back Squat');
    await page.fill('#stepperReps', '12');
    await page.fill('#stepperWeight', '150');
    await page.click('#logSetBtn');

    // Navigate to activity feed
    await page.click('#navActivityBtn');
    const privateBadge = page.locator('.private-badge').first();
    await expect(privateBadge).toBeVisible();
    await expect(privateBadge).toContainText('Private');
  });

  test('configures squad departure policy and toggles keep member contributions', async ({ page }) => {
    const squadSlug = `test-policy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await page.goto(`/r/${squadSlug}`);
    await page.waitForSelector('body[data-state="ready"]');

    // Open squad settings tab
    await page.click('#profileBtn');
    await expect(page.locator('#profileModal')).toBeVisible();
    await page.click('#tabBtnSquad');

    // Owner settings card should be visible for creator
    const ownerSettings = page.locator('#squadOwnerSettingsCard');
    await expect(ownerSettings).toBeVisible();

    const keepToggle = page.locator('#squadKeepDepartedToggle');
    await expect(keepToggle).toBeVisible();
    await expect(keepToggle).toBeChecked();

    // Toggle departure rule off
    await keepToggle.uncheck();
    await expect(keepToggle).not.toBeChecked();

    // Toggle departure rule back on
    await keepToggle.check();
    await expect(keepToggle).toBeChecked();

    await page.click('#closeProfileBtn');
    await expect(page.locator('#profileModal')).not.toBeVisible();
  });
});

