import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';

export function renderTrophyRoom() {
  if (!state.currentRoomData) return;
  const completed = state.currentRoomData.completed_goals || [];
  const trophyContainer = document.getElementById('viewTrophy');
  if (!trophyContainer) return;

  if (completed.length > 0) {
    const trophy = completed[0];
    const titleEl = trophyContainer.querySelector('.goal-hero-title');
    const descEl = trophyContainer.querySelector('.goal-hero-desc');
    const subEl = trophyContainer.querySelector('.goal-progress-sub');

    if (titleEl) {
      const isAbility = trophy.category === 'ability';
      titleEl.textContent = `${isAbility ? '⚡ ' : (trophy.theme_key === 'whale' ? '🐋 ' : '🏆 ')}${trophy.title}`;
    }
    if (descEl) {
      descEl.textContent = trophy.description;
    }
    if (subEl) {
      const isAbility = trophy.category === 'ability';
      subEl.innerHTML = isAbility
        ? `<span>✓ Accomplished Feat</span><span>Target: 1 Feat</span>`
        : `<span>${formatNumber(trophy.current_value)} ${trophy.unit}</span><span>Target: ${formatNumber(trophy.target_value)} ${trophy.unit}</span>`;
    }
    if (state.trophyDiorama) {
      state.trophyDiorama.setTheme(trophy.theme_key, 1.0);
    }
  }

  const listContainer = document.getElementById('conqueredTrophiesList');
  if (listContainer) {
    if (completed.length === 0) {
      listContainer.innerHTML = '';
      listContainer.style.display = 'none';
    } else {
      listContainer.style.display = 'flex';
      listContainer.innerHTML = completed.map(g => {
        const isAbility = g.category === 'ability';
        const emoji = isAbility ? '⚡' : (g.theme_key === 'whale' ? '🐋' : '🏆');
        const metricStr = isAbility
          ? 'One-off Feat'
          : `${formatNumber(g.target_value)} ${g.unit}`;

        return `
          <div class="leaderboard-card" style="margin-bottom: 0;">
            <div class="leaderboard-user">
              <div class="user-avatar" style="background-color: var(--bg-surface); font-size: 1.2rem;">${emoji}</div>
              <div class="user-details">
                <span class="user-name-row">${FlyToast.escape(g.title)}</span>
                <span class="user-stats-sub">${FlyToast.escape(metricStr)} • Conquered</span>
              </div>
            </div>
            <span class="score-main" style="color: var(--accent-green); font-size: 0.85rem; font-weight: 800;">✓ Done</span>
          </div>
        `;
      }).join('');
    }
  }

  renderQuirkyAchievements();
  setupTrophyListeners();
}

let currentAchievementIndex = 0;

export function generateAchievementPool(roomData) {
  if (!roomData) return [];
  const leaderboard = roomData.leaderboard || [];
  const activities = roomData.recent_activities || [];
  const profile = roomData.user_profile || {};
  const personalStats = profile.personal_stats || {};

  // 1. Total Weight (lbs)
  let totalWeight = leaderboard.reduce((acc, m) => acc + (Number(m.total_weight) || 0), 0);
  if (totalWeight === 0 && personalStats.total_weight) {
    totalWeight = Number(personalStats.total_weight);
  }
  if (totalWeight === 0) {
    totalWeight = activities.reduce((acc, a) => {
      if (a.activity_type === 'weight') {
        const wt = Number(a.total_metric) || ((Number(a.sets) || 1) * (Number(a.reps) || 1) * (Number(a.weight_per_rep) || 0));
        return acc + wt;
      }
      return acc;
    }, 0);
  }

  // 2. Total Distance (miles)
  let totalDistance = leaderboard.reduce((acc, m) => acc + (Number(m.total_distance) || 0), 0);
  if (totalDistance === 0 && personalStats.total_distance) {
    totalDistance = Number(personalStats.total_distance);
  }
  if (totalDistance === 0) {
    totalDistance = activities.reduce((acc, a) => {
      if (a.activity_type === 'distance') {
        return acc + (Number(a.distance_val) || Number(a.total_metric) || 0);
      }
      return acc;
    }, 0);
  }

  // 3. Total Elevation (feet)
  let totalElevation = leaderboard.reduce((acc, m) => acc + (Number(m.total_elevation) || 0), 0);
  if (totalElevation === 0 && personalStats.total_elevation) {
    totalElevation = Number(personalStats.total_elevation);
  }
  if (totalElevation === 0) {
    totalElevation = activities.reduce((acc, a) => {
      if (a.activity_type === 'elevation') {
        return acc + (Number(a.elevation_val) || Number(a.total_metric) || 0);
      }
      return acc;
    }, 0);
  }

  // 4. Total Sets
  let totalSets = leaderboard.reduce((acc, m) => acc + (Number(m.total_sets) || 0), 0);
  if (totalSets === 0 && personalStats.total_sets) {
    totalSets = Number(personalStats.total_sets);
  }
  if (totalSets === 0) {
    totalSets = activities.reduce((acc, a) => acc + (Number(a.sets) || 1), 0);
  }

  // 5. Day & Week Volumes and Max Weight
  const dayWeights = {};
  const dayDistances = {};
  let maxWeight = 0;

  for (const act of activities) {
    const dateKey = act.created_at ? act.created_at.slice(0, 10) : 'today';
    const type = act.activity_type || 'weight';

    if (type === 'weight') {
      const vol = Number(act.total_metric) || ((Number(act.sets) || 1) * (Number(act.reps) || 1) * (Number(act.weight_per_rep) || 0));
      dayWeights[dateKey] = (dayWeights[dateKey] || 0) + vol;
      const wt = Number(act.weight_per_rep) || 0;
      if (wt > maxWeight) maxWeight = wt;
    } else if (type === 'distance') {
      const dist = Number(act.distance_val) || Number(act.total_metric) || 0;
      dayDistances[dateKey] = (dayDistances[dateKey] || 0) + dist;
    }
  }

  const maxDayWeight = Math.max(0, ...Object.values(dayWeights));
  const maxDayDist = Math.max(0, ...Object.values(dayDistances));

  // Rolling 7-day or max day volume
  const sortedDays = Object.keys(dayWeights).sort();
  let maxWeekWeight = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    const d1 = new Date(sortedDays[i]).getTime();
    let weekSum = 0;
    for (let j = i; j < sortedDays.length; j++) {
      const d2 = new Date(sortedDays[j]).getTime();
      if (!isNaN(d1) && !isNaN(d2) && d2 - d1 <= 7 * 24 * 60 * 60 * 1000) {
        weekSum += dayWeights[sortedDays[j]];
      } else {
        break;
      }
    }
    if (weekSum > maxWeekWeight) maxWeekWeight = weekSum;
  }
  if (maxDayWeight > maxWeekWeight) maxWeekWeight = maxDayWeight;

  // 6. Streak calculation
  const allDates = Array.from(new Set(activities.map(a => a.created_at ? a.created_at.slice(0, 10) : null).filter(Boolean))).sort();
  let longestConsecutive = 0;
  let currStreak = 0;
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) {
      currStreak = 1;
    } else {
      const prev = new Date(allDates[i - 1]);
      const curr = new Date(allDates[i]);
      const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        currStreak += 1;
      } else if (diff > 1) {
        currStreak = 1;
      }
    }
    if (currStreak > longestConsecutive) longestConsecutive = currStreak;
  }
  const streakDays = Math.max(longestConsecutive, Number(profile.streak_days) || 0);

  // Conversions
  const totalFeet = totalDistance * 5280;
  const elevFeet = totalElevation > 0 ? totalElevation : (totalFeet * 0.05);

  const chihuahuas = Math.floor(totalWeight / 6);
  const gardenSnakes = Math.floor(totalFeet / 2);
  const elephants = totalWeight >= 130000 ? Math.floor(totalWeight / 13000) : (totalWeight / 13000).toFixed(1);
  const pizzaSlices = Math.floor(totalWeight / 0.25);
  const civics = (totalWeight / 2800).toFixed(1);
  const liberties = (elevFeet / 305).toFixed(1);
  const grizzlies = (totalWeight / 600).toFixed(1);
  const flamingos = Math.floor(totalFeet / 1.5);
  const burritos = Math.floor(totalWeight / 1.2);
  const empires = (elevFeet / 1250).toFixed(1);
  const coffeeBags = Math.floor(totalWeight / 0.75);
  const bowlingBalls = Math.floor(totalWeight / 14);
  const giraffes = (elevFeet / 18).toFixed(1);

  return [
    {
      id: 'chihuahuas',
      emoji: '🐕',
      badge: 'Equivalence',
      title: 'Chihuahuas Hoisted',
      value: `${formatNumber(chihuahuas)} 🐕`,
      desc: `Lifted the mass of ${formatNumber(chihuahuas)} feisty chihuahuas (~6 lbs each).`,
    },
    {
      id: 'garden_snakes',
      emoji: '🐍',
      badge: 'Distance',
      title: 'Garden Snakes Traveled',
      value: `${formatNumber(gardenSnakes)} 🐍`,
      desc: `Traveled length of ${formatNumber(gardenSnakes)} garden snakes end-to-end (~2 ft each).`,
    },
    {
      id: 'longest_streak',
      emoji: '🔥',
      badge: 'Consistency',
      title: 'Longest Streak',
      value: `${streakDays} ${streakDays === 1 ? 'Day' : 'Days'} 🔥`,
      desc: streakDays > 0 ? `${streakDays} active days logged without rusting.` : `Log consecutive days to spark your fire!`,
    },
    {
      id: 'peak_day',
      emoji: '💥',
      badge: 'Daily Best',
      title: 'Peak Single Day',
      value: maxDayWeight > 0 ? `${formatNumber(Math.round(maxDayWeight))} lbs` : (maxDayDist > 0 ? `${maxDayDist.toFixed(1)} mi` : `0 lbs`),
      desc: `Most volume conquered across the squad in a single 24-hr day.`,
    },
    {
      id: 'peak_week',
      emoji: '📅',
      badge: 'Weekly Best',
      title: 'Peak Monster Week',
      value: maxWeekWeight > 0 ? `${formatNumber(Math.round(maxWeekWeight))} lbs` : `0 lbs`,
      desc: `Top volume shifted inside a single 7-day rampage.`,
    },
    {
      id: 'elephants',
      emoji: '🐘',
      badge: 'Mega Mass',
      title: 'African Elephants',
      value: `${elephants} 🐘`,
      desc: `Equivalent to hauling ${elephants} full-grown bull elephants (~13,000 lbs).`,
    },
    {
      id: 'pizza_slices',
      emoji: '🍕',
      badge: 'Nutrition',
      title: 'Pizza Slices Shifted',
      value: `${formatNumber(pizzaSlices)} 🍕`,
      desc: `Deadlifted equivalent of ${formatNumber(pizzaSlices)} NY pepperoni slices.`,
    },
    {
      id: 'honda_civics',
      emoji: '🚗',
      badge: 'Curb Weight',
      title: 'Honda Civics Hauled',
      value: `${civics} 🚗`,
      desc: `Matched the curb weight of ${civics} compact commuter sedans (~2,800 lbs).`,
    },
    {
      id: 'statues_liberty',
      emoji: '🗽',
      badge: 'Altitude',
      title: 'Lady Liberty Scaled',
      value: `${liberties} 🗽`,
      desc: `Vertical height of ${liberties} Statues of Liberty stacked (~305 ft each).`,
    },
    {
      id: 'grizzly_bears',
      emoji: '🐻',
      badge: 'Apex Muscle',
      title: 'Grizzlies Out-lifted',
      value: `${grizzlies} 🐻`,
      desc: `Overpowered equivalent mass of ${grizzlies} adult grizzly bears (~600 lbs).`,
    },
    {
      id: 'flamingo_strides',
      emoji: '🦩',
      badge: 'Trail Pace',
      title: 'Flamingo Strides',
      value: `${formatNumber(flamingos)} 🦩`,
      desc: `Covered the distance of ${formatNumber(flamingos)} fabulous flamingo paces (~1.5 ft).`,
    },
    {
      id: 'burritos_lifted',
      emoji: '🌯',
      badge: 'Fuel Load',
      title: 'Burritos Heaved',
      value: `${formatNumber(burritos)} 🌯`,
      desc: `Shifted mass of ${formatNumber(burritos)} foil-wrapped mission burritos (~1.2 lbs).`,
    },
    {
      id: 'empire_state',
      emoji: '🏢',
      badge: 'Skyward',
      title: 'Empire State Climbs',
      value: `${empires} 🏢`,
      desc: `Skyward gain of ${empires} Empire State Buildings (~1,250 ft).`,
    },
    {
      id: 'coffee_bags',
      emoji: '☕',
      badge: 'Caffeine',
      title: 'Coffee Bags Heaved',
      value: `${formatNumber(coffeeBags)} ☕`,
      desc: `Lifted ${formatNumber(coffeeBags)} bags of artisan whole beans (~12 oz each).`,
    },
    {
      id: 'heaviest_rep',
      emoji: '🏋️',
      badge: 'Iron PR',
      title: 'Heaviest Single Rep',
      value: maxWeight > 0 ? `${formatNumber(maxWeight)} lbs` : `0 lbs`,
      desc: maxWeight > 0 ? `Max single barbell/dumbbell load moved in a set.` : `Load up heavy on your next set to claim this feat!`,
    },
    {
      id: 'total_sets',
      emoji: '⚡',
      badge: 'Endurance',
      title: 'Total Sets Conquered',
      value: `${formatNumber(totalSets)} Sets`,
      desc: `Raw grind logged by the crew set by set.`,
    },
    {
      id: 'bowling_balls',
      emoji: '🎳',
      badge: 'Tonnage',
      title: 'Bowling Balls Hurled',
      value: `${formatNumber(bowlingBalls)} 🎳`,
      desc: `Equal to chucking ${formatNumber(bowlingBalls)} regulation bowling balls (~14 lbs each).`,
    },
    {
      id: 'giraffes_stacked',
      emoji: '🦒',
      badge: 'Elevation',
      title: 'Giraffes Stacked',
      value: `${giraffes} 🦒`,
      desc: `Reached the height of ${giraffes} adult giraffes (~18 ft each).`,
    },
  ];
}

function renderAchievementCards(achievements) {
  return achievements.map(item => `
    <div class="achievement-card" data-achievement-id="${FlyToast.escape(item.id)}" title="Click to shuffle milestones">
      <div class="achievement-top-row">
        <span class="achievement-icon">${item.emoji}</span>
        <span class="achievement-badge">${FlyToast.escape(item.badge)}</span>
      </div>
      <div class="achievement-value">${FlyToast.escape(item.value)}</div>
      <div class="achievement-title">${FlyToast.escape(item.title)}</div>
      <div class="achievement-desc">${FlyToast.escape(item.desc)}</div>
    </div>
  `).join('');
}

export function renderQuirkyAchievements(isShuffle = false) {
  const container = document.getElementById('achievementsGrid');
  if (!container || !state.currentRoomData) return;

  const pool = generateAchievementPool(state.currentRoomData);
  if (pool.length === 0) return;

  const countToShow = 4;
  const startIdx = ((currentAchievementIndex % pool.length) + pool.length) % pool.length;

  const displayed = [];
  for (let i = 0; i < countToShow; i++) {
    displayed.push(pool[(startIdx + i) % pool.length]);
  }

  if (isShuffle) {
    container.style.opacity = '0';
    container.style.transform = 'scale(0.97)';
    setTimeout(() => {
      container.innerHTML = renderAchievementCards(displayed);
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
    }, 120);
  } else {
    container.innerHTML = renderAchievementCards(displayed);
  }
}

export function shuffleAchievements() {
  if (!state.currentRoomData) return;
  const pool = generateAchievementPool(state.currentRoomData);
  if (pool.length === 0) return;
  currentAchievementIndex = (currentAchievementIndex + 4) % pool.length;
  renderQuirkyAchievements(true);
}

export function setupTrophyListeners() {
  const shuffleBtn = document.getElementById('shuffleAchievementsBtn');
  if (shuffleBtn && !shuffleBtn.dataset.bound) {
    shuffleBtn.dataset.bound = 'true';
    shuffleBtn.addEventListener('click', () => {
      shuffleAchievements();
    });
  }

  const grid = document.getElementById('achievementsGrid');
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = 'true';
    grid.addEventListener('click', (e) => {
      if (e.target.closest('.achievement-card')) {
        shuffleAchievements();
      }
    });
  }
}

export function renderWishlists() {
  const container = document.getElementById('wishlistCardsContainer');
  if (!container || !state.currentRoomData) return;
  const list = state.currentRoomData.wishlists || [];

  const countLabel = document.getElementById('questsWishlistCountLabel');
  if (countLabel) {
    countLabel.textContent = `Wishlist (${list.length})`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="wishlist-empty-box">
        No proposals yet.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const cat = item.category || 'weight';
    const catEmoji = cat === 'weight' ? '🏋️' : cat === 'distance' ? '🏃' : (cat === 'elevation' ? '🧗' : '🎯');
    const safeTitle = FlyToast.escape(item.title);
    const safeNotes = item.notes ? FlyToast.escape(item.notes) : '';
    const safeUnit = FlyToast.escape(item.unit);

    const proposerDisplay = item.user_nickname
      ? `${item.user_nickname} (\`${item.user_token}\`)`
      : (item.user_token ? `\`${item.user_token}\`` : '');

    const ghTitle = encodeURIComponent(`[Quest Proposal] ${item.title} (${cat})`);
    const ghBody = encodeURIComponent(
      `### 🌲 New Quest Proposal from Tardigrade Tough\n\n` +
      `- **Quest Title**: ${item.title}\n` +
      `- **Category**: \`${cat}\` (${item.unit})\n` +
      `- **Target Metric**: ${formatNumber(item.target_value)} ${item.unit}\n` +
      `- **Squad Room**: \`${item.room_slug || state.roomSlug}\`\n` +
      (proposerDisplay ? `- **Proposed by**: ${proposerDisplay}\n\n` : `\n`) +
      `#### 📝 Notes & Lore\n` +
      `> ${item.notes || 'No extra notes provided.'}\n\n` +
      `---\n` +
      `*Submitted via Tardigrade Tough app.*`
    );
    const ghIssueUrl = `https://github.com/radmuffin/tardigrade-tough/issues/new?title=${ghTitle}&body=${ghBody}&labels=quest-proposal`;

    return `
      <div class="wishlist-card">
        <div class="wishlist-header-row">
          <span class="wishlist-card-title">${safeTitle}</span>
          <span class="wishlist-cat-badge ${FlyToast.escape(cat)}">${catEmoji} ${FlyToast.escape(cat)}</span>
        </div>
        <div class="wishlist-meta-row">
          <span>Target: <span class="wishlist-target-num">${formatNumber(item.target_value)} ${safeUnit}</span></span>
          ${item.user_nickname ? `<span class="wishlist-proposer" title="UUID: ${FlyToast.escape(item.user_token || '')}">by <strong>${FlyToast.escape(item.user_nickname)}</strong></span>` : ''}
        </div>
        ${safeNotes ? `<div class="wishlist-notes-text">“${safeNotes}”</div>` : ''}
        <div class="wishlist-actions-row">
          <a href="${ghIssueUrl}" target="_blank" rel="noopener noreferrer" class="wishlist-action-btn gh-issue-link" title="Open formatted GitHub Issue in new tab">
            <span>🐙</span> GitHub Issue
          </a>
          <button type="button" class="wishlist-action-btn activate-quest-btn" data-title="${safeTitle}" data-cat="${cat}" data-val="${item.target_value}" data-unit="${safeUnit}" data-notes="${safeNotes}" title="Activate this quest">
            <span>🚀</span> Activate
          </button>
        </div>
      </div>
    `;
  }).join('');
}
