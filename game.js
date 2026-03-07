import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
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

  const btnStart = $('btnStart');
  const btnRetry = $('btnRetry');
  const submitBtn = $('submitScore');
  const menu = $('mainMenu');
  const ui = $('ui');
  const canvas = $('gameCanvas');
  const warningDiv = $('warning');
  const gameOverScreen = $('gameOverScreen');
  const finalScoreSpan = $('finalScore');
  const boardList = $('boardList');
  const scoreSpan = $('score');
  const bestSpan = $('best');
  const skinsDiv = $('skins');
  const skillsDiv = $('skills');
  const bossUi = $('bossUi');
  const bossHpFill = document.querySelector('#bossHpBar>div');
  const hpBarDiv = document.querySelector('#hpBar>div');
  const hpBarContainer = $('hpBarContainer');

  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = 1200;
  canvas.height = 720;

  const hpText = document.createElement('div');
  hpText.id = 'hpText';
  Object.assign(hpText.style, {
    position: 'absolute',
    width: '200px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#fff',
    pointerEvents: 'none',
  });
  if (hpBarContainer) hpBarContainer.appendChild(hpText);

  const skillHud = document.createElement('div');
  skillHud.id = 'skillHud';
  skillHud.textContent = '우클릭: -';
  Object.assign(skillHud.style, {
    marginTop: '10px',
    display: 'inline-block',
    padding: '6px 10px',
    border: '1.5px solid #7fd3ff',
    color: '#dff6ff',
    background: 'rgba(17,17,17,0.9)',
    font: 'bold 16px sans-serif',
    lineHeight: '1.2',
    minWidth: '210px',
    boxSizing: 'border-box',
  });
  if (ui) ui.appendChild(skillHud);

  const FRAME_REF = 16.6667;
  const SCORE_PER_SEC = 60;
  const PLAYER_BULLET_DMG = 25;
  const PLAYER_FIRE_COOLDOWN = 150;
  const PLAYER_BASE_SPEED = 4.2;
  const NORMAL_SPAWN_START = 1000;
  const NORMAL_SPAWN_MIN = 300;
  const WARNING_DURATION = 1000;
  const BOSS_KILL_BONUS = 1000;
  const POWERUP_DURATION = 5000;
  const POWERUP_SPEED_MULT = 1.15;
  const POWERUP_FIRE_COOLDOWN = 100;

  const bossSchedule = [5000, 10000, 16000, 23000];
  const bossOrder = ['fire', 'water', 'earth', 'wind'];

  const skins = [
    { color: '#ff0', cost: 0 },
    { color: '#0f0', cost: 5000 },
    { color: '#fff', cost: 10000 },
  ];

  const rightSkills = [
    { id: 'shield', name: '방패', desc: '짧게 피격 무효화', cooldown: 10000 },
    { id: 'dash', name: '대시', desc: '마우스 방향 순간이동', cooldown: 6000 },
    { id: 'burst', name: '충격파', desc: '주변 탄 제거/코어 피해', cooldown: 11000 },
  ];

  const elementData = {
    fire: {
      name: '보스(火)',
      bg: '#2a0808',
      border: '#8b1e1e',
      burst: '#ff6b3d',
      spiral: '#ff9a3d',
      aimed: '#ff4a4a',
      size: 76,
      maxHp: 560,
      thresholds: { burst: 0.72, spiral: 0.40 },
      burstInterval: 740,
      burstSpeed: 2.9,
      burstCount: 18,
      burstDestructRatio: 0.20,
      spiralInterval: 46,
      spiralSpeed: 2.9,
      aimedInterval: 470,
      aimedShots: 3,
      aimedDelay: 90,
      aimedSpeed: 3.9,
      orbitRadius: 135,
      chaseSpeed: 75,
      zigSpeed: 130,
      homing: 0.0,
      heavy: false,
    },
    water: {
      name: '보스(水)',
      bg: '#071a2e',
      border: '#1b4e88',
      burst: '#4fd3ff',
      spiral: '#68c6ff',
      aimed: '#83d9ff',
      size: 76,
      maxHp: 700,
      thresholds: { burst: 0.70, spiral: 0.42 },
      burstInterval: 800,
      burstSpeed: 2.5,
      burstCount: 16,
      burstDestructRatio: 0.25,
      spiralInterval: 40,
      spiralSpeed: 2.7,
      aimedInterval: 520,
      aimedShots: 3,
      aimedDelay: 95,
      aimedSpeed: 3.65,
      orbitRadius: 115,
      chaseSpeed: 66,
      zigSpeed: 105,
      homing: 0.0,
      heavy: false,
      waterHeal: true,
    },
    earth: {
      name: '보스(土)',
      bg: '#1b1408',
      border: '#6a4d24',
      burst: '#c7994f',
      spiral: '#d6aa65',
      aimed: '#e1bb7d',
      size: 82,
      maxHp: 860,
      thresholds: { burst: 0.76, spiral: 0.48 },
      burstInterval: 820,
      burstSpeed: 2.25,
      burstCount: 14,
      burstDestructRatio: 0.18,
      spiralInterval: 52,
      spiralSpeed: 2.45,
      aimedInterval: 540,
      aimedShots: 3,
      aimedDelay: 100,
      aimedSpeed: 3.45,
      orbitRadius: 110,
      chaseSpeed: 60,
      zigSpeed: 92,
      homing: 0.0,
      heavy: true,
    },
    wind: {
      name: '보스(風)',
      bg: '#081f16',
      border: '#27a56f',
      burst: '#68ffb9',
      spiral: '#9ffff1',
      aimed: '#d6fff8',
      size: 72,
      maxHp: 780,
      thresholds: { burst: 0.68, spiral: 0.36 },
      burstInterval: 700,
      burstSpeed: 2.6,
      burstCount: 18,
      burstDestructRatio: 0.22,
      spiralInterval: 38,
      spiralSpeed: 2.9,
      aimedInterval: 390,
      aimedShots: 4,
      aimedDelay: 78,
      aimedSpeed: 3.55,
      orbitRadius: 140,
      chaseSpeed: 85,
      zigSpeed: 132,
      homing: 0.05,
      heavy: false,
    },
  };

  let bestScore = parseInt(localStorage.getItem('best') || '0', 10);
  let selectedSkin = 0;
  let selectedSkill = localStorage.getItem('selectedRightSkill') || 'shield';

  let player;
  let bullets = [];
  let playerBullets = [];
  let healthPacks = [];
  let effects = [];
  let bossCores = [];
  let fireZones = [];
  let earthWalls = null;
  let windTelegraphs = [];
  let score = 0;
  let gameOver = false;
  let spawnIntervalMs = NORMAL_SPAWN_START;
  let spawnTimerMs = 0;
  let difficultyTimerMs = 0;
  let nextBossIdx = 0;
  let bossActive = false;
  let boss = null;
  let warningActive = false;
  let warningElapsedMs = 0;
  let warningBossType = 'fire';
  let warningBossName = '보스';
  let pendingBossType = 'fire';
  let lastHealthThreshold = 0;
  let lastMaxHpThreshold = 0;
  let deletedHealthPacksForBoss = 0;
  let keys = {};
  let lastTime = 0;
  let mouseX = canvas.width / 2;
  let mouseY = canvas.height / 2;
  let playerFireCooldownMs = 0;
  let powerUpMs = 0;
  let rightSkillCooldownMs = 0;
  let shieldActiveMs = 0;
  let dashTrailMs = 0;
  let isSubmittingScore = false;
  let scoreSubmitted = false;

  function getSelectedSkill() {
    return rightSkills.find(s => s.id === selectedSkill) || rightSkills[0];
  }

  function renderSkinButtons() {
    if (!skinsDiv) return;
    skinsDiv.innerHTML = '';
    skins.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'skin';
      d.style.background = s.color;
      if (bestScore < s.cost) d.classList.add('locked');
      d.onclick = () => {
        if (bestScore >= s.cost) {
          selectedSkin = i;
          [...skinsDiv.querySelectorAll('.skin')].forEach(x => x.style.borderColor = '#fff');
          d.style.borderColor = '#f00';
        }
      };
      skinsDiv.appendChild(d);
    });
    const current = skinsDiv.querySelectorAll('.skin')[selectedSkin];
    if (current) current.style.borderColor = '#f00';
  }

  function renderSkillButtons() {
    if (!skillsDiv) return;
    skillsDiv.innerHTML = '';
    rightSkills.forEach(skill => {
      const btn = document.createElement('button');
      btn.className = 'skillBtn';
      if (skill.id === selectedSkill) btn.classList.add('selected');
      btn.innerHTML = `<strong>${skill.name}</strong><small>${skill.desc}</small>`;
      btn.onclick = () => {
        selectedSkill = skill.id;
        localStorage.setItem('selectedRightSkill', selectedSkill);
        renderSkillButtons();
      };
      skillsDiv.appendChild(btn);
    });
  }

  renderSkinButtons();
  renderSkillButtons();
  if (bestSpan) bestSpan.textContent = bestScore;

  class Bullet {
    constructor(x, y, vx, vy, r, color, dmg, destructible = false, opts = {}) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.r = r;
      this.color = color;
      this.dmg = dmg;
      this.destructible = destructible;
      this.alive = true;
      this.lifeMs = opts.lifeMs ?? Infinity;
      this.linger = opts.linger ?? false;
      this.homing = opts.homing ?? 0;
      this.heavy = opts.heavy ?? false;
    }
    update(dt) {
      if (this.homing > 0 && player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(this.vx, this.vy) || 1;
        const tx = (dx / len) * speed;
        const ty = (dy / len) * speed;
        this.vx += (tx - this.vx) * this.homing;
        this.vy += (ty - this.vy) * this.homing;
      }
      this.x += this.vx * dt / FRAME_REF;
      this.y += this.vy * dt / FRAME_REF;
      this.lifeMs -= dt;
      if (this.lifeMs <= 0) this.alive = false;
    }
    inBounds() {
      const margin = this.linger ? 80 : 50;
      return this.x >= -margin && this.x <= canvas.width + margin && this.y >= -margin && this.y <= canvas.height + margin;
    }
    draw() {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      if (this.destructible) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      if (this.heavy) {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff3';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class PlayerBullet {
    constructor(x, y, vx, vy, dmg = PLAYER_BULLET_DMG) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.r = 3;
      this.dmg = dmg;
      this.alive = true;
    }
    update(dt) {
      this.x += this.vx * dt / FRAME_REF;
      this.y += this.vy * dt / FRAME_REF;
    }
    inBounds() {
      return this.x >= -20 && this.x <= canvas.width + 20 && this.y >= -20 && this.y <= canvas.height + 20;
    }
    draw() {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ccf';
      ctx.fillStyle = '#ccf';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class HealthPack {
    constructor() {
      this.r = 7;
      this.color = '#ff66cc';
      let tries = 0;
      do {
        this.x = 60 + Math.random() * (canvas.width - 120);
        this.y = 60 + Math.random() * (canvas.height - 120);
        tries += 1;
      } while (tries < 20 && player && Math.hypot(this.x - player.x, this.y - player.y) < 120);
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(10, -4, 10, -14, 0, -8);
      ctx.bezierCurveTo(-10, -14, -10, -4, 0, 6);
      ctx.fill();
      ctx.restore();
    }
  }

  class BossCore {
    constructor(x, y, hits, color) {
      this.x = x;
      this.y = y;
      this.hits = hits;
      this.hp = hits * PLAYER_BULLET_DMG;
      this.maxHp = this.hp;
      this.size = 14 + hits * 4;
      this.color = color;
      this.alive = true;
    }
    hit(dmg) {
      this.hp -= dmg;
      spawnHitEffect(this.x, this.y, this.color);
      if (this.hp <= 0) {
        this.alive = false;
        spawnShockwave(this.x, this.y, 40, this.color, 2);
      }
    }
    draw() {
      const ratio = Math.max(0, this.hp / this.maxHp);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size * 0.8, 0);
      ctx.lineTo(0, this.size);
      ctx.lineTo(-this.size * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(0,0,0,${0.2 + (1 - ratio) * 0.5})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(this.hits), 0, 4);
      ctx.restore();
    }
  }

  class Boss {
    constructor(type) {
      this.type = type;
      this.data = elementData[type];
      this.x = canvas.width / 2;
      this.y = canvas.height / 2;
      this.baseX = this.x;
      this.baseY = this.y;
      this.size = this.data.size;
      this.maxHp = this.data.maxHp;
      this.hp = this.maxHp;
      this.phase = 'burst';
      this.rotate = 0;
      this.moveAngle = 0;
      this.fireTickMs = 0;
      this.burstQueue = 0;
      this.burstTickMs = 0;
      this.spawnHoldMs = 450;
      this.invulnMs = 550;
      this.hitFlashMs = 0;
      this.phaseShockQueued = false;
      this.waterHealUsed = false;
      this.waterHealActive = false;
      this.waterHealTimerMs = 0;
      this.fireHazardUsed = false;
      this.windTickMs = 0;
      if (this.type === 'earth') initEarthWalls();
    }
    getRatio() {
      return this.hp / this.maxHp;
    }
    updatePhase() {
      const ratio = this.getRatio();
      const prev = this.phase;
      if (ratio >= this.data.thresholds.burst) this.phase = 'burst';
      else if (ratio >= this.data.thresholds.spiral) this.phase = 'spiral';
      else this.phase = 'aimed';
      if (prev !== this.phase) {
        spawnShockwave(this.x, this.y, 120, this.getPhaseColor(), 3);
      }
    }
    getPhaseColor() {
      if (this.phase === 'burst') return this.data.burst;
      if (this.phase === 'spiral') return this.data.spiral;
      return this.data.aimed;
    }
    hit(dmg) {
      if (this.invulnMs > 0) return;
      this.hp -= dmg;
      this.hitFlashMs = 80;
      if (this.hp < 0) this.hp = 0;
      this.updatePhase();
      if (this.type === 'water' && !this.waterHealUsed && !this.waterHealActive && this.getRatio() <= 0.5) {
        this.startWaterHealing();
      }
      if (this.type === 'fire' && !this.fireHazardUsed && this.getRatio() <= 0.5) {
        this.fireHazardUsed = true;
        startFireHazards();
        spawnShockwave(this.x, this.y, 120, '#ff6b3d', 3);
      }
    }
    startWaterHealing() {
      this.waterHealUsed = true;
      this.waterHealActive = true;
      this.waterHealTimerMs = 4000;
      this.x = canvas.width / 2;
      this.y = canvas.height / 2;
      bossCores = [];
      const offsetX = 170;
      const offsetY = 110;
      const cfg = [1, 2, 3, 4];
      const pts = [
        [-offsetX, -offsetY],
        [ offsetX, -offsetY],
        [-offsetX,  offsetY],
        [ offsetX,  offsetY],
      ];
      for (let i = 0; i < 4; i += 1) {
        bossCores.push(new BossCore(canvas.width / 2 + pts[i][0], canvas.height / 2 + pts[i][1], cfg[i], '#8fe7ff'));
      }
      spawnShockwave(this.x, this.y, 100, '#8fe7ff', 2.5);
    }
    resolveWaterHealing() {
      const remain = bossCores.filter(c => c.alive).length;
      const healAmount = remain * this.maxHp * 0.07;
      this.hp = Math.min(this.maxHp, this.hp + healAmount);
      if (remain === 0) {
        this.invulnMs = 0;
      }
      this.waterHealActive = false;
      bossCores = [];
      spawnShockwave(this.x, this.y, 140, '#8fe7ff', 3);
      this.updatePhase();
    }
    update(dt) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt;
      if (this.spawnHoldMs > 0) {
        this.spawnHoldMs -= dt;
        this.invulnMs -= dt;
        return;
      }
      if (this.invulnMs > 0) this.invulnMs -= dt;
      if (this.waterHealActive) {
        this.waterHealTimerMs -= dt;
        if (this.waterHealTimerMs <= 0) this.resolveWaterHealing();
        return;
      }
      this.updatePhase();
      this.moveAngle += dt / 1000;
      this.fireTickMs += dt;
      if (this.type === 'wind') {
        this.windTickMs += dt;
        if (this.windTickMs >= 1300) {
          this.windTickMs = 0;
          queueWindTelegraph();
        }
      }
      const bossDmg = player.maxHp / 15;
      if (this.phase === 'burst') {
        this.x = this.baseX + Math.cos(this.moveAngle * 0.6) * this.data.orbitRadius;
        this.y = this.baseY + Math.sin(this.moveAngle * 0.6) * this.data.orbitRadius;
        if (this.fireTickMs >= this.data.burstInterval) {
          this.fireTickMs = 0;
          for (let i = 0; i < this.data.burstCount; i += 1) {
            const a = (Math.PI * 2 * i) / this.data.burstCount;
            const destructible = Math.random() < this.data.burstDestructRatio;
            bullets.push(new Bullet(
              this.x,
              this.y,
              Math.cos(a) * this.data.burstSpeed,
              Math.sin(a) * this.data.burstSpeed,
              this.data.heavy ? 7.5 : 5.5,
              this.data.burst,
              bossDmg,
              destructible,
              { heavy: this.data.heavy }
            ));
          }
        }
      } else if (this.phase === 'spiral') {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.x += (dx / len) * this.data.chaseSpeed * dt / 1000 + Math.sin(this.moveAngle * 3) * 30 * dt / 1000;
        this.y += (dy / len) * this.data.chaseSpeed * dt / 1000 + Math.cos(this.moveAngle * 2) * 20 * dt / 1000;
        this.x = clamp(this.x, 80, canvas.width - 80);
        this.y = clamp(this.y, 80, canvas.height - 80);
        if (this.fireTickMs >= this.data.spiralInterval) {
          this.fireTickMs = 0;
          const a = (performance.now() / 220) % (Math.PI * 2);
          bullets.push(new Bullet(this.x, this.y, Math.cos(a) * this.data.spiralSpeed, Math.sin(a) * this.data.spiralSpeed, this.data.heavy ? 7 : 5.5, this.data.spiral, bossDmg, false, { heavy: this.data.heavy }));
          bullets.push(new Bullet(this.x, this.y, Math.cos(a + Math.PI) * this.data.spiralSpeed, Math.sin(a + Math.PI) * this.data.spiralSpeed, this.data.heavy ? 7 : 5.5, this.data.spiral, bossDmg, false, { heavy: this.data.heavy }));
        }
      } else {
        const futureX = player.x + (keys['ArrowRight'] || keys['d'] ? 50 : 0) - (keys['ArrowLeft'] || keys['a'] ? 50 : 0);
        const futureY = player.y + (keys['ArrowDown'] || keys['s'] ? 35 : 0) - (keys['ArrowUp'] || keys['w'] ? 35 : 0);
        const dx = futureX - this.x;
        const dy = futureY - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.x += (dx / len) * this.data.zigSpeed * dt / 1000 + Math.sin(this.moveAngle * 5) * 55 * dt / 1000;
        this.y += (dy / len) * this.data.zigSpeed * dt / 1000 + Math.cos(this.moveAngle * 4) * 35 * dt / 1000;
        this.x = clamp(this.x, 80, canvas.width - 80);
        this.y = clamp(this.y, 80, canvas.height - 80);
        if (this.fireTickMs >= this.data.aimedInterval && this.burstQueue === 0) {
          this.fireTickMs = 0;
          this.burstQueue = this.data.aimedShots;
          this.burstTickMs = 0;
        }
        if (this.burstQueue > 0) {
          this.burstTickMs += dt;
          if (this.burstTickMs >= this.data.aimedDelay) {
            this.burstTickMs = 0;
            this.burstQueue -= 1;
            const dx2 = player.x - this.x;
            const dy2 = player.y - this.y;
            const len2 = Math.hypot(dx2, dy2) || 1;
            const shotIdx = this.data.aimedShots - this.burstQueue;
            const spread = (shotIdx - (this.data.aimedShots + 1) / 2) * 0.09;
            const ang = Math.atan2(dy2, dx2) + spread;
            bullets.push(new Bullet(this.x, this.y, Math.cos(ang) * this.data.aimedSpeed, Math.sin(ang) * this.data.aimedSpeed, this.data.heavy ? 7.2 : 6, this.data.aimed, bossDmg, false, { homing: this.data.homing, heavy: this.data.heavy }));
            if (shotIdx === this.data.aimedShots) {
              bullets.push(new Bullet(this.x, this.y, Math.cos(ang + 0.18) * 2.2, Math.sin(ang + 0.18) * 2.2, 7.5, this.data.aimed, bossDmg * 0.9, false, { lifeMs: 1600, linger: true }));
            }
          }
        }
        if (this.fireTickMs >= 2600) {
          this.fireTickMs = 0;
          spawnShockwave(this.x, this.y, 90, this.data.aimed, 2.5, true);
        }
      }
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.moveAngle);
      ctx.fillStyle = this.hitFlashMs > 0 ? '#fff' : this.getPhaseColor();
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.strokeStyle = this.data.border;
      ctx.lineWidth = 3;
      ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
      ctx.restore();
    }
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function updateHpBar() {
    if (!hpBarDiv || !player) return;
    const pct = Math.max(0, player.hp) / player.maxHp;
    hpBarDiv.style.width = `${200 * Math.max(0, Math.min(1, pct))}px`;
    hpText.textContent = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
  }

  function updateBossHpBar() {
    if (!bossHpFill || !boss) return;
    bossHpFill.style.width = `${240 * Math.max(0, Math.min(1, boss.hp / boss.maxHp))}px`;
  }

  function spawnHitEffect(x, y, color = '#afffaf') {
    const lifespan = 150;
    effects.push({ type: 'ring', x, y, color, life: lifespan, maxLife: lifespan, radius: 12 });
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 1.5;
      effects.push({
        type: 'particle', x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#fff',
        life: lifespan,
        maxLife: lifespan,
      });
    }
  }

  function spawnShockwave(x, y, radius, color, lineWidth = 2, damagesPlayer = false) {
    effects.push({
      type: 'shockwave',
      x, y,
      radius,
      maxRadius: radius,
      color,
      lineWidth,
      damagesPlayer,
      applied: false,
      life: 320,
      maxLife: 320,
    });
  }

  function startFireHazards() {
    fireZones = [];
    const candidates = [
      { x: 140, y: 110, w: 250, h: 150 },
      { x: canvas.width - 390, y: 110, w: 250, h: 150 },
      { x: 180, y: canvas.height - 250, w: 250, h: 150 },
      { x: canvas.width - 430, y: canvas.height - 250, w: 250, h: 150 },
      { x: canvas.width / 2 - 140, y: canvas.height / 2 - 90, w: 280, h: 180 },
    ];
    for (let i = 0; i < 2; i += 1) {
      const zone = candidates.splice((Math.random() * candidates.length) | 0, 1)[0];
      fireZones.push({ ...zone, life: 4500, maxLife: 4500, tickMs: 0 });
    }
  }

  function updateFireHazards(dt) {
    for (const zone of fireZones) {
      zone.life -= dt;
      if (player.x > zone.x && player.x < zone.x + zone.w && player.y > zone.y && player.y < zone.y + zone.h) {
        zone.tickMs -= dt;
        if (zone.tickMs <= 0) {
          if (shieldActiveMs > 0) shieldActiveMs = 0;
          else player.hp -= Math.max(1.4, player.maxHp / 40);
          zone.tickMs = 350;
          spawnHitEffect(player.x, player.y, '#ff9b54');
        }
      } else if (zone.tickMs < 0) {
        zone.tickMs = 0;
      }
    }
    fireZones = fireZones.filter(z => z.life > 0);
  }

  function drawFireHazards() {
    for (const zone of fireZones) {
      const alpha = Math.max(0.18, zone.life / zone.maxLife * 0.45);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#b73112';
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.globalAlpha = alpha + 0.12;
      ctx.strokeStyle = '#ff9b54';
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
      for (let i = 0; i < 6; i += 1) {
        const fx = zone.x + 25 + i * ((zone.w - 50) / 5);
        const fy = zone.y + zone.h * (0.3 + 0.35 * ((i % 2) ? 1 : 0.6));
        ctx.beginPath();
        ctx.arc(fx, fy, 8 + (i % 3), 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#ff6b3d' : '#ffb35c';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function initEarthWalls() {
    earthWalls = { left: 0, right: 0, corridorMin: 220 };
  }

  function updateEarthWalls(dt) {
    if (!earthWalls || !bossActive || !boss || boss.type !== 'earth') return;
    const ratio = boss.getRatio();
    const speed = 10 + (1 - ratio) * 24;
    const maxWidth = (canvas.width - earthWalls.corridorMin) / 2;
    earthWalls.left = Math.min(maxWidth, earthWalls.left + speed * dt / 1000);
    earthWalls.right = Math.min(maxWidth, earthWalls.right + speed * dt / 1000);

    if (player.x - player.r < earthWalls.left) {
      player.x = earthWalls.left + player.r;
      if (shieldActiveMs > 0) shieldActiveMs = 0;
      else player.hp -= Math.max(1.8, player.maxHp / 28) * dt / 220;
    }
    if (player.x + player.r > canvas.width - earthWalls.right) {
      player.x = canvas.width - earthWalls.right - player.r;
      if (shieldActiveMs > 0) shieldActiveMs = 0;
      else player.hp -= Math.max(1.8, player.maxHp / 28) * dt / 220;
    }
  }

  function drawEarthWalls() {
    if (!earthWalls) return;
    ctx.save();
    ctx.fillStyle = 'rgba(106,77,36,0.72)';
    ctx.fillRect(0, 0, earthWalls.left, canvas.height);
    ctx.fillRect(canvas.width - earthWalls.right, 0, earthWalls.right, canvas.height);
    ctx.strokeStyle = 'rgba(225,187,125,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(earthWalls.left, 0);
    ctx.lineTo(earthWalls.left, canvas.height);
    ctx.moveTo(canvas.width - earthWalls.right, 0);
    ctx.lineTo(canvas.width - earthWalls.right, canvas.height);
    ctx.stroke();
    ctx.restore();
  }

  function queueWindTelegraph() {
    if (!bossActive || !boss || boss.type !== 'wind') return;
    const ang = Math.atan2(player.y - boss.y, player.x - boss.x);
    const len = 1800;
    windTelegraphs.push({
      x1: boss.x,
      y1: boss.y,
      x2: boss.x + Math.cos(ang) * len,
      y2: boss.y + Math.sin(ang) * len,
      ang,
      delayMs: 500,
      life: 700,
      maxLife: 700,
      fired: false,
    });
  }

  function updateWindTelegraphs(dt) {
    for (const t of windTelegraphs) {
      t.delayMs -= dt;
      t.life -= dt;
      if (!t.fired && t.delayMs <= 0) {
        t.fired = true;
        const bossDmg = player.maxHp / 30;
        bullets.push(new Bullet(boss.x, boss.y, Math.cos(t.ang) * 11.5, Math.sin(t.ang) * 11.5, 4.5, '#d6fff8', bossDmg, false, { lifeMs: 260 }));
      }
    }
    windTelegraphs = windTelegraphs.filter(t => t.life > 0);
  }

  function drawWindTelegraphs() {
    for (const t of windTelegraphs) {
      const alpha = t.fired ? 0.12 : 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#d6fff8';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#7fffd4';
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function firePlayerBullet(tx, ty) {
    if (playerFireCooldownMs > 0 || !player || gameOver) return;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 8.5;
    playerBullets.push(new PlayerBullet(player.x, player.y, (dx / len) * speed, (dy / len) * speed));
    playerFireCooldownMs = powerUpMs > 0 ? POWERUP_FIRE_COOLDOWN : PLAYER_FIRE_COOLDOWN;
  }

  function spawnNormalBullets() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * canvas.width; y = -10; }
    else if (edge === 1) { x = canvas.width + 10; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 10; }
    else { x = -10; y = Math.random() * canvas.height; }

    const dx = player.x - x;
    const dy = player.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 3 + score / 5000;
    const destructible = Math.random() < 0.25;
    bullets.push(new Bullet(x, y, (dx / len) * speed, (dy / len) * speed, 5, destructible ? '#3f3' : '#f00', player.maxHp / 15, destructible));
  }

  function maybeSpawnBoss() {
    if (bossActive || warningActive) return;
    if (nextBossIdx < bossSchedule.length && score >= bossSchedule[nextBossIdx]) {
      pendingBossType = bossOrder[nextBossIdx % bossOrder.length];
      warningBossType = pendingBossType;
      warningBossName = elementData[pendingBossType].name;
      deletedHealthPacksForBoss = healthPacks.length;
      healthPacks.length = 0;
      warningActive = true;
      warningElapsedMs = 0;
      if (warningDiv) {
        warningDiv.textContent = `${warningBossName} 접근`; 
        warningDiv.style.display = 'block';
      }
      nextBossIdx += 1;
    }
  }

  function awardBossPowerup() {
    powerUpMs = POWERUP_DURATION;
  }

  function useRightSkill() {
    if (gameOver || rightSkillCooldownMs > 0) return;
    const skill = getSelectedSkill();
    rightSkillCooldownMs = skill.cooldown;

    if (skill.id === 'shield') {
      shieldActiveMs = 600;
      return;
    }

    if (skill.id === 'dash') {
      const dx = mouseX - player.x;
      const dy = mouseY - player.y;
      const len = Math.hypot(dx, dy) || 1;
      player.x = clamp(player.x + (dx / len) * 120, player.r, canvas.width - player.r);
      player.y = clamp(player.y + (dy / len) * 120, player.r, canvas.height - player.r);
      dashTrailMs = 180;
      return;
    }

    if (skill.id === 'burst') {
      spawnShockwave(player.x, player.y, 90, '#ddf', 2.5);
      for (const b of bullets) {
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        if (dx * dx + dy * dy <= 95 * 95 && b.destructible) {
          b.alive = false;
          spawnHitEffect(b.x, b.y, '#ddf');
        }
      }
      if (bossActive && boss && Math.hypot(boss.x - player.x, boss.y - player.y) < 120) {
        boss.hit(65);
      }
      for (const core of bossCores) {
        if (!core.alive) continue;
        if (Math.hypot(core.x - player.x, core.y - player.y) < 120) {
          core.hit(80);
        }
      }
    }
  }

  function normalizeNameKey(name) {
    return (name || '').trim().toLowerCase();
  }

  async function loadBestScores(limitCount = 10) {
    const q = query(collection(db, 'bestScores'), orderBy('score', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  function renderBoardEntries(entries) {
    if (!boardList) return;
    boardList.innerHTML = entries.length
      ? entries.map((e, i) => `<li>${i + 1}위 — ${e.name || '익명'}: ${e.score}점</li>`).join('')
      : '<li>기록이 없습니다.</li>';
  }

  function initGame() {
    player = {
      x: canvas.width * 0.25,
      y: canvas.height * 0.5,
      r: 7,
      speed: PLAYER_BASE_SPEED,
      hp: 100,
      maxHp: 100,
      color: skins[selectedSkin].color,
    };
    bullets = [];
    playerBullets = [];
    healthPacks = [];
    effects = [];
    bossCores = [];
    fireZones = [];
    earthWalls = null;
    windTelegraphs = [];
    score = 0;
    gameOver = false;
    spawnIntervalMs = NORMAL_SPAWN_START;
    spawnTimerMs = 0;
    difficultyTimerMs = 0;
    nextBossIdx = 0;
    bossActive = false;
    boss = null;
    warningActive = false;
    warningElapsedMs = 0;
    lastHealthThreshold = 0;
    lastMaxHpThreshold = 0;
    deletedHealthPacksForBoss = 0;
    playerFireCooldownMs = 0;
    powerUpMs = 0;
    rightSkillCooldownMs = 0;
    shieldActiveMs = 0;
    dashTrailMs = 0;
    isSubmittingScore = false;
    scoreSubmitted = false;
    if (menu) menu.style.display = 'none';
    if (ui) ui.style.display = 'block';
    canvas.style.display = 'block';
    if (warningDiv) warningDiv.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    if (bossUi) bossUi.style.display = 'none';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '점수 제출'; }
    updateHpBar();
    if (scoreSpan) scoreSpan.textContent = '0';
    if (bossHpFill) bossHpFill.style.width = '240px';
    lastTime = performance.now();
  }

  function doGameOver() {
    gameOver = true;
    if (gameOverScreen) gameOverScreen.style.display = 'flex';
    if (finalScoreSpan) finalScoreSpan.textContent = String(score | 0);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '점수 제출'; }
    loadBestScores(10).then(renderBoardEntries).catch(err => { if (boardList) boardList.innerHTML = `<li>불러오기 실패: ${err?.message || err}</li>`; });
    if (score > bestScore) {
      bestScore = score | 0;
      localStorage.setItem('best', String(bestScore));
      if (bestSpan) bestSpan.textContent = String(bestScore);
    }
  }

  async function handleSubmit() {
    if (!gameOver || isSubmittingScore || scoreSubmitted) return;

    let name = localStorage.getItem('nickname');
    if (!name) {
      name = prompt('이름 입력 (한글 1~4자)');
      if (!name) return;
      name = name.trim();
      if (!/^[가-힣]{1,4}$/.test(name)) {
        alert('이름은 한글 1~4자만');
        return;
      }
      localStorage.setItem('nickname', name);
    }

    const nameKey = normalizeNameKey(name);
    if (!nameKey) {
      alert('이름이 비어 있습니다.');
      return;
    }

    isSubmittingScore = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '제출 중...';
    }

    try {
      const scoreValue = score | 0;
      const ref = doc(db, 'bestScores', nameKey);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, {
          name,
          nameKey,
          score: scoreValue,
          updatedAt: serverTimestamp(),
        });
      } else {
        const prev = snap.data();
        const prevScore = Number(prev.score ?? 0);
        if (scoreValue > prevScore) {
          await setDoc(ref, {
            name,
            nameKey,
            score: scoreValue,
            updatedAt: serverTimestamp(),
          });
        }
      }

      const entries = await loadBestScores(10);
      renderBoardEntries(entries);
      scoreSubmitted = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '제출 완료';
      }
    } catch (err) {
      console.error(err);
      alert(`저장 실패: ${err?.message || err}`);
      if (submitBtn && !scoreSubmitted) {
        submitBtn.disabled = false;
        submitBtn.textContent = '점수 제출';
      }
    } finally {
      isSubmittingScore = false;
    }
  }

  function update(dt) {
    if (gameOver) return;

    if (powerUpMs > 0) powerUpMs -= dt;
    if (playerFireCooldownMs > 0) playerFireCooldownMs -= dt;
    if (rightSkillCooldownMs > 0) rightSkillCooldownMs -= dt;
    if (shieldActiveMs > 0) shieldActiveMs -= dt;
    if (dashTrailMs > 0) dashTrailMs -= dt;

    const speedMult = powerUpMs > 0 ? POWERUP_SPEED_MULT : 1;
    const move = player.speed * speedMult * dt / FRAME_REF;
    if (keys['ArrowLeft'] || keys['a']) player.x -= move;
    if (keys['ArrowRight'] || keys['d']) player.x += move;
    if (keys['ArrowUp'] || keys['w']) player.y -= move;
    if (keys['ArrowDown'] || keys['s']) player.y += move;
    player.x = clamp(player.x, player.r, canvas.width - player.r);
    player.y = clamp(player.y, player.r, canvas.height - player.r);

    if (keys[' ']) firePlayerBullet(mouseX, mouseY);

    spawnTimerMs += dt;
    if (!warningActive && !bossActive && spawnTimerMs >= spawnIntervalMs) {
      spawnTimerMs -= spawnIntervalMs;
      spawnNormalBullets();
    }
    difficultyTimerMs += dt;
    if (difficultyTimerMs >= 5000) {
      difficultyTimerMs -= 5000;
      spawnIntervalMs = Math.max(NORMAL_SPAWN_MIN, spawnIntervalMs - 50);
    }

    const healThr = ((score | 0) / 500) | 0;
    if (!warningActive && !bossActive && healThr > lastHealthThreshold) {
      lastHealthThreshold = healThr;
      healthPacks.push(new HealthPack());
    }

    const hpIncThr = ((score | 0) / 2000) | 0;
    if (hpIncThr > lastMaxHpThreshold) {
      lastMaxHpThreshold = hpIncThr;
      const inc = player.maxHp / 15;
      player.maxHp += inc;
      player.hp += inc;
    }

    maybeSpawnBoss();

    if (warningActive) {
      warningElapsedMs += dt;
      if (warningElapsedMs >= WARNING_DURATION) {
        warningActive = false;
        if (warningDiv) warningDiv.style.display = 'none';
        bossActive = true;
        boss = new Boss(pendingBossType);
        if (bossUi) bossUi.style.display = 'block';
      }
    }

    if (bossActive && boss) {
      boss.update(dt);
      if (Math.abs(player.x - boss.x) <= boss.size / 2 + player.r && Math.abs(player.y - boss.y) <= boss.size / 2 + player.r) {
        player.hp -= (player.maxHp / 15) * 0.15 * dt / FRAME_REF;
      }
      if (boss.hp <= 0) {
        score += BOSS_KILL_BONUS;
        const recoveredHp = Math.min(deletedHealthPacksForBoss * 2, 10);
        if (recoveredHp > 0) player.hp = Math.min(player.maxHp, player.hp + recoveredHp);
        deletedHealthPacksForBoss = 0;
        awardBossPowerup();
        bossActive = false;
        boss = null;
        bossCores = [];
        fireZones = [];
        earthWalls = null;
        windTelegraphs = [];
        if (bossUi) bossUi.style.display = 'none';
      }
    }

    bullets.forEach(b => b.update(dt));
    playerBullets.forEach(pb => pb.update(dt));
    updateFireHazards(dt);
    updateEarthWalls(dt);
    updateWindTelegraphs(dt);

    for (const e of effects) {
      e.life -= dt;
      if (e.type === 'particle') {
        e.x += e.vx * dt / FRAME_REF;
        e.y += e.vy * dt / FRAME_REF;
      }
      if (e.type === 'shockwave' && e.damagesPlayer && !e.applied) {
        const alpha = 1 - e.life / e.maxLife;
        const currentR = e.maxRadius * alpha;
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        if (Math.abs(dist - currentR) < 8 + player.r) {
          if (shieldActiveMs > 0) shieldActiveMs = 0;
          else player.hp -= player.maxHp / 20;
          e.applied = true;
        }
      }
    }
    effects = effects.filter(e => e.life > 0);

    if (bossActive && boss) {
      for (const pb of playerBullets) {
        if (!pb.alive) continue;
        if (boss.waterHealActive) {
          for (const core of bossCores) {
            if (!core.alive) continue;
            const dx = pb.x - core.x;
            const dy = pb.y - core.y;
            if (dx * dx + dy * dy < (pb.r + core.size * 0.8) ** 2) {
              core.hit(pb.dmg);
              pb.alive = false;
              break;
            }
          }
        }
        if (!pb.alive) continue;
        const dx = pb.x - boss.x;
        const dy = pb.y - boss.y;
        if (Math.abs(dx) <= boss.size / 2 + pb.r && Math.abs(dy) <= boss.size / 2 + pb.r) {
          boss.hit(pb.dmg);
          pb.alive = false;
        }
      }
    }

    for (const pb of playerBullets) {
      if (!pb.alive) continue;
      for (const b of bullets) {
        if (!b.alive || !b.destructible) continue;
        const dx = pb.x - b.x;
        const dy = pb.y - b.y;
        const rSum = pb.r + b.r;
        if (dx * dx + dy * dy < rSum * rSum) {
          pb.alive = false;
          b.alive = false;
          spawnHitEffect(b.x, b.y);
          break;
        }
      }
    }

    for (const b of bullets) {
      if (!b.alive) continue;
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      const rSum = b.r + player.r;
      if (dx * dx + dy * dy < rSum * rSum) {
        if (shieldActiveMs > 0) {
          shieldActiveMs = 0;
          b.alive = false;
          spawnShockwave(player.x, player.y, 40, '#ddf', 2);
        } else {
          player.hp -= b.dmg;
          b.alive = false;
        }
      }
    }

    bullets = bullets.filter(b => b.alive && b.inBounds());
    playerBullets = playerBullets.filter(pb => pb.alive && pb.inBounds());
    bossCores = bossCores.filter(c => c.alive);

    healthPacks = healthPacks.filter(pack => {
      if (Math.hypot(pack.x - player.x, pack.y - player.y) < pack.r + player.r) {
        const missing = player.maxHp - player.hp;
        player.hp = Math.min(player.maxHp, player.hp + missing * 0.1 + player.maxHp / 15);
        return false;
      }
      return true;
    });

    if (!bossActive && !warningActive) {
      score += (dt / 1000) * SCORE_PER_SEC;
    }

    updateHpBar();
    if (scoreSpan) scoreSpan.textContent = String(score | 0);
    if (bossActive && boss) updateBossHpBar();
    if (player.hp <= 0) doGameOver();
  }

  function drawBackground() {
    let bg = '#111';
    if (bossActive && boss) bg = elementData[boss.type].bg;
    else if (warningActive) bg = elementData[warningBossType].bg;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = (bossActive && boss) ? elementData[boss.type].border : '#333';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  function draw() {
    drawBackground();

    if (warningActive) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const progress = warningElapsedMs / WARNING_DURATION;
      const ringR = 90 * (1 - progress) + 24;
      const alpha = 0.4 + progress * 0.6;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#f55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      const armLen = ringR * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - armLen, cy); ctx.lineTo(cx + armLen, cy);
      ctx.moveTo(cx, cy - armLen); ctx.lineTo(cx, cy + armLen);
      ctx.stroke();
      ctx.restore();
    }

    drawFireHazards();
    drawEarthWalls();
    drawWindTelegraphs();
    healthPacks.forEach(h => h.draw());
    bossCores.forEach(c => c.draw());
    playerBullets.forEach(pb => pb.draw());
    bullets.forEach(b => b.draw());
    if (bossActive && boss) boss.draw();

    effects.forEach(e => {
      const alpha = Math.max(0, e.life / e.maxLife);
      if (e.type === 'ring') {
        const r = (1 - alpha) * e.radius + 3;
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === 'particle') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.type === 'shockwave') {
        const t = 1 - alpha;
        const r = e.maxRadius * t;
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.lineWidth;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    if (dashTrailMs > 0) {
      ctx.save();
      ctx.globalAlpha = dashTrailMs / 180 * 0.5;
      ctx.fillStyle = '#9ff';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (shieldActiveMs > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ccf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(150,150,255,0.25)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const skill = getSelectedSkill();
    const cooldownSec = Math.max(0, rightSkillCooldownMs) / 1000;
    const ready = rightSkillCooldownMs <= 0;
    const skillText = `우클릭: ${skill.name} ${ready ? '(준비)' : `(${cooldownSec.toFixed(1)}s)`}`;

    if (skillHud) {
      skillHud.textContent = skillText;
      skillHud.style.borderColor = ready ? '#7fd3ff' : '#ffcf66';
      skillHud.style.color = ready ? '#dff6ff' : '#ffe8a3';
    }
  }

  function loop(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min(50, time - lastTime);
    lastTime = time;
    update(dt);
    draw();
    if (!gameOver) requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    keys[e.key] = false;
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener('mousedown', e => {
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    if (e.button === 0) {
      firePlayerBullet(mouseX, mouseY);
    }
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    useRightSkill();
  });

  btnStart?.addEventListener('click', () => {
    initGame();
    requestAnimationFrame(loop);
  });
  btnRetry?.addEventListener('click', () => {
    if (menu) menu.style.display = 'block';
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    gameOver = false;
  });
  submitBtn?.addEventListener('click', handleSubmit);

  if (menu) menu.style.display = 'block';
  if (ui) ui.style.display = 'none';
  canvas.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
});
