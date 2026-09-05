import { FlyToast } from '/_fly/fly-ui.js';
import { state, formatNumber } from './state.js';

export function setupLeaderboardTabs() {
  // Leaderboard displays all categories vertically
}

export function renderLeaderboard() {
  const container = document.getElementById('leaderboardList');
  if (!container || !state.currentRoomData) return;
  container.innerHTML = '';

  const activeGoals = state.currentRoomData.active_goals || [];
  const wtUnit = activeGoals.find(g => g.category === 'weight')?.unit || 'lbs';
  const distUnit = activeGoals.find(g => g.category === 'distance')?.unit || 'mi';
  const elevUnit = activeGoals.find(g => g.category === 'elevation')?.unit || 'ft';

  let totalWeight = 0;
  let totalDistance = 0;
  let totalElevation = 0;
  let totalSets = 0;

  const rawMembers = state.currentRoomData.leaderboard || [];
  rawMembers.forEach(m => {
    totalWeight += m.total_weight || 0;
    totalDistance += m.total_distance || 0;
    totalElevation += m.total_elevation || 0;
    totalSets += m.total_sets || 0;
  });

  // Update badge & multi-metric hero grid
  const setsBadge = document.getElementById('lbTotalSetsBadge');
  if (setsBadge) setsBadge.textContent = `${totalSets} sets logged`;

  const heroWt = document.getElementById('lbHeroWeight');
  const heroDist = document.getElementById('lbHeroDistance');
  const heroElev = document.getElementById('lbHeroElevation');
  if (heroWt) heroWt.textContent = `${formatNumber(totalWeight)} ${wtUnit}`;
  if (heroDist) heroDist.textContent = `${totalDistance.toFixed(1)} ${distUnit}`;
  if (heroElev) heroElev.textContent = `${formatNumber(totalElevation)} ${elevUnit}`;

  // Update squad banner in leaderboard
  const isSolo = state.roomSlug.startsWith('solo-');
  const squadNameLabel = document.getElementById('lbSquadNameLabel');
  const squadMembersCount = document.getElementById('lbSquadMembersCount');
  if (squadNameLabel && state.currentRoomData?.room) {
    squadNameLabel.textContent = isSolo ? 'Solo Quest' : state.currentRoomData.room.name;
  }
  if (squadMembersCount) {
    const memberCount = state.currentRoomData?.members?.length || 0;
    squadMembersCount.textContent = isSolo ? 'Private Solo' : `${memberCount} member${memberCount === 1 ? '' : 's'}`;
  }

  const currentUserId = state.currentRoomData.user_profile?.user_token;

  // Render 3 Vertical Category Sections (Weight, Distance, Elevation)
  const categorySections = [
    {
      category: 'weight',
      icon: '🌲',
      name: 'Weight Hoisted',
      questSubtitle: 'Pando Aspen Clone Quest',
      unit: wtUnit,
      metricKey: 'total_weight',
      totalVal: totalWeight,
      formatter: (v) => `${formatNumber(v)} ${wtUnit}`,
      emptyMsg: 'No weight hoisted yet. Be the first to log a set!',
    },
    {
      category: 'distance',
      icon: '🦌',
      name: 'Distance Traveled',
      questSubtitle: 'Caribou Migration Quest',
      unit: distUnit,
      metricKey: 'total_distance',
      totalVal: totalDistance,
      formatter: (v) => `${v.toFixed(1)} ${distUnit}`,
      emptyMsg: 'No distance recorded yet. Log your run, walk, or cycle!',
    },
    {
      category: 'elevation',
      icon: '🐐',
      name: 'Elevation Climbed',
      questSubtitle: 'Mt. Everest Ascent Quest',
      unit: elevUnit,
      metricKey: 'total_elevation',
      totalVal: totalElevation,
      formatter: (v) => `${formatNumber(v)} ${elevUnit}`,
      emptyMsg: 'No elevation logged yet. Climb some stairs or hills!',
    },
  ];

  // Append any custom active categories from active goals
  const customGoals = activeGoals.filter(g => !['weight', 'distance', 'elevation'].includes(g.category));
  customGoals.forEach(cg => {
    const catActs = (state.currentRoomData.recent_activities || []).filter(a => a.activity_type === cg.category);
    const catTotal = catActs.reduce((sum, a) => sum + (a.total_metric || 0), 0);
    const userTotals = {};
    catActs.forEach(a => {
      userTotals[a.user_token] = (userTotals[a.user_token] || 0) + (a.total_metric || 0);
    });

    categorySections.push({
      category: cg.category,
      icon: '🎯',
      name: cg.title,
      questSubtitle: `Custom Quest Target: ${formatNumber(cg.target_value)} ${cg.unit}`,
      unit: cg.unit,
      metricKey: null,
      userTotals,
      totalVal: Math.max(cg.current_value || 0, catTotal),
      formatter: (v) => `${formatNumber(v)} ${cg.unit}`,
      emptyMsg: `No activity logged for ${cg.title} yet. Be the first!`,
    });
  });

  categorySections.forEach(sec => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'lb-category-section';
    sectionEl.dataset.category = sec.category;

    const headerEl = document.createElement('div');
    headerEl.className = 'lb-category-header';
    headerEl.innerHTML = `
      <div class="lb-category-heading">
        <div class="lb-category-title-row">
          <span class="lb-category-icon">${sec.icon}</span>
          <h3 class="lb-category-title">${sec.name}</h3>
        </div>
        <span class="lb-category-quest-subtitle">${sec.questSubtitle}</span>
      </div>
      <div class="lb-category-total-badge ${sec.category}">
        <span class="total-badge-label">Squad Total</span>
        <span class="total-badge-val">${sec.formatter(sec.totalVal)}</span>
      </div>
    `;
    sectionEl.appendChild(headerEl);

    // Filter members with contributions in this category, sorted descending
    const catMembers = sec.metricKey
      ? [...rawMembers]
          .filter(m => (m[sec.metricKey] || 0) > 0)
          .sort((a, b) => (b[sec.metricKey] || 0) - (a[sec.metricKey] || 0))
      : [...rawMembers]
          .map(m => ({ ...m, custom_val: sec.userTotals?.[m.user_token] || 0 }))
          .filter(m => m.custom_val > 0)
          .sort((a, b) => b.custom_val - a.custom_val);

    if (catMembers.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'lb-category-empty';
      emptyEl.innerHTML = `
        <span class="empty-icon">${sec.icon}</span>
        <span class="empty-text">${sec.emptyMsg}</span>
      `;
      sectionEl.appendChild(emptyEl);
    } else {
      const listEl = document.createElement('div');
      listEl.className = 'lb-category-list';

      catMembers.forEach((member, idx) => {
        const isMe = member.user_token === currentUserId;
        let rankBadge = '';
        let rankClass = '';
        if (idx === 0) { rankBadge = '🥇'; rankClass = 'rank-gold'; }
        else if (idx === 1) { rankBadge = '🥈'; rankClass = 'rank-silver'; }
        else if (idx === 2) { rankBadge = '🥉'; rankClass = 'rank-bronze'; }
        else { rankBadge = `#${idx + 1}`; rankClass = 'rank-other'; }

        const val = sec.metricKey ? (member[sec.metricKey] || 0) : (member.custom_val || 0);
        const pct = sec.totalVal > 0 ? ((val / sec.totalVal) * 100).toFixed(1) : '0.0';

        const card = document.createElement('div');
        card.className = `leaderboard-card ${isMe ? 'is-me' : ''}`;

        card.innerHTML = `
          <div class="lb-card-top-row">
            <div class="leaderboard-user">
              <span class="lb-rank-badge ${rankClass}">${rankBadge}</span>
              <div class="user-avatar" style="background-color: ${member.avatar_color || '#10b981'}; font-size: ${member.avatar_emoji ? '1.15rem' : '0.9rem'};">
                ${member.avatar_emoji ? FlyToast.escape(member.avatar_emoji) : (member.nickname || 'L').substring(0, 1).toUpperCase()}
              </div>
              <div class="user-details">
                <div class="user-name-row">
                  <span class="user-nickname-text">${FlyToast.escape(member.nickname)}</span>
                </div>
              </div>
            </div>
            <div class="leaderboard-score">
              <div class="score-main ${sec.category}">${sec.formatter(val)}</div>
            </div>
          </div>
          <div class="lb-card-bottom-row">
            <div class="lb-meta-badges">
              ${isMe ? '<span class="badge-me">YOU</span>' : ''}
              ${member.is_daily_mvp ? '<span class="mvp-crown" title="Daily Titan">👑 Titan</span>' : ''}
              <span class="user-stats-sub">${member.total_sets || 0} sets logged</span>
            </div>
            <div class="score-pct">${pct}% of Crew</div>
          </div>
        `;
        listEl.appendChild(card);
      });

      sectionEl.appendChild(listEl);
    }

    container.appendChild(sectionEl);
  });
}
