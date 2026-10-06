import { FlyToast } from '/_fly/fly-ui.js';

/**
 * 100+ Curated Emojis for Tardigrade Tough Custom Exercises
 * Grouped with search keywords for fast, intuitive selection.
 */
export const CURATED_EXERCISE_EMOJIS = [
  // 🏋️ Strength & Gym
  { emoji: '🏋️', cat: 'strength', tags: ['squat', 'lift', 'deadlift', 'barbell', 'clean', 'snatch', 'gym'] },
  { emoji: '⛓️', cat: 'strength', tags: ['chain', 'heavy', 'metal', 'iron', 'deadlift', 'lock'] },
  { emoji: '🛡️', cat: 'strength', tags: ['shield', 'bench', 'armor', 'guard', 'defense', 'chest'] },
  { emoji: '🦵', cat: 'strength', tags: ['leg', 'squat', 'quad', 'hamstring', 'calf', 'lunge', 'extension'] },
  { emoji: '🚀', cat: 'strength', tags: ['overhead', 'press', 'explosive', 'power', 'thrust', 'rocket'] },
  { emoji: '🚣', cat: 'strength', tags: ['row', 'barbell row', 'back', 'lat', 'pulley', 'cable'] },
  { emoji: '👟', cat: 'strength', tags: ['shoe', 'lunge', 'step', 'squat', 'sneaker', 'footwork'] },
  { emoji: '💪', cat: 'strength', tags: ['bicep', 'curl', 'muscle', 'arm', 'flex', 'gun', 'strong'] },
  { emoji: '🦾', cat: 'strength', tags: ['bionic', 'arm', 'robot', 'cyber', 'iron', 'steel', 'power'] },
  { emoji: '🦿', cat: 'strength', tags: ['bionic', 'leg', 'prosthetic', 'speed', 'jump'] },
  { emoji: '🪵', cat: 'strength', tags: ['log', 'wood', 'carry', 'strongman', 'press', 'clean'] },
  { emoji: '🔨', cat: 'strength', tags: ['hammer', 'slam', 'sledge', 'tire', 'forearm', 'smash'] },
  { emoji: '⚓', cat: 'strength', tags: ['anchor', 'heavy', 'deadweight', 'hold', 'grip', 'static'] },
  { emoji: '🎯', cat: 'strength', tags: ['target', 'accuracy', 'focus', 'form', 'core', 'center'] },
  { emoji: '🧱', cat: 'strength', tags: ['brick', 'wall', 'build', 'foundation', 'solid', 'abs'] },
  { emoji: '🪢', cat: 'strength', tags: ['rope', 'battle rope', 'climb', 'grip', 'knot', 'pull'] },
  { emoji: '🔔', cat: 'strength', tags: ['kettlebell', 'bell', 'swing', 'snatch', 'press', 'turkish'] },
  { emoji: '🤸', cat: 'strength', tags: ['calisthenics', 'handstand', 'gymnastics', 'dip', 'pullup', 'planche'] },
  { emoji: '🤼', cat: 'strength', tags: ['wrestle', 'grapple', 'combat', 'clinch', 'takedown'] },
  { emoji: '🪓', cat: 'strength', tags: ['axe', 'chop', 'woodchopper', 'oblique', 'rotational'] },

  // 🏃 Cardio & Endurance
  { emoji: '🏃', cat: 'cardio', tags: ['run', 'sprint', 'jog', 'cardio', 'treadmill', 'track', '5k', '10k', 'marathon'] },
  { emoji: '🚶', cat: 'cardio', tags: ['walk', 'hike', 'ruck', 'treadmill', 'incline', 'steps'] },
  { emoji: '🏊', cat: 'cardio', tags: ['swim', 'pool', 'laps', 'freestyle', 'breaststroke', 'water'] },
  { emoji: '🚴', cat: 'cardio', tags: ['bike', 'cycle', 'spin', 'peloton', 'road', 'wheels'] },
  { emoji: '🚵', cat: 'cardio', tags: ['mountain bike', 'trail', 'downhill', 'climb', 'quads'] },
  { emoji: '🧗', cat: 'cardio', tags: ['climb', 'bouldering', 'rock', 'grip', 'forearm', 'wall'] },
  { emoji: '⛷️', cat: 'cardio', tags: ['ski', 'skierg', 'snow', 'nordic', 'slopes'] },
  { emoji: '🏂', cat: 'cardio', tags: ['snowboard', 'downhill', 'balance', 'core', 'slopes'] },
  { emoji: '🏄', cat: 'cardio', tags: ['surf', 'waves', 'paddle', 'balance', 'ocean'] },
  { emoji: '🛹', cat: 'cardio', tags: ['skate', 'skateboard', 'balance', 'ollie', 'street'] },
  { emoji: '🛼', cat: 'cardio', tags: ['roller', 'skates', 'quads', 'glutes', 'cardio'] },
  { emoji: '🥾', cat: 'cardio', tags: ['hike', 'boot', 'trek', 'trail', 'elevation', 'ruck'] },
  { emoji: '🏔️', cat: 'cardio', tags: ['mountain', 'summit', 'peak', 'elevation', 'climb', 'everest'] },
  { emoji: '🧘', cat: 'cardio', tags: ['yoga', 'stretch', 'mobility', 'cooldown', 'flexibility', 'zen'] },
  { emoji: '🚣‍♀️', cat: 'cardio', tags: ['rowing', 'erg', 'concept2', 'endurance', 'cardio'] },
  { emoji: '👟', cat: 'cardio', tags: ['steps', 'walking', 'running', 'daily', 'shoes'] },

  // 🐻 Beasts & Tardigrade Nature
  { emoji: '🐻', cat: 'beasts', tags: ['bear', 'water bear', 'tardigrade', 'beast', 'brute', 'power'] },
  { emoji: '🦔', cat: 'beasts', tags: ['tardigrade', 'hedgehog', 'micro', 'tough', 'indestructible'] },
  { emoji: '🌲', cat: 'beasts', tags: ['pando', 'tree', 'aspen', 'forest', 'roots', 'roots', 'endurance'] },
  { emoji: '🐐', cat: 'beasts', tags: ['goat', 'greatest', 'climb', 'mountain', 'steep', 'horns'] },
  { emoji: '🐋', cat: 'beasts', tags: ['whale', 'blue whale', 'colossal', 'giant', 'ocean', 'heavy'] },
  { emoji: '🦍', cat: 'beasts', tags: ['gorilla', 'silverback', 'ape', 'chest', 'grip', 'primate'] },
  { emoji: '🦅', cat: 'beasts', tags: ['eagle', 'wings', 'flight', 'upper body', 'predator', 'sky'] },
  { emoji: '🦁', cat: 'beasts', tags: ['lion', 'king', 'pride', 'roar', 'beast', 'predator'] },
  { emoji: '🐯', cat: 'beasts', tags: ['tiger', 'stripes', 'ferocious', 'pounce', 'raw'] },
  { emoji: '🦈', cat: 'beasts', tags: ['shark', 'swim', 'bite', 'speed', 'relentless', 'ocean'] },
  { emoji: '🦖', cat: 'beasts', tags: ['t-rex', 'dinosaur', 'reptile', 'monster', 'colossus'] },
  { emoji: '🦏', cat: 'beasts', tags: ['rhino', 'horn', 'charge', 'heavyweight', 'thick'] },
  { emoji: '🐂', cat: 'beasts', tags: ['ox', 'bull', 'horns', 'powerlifter', 'strength'] },
  { emoji: '🐎', cat: 'beasts', tags: ['horse', 'stallion', 'gallop', 'stamina', 'speed'] },
  { emoji: '🐺', cat: 'beasts', tags: ['wolf', 'lone wolf', 'pack', 'howl', 'stamina'] },
  { emoji: '🐲', cat: 'beasts', tags: ['dragon', 'mythic', 'fire', 'claws', 'legendary'] },
  { emoji: '🐙', cat: 'beasts', tags: ['octopus', 'tentacles', 'grip', 'multi', 'grapple'] },
  { emoji: '🐍', cat: 'beasts', tags: ['snake', 'cobra', 'core', 'grip', 'strike'] },
  { emoji: '🐢', cat: 'beasts', tags: ['turtle', 'shell', 'defense', 'slow and steady', 'shield'] },
  { emoji: '🐘', cat: 'beasts', tags: ['elephant', 'stampede', 'heavy', 'giant', 'trunk'] },
  { emoji: '🐆', cat: 'beasts', tags: ['leopard', 'cheetah', 'sprint', 'fast', 'speed'] },
  { emoji: '🐗', cat: 'beasts', tags: ['boar', 'tusks', 'wild', 'charge'] },
  { emoji: '🦊', cat: 'beasts', tags: ['fox', 'agile', 'quick', 'nimble'] },
  { emoji: '🐾', cat: 'beasts', tags: ['paws', 'track', 'trail', 'animal', 'steps'] },
  { emoji: '🦣', cat: 'beasts', tags: ['mammoth', 'ice age', 'tusk', 'ancient', 'beast'] },

  // 🔥 Power, Badges & Trophies
  { emoji: '🔥', cat: 'power', tags: ['fire', 'flame', 'burn', 'calories', 'blaze', 'sweat', 'hot'] },
  { emoji: '⚡', cat: 'power', tags: ['lightning', 'speed', 'bolt', 'shock', 'quick', 'power'] },
  { emoji: '⚔️', cat: 'power', tags: ['swords', 'battle', 'warrior', 'clash', 'combat', 'grind'] },
  { emoji: '👑', cat: 'power', tags: ['crown', 'king', 'pr', 'record', 'personal best', 'champion'] },
  { emoji: '🏆', cat: 'power', tags: ['trophy', 'cup', 'winner', 'victory', 'gold', 'champ'] },
  { emoji: '💎', cat: 'power', tags: ['diamond', 'unbreakable', 'hard', 'indestructible', 'gem'] },
  { emoji: '🌋', cat: 'power', tags: ['volcano', 'lava', 'eruption', 'heat', 'core'] },
  { emoji: '💥', cat: 'power', tags: ['boom', 'collision', 'impact', 'smash', 'explosive'] },
  { emoji: '💣', cat: 'power', tags: ['bomb', 'blast', 'heavy', 'dynamite', 'core'] },
  { emoji: '🩸', cat: 'power', tags: ['blood', 'sweat', 'tears', 'hardcore', 'grind', 'toll'] },
  { emoji: '🥋', cat: 'power', tags: ['martial arts', 'jiu jitsu', 'bjj', 'gi', 'black belt', 'karate'] },
  { emoji: '🥊', cat: 'power', tags: ['boxing', 'gloves', 'punch', 'sparring', 'ring', 'uppercut'] },
  { emoji: '🏅', cat: 'power', tags: ['medal', 'ribbon', 'award', 'honor'] },
  { emoji: '🥇', cat: 'power', tags: ['first', 'gold', 'winner', 'number one'] },
  { emoji: '🥈', cat: 'power', tags: ['second', 'silver', 'podium'] },
  { emoji: '🥉', cat: 'power', tags: ['third', 'bronze', 'podium'] },
  { emoji: '🎖️', cat: 'power', tags: ['veteran', 'distinction', 'badge', 'honor'] },
  { emoji: '🌟', cat: 'power', tags: ['star', 'glow', 'elite', 'bright'] },
  { emoji: '✨', cat: 'power', tags: ['sparkles', 'magic', 'special', 'custom', 'shine'] },
  { emoji: '💯', cat: 'power', tags: ['100', 'perfect', 'max', 'full effort', 'score'] },
  { emoji: '🚩', cat: 'power', tags: ['flag', 'checkpoint', 'milestone', 'goal', 'finish'] },
  { emoji: '🌪️', cat: 'power', tags: ['tornado', 'spin', 'whirlwind', 'fury'] },
  { emoji: '☄️', cat: 'power', tags: ['comet', 'meteor', 'fast', 'impact'] },

  // 🍎 Fuel & Body
  { emoji: '🥩', cat: 'fuel', tags: ['steak', 'meat', 'protein', 'beef', 'carnivore', 'mass'] },
  { emoji: '🥓', cat: 'fuel', tags: ['bacon', 'keto', 'fat', 'breakfast', 'pork'] },
  { emoji: '🍗', cat: 'fuel', tags: ['chicken', 'poultry', 'lean', 'protein', 'meal prep'] },
  { emoji: '🥚', cat: 'fuel', tags: ['egg', 'eggs', 'protein', 'breakfast', 'clean'] },
  { emoji: '🥑', cat: 'fuel', tags: ['avocado', 'healthy fats', 'clean food', 'fuel'] },
  { emoji: '🥦', cat: 'fuel', tags: ['broccoli', 'greens', 'micronutrients', 'fiber', 'veggies'] },
  { emoji: '🍌', cat: 'fuel', tags: ['banana', 'potassium', 'carbs', 'preworkout', 'energy'] },
  { emoji: '💧', cat: 'fuel', tags: ['water', 'hydration', 'sweat', 'electrolytes', 'drink'] },
  { emoji: '☕', cat: 'fuel', tags: ['coffee', 'caffeine', 'preworkout', 'stimulant', 'focus'] },
  { emoji: '🫀', cat: 'fuel', tags: ['heart', 'cardio', 'pulse', 'bpm', 'aerobic', 'vital'] },
  { emoji: '🫁', cat: 'fuel', tags: ['lungs', 'breath', 'vo2 max', 'aerobic', 'capacity'] },
  { emoji: '🧠', cat: 'fuel', tags: ['brain', 'mindset', 'focus', 'psychology', 'discipline'] },
  { emoji: '🦴', cat: 'fuel', tags: ['bone', 'density', 'skeletal', 'joint', 'calcium'] },
  { emoji: '🍎', cat: 'fuel', tags: ['apple', 'fruit', 'nutrition', 'healthy'] },
  { emoji: '🥜', cat: 'fuel', tags: ['peanuts', 'nuts', 'energy', 'snack'] },
  { emoji: '🧂', cat: 'fuel', tags: ['salt', 'sodium', 'pump', 'electrolytes'] },

  // 🚀 Sports & Activities
  { emoji: '🏀', cat: 'sports', tags: ['basketball', 'hoop', 'dunk', 'jump', 'court'] },
  { emoji: '⚽', cat: 'sports', tags: ['soccer', 'football', 'pitch', 'kick', 'cardio'] },
  { emoji: '🏈', cat: 'sports', tags: ['football', 'gridiron', 'tackle', 'quarterback'] },
  { emoji: '⚾', cat: 'sports', tags: ['baseball', 'bat', 'swing', 'pitch', 'diamond'] },
  { emoji: '🏐', cat: 'sports', tags: ['volleyball', 'spike', 'beach', 'jump', 'serve'] },
  { emoji: '🎾', cat: 'sports', tags: ['tennis', 'racket', 'serve', 'court', 'agility'] },
  { emoji: '🏓', cat: 'sports', tags: ['ping pong', 'table tennis', 'paddle', 'reflexes'] },
  { emoji: '🏸', cat: 'sports', tags: ['badminton', 'shuttlecock', 'smash', 'speed'] },
  { emoji: '🏹', cat: 'sports', tags: ['bow', 'archery', 'arrow', 'focus', 'lat', 'draw'] },
  { emoji: '🎣', cat: 'sports', tags: ['fishing', 'reel', 'outdoor', 'patience'] },
  { emoji: '🏌️', cat: 'sports', tags: ['golf', 'swing', 'drive', 'core', 'hips'] },
  { emoji: '🤾', cat: 'sports', tags: ['handball', 'throw', 'athletic', 'team'] },
  { emoji: '🤺', cat: 'sports', tags: ['fencing', 'foil', 'sword', 'lunge', 'agility'] },
  { emoji: '🏇', cat: 'sports', tags: ['equestrian', 'horse racing', 'jockey', 'core'] },
  { emoji: '🎳', cat: 'sports', tags: ['bowling', 'strike', 'pins', 'arm'] },
  { emoji: '🥏', cat: 'sports', tags: ['frisbee', 'ultimate', 'disc', 'throw', 'sprint'] },
  { emoji: '🛸', cat: 'sports', tags: ['ufo', 'alien', 'gravity', 'space', 'otherworldly'] },
  { emoji: '🤖', cat: 'sports', tags: ['robot', 'cyborg', 'machine', 'unstoppable'] }
];

const STORAGE_KEY = 'tardigrade_custom_exercises';

/**
 * Retrieves normalized custom exercises list: [{ name, emoji }]
 */
export function getCustomExercises() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        if (typeof item === 'string') {
          return { name: item.trim(), emoji: '✨' };
        }
        if (item && typeof item === 'object') {
          return {
            name: (item.name || '').trim(),
            emoji: (item.emoji || '✨').trim()
          };
        }
        return null;
      })
      .filter(item => item && item.name.length > 0);
  } catch (e) {
    return [];
  }
}

/**
 * Saves or updates a custom exercise.
 * If an exercise with the same name (case-insensitive) exists, its emoji is updated.
 */
export function saveCustomExercise(name, emoji = '✨') {
  if (!name || typeof name !== 'string') return null;
  const cleanName = name.trim();
  if (!cleanName) return null;
  const cleanEmoji = (emoji || '✨').trim() || '✨';

  const list = getCustomExercises();
  const existingIdx = list.findIndex(e => e.name.toLowerCase() === cleanName.toLowerCase());

  if (existingIdx >= 0) {
    list[existingIdx] = { name: cleanName, emoji: cleanEmoji };
  } else {
    list.push({ name: cleanName, emoji: cleanEmoji });
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('tardigrade-custom-exercises-updated', { detail: { list } }));
  } catch (e) {}

  return { name: cleanName, emoji: cleanEmoji };
}

/**
 * Deletes a custom exercise by name.
 */
export function deleteCustomExercise(name) {
  if (!name) return false;
  const clean = name.trim().toLowerCase();
  const list = getCustomExercises();
  const filtered = list.filter(e => e.name.toLowerCase() !== clean);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('tardigrade-custom-exercises-updated', { detail: { list: filtered } }));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Generates HTML <option> tags for all custom exercises.
 */
export function getCustomExerciseOptionsHtml(selectedName = '') {
  const list = getCustomExercises();
  if (list.length === 0) return '';
  return list.map(item => {
    const isSel = selectedName && selectedName.toLowerCase() === item.name.toLowerCase();
    return `<option value="${FlyToast.escape(item.name)}" ${isSel ? 'selected' : ''}>${FlyToast.escape(item.emoji)} ${FlyToast.escape(item.name)}</option>`;
  }).join('');
}

let activeModalState = null;

/**
 * Opens the custom exercise modal.
 */
export function openCustomExerciseModal({ onSave, onCancel, initialName = '', initialEmoji = '✨' } = {}) {
  const modal = document.getElementById('customExerciseModal');
  if (!modal) return;

  activeModalState = { onSave, onCancel };

  const nameInput = document.getElementById('customExNameInput');
  const searchInput = document.getElementById('customExEmojiSearch');
  const modalTitle = document.getElementById('customExModalTitle');

  if (nameInput) {
    nameInput.value = initialName || '';
    setTimeout(() => nameInput.focus(), 80);
  }

  if (modalTitle) {
    modalTitle.textContent = initialName ? '✨ Edit Custom Exercise' : '✨ Custom Exercise';
  }

  if (searchInput) {
    searchInput.value = '';
  }

  // Reset category pills
  document.querySelectorAll('.custom-ex-cat-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === 'all');
  });

  setSelectedEmoji(initialEmoji || '✨');
  filterEmojis('', 'all');
  renderExistingList();

  modal.classList.remove('hidden');
}

/**
 * Closes the custom exercise modal.
 */
export function closeCustomExerciseModal(wasSaved = false) {
  const modal = document.getElementById('customExerciseModal');
  if (!modal) return;
  modal.classList.add('hidden');

  if (!wasSaved && activeModalState && activeModalState.onCancel) {
    activeModalState.onCancel();
  }
  activeModalState = null;
}

let currentSelectedEmoji = '✨';
let currentCategory = 'all';

function setSelectedEmoji(emoji) {
  currentSelectedEmoji = emoji || '✨';
  const previewBadge = document.getElementById('customExEmojiPreview');
  if (previewBadge) {
    previewBadge.textContent = currentSelectedEmoji;
  }

  // Update selected highlight in the grid
  const grid = document.getElementById('customExEmojiGrid');
  if (grid) {
    grid.querySelectorAll('.custom-ex-emoji-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.emoji === currentSelectedEmoji);
    });
  }
}

function filterEmojis(searchQuery = '', category = 'all') {
  const grid = document.getElementById('customExEmojiGrid');
  if (!grid) return;

  const q = searchQuery.trim().toLowerCase();
  const cat = category || 'all';

  const filtered = CURATED_EXERCISE_EMOJIS.filter(item => {
    if (cat !== 'all' && item.cat !== cat) return false;
    if (!q) return true;
    return item.emoji.includes(q) || item.tags.some(t => t.includes(q));
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 18px 0;">No matching emojis</div>';
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const isSel = item.emoji === currentSelectedEmoji;
    return `<button type="button" class="custom-ex-emoji-btn ${isSel ? 'selected' : ''}" data-emoji="${item.emoji}" title="${item.tags[0] || 'Emoji'}">${item.emoji}</button>`;
  }).join('');
}

function renderExistingList() {
  const container = document.getElementById('customExExistingList');
  const section = document.getElementById('customExExistingSection');
  if (!container || !section) return;

  const list = getCustomExercises();
  if (list.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = list.map(item => `
    <div class="custom-ex-chip">
      <span class="custom-ex-chip-emoji">${FlyToast.escape(item.emoji)}</span>
      <span class="custom-ex-chip-name" title="${FlyToast.escape(item.name)}">${FlyToast.escape(item.name)}</span>
      <button type="button" class="custom-ex-chip-action edit-btn" data-name="${FlyToast.escape(item.name)}" data-emoji="${FlyToast.escape(item.emoji)}" title="Edit">✎</button>
      <button type="button" class="custom-ex-chip-action del-btn" data-name="${FlyToast.escape(item.name)}" title="Delete">✕</button>
    </div>
  `).join('');
}

/**
 * Initializes listeners and bindings for the custom exercise modal.
 */
export function setupCustomExerciseModal() {
  const modal = document.getElementById('customExerciseModal');
  if (!modal) return;

  const closeBtn = document.getElementById('closeCustomExModalBtn');
  const cancelBtn = document.getElementById('cancelCustomExModalBtn');
  const saveBtn = document.getElementById('saveCustomExModalBtn');
  const nameInput = document.getElementById('customExNameInput');
  const searchInput = document.getElementById('customExEmojiSearch');
  const catPills = document.querySelectorAll('.custom-ex-cat-pill');
  const emojiGrid = document.getElementById('customExEmojiGrid');
  const existingList = document.getElementById('customExExistingList');

  // Close triggers
  if (closeBtn) closeBtn.addEventListener('click', () => closeCustomExerciseModal(false));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeCustomExerciseModal(false));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCustomExerciseModal(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeCustomExerciseModal(false);
    }
  });

  // Category filter pills
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.cat || 'all';
      filterEmojis(searchInput?.value || '', currentCategory);
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterEmojis(searchInput.value || '', currentCategory);
    });
  }

  // Emoji Grid selection (delegation)
  if (emojiGrid) {
    emojiGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.custom-ex-emoji-btn');
      if (btn && btn.dataset.emoji) {
        setSelectedEmoji(btn.dataset.emoji);
      }
    });
  }

  // Handle Save
  function handleSave() {
    const rawName = nameInput ? nameInput.value.trim() : '';
    if (!rawName) {
      FlyToast.error('Please enter an exercise name');
      if (nameInput) nameInput.focus();
      return;
    }

    const saved = saveCustomExercise(rawName, currentSelectedEmoji);
    if (!saved) return;

    if (activeModalState && activeModalState.onSave) {
      activeModalState.onSave(saved);
    }

    FlyToast.success(`Saved "${saved.emoji} ${saved.name}"!`);
    closeCustomExerciseModal(true);
  }

  if (saveBtn) saveBtn.addEventListener('click', handleSave);

  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    });
  }

  // Existing custom exercises chip actions (edit & delete)
  if (existingList) {
    existingList.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-btn');
      if (editBtn) {
        const name = editBtn.dataset.name;
        const emoji = editBtn.dataset.emoji;
        if (nameInput) {
          nameInput.value = name;
          nameInput.focus();
        }
        setSelectedEmoji(emoji || '✨');
        const modalTitle = document.getElementById('customExModalTitle');
        if (modalTitle) modalTitle.textContent = '✨ Edit Custom Exercise';
        return;
      }

      const delBtn = e.target.closest('.del-btn');
      if (delBtn) {
        const name = delBtn.dataset.name;
        if (confirm(`Remove "${name}" from custom exercises?`)) {
          deleteCustomExercise(name);
          renderExistingList();
          FlyToast.info(`Removed "${name}"`);
        }
      }
    });
  }
}
