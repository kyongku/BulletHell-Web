import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA65hHD3pzh8Jv91xBWxMOK_FG9j8vNL2o",
  authDomain: "core-tempest-11588.firebaseapp.com",
  projectId: "core-tempest-11588",
  storageBucket: "core-tempest-11588.firebasestorage.app",
  messagingSenderId: "343743820806",
  appId: "1:343743820806:web:41391a57902093fea57f87",
  measurementId: "G-4P8SZVSN3Q"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  const btnStart        = $('btnStart');
  const btnRetry        = $('btnRetry');
  const submitBtn       = $('submitScore');
  const menu            = $('mainMenu');
  const ui              = $('ui');
  const canvas          = $('gameCanvas');
  const warningDiv      = $('warning');
  const gameOverScreen  = $('gameOverScreen');
  const pauseScreen     = $('pauseScreen');
  const finalScoreSpan  = $('finalScore');
  const boardList       = $('boardList');
  const scoreSpan       = $('score');
  const bestSpan        = $('best');
  const skinsDiv        = $('skins');
  const skillsDiv       = $('skills');
  const bossUi          = $('bossUi');
  const bossHpFill      = document.querySelector('#bossHpBar>div');
  const hpBarDiv        = document.querySelector('#hpBar>div');
  const hpBarContainer  = $('hpBarContainer');

  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = 1200;
  canvas.height = 720;

  // ─── HUD elements ────────────────────────────────────────────────
  const hpText = document.createElement('div');
  hpText.id = 'hpText';
  Object.assign(hpText.style, {
    position: 'absolute', width: '200px', textAlign: 'center', color: 'inherit',
    fontSize: '12px', color: '#fff', pointerEvents: 'none',
  });
  if (hpBarContainer) hpBarContainer.appendChild(hpText);

  // Skill HUD: vertical container — one row per skill, current skill highlighted
  const skillHud = document.createElement('div');
  skillHud.id = 'skillHud';
  Object.assign(skillHud.style, {
    marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px',
  });
  if (ui) ui.appendChild(skillHud);

  // ─── Constants ───────────────────────────────────────────────────
  const FRAME_REF            = 16.6667;
  const SCORE_PER_SEC        = 60;
  const PLAYER_BULLET_DMG    = 25;
  const PLAYER_FIRE_CD       = 150;
  const PLAYER_BASE_SPEED    = 4.2;
  const NORMAL_SPAWN_START   = 1000;
  const NORMAL_SPAWN_MIN     = 300;
  const WARNING_DURATION     = 1200;   // ms — warning screen
  const FIRE_WARN_DURATION   = 800;    // ms — fire zone telegraph before activation
  const BOSS_KILL_BONUS      = 1000;
  const POWERUP_DURATION     = 5000;
  const POWERUP_SPEED_MULT   = 1.15;
  const POWERUP_FIRE_CD      = 100;
  const BOSS_SCORE_INTERVAL  = 3000;   // every 3000 pts a boss spawns
  const ELECTRIC_BALL_COUNT  = 8;      // number of electric orbs on field
  const ELECTRIC_LINK_INTERVAL = 2500; // ms between link pulses
  const PARRY_WINDOW_START   = 100;    // ms after cast when parry window opens
  const PARRY_WINDOW_END     = 350;    // ms after cast when parry window closes
  const PARRY_CD_REDUCTION   = 0.90;   // 90% cooldown cut on perfect parry

  // ─── Boss element definitions ────────────────────────────────────
  // Each entry defines colors, stats, and behavior multipliers.
  // Hybrid bosses inherit blended values from two entries.
  const elementData = {
    fire: {
      name: '화염(火)',
      color: '#ff6b3d',     // primary color used for blending
      bg: '#2a0808', border: '#8b1e1e',
      burst: '#ff6b3d', spiral: '#ff9a3d', aimed: '#ff4a4a',
      size: 76, maxHp: 560,
      thresholds: { burst: 0.72, spiral: 0.40 },
      burstInterval: 740, burstSpeed: 2.9, burstCount: 18, burstDestructRatio: 0.20,
      spiralInterval: 46, spiralSpeed: 2.9,
      aimedInterval: 470, aimedShots: 3, aimedDelay: 90, aimedSpeed: 3.9,
      orbitRadius: 135, chaseSpeed: 75, zigSpeed: 130,
      homing: 0.0, defenseMultiplier: 1.0,
      // fire-specific: zone hazard on HP threshold
      fireZoneOnThreshold: 0.5,
    },
    water: {
      name: '물(水)',
      color: '#4fd3ff',
      bg: '#071a2e', border: '#1b4e88',
      burst: '#4fd3ff', spiral: '#68c6ff', aimed: '#83d9ff',
      size: 76, maxHp: 700,
      thresholds: { burst: 0.70, spiral: 0.42 },
      burstInterval: 800, burstSpeed: 2.5, burstCount: 16, burstDestructRatio: 0.25,
      spiralInterval: 40, spiralSpeed: 2.7,
      aimedInterval: 520, aimedShots: 3, aimedDelay: 95, aimedSpeed: 3.65,
      orbitRadius: 115, chaseSpeed: 66, zigSpeed: 105,
      homing: 0.0, defenseMultiplier: 1.0,
      // water-specific: totem heal phase on 50% HP
      waterHealOnThreshold: 0.5,
    },
    earth: {
      name: '대지(土)',
      color: '#c7994f',
      bg: '#1b1408', border: '#6a4d24',
      burst: '#c7994f', spiral: '#d6aa65', aimed: '#e1bb7d',
      size: 82, maxHp: 860,
      thresholds: { burst: 0.76, spiral: 0.48 },
      burstInterval: 1000, burstSpeed: 2.0, burstCount: 12, burstDestructRatio: 0.18,
      spiralInterval: 60, spiralSpeed: 2.2,
      aimedInterval: 660, aimedShots: 2, aimedDelay: 120, aimedSpeed: 3.0,
      orbitRadius: 110, chaseSpeed: 55, zigSpeed: 85,
      homing: 0.0,
      defenseMultiplier: 0.5,  // takes 50% damage — core earth trait
    },
    wind: {
      name: '바람(風)',
      color: '#68ffb9',
      bg: '#081f16', border: '#27a56f',
      burst: '#68ffb9', spiral: '#9ffff1', aimed: '#d6fff8',
      size: 72, maxHp: 780,
      thresholds: { burst: 0.68, spiral: 0.36 },
      burstInterval: 700, burstSpeed: 2.6, burstCount: 18, burstDestructRatio: 0.22,
      spiralInterval: 30, spiralSpeed: 3.3,   // faster spiral
      aimedInterval: 320, aimedShots: 4, aimedDelay: 65, aimedSpeed: 3.55,
      orbitRadius: 140, chaseSpeed: 58, zigSpeed: 80,  // capped near player speed
      homing: 0.05, defenseMultiplier: 1.0,
      // wind-specific: laser telegraph fires every 1300ms
      laserInterval: 1000,
      isWind: true,
    },
    electric: {
      name: '전기(電)',
      color: '#ffe566',
      bg: '#0d0d1f', border: '#4a4aaa',
      burst: '#ffe566', spiral: '#ffc533', aimed: '#ffec99',
      size: 74, maxHp: 720,
      thresholds: { burst: 0.70, spiral: 0.42 },
      burstInterval: 850, burstSpeed: 2.4, burstCount: 14, burstDestructRatio: 0.20,
      spiralInterval: 44, spiralSpeed: 2.8,
      aimedInterval: 600, aimedShots: 3, aimedDelay: 100, aimedSpeed: 3.5,
      orbitRadius: 120, chaseSpeed: 70, zigSpeed: 115,
      homing: 0.0, defenseMultiplier: 1.0,
      // electric-specific: 8 orbs on field, link pulse every 2.5s
    },
  };

  // ─── Boss sequence logic ─────────────────────────────────────────
  // Cycle 0 (bosses 1-5): shuffle of all 5 types, no repeats.
  // Cycle 1+ (boss 6+): random pair of 2 types → hybrid boss.
  const ALL_BOSS_TYPES = ['fire', 'water', 'earth', 'wind', 'electric'];

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Returns a blended hex color (50/50) from two hex strings like '#rrggbb'
  function blendColors(hex1, hex2) {
    const parse = h => [
      parseInt(h.slice(1,3), 16),
      parseInt(h.slice(3,5), 16),
      parseInt(h.slice(5,7), 16),
    ];
    const [r1,g1,b1] = parse(hex1);
    const [r2,g2,b2] = parse(hex2);
    const r = ((r1+r2)/2)|0;
    const g = ((g1+g2)/2)|0;
    const b = ((b1+b2)/2)|0;
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  // Build a hybrid element config merging N base types (N = 2 or 3).
  // Attribute-best-stat rules:
  //   火(fire)  → damage stats  : aimedSpeed, burstSpeed, spiralSpeed 최대값
  //   土(earth) → defense       : defenseMultiplier 최소값 (= 최강 방어)
  //   水(water) → HP + healing  : maxHp 최대값
  //   風(wind)  → move speed    : chaseSpeed, zigSpeed 최대값
  //   電(elec)  → attack speed  : burstInterval, spiralInterval, aimedInterval 최소값
  function makeHybridData(...types) {
    const entries = types.map(t => elementData[t]);
    const n = entries.length;
    const hpMult = n === 2 ? 1.25 : 1.55; // 3속성은 더 강함

    // 평균 헬퍼
    const avg  = key => entries.reduce((s, e) => s + e[key], 0) / n;
    // 최대/최소 헬퍼
    const best = key => Math.max(...entries.map(e => e[key]));
    const min  = key => Math.min(...entries.map(e => e[key]));

    // 색상: 모든 타입 색 혼합
    const blendAll = key => {
      let r=0, g=0, b=0;
      for (const e of entries) {
        const parse = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
        const [er,eg,eb] = parse(e[key]);
        r+=er; g+=eg; b+=eb;
      }
      r=(r/n)|0; g=(g/n)|0; b=(b/n)|0;
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    };

    const hasFire  = types.includes('fire');
    const hasEarth = types.includes('earth');
    const hasWater = types.includes('water');
    const hasWind  = types.includes('wind');
    const hasElec  = types.includes('electric');

    return {
      name: entries.map(e => e.name).join('+'),
      color:  blendAll('color'),
      bg:     blendAll('bg'),
      border: blendAll('border'),
      burst:  blendAll('burst'),
      spiral: blendAll('spiral'),
      aimed:  blendAll('aimed'),
      size:   avg('size'),

      // 水 보너스: maxHp 최대값 적용
      maxHp: (hasWater ? best('maxHp') : avg('maxHp')) * hpMult,

      thresholds: {
        burst:  entries.reduce((s,e)=>s+e.thresholds.burst, 0)/n,
        spiral: entries.reduce((s,e)=>s+e.thresholds.spiral,0)/n,
      },

      // 電 보너스: 발사 간격 최소값 (가장 빠른 공격속도)
      burstInterval:  hasElec ? min('burstInterval')  : avg('burstInterval'),
      spiralInterval: hasElec ? min('spiralInterval') : avg('spiralInterval'),
      aimedInterval:  hasElec ? min('aimedInterval')  : avg('aimedInterval'),
      aimedDelay:     hasElec ? min('aimedDelay')     : avg('aimedDelay'),

      // 火 보너스: 투사체 속도 최대값
      burstSpeed:  hasFire ? best('burstSpeed')  : avg('burstSpeed'),
      spiralSpeed: hasFire ? best('spiralSpeed') : avg('spiralSpeed'),
      aimedSpeed:  hasFire ? best('aimedSpeed')  : avg('aimedSpeed'),

      burstCount:         Math.round(avg('burstCount')),
      burstDestructRatio: avg('burstDestructRatio'),
      aimedShots:         Math.round(avg('aimedShots')),

      // 風 보너스: 이동속도 최대값
      chaseSpeed:  hasWind ? best('chaseSpeed') : avg('chaseSpeed'),
      zigSpeed:    hasWind ? best('zigSpeed')   : avg('zigSpeed'),
      orbitRadius: avg('orbitRadius'),

      homing: best('homing'),

      // 土 보너스: 방어율 최소값 (가장 높은 방어)
      defenseMultiplier: hasEarth ? min('defenseMultiplier') : avg('defenseMultiplier'),

      // 특성 플래그 (부모 중 하나라도 있으면 상속)
      fireZoneOnThreshold:  entries.some(e=>e.fireZoneOnThreshold)  ? 0.5 : null,
      waterHealOnThreshold: entries.some(e=>e.waterHealOnThreshold) ? 0.5 : null,
      laserInterval:        hasWind ? min('laserInterval') : null,
      isElectric: hasElec,
      isEarth:    hasEarth,
      isWind:     hasWind,
      hybridTypes: types,
    };
  }

  // ─── Skill definitions ───────────────────────────────────────────
  const SKILLS = [
    { id: 'teleport',  name: '공간도약', desc: '마우스 방향 순간이동',           cooldown: 6000  },
    { id: 'fluid',     name: '유체화',   desc: '3s 피해 50% 감소',               cooldown: 12000 },
    { id: 'overcharge',name: '과부하',   desc: '4s 데미지 2배',                  cooldown: 14000 },
    { id: 'parry',     name: '패링',     desc: '0.1s 후 피격 시 쿨타임 90% 감소 + 주변 탄 제거', cooldown: 5000  },
    { id: 'barrier',   name: '장벽',     desc: '0.6s 완전 피격 무효화',           cooldown: 10000 },
  ];

  // ─── Skins ───────────────────────────────────────────────────────
  const skins = [
    { color: '#ffe566', label: '기본', cost: 0,     skill: 'teleport'   },
    { color: '#66ff99', label: '초록', cost: 3000,  skill: 'barrier'    },
    { color: '#66ccff', label: '하늘', cost: 5000,  skill: 'fluid'      },
    { color: '#ff6699', label: '분홍', cost: 7000,  skill: 'parry'      },
    { color: '#cc66ff', label: '보라', cost: 10000, skill: 'overcharge' },
    { color: '#ff9944', label: '주황', cost: 14000, skill: 'parry'      },
    { color: '#ffffff', label: '백색', cost: 20000, skill: 'teleport'   },
  ];

  // ─── State variables ─────────────────────────────────────────────
  let bestScore    = parseInt(localStorage.getItem('best') || '0', 10);
  let selectedSkin = parseInt(localStorage.getItem('selectedSkin') || '0', 10);
  // selectedSkill is always derived from skins[selectedSkin].skill — not stored separately
  function getSelectedSkill() { return skins[selectedSkin].skill; }

  // skill cooldown state: map from skill id → remaining ms
  let skillCooldowns = {};
  // skill active timers: map from skill id → remaining ms
  let skillActiveMs  = {};

  let player;
  let bullets       = [];
  let playerBullets = [];
  let healthPacks   = [];
  let effects       = [];
  let bossCores     = [];   // water totem cores
  let fireZones     = [];   // fire hazard zones (with telegraph + active state)
  let earthWalls    = null;
  let windTelegraphs = [];
  let electricOrbs  = [];   // { x, y, vx, vy, alive }
  let windMinions   = [];   // { x, y, vx, vy, hp, maxHp, alive }
  let windSlowActive = false; // player speed debuff while wind boss is enraged
  let electricLinks = [];   // { a, b, life, maxLife } — visual arcs between orb pairs

  let score              = 0;
  let gameOver           = false;
  let isPaused           = false;
  let spawnIntervalMs    = NORMAL_SPAWN_START;
  let spawnTimerMs       = 0;
  let difficultyTimerMs  = 0;

  // Boss sequencing
  let bossKillCount      = 0;   // total bosses killed (determines cycle)
  let cycle1BossOrder    = [];  // shuffled order for first 5 (single types)
  let cycle2Queue        = [];  // 2-type combos: 10가지 순열을 shuffle 후 순서대로 소진
  let cycle3Queue        = [];  // 3-type combos: 10가지 순열을 shuffle 후 순서대로 소진
  let bossActive         = false;
  let boss               = null;
  let warningActive      = false;
  let warningElapsedMs   = 0;
  let pendingBossData    = null; // element data object to pass to Boss constructor
  let pendingBossLabel   = '';

  let lastBossScoreThreshold = 0; // last score multiple of 3000 that triggered a boss

  let lastHealthThreshold = 0;
  let lastMaxHpThreshold  = 0;
  let deletedHpPacks      = 0;

  let keys         = {};
  let lastTime     = 0;
  let mouseX       = canvas.width  / 2;
  let mouseY       = canvas.height / 2;
  let playerFireCooldownMs = 0;
  let isMouseDown   = false;  // 좌클릭 꾹 누르기 지속 발사용
  let isRightDown   = false;  // 우클릭 누르는 중 (점멸 미리보기용)

  // ─── 플레이어 누적 강화 스탯 ────────────────────────────────────
  // 보스 처치 시 누적, 게임 재시작 시 초기화
  let playerStats = {
    defense:   0,    // 방어율(%), 상한 50
    speedBonus:0,    // 이속 추가량, 상한 PLAYER_BASE_SPEED * 0.5
    fireCdBonus:0,   // 공속 감소량(ms 누적), 하한 적용은 firePlayerBullet에서
    dmgBonus:  0,    // 공격력 추가량
    hpBonus:   0,    // maxHp 추가량
  };
  let powerUpMs    = 0;
  let dashTrailMs  = 0;

  // parry-specific sub-state
  let parryWindowMs   = 0;  // > 0 while window is open (after 0.1s delay)
  let parryWindowUsed = false;

  let isSubmittingScore = false;
  let scoreSubmitted    = false;

  // 강화 토스트
  let statToast = null;  // { text, alpha, lifeMs, maxLifeMs }

  // ─── Utility ─────────────────────────────────────────────────────
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ─── 보스 처치 강화 추첨 ─────────────────────────────────────────
  const STAT_UPGRADES = [
    {
      id: 'defense',
      label: '방어력',
      canApply: () => playerStats.defense < 50,
      apply:    () => { playerStats.defense = Math.min(50, playerStats.defense + 10); },
      getValue: () => `+10% (총 ${playerStats.defense}%)`,
    },
    {
      id: 'speed',
      label: '이동속도',
      canApply: () => playerStats.speedBonus < PLAYER_BASE_SPEED * 0.5,
      apply:    () => { playerStats.speedBonus = Math.min(PLAYER_BASE_SPEED * 0.5, playerStats.speedBonus + 0.35); },
      getValue: () => `+이동속도`,
    },
    {
      id: 'firecd',
      label: '공격속도',
      canApply: () => playerStats.fireCdBonus < (PLAYER_FIRE_CD - 50),
      apply:    () => { playerStats.fireCdBonus = Math.min(PLAYER_FIRE_CD - 50, playerStats.fireCdBonus + 15); },
      getValue: () => `+공격속도`,
    },
    {
      id: 'dmg',
      label: '공격력',
      canApply: () => true,
      apply:    () => { playerStats.dmgBonus += 8; },
      getValue: () => `+공격력`,
    },
    {
      id: 'hp',
      label: '체력',
      canApply: () => true,
      apply:    () => {
        player.maxHp += 20;
        player.hp = Math.min(player.maxHp, player.hp + 20);
      },
      getValue: () => `+체력`,
    },
  ];

  function rollStatUpgrade() {
    // 한계치 초과 항목 제외 후 랜덤 선택, 최대 10회 재시도
    const available = STAT_UPGRADES.filter(s => s.canApply());
    if (available.length === 0) return; // 모든 스탯 만렙 (사실상 불가)
    const chosen = available[(Math.random() * available.length) | 0];
    chosen.apply();
    showStatToast(`+${chosen.label}`);
  }

  function showStatToast(text) {
    statToast = { text, alpha: 1.0, lifeMs: 1800, maxLifeMs: 1800 };
  }

  function updateStatToast(dt) {
    if (!statToast) return;
    statToast.lifeMs -= dt;
    // 마지막 600ms 동안 페이드 아웃
    if (statToast.lifeMs <= 600) {
      statToast.alpha = statToast.lifeMs / 600;
    }
    if (statToast.lifeMs <= 0) statToast = null;
  }

  function drawStatToast() {
    if (!statToast) return;
    ctx.save();
    ctx.globalAlpha = statToast.alpha;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 텍스트 그림자
    ctx.fillStyle = isLight() ? '#fff' : '#000';
    ctx.fillText(statToast.text, canvas.width/2 + 1, canvas.height/2 - 59);
    ctx.fillStyle = '#ffe566';
    ctx.fillText(statToast.text, canvas.width/2, canvas.height/2 - 60);
    ctx.restore();
  }

  // ─── Boss sequence helpers ────────────────────────────────────────

  // 5C2 = 10가지 2속성 조합 생성
  function allPairs() {
    const pairs = [];
    for (let i = 0; i < ALL_BOSS_TYPES.length; i++)
      for (let j = i+1; j < ALL_BOSS_TYPES.length; j++)
        pairs.push([ALL_BOSS_TYPES[i], ALL_BOSS_TYPES[j]]);
    return pairs; // 10개
  }

  // 5C3 = 10가지 3속성 조합 생성
  function allTriples() {
    const triples = [];
    for (let i = 0; i < ALL_BOSS_TYPES.length; i++)
      for (let j = i+1; j < ALL_BOSS_TYPES.length; j++)
        for (let k = j+1; k < ALL_BOSS_TYPES.length; k++)
          triples.push([ALL_BOSS_TYPES[i], ALL_BOSS_TYPES[j], ALL_BOSS_TYPES[k]]);
    return triples; // 10개
  }

  function getNextBossData() {
    // ── 1단계: 1~5번 (단일 속성, 중복 없는 순열) ──────────────────
    if (bossKillCount < 5) {
      if (cycle1BossOrder.length === 0)
        cycle1BossOrder = shuffle(ALL_BOSS_TYPES);
      const type = cycle1BossOrder[bossKillCount];
      const base = elementData[type];
      const data = {
        ...base,
        hybridTypes: null,
        isEarth:    type === 'earth',
        isElectric: type === 'electric',
        isWind:     type === 'wind',
        laserInterval: base.laserInterval ?? null,
      };
      return { data, label: base.name };
    }

    // ── 2단계: 6~15번 (2속성, 10조합 순열 소진) ───────────────────
    if (bossKillCount < 15) {
      if (cycle2Queue.length === 0)
        cycle2Queue = shuffle(allPairs());
      const [tA, tB] = cycle2Queue.shift();
      const data = makeHybridData(tA, tB);
      return { data, label: data.name };
    }

    // ── 3단계: 16번~ (3속성, 10조합 순열 소진 후 반복) ────────────
    if (cycle3Queue.length === 0)
      cycle3Queue = shuffle(allTriples());
    const triple = cycle3Queue.shift();
    const data = makeHybridData(...triple);
    return { data, label: data.name };
  }

  // ─── Skill UI ─────────────────────────────────────────────────────
  function updateSkillHud() {
    if (!skillHud) return;
    skillHud.innerHTML = '';
    const equippedId = getSelectedSkill();
    for (const skill of SKILLS) {
      const isEquipped = skill.id === equippedId;
      const cd    = skillCooldowns[skill.id] || 0;
      const ready = cd <= 0;
      const active = (skillActiveMs[skill.id] || 0) > 0;

      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '3px 7px',
        background: isEquipped ? 'rgba(127,211,255,0.12)' : 'rgba(17,17,17,0.85)',
        border: `1px solid ${active ? '#ffe566' : isEquipped ? (ready ? '#7fd3ff' : '#ffcf66') : '#333'}`,
        color: active ? '#ffe566' : isEquipped ? (ready ? '#dff6ff' : '#ffe8a3') : '#666',
        font: `${isEquipped ? 'bold' : 'normal'} 13px sans-serif`,
        minWidth: '200px', boxSizing: 'border-box',
        opacity: isEquipped ? '1' : '0.5',
      });

      // Skill name
      const nameSpan = document.createElement('span');
      nameSpan.style.flex = '1';
      nameSpan.textContent = (isEquipped ? '[F/우클릭] ' : '') + skill.name;
      row.appendChild(nameSpan);

      // Cooldown / status
      const cdSpan = document.createElement('span');
      cdSpan.style.fontSize = '11px';
      cdSpan.style.minWidth = '48px';
      cdSpan.style.textAlign = 'right';
      if (!isEquipped) {
        cdSpan.textContent = '';
      } else if (active) {
        cdSpan.textContent = '활성 ★';
      } else if (ready) {
        cdSpan.textContent = '준비';
      } else {
        cdSpan.textContent = (cd/1000).toFixed(1) + 's';
      }
      row.appendChild(cdSpan);

      skillHud.appendChild(row);
    }
  }

  function renderSkinButtons() {
    if (!skinsDiv) return;
    skinsDiv.innerHTML = '';
    skins.forEach((s, i) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;';

      const d = document.createElement('div');
      d.className = 'skin';
      d.style.background = s.color;
      const locked = bestScore < s.cost;
      if (locked) d.classList.add('locked');

      // Skill badge below skin swatch
      const badge = document.createElement('div');
      badge.style.cssText = `font:10px sans-serif;color:${locked?'#555':'#aaa'};text-align:center;`;
      const skillObj = SKILLS.find(sk => sk.id === s.skill);
      badge.textContent = skillObj ? skillObj.name : '';

      wrap.onclick = () => {
        if (!locked) {
          selectedSkin = i;
          localStorage.setItem('selectedSkin', String(i));
          // skill auto-equips from skin
          renderSkinButtons();
          renderSkillButtons();
        }
      };
      wrap.appendChild(d);
      wrap.appendChild(badge);
      skinsDiv.appendChild(wrap);
    });
    // Highlight selected
    const wraps = skinsDiv.querySelectorAll('.skin');
    wraps.forEach((el, i) => { el.style.borderColor = i === selectedSkin ? '#f00' : '#fff'; });
  }

  // Menu: read-only skill display — shows all 5, highlights the skin-locked one
  function renderSkillButtons() {
    if (!skillsDiv) return;
    skillsDiv.innerHTML = '';
    const equippedId = getSelectedSkill();
    for (const skill of SKILLS) {
      const btn = document.createElement('button');
      btn.className = 'skillBtn' + (skill.id === equippedId ? ' selected' : '');
      btn.style.opacity = skill.id === equippedId ? '1' : '0.45';
      btn.innerHTML = `<strong>${skill.name}</strong><small>${skill.desc} | CD: ${skill.cooldown/1000}s</small>`;
      btn.disabled = true;
      skillsDiv.appendChild(btn);
    }
  }

  renderSkinButtons();
  renderSkillButtons();
  if (bestSpan) bestSpan.textContent = bestScore;

  // ─── Classes ─────────────────────────────────────────────────────

  class Bullet {
    constructor(x, y, vx, vy, r, color, dmg, destructible = false, opts = {}) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.r = r;
      this.color = color;
      this.dmg = dmg;
      this.destructible = destructible;
      this.alive = true;
      this.lifeMs = opts.lifeMs ?? Infinity;
      this.linger  = opts.linger  ?? false;
      this.homing  = opts.homing  ?? 0;
      this.heavy   = opts.heavy   ?? false;
      this.bounces = opts.bounces ?? 0;  // remaining wall bounces (electric orbs use this)
    }
    update(dt) {
      if (this.homing > 0 && player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = Math.hypot(this.vx, this.vy) || 1;
        this.vx += ((dx/len)*spd - this.vx) * this.homing;
        this.vy += ((dy/len)*spd - this.vy) * this.homing;
      }
      this.x += this.vx * dt / FRAME_REF;
      this.y += this.vy * dt / FRAME_REF;
      this.lifeMs -= dt;
      if (this.lifeMs <= 0) this.alive = false;
    }
    inBounds() {
      const m = this.linger ? 80 : 50;
      return this.x >= -m && this.x <= canvas.width+m && this.y >= -m && this.y <= canvas.height+m;
    }
    draw() {
      ctx.save();
      // 라이트 모드에서 밝은 탄(흰/노랑 계열)은 어두운 색으로 반전
      ctx.fillStyle = isLight() ? darkenForLight(this.color) : this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fill();
      if (this.destructible) {
        ctx.lineWidth = 1.5; ctx.strokeStyle = getThemeFg(); ctx.stroke();
      }
      if (this.heavy) {
        ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.strokeStyle = getThemeFgA(0.2);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r+2, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  class PlayerBullet {
    constructor(x, y, vx, vy, dmg = PLAYER_BULLET_DMG) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.r = 3; this.dmg = dmg; this.alive = true;
    }
    update(dt) {
      this.x += this.vx * dt / FRAME_REF;
      this.y += this.vy * dt / FRAME_REF;
    }
    inBounds() {
      return this.x >= -20 && this.x <= canvas.width+20 && this.y >= -20 && this.y <= canvas.height+20;
    }
    draw() {
      // Increase damage indicator when overcharge is active
      const isOvercharge = (skillActiveMs['overcharge']||0) > 0;
      ctx.save();
      ctx.shadowBlur = isOvercharge ? 18 : 10;
      ctx.shadowColor = isOvercharge ? '#ffb0b0' : '#ccf';
      ctx.fillStyle   = isOvercharge ? '#ff8866' : '#ccf';
      ctx.beginPath();
      ctx.arc(this.x, this.y, isOvercharge ? 4.5 : 3, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  class HealthPack {
    constructor() {
      this.r = 7; this.color = '#ff66cc';
      let tries = 0;
      do {
        this.x = 60 + Math.random()*(canvas.width-120);
        this.y = 60 + Math.random()*(canvas.height-120);
        tries++;
      } while (tries < 20 && player && Math.hypot(this.x-player.x, this.y-player.y) < 120);
    }
    draw() {
      ctx.save(); ctx.translate(this.x, this.y); ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0,6); ctx.bezierCurveTo(10,-4,10,-14,0,-8); ctx.bezierCurveTo(-10,-14,-10,-4,0,6);
      ctx.fill(); ctx.restore();
    }
  }

  class BossCore {
    constructor(x, y, hits, color) {
      this.x = x; this.y = y;
      this.hits = hits;
      this.hp = hits * PLAYER_BULLET_DMG;
      this.maxHp = this.hp;
      this.size  = 14 + hits * 4;
      this.color = color;
      this.alive = true;
    }
    hit(dmg) {
      this.hp -= dmg;
      spawnHitEffect(this.x, this.y, this.color);
      if (this.hp <= 0) { this.alive = false; spawnShockwave(this.x, this.y, 40, this.color, 2); }
    }
    draw() {
      const ratio = Math.max(0, this.hp/this.maxHp);
      ctx.save(); ctx.translate(this.x, this.y);
      ctx.fillStyle = this.color; ctx.strokeStyle = getThemeFg(); ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0,-this.size); ctx.lineTo(this.size*0.8,0);
      ctx.lineTo(0,this.size); ctx.lineTo(-this.size*0.8,0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(0,0,0,${0.2+(1-ratio)*0.5})`;
      ctx.beginPath(); ctx.arc(0,0,this.size*0.32,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=getThemeFg(); ctx.font='11px sans-serif'; ctx.textAlign='center';
      ctx.fillText(String(this.hits), 0, 4);
      ctx.restore();
    }
  }

  // ─── Boss class ───────────────────────────────────────────────────
  class Boss {
    constructor(data) {
      this.data       = data;
      this.x          = canvas.width  / 2;
      this.y          = canvas.height / 2;
      this.baseX      = this.x;
      this.baseY      = this.y;
      this.size       = data.size;
      this.maxHp      = data.maxHp;
      this.hp         = this.maxHp;
      this.phase      = 'burst';
      this.moveAngle  = 0;
      this.fireTickMs = 0;
      this.burstQueue = 0;
      this.burstTickMs= 0;
      this.spawnHoldMs= 450;
      this.invulnMs   = 550;
      this.hitFlashMs = 0;

      // Water trait state
      this.waterHealUsed   = false;
      this.waterHealActive = false;
      this.waterHealTimerMs= 0;

      // Fire trait state
      this.fireHazardUsed = false;

      // Wind/laser trait state
      this.windTickMs       = 0;
      this.windEnraged      = false;  // true after HP drops to 50%
      this.windMinionSpawned= false;  // spawn only once

      // Electric trait state
      this.electricLinkTickMs = 0;

      // Earth wall init if trait present
      if (data.isEarth)    initEarthWalls();
      if (data.isElectric) initElectricOrbs();

      // 킬 수에 따라 burst 탄 수 증가: 매 3킬마다 +2발
      this.effectiveBurstCount = data.burstCount + Math.floor(bossKillCount / 3) * 2;
    }

    getRatio() { return this.hp / this.maxHp; }

    updatePhase() {
      const r = this.getRatio();
      const prev = this.phase;
      if      (r >= this.data.thresholds.burst)  this.phase = 'burst';
      else if (r >= this.data.thresholds.spiral) this.phase = 'spiral';
      else                                        this.phase = 'aimed';
      if (prev !== this.phase) spawnShockwave(this.x, this.y, 120, this.getPhaseColor(), 3);
    }

    getPhaseColor() {
      if (this.phase === 'burst')  return this.data.burst;
      if (this.phase === 'spiral') return this.data.spiral;
      return this.data.aimed;
    }

    hit(rawDmg) {
      if (this.invulnMs > 0) return;
      // Water totem invuln: boss is invuln while waterHealActive
      if (this.waterHealActive) return;

      // Wind boss: defense scales with living minion count (10% per minion)
      let defMult = this.data.defenseMultiplier;
      if (this.data.isWind) {
        if (!this.windMinionSpawned) {
          // 미니언 소환 전: 방어 없음 (defMult 1.0)
          defMult = 1.0;
        } else {
          // 소환 후: 마리당 방어율 20%, 받는 데미지 = rawDmg × (1 - 마리수×0.20)
          // 3마리=40% 데미지(60% 방어), 2마리=60%, 1마리=80%, 0마리=100%
          const living = windMinions.filter(m => m.alive).length;
          defMult = 1.0 - (living * 0.20);
        }
      }
      const actualDmg = rawDmg * defMult;
      this.hp -= actualDmg;
      this.hitFlashMs = 80;
      if (this.hp < 0) this.hp = 0;
      this.updatePhase();

      // Water heal trigger
      if (this.data.waterHealOnThreshold && !this.waterHealUsed && this.getRatio() <= this.data.waterHealOnThreshold) {
        this.startWaterHealing();
      }
      // Wind enrage trigger: HP 50% → spawn minions + speed changes
      if (this.data.isWind && !this.windMinionSpawned && this.getRatio() <= 0.5) {
        this.windMinionSpawned = true;
        this.windEnraged       = true;
        windSlowActive         = true;
        spawnWindMinions();
        spawnShockwave(this.x, this.y, 140, '#68ffb9', 3);
      }

      // Fire hazard trigger
      if (this.data.fireZoneOnThreshold && !this.fireHazardUsed && this.getRatio() <= this.data.fireZoneOnThreshold) {
        this.fireHazardUsed = true;
        scheduleFireZones();
        spawnShockwave(this.x, this.y, 120, '#ff6b3d', 3);
      }
    }

    startWaterHealing() {
      this.waterHealUsed   = true;
      this.waterHealActive = true;
      this.waterHealTimerMs= 4000;
      this.invulnMs        = 99999; // held until resolved
      this.x = canvas.width  / 2;
      this.y = canvas.height / 2;
      bossCores = [];
      const offs = [[-170,-110],[170,-110],[-170,110],[170,110]];
      const cfgs = [1, 2, 3, 4];
      offs.forEach(([ox,oy], i) => {
        bossCores.push(new BossCore(canvas.width/2+ox, canvas.height/2+oy, cfgs[i], '#8fe7ff'));
      });
      spawnShockwave(this.x, this.y, 100, '#8fe7ff', 2.5);
    }

    resolveWaterHealing() {
      const remain = bossCores.filter(c => c.alive).length;
      this.hp = Math.min(this.maxHp, this.hp + remain * this.maxHp * 0.07);
      this.waterHealActive = false;
      this.invulnMs = 0;
      bossCores = [];
      spawnShockwave(this.x, this.y, 140, '#8fe7ff', 3);
      this.updatePhase();
    }

    update(dt) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt;
      if (this.spawnHoldMs > 0) { this.spawnHoldMs -= dt; this.invulnMs -= dt; return; }
      if (this.invulnMs    > 0) this.invulnMs -= dt;

      if (this.waterHealActive) {
        this.waterHealTimerMs -= dt;
        if (this.waterHealTimerMs <= 0) this.resolveWaterHealing();
        return;
      }

      this.updatePhase();
      // Wind enrage: boost boss movement multiplier after trigger
      this._speedBoost = (this.data.isWind && this.windEnraged) ? 1.20 : 1.0;
      this.moveAngle  += dt / 1000;
      this.fireTickMs += dt;

      const hasLaser = this.data.laserInterval != null;
      if (hasLaser) {
        this.windTickMs += dt;
        if (this.windTickMs >= this.data.laserInterval) {
          this.windTickMs = 0;
          queueWindTelegraph(this);
        }
      }

      const hasElectric = this.data.isElectric;
      if (hasElectric) {
        this.electricLinkTickMs += dt;
        if (this.electricLinkTickMs >= ELECTRIC_LINK_INTERVAL) {
          this.electricLinkTickMs = 0;
          triggerElectricLinks();
        }
      }

      const bossDmg = player.maxHp / 15;

      if (this.phase === 'burst') {
        this.x = this.baseX + Math.cos(this.moveAngle * 0.6) * this.data.orbitRadius;
        this.y = this.baseY + Math.sin(this.moveAngle * 0.6) * this.data.orbitRadius;
        if (this.fireTickMs >= this.data.burstInterval) {
          this.fireTickMs = 0;
          for (let i = 0; i < this.effectiveBurstCount; i++) {
            const a = (Math.PI*2*i) / this.effectiveBurstCount;
            const dest = Math.random() < this.data.burstDestructRatio;
            bullets.push(new Bullet(this.x, this.y,
              Math.cos(a)*this.data.burstSpeed, Math.sin(a)*this.data.burstSpeed,
              5.5, this.data.burst, bossDmg, dest));
          }
        }

      } else if (this.phase === 'spiral') {
        const dx = player.x - this.x, dy = player.y - this.y;
        const len = Math.hypot(dx,dy) || 1;
        this.x += (dx/len)*this.data.chaseSpeed*(this._speedBoost||1)*dt/1000 + Math.sin(this.moveAngle*3)*30*dt/1000;
        this.y += (dy/len)*this.data.chaseSpeed*(this._speedBoost||1)*dt/1000 + Math.cos(this.moveAngle*2)*20*dt/1000;
        this.x = clamp(this.x, 80, canvas.width-80);
        this.y = clamp(this.y, 80, canvas.height-80);
        if (this.fireTickMs >= this.data.spiralInterval) {
          this.fireTickMs = 0;
          const a = (performance.now()/220) % (Math.PI*2);
          bullets.push(new Bullet(this.x,this.y, Math.cos(a)*this.data.spiralSpeed,   Math.sin(a)*this.data.spiralSpeed,   5.5, this.data.spiral, bossDmg));
          bullets.push(new Bullet(this.x,this.y, Math.cos(a+Math.PI)*this.data.spiralSpeed, Math.sin(a+Math.PI)*this.data.spiralSpeed, 5.5, this.data.spiral, bossDmg));
        }

      } else {
        // aimed phase
        const futX = player.x + ((keys['d']||keys['ArrowRight'])?50:0) - ((keys['a']||keys['ArrowLeft'])?50:0);
        const futY = player.y + ((keys['s']||keys['ArrowDown']) ?35:0) - ((keys['w']||keys['ArrowUp'])  ?35:0);
        const dx = futX - this.x, dy = futY - this.y;
        const len = Math.hypot(dx,dy) || 1;
        this.x += (dx/len)*this.data.zigSpeed*(this._speedBoost||1)*dt/1000 + Math.sin(this.moveAngle*5)*55*dt/1000;
        this.y += (dy/len)*this.data.zigSpeed*(this._speedBoost||1)*dt/1000 + Math.cos(this.moveAngle*4)*35*dt/1000;
        this.x = clamp(this.x, 80, canvas.width-80);
        this.y = clamp(this.y, 80, canvas.height-80);

        if (this.fireTickMs >= this.data.aimedInterval && this.burstQueue === 0) {
          this.fireTickMs = 0;
          this.burstQueue  = this.data.aimedShots;
          this.burstTickMs = 0;
        }
        if (this.burstQueue > 0) {
          this.burstTickMs += dt;
          if (this.burstTickMs >= this.data.aimedDelay) {
            this.burstTickMs = 0;
            this.burstQueue--;
            const ax = player.x - this.x, ay = player.y - this.y;
            const al = Math.hypot(ax,ay) || 1;
            const shotIdx = this.data.aimedShots - this.burstQueue;
            const spread = (shotIdx - (this.data.aimedShots+1)/2) * 0.09;
            const ang = Math.atan2(ay,ax) + spread;
            bullets.push(new Bullet(this.x,this.y,
              Math.cos(ang)*this.data.aimedSpeed, Math.sin(ang)*this.data.aimedSpeed,
              6, this.data.aimed, bossDmg, false, { homing: this.data.homing }));
          }
        }
      }
    }

    draw() {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.moveAngle);
      ctx.fillStyle   = this.hitFlashMs > 0 ? getThemeFg() : this.getPhaseColor();
      ctx.strokeStyle = this.data.border;
      ctx.lineWidth   = 3;
      const s = this.size;
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.strokeRect(-s/2, -s/2, s, s);
      // Earth: subtle armor pattern
      if (this.data.isEarth) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = getThemeFg();
        ctx.lineWidth = 1;
        ctx.strokeRect(-s/2+4, -s/2+4, s-8, s-8);
      }
      ctx.restore();
    }
  }

  // ─── Fire hazard (telegraph + zone) ──────────────────────────────
  // Telegraph appears first (orange outline), then activates after FIRE_WARN_DURATION ms
  function scheduleFireZones() {
    fireZones = [];
    const cols = 2, rows = 2;
    const cellW = canvas.width / cols, cellH = canvas.height / rows;
    const mx = cellW*0.12, my = cellH*0.12;
    const candidates = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        candidates.push({ x: c*cellW+mx, y: r*cellH+my, w: cellW-mx*2, h: cellH-my*2 });

    for (let i = 0; i < 2; i++) {
      const idx = (Math.random()*candidates.length)|0;
      const zone = candidates.splice(idx,1)[0];
      fireZones.push({
        ...zone,
        // telegraph phase: not yet active
        telegraphMs: FIRE_WARN_DURATION,
        active: false,
        life: 4500, maxLife: 4500, tickMs: 0,
      });
    }
  }

  function updateFireHazards(dt) {
    for (const zone of fireZones) {
      if (!zone.active) {
        zone.telegraphMs -= dt;
        if (zone.telegraphMs <= 0) zone.active = true;
        continue;
      }
      zone.life -= dt;
      if (player.x > zone.x && player.x < zone.x+zone.w &&
          player.y > zone.y && player.y < zone.y+zone.h) {
        zone.tickMs -= dt;
        if (zone.tickMs <= 0) {
          applyPlayerHit(Math.max(1.4, player.maxHp/40), zone.x + zone.w/2, zone.y + zone.h/2);
          zone.tickMs = 350;
        }
      } else if (zone.tickMs < 0) zone.tickMs = 0;
    }
    fireZones = fireZones.filter(z => z.life > 0);
  }

  function drawFireHazards() {
    for (const zone of fireZones) {
      ctx.save();
      if (!zone.active) {
        // Telegraph: pulsing orange outline only
        const pulse = 0.4 + 0.5 * Math.sin(performance.now()/100);
        ctx.globalAlpha = pulse * 0.9;
        ctx.strokeStyle = '#ff9b54';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
        ctx.setLineDash([]);
        ctx.globalAlpha = pulse * 0.25;
        ctx.fillStyle = '#ff6b3d';
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      } else {
        const alpha = Math.max(0.18, zone.life/zone.maxLife * 0.45);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#b73112';
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
        ctx.globalAlpha = alpha+0.12;
        ctx.strokeStyle = '#ff9b54'; ctx.lineWidth = 2;
        ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
        for (let i = 0; i < 6; i++) {
          const fx = zone.x + 25 + i*((zone.w-50)/5);
          const fy = zone.y + zone.h*(0.3+0.35*((i%2)?1:0.6));
          ctx.beginPath(); ctx.arc(fx,fy,8+(i%3),0,Math.PI*2);
          ctx.fillStyle = i%2 ? '#ff6b3d' : '#ffb35c'; ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ─── Earth walls ──────────────────────────────────────────────────
  function initEarthWalls() {
    earthWalls = { left: 0, right: 0, corridorMin: 220 };
  }

  function updateEarthWalls(dt) {
    if (!earthWalls || !bossActive || !boss) return;
    if (!boss.data.isEarth) return;
    const ratio = boss.getRatio();
    const spd = 10 + (1 - ratio) * 24;
    const maxW = (canvas.width - earthWalls.corridorMin) / 2;
    earthWalls.left  = Math.min(maxW, earthWalls.left  + spd*dt/1000);
    earthWalls.right = Math.min(maxW, earthWalls.right + spd*dt/1000);
    if (player.x - player.r < earthWalls.left) {
      player.x = earthWalls.left + player.r;
      applyPlayerHit(Math.max(1.8, player.maxHp/28)*dt/220, player.x, player.y);
    }
    if (player.x + player.r > canvas.width - earthWalls.right) {
      player.x = canvas.width - earthWalls.right - player.r;
      applyPlayerHit(Math.max(1.8, player.maxHp/28)*dt/220, player.x, player.y);
    }
  }

  function drawEarthWalls() {
    if (!earthWalls) return;
    ctx.save();
    ctx.fillStyle = 'rgba(106,77,36,0.72)';
    ctx.fillRect(0, 0, earthWalls.left, canvas.height);
    ctx.fillRect(canvas.width-earthWalls.right, 0, earthWalls.right, canvas.height);
    ctx.strokeStyle = 'rgba(225,187,125,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(earthWalls.left,0); ctx.lineTo(earthWalls.left,canvas.height);
    ctx.moveTo(canvas.width-earthWalls.right,0); ctx.lineTo(canvas.width-earthWalls.right,canvas.height);
    ctx.stroke(); ctx.restore();
  }

  // ─── Wind laser telegraph ─────────────────────────────────────────
  function queueWindTelegraph(bossRef) {
    if (!bossActive || !boss) return;
    const ang = Math.atan2(player.y - bossRef.y, player.x - bossRef.x);
    const len = 1800;
    windTelegraphs.push({
      x1: bossRef.x, y1: bossRef.y,
      x2: bossRef.x + Math.cos(ang)*len,
      y2: bossRef.y + Math.sin(ang)*len,
      ang, delayMs: 500, life: 700, maxLife: 700, fired: false,
    });
  }

  function updateWindTelegraphs(dt) {
    for (const t of windTelegraphs) {
      t.delayMs -= dt; t.life -= dt;
      if (!t.fired && t.delayMs <= 0) {
        t.fired = true;
        const bossDmg = player.maxHp / 30;
        // Laser: multiple bullets along direction for "beam" feel
        for (let i = 0; i < 4; i++) {
          bullets.push(new Bullet(boss.x, boss.y,
            Math.cos(t.ang)*12.5, Math.sin(t.ang)*12.5,
            4.5, '#d6fff8', bossDmg, false, { lifeMs: 600 + i*40 }));
        }
      }
    }
    windTelegraphs = windTelegraphs.filter(t => t.life > 0);
  }

  function drawWindTelegraphs() {
    for (const t of windTelegraphs) {
      const alpha = t.fired ? 0.12 : 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#d6fff8'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(t.x1,t.y1); ctx.lineTo(t.x2,t.y2); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#7fffd4';
      ctx.beginPath(); ctx.moveTo(t.x1,t.y1); ctx.lineTo(t.x2,t.y2); ctx.stroke();
      ctx.restore();
    }
  }

  // ─── Wind minions ────────────────────────────────────────────────
  // 5마리 소환. 각자 HP와 공격력 보유.
  // 보스 방어율 = 살아있는 미니언 수 × 10% (boss.hit()에서 처리)
  function spawnWindMinions() {
    windMinions = [];
    const bossDmg = player.maxHp / 20;
    // 5마리를 보스 주변 원형 배치
    for (let i = 0; i < 3; i++) {
      const ang = (Math.PI * 2 * i) / 3;
      const dist = 140;
      windMinions.push({
        x:    boss.x + Math.cos(ang) * dist,
        y:    boss.y + Math.sin(ang) * dist,
        vx:   Math.cos(ang + Math.PI/2) * 1.8,  // 초기 선회 속도
        vy:   Math.sin(ang + Math.PI/2) * 1.8,
        hp:   120,
        maxHp: 120,
        atk:  bossDmg,
        r:    12,
        fireTickMs: 800 + i * 200,  // 스폰 즉시 일제 발사 방지
        alive: true,
        orbitAngle: ang,
      });
    }
  }

  function updateWindMinions(dt) {
    if (!bossActive || !boss || !boss.data.isWind) return;
    const bossDmg = player.maxHp / 20;

    for (const m of windMinions) {
      if (!m.alive) continue;

      // 보스 주변 궤도 이동 (보스가 움직이면 따라감)
      m.orbitAngle += dt / 1200;
      const orbitDist = 120 + Math.sin(m.orbitAngle * 0.7) * 25;
      const targetX = boss.x + Math.cos(m.orbitAngle) * orbitDist;
      const targetY = boss.y + Math.sin(m.orbitAngle) * orbitDist;
      m.x += (targetX - m.x) * 0.06;
      m.y += (targetY - m.y) * 0.06;

      // 플레이어에게 조준 발사
      m.fireTickMs -= dt;
      if (m.fireTickMs <= 0) {
        m.fireTickMs = 1400;
        const dx = player.x - m.x, dy = player.y - m.y;
        const len = Math.hypot(dx, dy) || 1;
        bullets.push(new Bullet(
          m.x, m.y, (dx/len)*3.2, (dy/len)*3.2,
          5, '#9ffff1', m.atk, false
        ));
      }

      // 플레이어 접촉 데미지
      if (Math.hypot(m.x - player.x, m.y - player.y) < m.r + player.r) {
        applyPlayerHit(m.atk * 0.08 * dt / FRAME_REF, m.x, m.y);
      }
    }

    // 플레이어 탄 vs 미니언 충돌
    for (const pb of playerBullets) {
      if (!pb.alive) continue;
      for (const m of windMinions) {
        if (!m.alive) continue;
        if (Math.hypot(pb.x - m.x, pb.y - m.y) < pb.r + m.r) {
          m.hp -= pb.dmg;
          pb.alive = false;
          spawnHitEffect(m.x, m.y, '#68ffb9');
          if (m.hp <= 0) {
            m.alive = false;
            spawnShockwave(m.x, m.y, 40, '#68ffb9', 2);
          }
          break;
        }
      }
    }

    // 전원 사망 시 이속 디버프 해제
    if (windSlowActive && windMinions.every(m => !m.alive)) {
      windSlowActive = false;
    }
  }

  function drawWindMinions() {
    for (const m of windMinions) {
      if (!m.alive) continue;
      const ratio = m.hp / m.maxHp;
      ctx.save();
      ctx.translate(m.x, m.y);
      // 삼각형 몸체
      ctx.fillStyle = '#68ffb9';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(0, -m.r);
      ctx.lineTo(m.r * 0.87, m.r * 0.5);
      ctx.lineTo(-m.r * 0.87, m.r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d6fff8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // HP 바
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#333';
      ctx.fillRect(-m.r, m.r + 3, m.r * 2, 4);
      ctx.fillStyle = ratio > 0.5 ? '#68ffb9' : '#ff9944';
      ctx.fillRect(-m.r, m.r + 3, m.r * 2 * ratio, 4);
      ctx.restore();
    }
  }

  // ─── Electric orbs ────────────────────────────────────────────────
  function initElectricOrbs() {
    electricOrbs = [];
    electricLinks = [];
    for (let i = 0; i < ELECTRIC_BALL_COUNT; i++) {
      const margin = 60;
      const x = margin + Math.random() * (canvas.width  - margin*2);
      const y = margin + Math.random() * (canvas.height - margin*2);
      const spd = 1.8 + Math.random() * 1.2;
      const ang = Math.random() * Math.PI * 2;
      electricOrbs.push({
        x, y, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        r: 8, alive: true,
      });
    }
  }

  function updateElectricOrbs(dt) {
    if (!bossActive || !boss || !boss.data.isElectric) return;
    const bossDmg = player.maxHp / 18;
    for (const orb of electricOrbs) {
      if (!orb.alive) continue;
      orb.x += orb.vx * dt / FRAME_REF;
      orb.y += orb.vy * dt / FRAME_REF;
      // Wall bounce
      if (orb.x - orb.r <= 0)                   { orb.vx =  Math.abs(orb.vx); spawnHitEffect(orb.x, orb.y, '#ffe566'); }
      if (orb.x + orb.r >= canvas.width)         { orb.vx = -Math.abs(orb.vx); spawnHitEffect(orb.x, orb.y, '#ffe566'); }
      if (orb.y - orb.r <= 0)                    { orb.vy =  Math.abs(orb.vy); spawnHitEffect(orb.x, orb.y, '#ffe566'); }
      if (orb.y + orb.r >= canvas.height)        { orb.vy = -Math.abs(orb.vy); spawnHitEffect(orb.x, orb.y, '#ffe566'); }
      // Player contact
      if (Math.hypot(orb.x - player.x, orb.y - player.y) < orb.r + player.r) {
        applyPlayerHit(bossDmg, orb.x, orb.y);
        spawnShockwave(orb.x, orb.y, 30, '#ffe566', 1.5);
      }
    }
    // Player bullets can destroy orbs
    for (const pb of playerBullets) {
      if (!pb.alive) continue;
      for (const orb of electricOrbs) {
        if (!orb.alive) continue;
        if (Math.hypot(pb.x - orb.x, pb.y - orb.y) < pb.r + orb.r) {
          orb.alive = false;
          pb.alive = false;
          spawnShockwave(orb.x, orb.y, 30, '#ffe566', 2);
        }
      }
    }
    // Update link lifetimes
    electricLinks = electricLinks.filter(l => { l.life -= dt; return l.life > 0; });
  }

  // Trigger: connect each alive orb to its two nearest neighbours with a damaging arc
  function triggerElectricLinks() {
    const alive = electricOrbs.filter(o => o.alive);
    if (alive.length < 2) return;
    const bossDmg = player.maxHp / 22;
    const linkDuration = 1200; // ms
    const newLinks = [];

    for (const orb of alive) {
      // Sort other orbs by distance, take nearest 2
      const others = alive
        .filter(o => o !== orb)
        .sort((a, b) => Math.hypot(a.x-orb.x,a.y-orb.y) - Math.hypot(b.x-orb.x,b.y-orb.y))
        .slice(0, 2);
      for (const other of others) {
        // Avoid duplicate pairs
        const exists = newLinks.some(l => (l.a===orb&&l.b===other)||(l.a===other&&l.b===orb));
        if (!exists) newLinks.push({ a: orb, b: other, life: linkDuration, maxLife: linkDuration });
      }
    }

    electricLinks.push(...newLinks);

    // Check if player is intersected by any link segment
    for (const link of newLinks) {
      if (segmentCircleIntersect(link.a.x,link.a.y, link.b.x,link.b.y, player.x,player.y, player.r+6)) {
        applyPlayerHit(bossDmg, (link.a.x+link.b.x)/2, (link.a.y+link.b.y)/2);
        spawnShockwave(player.x, player.y, 40, '#ffe566', 2);
      }
    }
  }

  // Point-to-segment distance for electric link collision
  function segmentCircleIntersect(x1,y1,x2,y2,cx,cy,cr) {
    const dx = x2-x1, dy = y2-y1;
    const len2 = dx*dx+dy*dy;
    if (len2 === 0) return Math.hypot(cx-x1,cy-y1) < cr;
    const t = clamp(((cx-x1)*dx+(cy-y1)*dy)/len2, 0, 1);
    const px = x1+t*dx, py = y1+t*dy;
    return Math.hypot(cx-px,cy-py) < cr;
  }

  function drawElectricOrbs() {
    // Links first (behind orbs)
    for (const link of electricLinks) {
      const alpha = Math.max(0, link.life/link.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = '#ffe566';
      ctx.lineWidth = 2 + alpha * 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ffe566';
      ctx.beginPath();
      ctx.moveTo(link.a.x, link.a.y);
      ctx.lineTo(link.b.x, link.b.y);
      ctx.stroke();
      ctx.restore();
    }
    // Orbs
    for (const orb of electricOrbs) {
      if (!orb.alive) continue;
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ffe566';
      ctx.fillStyle = '#fff8c0';
      ctx.strokeStyle = '#ffe566';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ─── Player bullet fire ───────────────────────────────────────────
  function firePlayerBullet(tx, ty) {
    if (playerFireCooldownMs > 0 || !player || gameOver) return;
    const dx = tx - player.x, dy = ty - player.y;
    const len = Math.hypot(dx,dy) || 1;
    const spd = 8.5;
    const baseDmg = PLAYER_BULLET_DMG + playerStats.dmgBonus;
    const dmg = (skillActiveMs['overcharge']||0) > 0 ? baseDmg * 2 : baseDmg;
    playerBullets.push(new PlayerBullet(player.x, player.y, (dx/len)*spd, (dy/len)*spd, dmg));
    // 공속 보너스 반영 (하한 50ms)
    const baseCD = (powerUpMs > 0) ? POWERUP_FIRE_CD : PLAYER_FIRE_CD;
    playerFireCooldownMs = Math.max(50, baseCD - playerStats.fireCdBonus);
  }

  // ─── Normal bullet spawn ──────────────────────────────────────────
  function spawnNormalBullets() {
    const edge = (Math.random()*4)|0;
    let x, y;
    if      (edge===0) { x = Math.random()*canvas.width; y = -10; }
    else if (edge===1) { x = canvas.width+10; y = Math.random()*canvas.height; }
    else if (edge===2) { x = Math.random()*canvas.width; y = canvas.height+10; }
    else               { x = -10; y = Math.random()*canvas.height; }
    const dx = player.x-x, dy = player.y-y;
    const len = Math.hypot(dx,dy) || 1;
    const spd = 3 + score/5000;
    const dest = Math.random() < 0.25;

    // 보스를 잡을수록 탄 수 증가: 매 5킬마다 1발 추가, 최대 5발
    const extraShots = Math.min(4, Math.floor(bossKillCount / 5));
    const spread = 0.12; // 추가 탄 간격 (rad)
    const baseAng = Math.atan2(dy, dx);
    for (let i = 0; i <= extraShots; i++) {
      const offset = (i - extraShots/2) * spread;
      const ang = baseAng + offset;
      bullets.push(new Bullet(
        x, y,
        Math.cos(ang)*spd, Math.sin(ang)*spd,
        5, dest ? (isLight() ? '#080' : '#3f3') : '#f00', player.maxHp/15, dest
      ));
    }
  }

  // ─── Boss spawn scheduling ────────────────────────────────────────
  function maybeSpawnBoss() {
    if (bossActive || warningActive) return;
    const threshold = (Math.floor(score / BOSS_SCORE_INTERVAL)) * BOSS_SCORE_INTERVAL;
    if (threshold > 0 && threshold > lastBossScoreThreshold) {
      lastBossScoreThreshold = threshold;
      const next = getNextBossData();
      pendingBossData  = next.data;
      pendingBossLabel = next.label;
      deletedHpPacks   = healthPacks.length;
      healthPacks.length = 0;
      warningActive    = true;
      warningElapsedMs = 0;
      if (warningDiv) {
        warningDiv.textContent = `⚠ ${pendingBossLabel} 출현 ⚠`;
        warningDiv.style.display = 'block';
      }
    }
  }

  // ─── Skill execution ──────────────────────────────────────────────
  function useSkill(skillId) {
    if (gameOver) return;
    const skill = SKILLS.find(s => s.id === skillId);
    if (!skill) return;
    const cd = skillCooldowns[skillId] || 0;
    if (cd > 0) return;
    skillCooldowns[skillId] = skill.cooldown;

    if (skillId === 'teleport') {
      const TELEPORT_RANGE = 220;
      const dx = mouseX - player.x, dy = mouseY - player.y;
      const mouseDist = Math.hypot(dx, dy) || 1;
      // 사거리 내면 마우스 위치로, 밖이면 방향만 따라 최대 사거리까지
      const actualDist = Math.min(mouseDist, TELEPORT_RANGE);
      const nx = dx / mouseDist, ny = dy / mouseDist;
      player.x = clamp(player.x + nx * actualDist, player.r, canvas.width  - player.r);
      player.y = clamp(player.y + ny * actualDist, player.r, canvas.height - player.r);
      dashTrailMs = 200;
      spawnShockwave(player.x, player.y, 50, '#9ff', 1.5);
      return;
    }

    if (skillId === 'fluid') {
      skillActiveMs['fluid'] = 3000;
      return;
    }

    if (skillId === 'overcharge') {
      skillActiveMs['overcharge'] = 4000;
      return;
    }

    if (skillId === 'parry') {
      // Window opens after PARRY_WINDOW_START ms (0.1s delay mechanic)
      // parryWindowMs counts DOWN from a max, window is open between PARRY_WINDOW_START and PARRY_WINDOW_END
      skillActiveMs['parry'] = PARRY_WINDOW_END + 50; // visual duration slightly longer than window
      parryWindowMs   = PARRY_WINDOW_END;
      parryWindowUsed = false;
      return;
    }

    if (skillId === 'barrier') {
      skillActiveMs['barrier'] = 600;
      return;
    }
  }

  // ─── Centralised player hit handler ──────────────────────────────
  // Checks all active damage mitigations before applying HP loss
  function applyPlayerHit(dmg, srcX, srcY) {
    // Barrier: full block
    if ((skillActiveMs['barrier']||0) > 0) {
      skillActiveMs['barrier'] = 0; // consumed
      spawnShockwave(player.x, player.y, 40, '#ccf', 2);
      return;
    }
    // Parry window: time-gated parry check
    // Window is OPEN when parryWindowMs is between (PARRY_WINDOW_END - elapsed > PARRY_WINDOW_START)
    // We track it by storing the time since cast inside skillActiveMs['parry']
    if ((skillActiveMs['parry']||0) > 0 && !parryWindowUsed) {
      const elapsed = PARRY_WINDOW_END - parryWindowMs;
      if (elapsed >= PARRY_WINDOW_START && elapsed <= PARRY_WINDOW_END) {
        // Perfect parry
        parryWindowUsed = true;
        const reducedCd = SKILLS.find(s=>s.id==='parry').cooldown * (1 - PARRY_CD_REDUCTION);
        skillCooldowns['parry'] = reducedCd;

        // 반경 180px 이내 적 탄 전부 제거
        const PARRY_CLEAR_R = 180;
        bullets = bullets.filter(b => {
          const dist = Math.hypot(b.x - player.x, b.y - player.y);
          return dist > PARRY_CLEAR_R;
        });

        // 시각 효과: 쇼크웨이브 2개 (내부 + 외부)
        spawnShockwave(player.x, player.y, PARRY_CLEAR_R, '#ffe566', 4);
        spawnShockwave(player.x, player.y, 55, '#ffffff', 3);
        spawnHitEffect(player.x, player.y, '#ffe566');
        return;
      }
    }
    // Fluid: 50% reduction
    const fluidMult = (skillActiveMs['fluid']||0) > 0 ? 0.5 : 1.0;
    // 플레이어 방어율 적용 (playerStats.defense %)
    const defMult = 1.0 - (playerStats.defense / 100);
    player.hp -= dmg * fluidMult * defMult;
    spawnHitEffect(srcX ?? player.x, srcY ?? player.y, '#f88');
  }

  // ─── Effect helpers ───────────────────────────────────────────────
  function spawnHitEffect(x, y, color='#afffaf') {
    const life = 150;
    effects.push({ type:'ring', x,y, color, life, maxLife:life, radius:12 });
    for (let i=0;i<4;i++) {
      const a=Math.random()*Math.PI*2, spd=1.5+Math.random()*1.5;
      effects.push({ type:'particle', x,y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, color:'#fff', life, maxLife:life });
    }
  }

  function spawnShockwave(x,y,radius,color,lineWidth=2,damagesPlayer=false) {
    effects.push({ type:'shockwave', x,y, radius, maxRadius:radius, color, lineWidth, damagesPlayer, applied:false, life:320, maxLife:320 });
  }

  // ─── HP / Score UI ────────────────────────────────────────────────
  function updateHpBar() {
    if (!hpBarDiv || !player) return;
    const pct = Math.max(0, player.hp) / player.maxHp;
    hpBarDiv.style.width = `${200 * clamp(pct,0,1)}px`;
    hpText.textContent = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
  }

  function updateBossHpBar() {
    if (!bossHpFill || !boss) return;
    bossHpFill.style.width = `${240 * clamp(boss.hp/boss.maxHp,0,1)}px`;
  }

  // ─── Firebase ────────────────────────────────────────────────────
  async function loadBestScores(n=10) {
    const q = query(collection(db,'bestScores'), orderBy('score','desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map(d=>d.data());
  }

  function renderBoardEntries(entries) {
    if (!boardList) return;
    boardList.innerHTML = entries.length
      ? entries.map((e,i)=>`<li>${i+1}위 — ${e.name||'익명'}: ${e.score}점</li>`).join('')
      : '<li>기록이 없습니다.</li>';
  }

  // ─── Game init / over ─────────────────────────────────────────────
  function initGame() {
    player = {
      x: canvas.width*0.25, y: canvas.height*0.5,
      r: 7, speed: PLAYER_BASE_SPEED,
      hp: 100, maxHp: 100,
      color: skins[selectedSkin].color,
    };
    bullets=[];playerBullets=[];healthPacks=[];effects=[];
    bossCores=[];fireZones=[];earthWalls=null;windTelegraphs=[];
    electricOrbs=[];electricLinks=[];
    windMinions=[];windSlowActive=false;
    score=0;gameOver=false;isPaused=false;
    if (pauseScreen) pauseScreen.style.display='none';
    spawnIntervalMs=NORMAL_SPAWN_START;spawnTimerMs=0;difficultyTimerMs=0;
    bossKillCount=0;cycle1BossOrder=[];cycle2Queue=[];cycle3Queue=[];
    bossActive=false;boss=null;
    warningActive=false;warningElapsedMs=0;
    pendingBossData=null;pendingBossLabel='';
    lastBossScoreThreshold=0;
    lastHealthThreshold=0;lastMaxHpThreshold=0;deletedHpPacks=0;
    playerFireCooldownMs=0;powerUpMs=0;dashTrailMs=0;isMouseDown=false;isRightDown=false;
    playerStats={defense:0,speedBonus:0,fireCdBonus:0,dmgBonus:0,hpBonus:0};
    statToast=null;
    skillCooldowns={};skillActiveMs={};
    parryWindowMs=0;parryWindowUsed=false;
    isSubmittingScore=false;scoreSubmitted=false;

    if (menu)           menu.style.display='none';
    if (ui)             ui.style.display='block';
    canvas.style.display='block';
    if (warningDiv)     warningDiv.style.display='none';
    if (gameOverScreen) gameOverScreen.style.display='none';
    if (bossUi)         bossUi.style.display='none';
    if (submitBtn)      { submitBtn.disabled=false; submitBtn.textContent='점수 제출'; }
    renderSkillButtons();
    updateHpBar();
    if (scoreSpan) scoreSpan.textContent='0';
    if (bossHpFill) bossHpFill.style.width='240px';
    lastTime=performance.now();
  }

  function doGameOver() {
    gameOver=true;
    if (gameOverScreen) gameOverScreen.style.display='flex';
    if (finalScoreSpan) finalScoreSpan.textContent=String(score|0);
    if (submitBtn) { submitBtn.disabled=false; submitBtn.textContent='점수 제출'; }
    loadBestScores(10).then(renderBoardEntries).catch(err=>{ if(boardList) boardList.innerHTML=`<li>불러오기 실패: ${err?.message||err}</li>`; });
    if (score > bestScore) {
      bestScore = score|0;
      localStorage.setItem('best', String(bestScore));
      if (bestSpan) bestSpan.textContent=String(bestScore);
    }
  }

  async function handleSubmit() {
    if (!gameOver||isSubmittingScore||scoreSubmitted) return;
    let name = localStorage.getItem('nickname');
    if (!name) {
      name = prompt('이름 입력 (한글 1~4자)');
      if (!name) return;
      name = name.trim();
      if (!/^[가-힣]{1,4}$/.test(name)) { alert('이름은 한글 1~4자만'); return; }
      localStorage.setItem('nickname', name);
    }
    const nameKey = (name||'').trim().toLowerCase();
    if (!nameKey) { alert('이름이 비어 있습니다.'); return; }
    isSubmittingScore=true;
    if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='제출 중...'; }
    try {
      const sv = score|0;
      const ref = doc(db,'bestScores',nameKey);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref,{name,nameKey,score:sv,updatedAt:serverTimestamp()});
      } else {
        if (sv > Number(snap.data().score??0))
          await setDoc(ref,{name,nameKey,score:sv,updatedAt:serverTimestamp()});
      }
      const entries = await loadBestScores(10);
      renderBoardEntries(entries);
      scoreSubmitted=true;
      if (submitBtn) { submitBtn.disabled=true; submitBtn.textContent='제출 완료'; }
    } catch(err) {
      console.error(err); alert(`저장 실패: ${err?.message||err}`);
      if (submitBtn&&!scoreSubmitted) { submitBtn.disabled=false; submitBtn.textContent='점수 제출'; }
    } finally { isSubmittingScore=false; }
  }

  // ─── Main update ─────────────────────────────────────────────────
  function update(dt) {
    if (gameOver) return;

    // Skill cooldowns tick
    for (const skill of SKILLS) {
      if (skillCooldowns[skill.id] > 0) skillCooldowns[skill.id] = Math.max(0, skillCooldowns[skill.id]-dt);
      if (skillActiveMs[skill.id]  > 0) skillActiveMs[skill.id]  = Math.max(0, skillActiveMs[skill.id] -dt);
    }

    // Parry window tracking
    if (parryWindowMs > 0) parryWindowMs = Math.max(0, parryWindowMs - dt);

    if (powerUpMs > 0) powerUpMs -= dt;
    if (playerFireCooldownMs > 0) playerFireCooldownMs -= dt;
    if (dashTrailMs > 0) dashTrailMs -= dt;

    // Player movement
    const windDebuff = windSlowActive ? 0.65 : 1.0;
    const speedMult = (powerUpMs > 0 ? POWERUP_SPEED_MULT : 1) * windDebuff;
    // 이속 보너스: player.speed(기본값) + speedBonus 적용
    const effectiveSpeed = (PLAYER_BASE_SPEED + playerStats.speedBonus) * speedMult;
    const move = effectiveSpeed * dt / FRAME_REF;
    if (keys['ArrowLeft'] ||keys['a']) player.x -= move;
    if (keys['ArrowRight']||keys['d']) player.x += move;
    if (keys['ArrowUp']   ||keys['w']) player.y -= move;
    if (keys['ArrowDown'] ||keys['s']) player.y += move;
    player.x = clamp(player.x, player.r, canvas.width -player.r);
    player.y = clamp(player.y, player.r, canvas.height-player.r);

    if (keys[' '] || isMouseDown) firePlayerBullet(mouseX, mouseY);

    // Normal bullet spawner (only outside boss fights)
    spawnTimerMs += dt;
    if (!warningActive && !bossActive && spawnTimerMs >= spawnIntervalMs) {
      spawnTimerMs -= spawnIntervalMs;
      spawnNormalBullets();
    }
    difficultyTimerMs += dt;
    if (difficultyTimerMs >= 5000) {
      difficultyTimerMs -= 5000;
      spawnIntervalMs = Math.max(NORMAL_SPAWN_MIN, spawnIntervalMs-50);
    }

    // Health pack spawning (every 500 score outside boss)
    const healThr = ((score|0)/500)|0;
    if (!warningActive && !bossActive && healThr > lastHealthThreshold) {
      lastHealthThreshold = healThr;
      healthPacks.push(new HealthPack());
    }

    // Max HP scaling
    const hpThr = ((score|0)/2000)|0;
    if (hpThr > lastMaxHpThreshold) {
      lastMaxHpThreshold = hpThr;
      const inc = player.maxHp/15;
      player.maxHp += inc; player.hp += inc;
    }

    maybeSpawnBoss();

    // Warning → boss transition
    if (warningActive) {
      warningElapsedMs += dt;
      if (warningElapsedMs >= WARNING_DURATION) {
        warningActive = false;
        if (warningDiv) warningDiv.style.display='none';
        bossActive = true;
        boss = new Boss(pendingBossData);
        if (bossUi) bossUi.style.display='block';
      }
    }

    if (bossActive && boss) {
      boss.update(dt);
      // Boss body contact
      if (Math.abs(player.x-boss.x) <= boss.size/2+player.r &&
          Math.abs(player.y-boss.y) <= boss.size/2+player.r) {
        applyPlayerHit((player.maxHp/15)*0.15*dt/FRAME_REF, boss.x, boss.y);
      }
      if (boss.hp <= 0) {
        score += BOSS_KILL_BONUS;
        bossKillCount++;
        const recovered = Math.min(deletedHpPacks*2, 10);
        if (recovered > 0) player.hp = Math.min(player.maxHp, player.hp+recovered);
        deletedHpPacks = 0;
        powerUpMs = POWERUP_DURATION;
        rollStatUpgrade();  // 보스 처치 강화 추첨
        bossActive=false; boss=null; bossCores=[];
        fireZones=[]; earthWalls=null; windTelegraphs=[];
        electricOrbs=[]; electricLinks=[];
        windMinions=[]; windSlowActive=false;
        bullets=[];
        if (bossUi) bossUi.style.display='none';
      }
    }

    // Bullet physics
    bullets.forEach(b => b.update(dt));
    playerBullets.forEach(pb => pb.update(dt));
    updateFireHazards(dt);
    updateEarthWalls(dt);
    updateWindTelegraphs(dt);
    updateElectricOrbs(dt);
    updateWindMinions(dt);

    updateStatToast(dt);

    // Effect lifecycle
    for (const e of effects) {
      e.life -= dt;
      if (e.type==='particle') { e.x+=e.vx*dt/FRAME_REF; e.y+=e.vy*dt/FRAME_REF; }
      if (e.type==='shockwave' && e.damagesPlayer && !e.applied) {
        const progress = 1 - e.life/e.maxLife;
        const curR = e.maxRadius * progress;
        if (Math.abs(Math.hypot(player.x-e.x, player.y-e.y) - curR) < 8+player.r) {
          applyPlayerHit(player.maxHp/20, e.x, e.y);
          e.applied=true;
        }
      }
    }
    effects = effects.filter(e => e.life > 0);

    // Player bullet vs boss / core collisions
    if (bossActive && boss) {
      for (const pb of playerBullets) {
        if (!pb.alive) continue;
        if (boss.waterHealActive) {
          for (const core of bossCores) {
            if (!core.alive) continue;
            if (Math.hypot(pb.x-core.x, pb.y-core.y) < pb.r+core.size*0.8) {
              core.hit(pb.dmg); pb.alive=false; break;
            }
          }
        }
        if (!pb.alive) continue;
        if (Math.abs(pb.x-boss.x) <= boss.size/2+pb.r && Math.abs(pb.y-boss.y) <= boss.size/2+pb.r) {
          boss.hit(pb.dmg); pb.alive=false;
        }
      }
    }

    // Player bullet vs destructible bullets
    for (const pb of playerBullets) {
      if (!pb.alive) continue;
      for (const b of bullets) {
        if (!b.alive||!b.destructible) continue;
        if (Math.hypot(pb.x-b.x, pb.y-b.y) < pb.r+b.r) {
          pb.alive=false; b.alive=false; spawnHitEffect(b.x,b.y); break;
        }
      }
    }

    // Enemy bullets vs player
    for (const b of bullets) {
      if (!b.alive) continue;
      if (Math.hypot(b.x-player.x, b.y-player.y) < b.r+player.r) {
        applyPlayerHit(b.dmg, b.x, b.y);
        b.alive=false;
      }
    }

    bullets       = bullets.filter(b  => b.alive  && b.inBounds());
    playerBullets = playerBullets.filter(pb => pb.alive && pb.inBounds());
    bossCores     = bossCores.filter(c => c.alive);

    // Health pack pickup
    healthPacks = healthPacks.filter(pack => {
      if (Math.hypot(pack.x-player.x, pack.y-player.y) < pack.r+player.r) {
        const missing = player.maxHp - player.hp;
        player.hp = Math.min(player.maxHp, player.hp + missing*0.1 + player.maxHp/15);
        return false;
      }
      return true;
    });

    // Score accrual (paused during boss fight)
    if (!bossActive && !warningActive) {
      score += (dt/1000) * SCORE_PER_SEC;
    }

    updateHpBar();
    if (scoreSpan) scoreSpan.textContent = String(score|0);
    if (bossActive && boss) updateBossHpBar();
    updateSkillHud();
    if (player.hp <= 0) doGameOver();
  }

  // ─── Draw ─────────────────────────────────────────────────────────
  function isLight() { return document.body.classList.contains('light'); }
  function getThemeBg()     { return isLight() ? '#e8e8e8' : '#111'; }
  function getThemeBorder() { return isLight() ? '#aaa'    : '#333'; }
  // 텍스트/전경색: 라이트=검정, 다크=흰색
  function getThemeFg()     { return isLight() ? '#111'    : '#fff'; }
  // 반투명 오버레이용
  function getThemeFgA(a)   { return isLight() ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; }

  // 라이트 모드에서 밝은 색(R+G+B > 480) → 어두운 보색으로 치환
  function darkenForLight(hex) {
    if (!isLight()) return hex;
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    // 밝기 합산 — 밝은 색이면 반전
    if (r + g + b > 480) {
      // 보색 계열로 어둡게
      const nr = Math.max(0, 255-r) >> 1;
      const ng = Math.max(0, 255-g) >> 1;
      const nb = Math.max(0, 255-b) >> 1;
      return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
    }
    return hex;
  }

  // 라이트 모드에서 보스 bg/border를 밝은 배경에 맞게 혼합
  function adaptBossColor(hex, isBg) {
    if (!isLight() || !hex || hex[0] !== '#') return hex;
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    if (isBg) {
      // bg: 흰색(232,232,232)과 60:40 혼합 → 밝은 버전
      const nr = ((r + 232*2) / 3) | 0;
      const ng = ((g + 232*2) / 3) | 0;
      const nb = ((b + 232*2) / 3) | 0;
      return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
    } else {
      // border: 원래 색 그대로 (속성 색은 유지)
      return hex;
    }
  }

  function drawBackground() {
    let bg = getThemeBg(), border = getThemeBorder();
    if (bossActive && boss) {
      bg     = adaptBossColor(boss.data.bg,     true);
      border = adaptBossColor(boss.data.border, false);
    } else if (warningActive && pendingBossData) {
      bg     = adaptBossColor(pendingBossData.bg,     true);
      border = adaptBossColor(pendingBossData.border, false);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = border; ctx.lineWidth=5;
    ctx.strokeRect(0,0,canvas.width,canvas.height);
  }

  function draw() {
    drawBackground();

    // Warning crosshair animation
    if (warningActive) {
      const cx=canvas.width/2, cy=canvas.height/2;
      const progress = warningElapsedMs/WARNING_DURATION;
      const ringR = 90*(1-progress)+24;
      const alpha = 0.4+progress*0.6;
      ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle='#f55'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy,ringR,0,Math.PI*2); ctx.stroke();
      const arm=ringR*0.6;
      ctx.beginPath();
      ctx.moveTo(cx-arm,cy); ctx.lineTo(cx+arm,cy);
      ctx.moveTo(cx,cy-arm); ctx.lineTo(cx,cy+arm);
      ctx.stroke(); ctx.restore();
    }

    drawFireHazards();
    drawEarthWalls();
    drawWindTelegraphs();
    drawElectricOrbs();
    drawWindMinions();
    drawStatToast();
    healthPacks.forEach(h=>h.draw());
    bossCores.forEach(c=>c.draw());
    playerBullets.forEach(pb=>pb.draw());
    bullets.forEach(b=>b.draw());
    if (bossActive && boss) boss.draw();

    effects.forEach(e => {
      const alpha = Math.max(0, e.life/e.maxLife);
      if (e.type==='ring') {
        const r = (1-alpha)*e.radius+3;
        ctx.save(); ctx.globalAlpha=alpha*0.9; ctx.strokeStyle=e.color; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(e.x,e.y,r,0,Math.PI*2); ctx.stroke(); ctx.restore();
      } else if (e.type==='particle') {
        ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=e.color;
        ctx.beginPath(); ctx.arc(e.x,e.y,2,0,Math.PI*2); ctx.fill(); ctx.restore();
      } else if (e.type==='shockwave') {
        const t = 1-alpha, r = e.maxRadius*t;
        ctx.save(); ctx.globalAlpha=alpha*0.85; ctx.strokeStyle=e.color; ctx.lineWidth=e.lineWidth;
        ctx.beginPath(); ctx.arc(e.x,e.y,r,0,Math.PI*2); ctx.stroke(); ctx.restore();
      }
    });

    // Teleport/dash trail
    if (dashTrailMs > 0) {
      ctx.save(); ctx.globalAlpha=dashTrailMs/200*0.55; ctx.fillStyle='#9ff';
      ctx.beginPath(); ctx.arc(player.x,player.y,player.r+8,0,Math.PI*2); ctx.fill(); ctx.restore();
    }

    // Barrier visual
    if ((skillActiveMs['barrier']||0) > 0) {
      ctx.save(); ctx.globalAlpha=0.6; ctx.strokeStyle='#ccf'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(player.x,player.y,player.r+9,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }

    // Fluid visual
    if ((skillActiveMs['fluid']||0) > 0) {
      ctx.save(); ctx.globalAlpha=0.3; ctx.strokeStyle='#4fd3ff'; ctx.lineWidth=3;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(player.x,player.y,player.r+12,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }

    // Parry window visual
    if ((skillActiveMs['parry']||0) > 0) {
      const elapsed = PARRY_WINDOW_END - parryWindowMs;
      const inWindow = elapsed >= PARRY_WINDOW_START && elapsed <= PARRY_WINDOW_END;
      ctx.save();
      ctx.globalAlpha = inWindow ? 0.85 : 0.3;
      ctx.strokeStyle = inWindow ? '#ffe566' : '#888';
      ctx.lineWidth = inWindow ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(player.x,player.y,player.r+14,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Overcharge visual
    if ((skillActiveMs['overcharge']||0) > 0) {
      ctx.save(); ctx.globalAlpha=0.4; ctx.strokeStyle='#ff8866'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(player.x,player.y,player.r+16,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }

    // Aim line
    ctx.save(); ctx.strokeStyle='rgba(150,150,255,0.25)'; ctx.setLineDash([4,6]); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(player.x,player.y); ctx.lineTo(mouseX,mouseY); ctx.stroke(); ctx.restore();

    // Player body
    ctx.save();
    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();
    // 라이트 모드: 외곽선 검정
    if (isLight()) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.stroke();
    }
    ctx.fillStyle = getThemeBg();
    ctx.beginPath(); ctx.arc(player.x,player.y,player.r*0.45,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // 점멸 미리보기: 우클릭 누르는 동안 도착 위치 + 최대 사거리 원 표시
    if (isRightDown && getSelectedSkill() === 'teleport' && (skillCooldowns['teleport']||0) <= 0) {
      const TELEPORT_RANGE = 220;
      const dx = mouseX - player.x, dy = mouseY - player.y;
      const mouseDist = Math.hypot(dx, dy) || 1;
      const actualDist = Math.min(mouseDist, TELEPORT_RANGE);
      const nx = dx / mouseDist, ny = dy / mouseDist;
      const px = clamp(player.x + nx * actualDist, player.r, canvas.width  - player.r);
      const py = clamp(player.y + ny * actualDist, player.r, canvas.height - player.r);
      const inRange = mouseDist <= TELEPORT_RANGE;

      ctx.save();

      // 최대 사거리 원
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#9ff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(player.x, player.y, TELEPORT_RANGE, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);

      // 플레이어 → 도착지 점선
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = inRange ? '#9ff' : '#f88';  // 사거리 밖이면 빨강
      ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);

      // 도착 위치 고스트
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = player.color;
      ctx.beginPath(); ctx.arc(px, py, player.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#9ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, player.r + 4, 0, Math.PI*2); ctx.stroke();

      ctx.restore();
    }
  }

  // ─── Game loop ────────────────────────────────────────────────────
  function loop(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min(50, time-lastTime);
    lastTime = time;
    if (!isPaused) update(dt);
    draw();
    if (!gameOver) requestAnimationFrame(loop);
  }

  function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;
    if (pauseScreen) pauseScreen.style.display = isPaused ? 'flex' : 'none';
    if (!isPaused) lastTime = performance.now(); // dt 튀는 거 방지
  }

  // ─── Input ───────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // 메뉴/게임오버 화면에선 무시
      if (canvas.style.display !== 'none') togglePause();
      return;
    }
    if (isPaused) return; // 일시정지 중 다른 키 무시
    keys[e.key] = true;
    if (e.key===' ') e.preventDefault();
    if (e.key==='f' || e.key==='F') {
      e.preventDefault();
      useSkill(getSelectedSkill());
    }
  });
  window.addEventListener('keyup', e => { if (!isPaused) keys[e.key]=false; else keys={}; });
  // 포커스 이탈 시 모든 키 상태 초기화 (WASD 고착 방지)
  window.addEventListener('blur', () => { keys = {}; });

  function getCanvasMouse(e) {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / r.width;
    const scaleY = canvas.height / r.height;
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top)  * scaleY,
    };
  }

  // window 레벨로 등록 — canvas 밖(크롬 창 안)에서도 마우스 인식
  window.addEventListener('mousemove', e => {
    const m = getCanvasMouse(e);
    mouseX = m.x; mouseY = m.y;
  });
  window.addEventListener('mousedown', e => {
    if (gameOver || isPaused) return;
    if (canvas.style.display === 'none') return; // 메뉴에선 무시
    const m = getCanvasMouse(e);
    mouseX = m.x; mouseY = m.y;
    if (e.button===0) { isMouseDown=true; firePlayerBullet(mouseX,mouseY); }
    if (e.button===2) {
      // 점멸 스킬이면 누르는 동안 미리보기만, 아니면 즉시 발동
      if (getSelectedSkill() === 'teleport') {
        isRightDown = true;
      } else {
        useSkill(getSelectedSkill());
      }
    }
  });
  window.addEventListener('mouseup', e => {
    if (e.button===0) isMouseDown=false;
    if (e.button===2) {
      if (isRightDown && getSelectedSkill() === 'teleport' && !gameOver && !isPaused) {
        useSkill('teleport');
      }
      isRightDown = false;
    }
  });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); });

  btnStart?.addEventListener('click', () => { initGame(); requestAnimationFrame(loop); });
  $('btnResume')?.addEventListener('click', () => { if (isPaused) togglePause(); });
  btnRetry?.addEventListener('click', () => {
    if (menu)           menu.style.display='block';
    if (ui)             ui.style.display='none';
    canvas.style.display='none';
    if (gameOverScreen) gameOverScreen.style.display='none';
    gameOver=false;
  });
  submitBtn?.addEventListener('click', handleSubmit);

  if (menu)           menu.style.display='block';
  if (ui)             ui.style.display='none';
  canvas.style.display='none';
  if (gameOverScreen) gameOverScreen.style.display='none';
});
