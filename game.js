// game.js — BulletHell-Web
// Added: PlayerBullet system (click / spacebar), revamped Boss (movement, real HP, phases)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://racbwrlvquamhqbqzsix.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhY2J3cmx2cXVhbWhxYnF6c2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMTM0MzMsImV4cCI6MjA2ODY4OTQzM30.pT24RRHE4oX9__fdldUT6Cic5P4MgGFk1HiIM46gXGE';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const btnStart       = document.getElementById('btnStart');
  const btnRetry       = document.getElementById('btnRetry');
  const submitBtn      = document.getElementById('submitScore');
  const menu           = document.getElementById('mainMenu');
  const ui             = document.getElementById('ui');
  const canvas         = document.getElementById('gameCanvas');
  const ctx            = canvas.getContext('2d');
  const warningDiv     = document.getElementById('warning');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalScoreSpan = document.getElementById('finalScore');
  const boardList      = document.getElementById('boardList');
  const scoreSpan      = document.getElementById('score');
  const hpBarDiv       = document.querySelector('#hpBar>div');
  const bestSpan       = document.getElementById('best');
  const skinsDiv       = document.getElementById('skins');
  const bossUi         = document.getElementById('bossUi');
  const bossHpFill     = document.querySelector('#bossHpBar>div');

  // HP 숫자 텍스트
  const hpText = document.createElement('div');
  hpText.id = 'hpText';
  Object.assign(hpText.style, {
    position: 'absolute', width: '200px',
    textAlign: 'center', fontSize: '12px', color: '#fff',
  });
  document.getElementById('hpBarContainer').appendChild(hpText);

  // ── 상수 ──────────────────────────────────────────────────────────────────
  const FRAME_REF            = 16.6667;
  const SCORE_PER_SEC        = 60;
  const PLAYER_BULLET_DMG    = 25;
  const PLAYER_FIRE_COOLDOWN = 150;  // ms
  const BOSS_KILL_BONUS      = 500;

  // ── 상태 ──────────────────────────────────────────────────────────────────
  let player, bullets, playerBullets, healthPacks, effects, score, gameOver;
  let spawnIntervalMs, spawnTimerMs, difficultyTimerMs;
  let nextBossIdx = 0;
  const bossSchedule = [5000, 10000, 16000];
  let bossActive = false;
  let boss       = null;
  let lastHealthThreshold = 0, lastMaxHpThreshold = 0;
  let keys       = {};
  let lastTime   = 0;
  let mouseX     = 400;
  let mouseY     = 300;
  // 보스 스폰 예고 레티클용
  let warningActive  = false;  // 경고 중인지
  let warningElapsedMs = 0;    // 경고 경과 시간
  const WARNING_DURATION = 1000; // ms, maybeSpawnBoss의 setTimeout과 동일
  let playerFireCooldownMs = 0;

  // ── 스킨 & 최고점 ─────────────────────────────────────────────────────────
  const skins = [
    { color: '#ff0', cost: 0 },
    { color: '#0f0', cost: 5000 },
    { color: '#fff', cost: 10000 },
  ];
  let selectedSkin = 0;
  let bestScore = parseInt(localStorage.getItem('best') || '0', 10);
  let isSubmittingScore = false;
  let scoreSubmitted = false;
  bestSpan.textContent = bestScore;

  skins.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'skin';
    d.style.background = s.color;
    if (bestScore < s.cost) d.classList.add('locked');
    d.onclick = () => {
      if (bestScore >= s.cost) {
        selectedSkin = i;
        document.querySelectorAll('.skin').forEach(x => x.style.borderColor = '#fff');
        d.style.borderColor = '#f00';
      }
    };
    skinsDiv.appendChild(d);
  });
  document.querySelectorAll('.skin')[0].style.borderColor = '#f00';

  // ── HealthPack ────────────────────────────────────────────────────────────
  class HealthPack {
    constructor() {
      this.r = 8; this.color = '#ff66cc';
      this.x = Math.random() * (canvas.width  - 20) + 10;
      this.y = Math.random() * (canvas.height - 20) + 10;
    }
    draw() {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      const h = this.r * 0.3;
      ctx.moveTo(this.x, this.y + this.r * 0.3);
      ctx.bezierCurveTo(this.x - this.r,       this.y - h,
                        this.x - this.r * 1.5,  this.y + this.r * 0.8,
                        this.x,                  this.y + this.r * 1.6);
      ctx.bezierCurveTo(this.x + this.r * 1.5,  this.y + this.r * 0.8,
                        this.x + this.r,          this.y - h,
                        this.x,                   this.y + this.r * 0.3);
      ctx.closePath(); ctx.fill();
    }
  }

  // ── 적 탄환 ───────────────────────────────────────────────────────────────
  class Bullet {
    // destructible: 플레이어 탄환으로 제거 가능 여부
    // alive: false가 되면 프레임 끝에서 일괄 제거 (splice 즉시 호출 금지)
    constructor(x, y, vx, vy, r, color, dmg, destructible = false) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.r = r; this.color = color; this.dmg = dmg;
      this.destructible = destructible;
      this.alive = true;
    }

    // 궤적 계산만 담당 — destructible 여부는 여기서 결정하지 않음
    static aimedFromEdge() {
      let x, y;
      if (Math.random() < 0.5) {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 : canvas.height;
      } else {
        x = Math.random() < 0.5 ? 0 : canvas.width;
        y = Math.random() * canvas.height;
      }
      const dx = player.x - x, dy = player.y - y;
      const L  = Math.hypot(dx, dy) || 1;
      const sp = 3 + score / 5000;
      // destructible=false: 생성 정책 함수에서 오버라이드
      return new Bullet(x, y, dx / L * sp, dy / L * sp, 5, '#f00', player.maxHp / 15, false);
    }

    draw() {
      if (this.destructible) {
        // 제거 가능: 초록 + 흰 외곽선
        ctx.fillStyle = '#3f3';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // 제거 불가: 기존 색 단색
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI); ctx.fill();
      }
    }

    update(dt) {
      const k = dt / FRAME_REF;
      this.x += this.vx * k;
      this.y += this.vy * k;
    }
    inBounds() {
      return this.x >= -20 && this.x <= canvas.width  + 20 &&
             this.y >= -20 && this.y <= canvas.height + 20;
    }
  }

  // ── 탄환 생성 정책 ────────────────────────────────────────────────────────
  // aimedFromEdge()는 궤적 계산, 여기서 destructible 여부를 결정함
  // 일반 탄막: 25% 확률로 destructible
  function spawnNormalBullets() {
    const b1 = Bullet.aimedFromEdge();
    const b2 = Bullet.aimedFromEdge();
    b1.destructible = Math.random() < 0.25;
    b2.destructible = Math.random() < 0.25;
    bullets.push(b1, b2);
  }

  // 보스 burst 탄환 생성: destructibleRatio 비율만큼 제거 가능으로 표시
  function spawnBossBurstBullets(bossX, bossY, bossDmg, destructibleRatio = 0.20) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a    = (2 * Math.PI * i) / n;
      const isD  = Math.random() < destructibleRatio;
      // destructible이면 초록으로 렌더되므로 color는 의미 없지만 일관성 유지
      const b = new Bullet(bossX, bossY, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 6, '#f80', bossDmg, isD);
      bullets.push(b);
    }
  }

  // ── 플레이어 탄환 ─────────────────────────────────────────────────────────
  class PlayerBullet {
    constructor(x, y, vx, vy) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.r    = 4;
      this.dmg  = PLAYER_BULLET_DMG;
      this.alive = true;
    }
    update(dt) {
      const k = dt / FRAME_REF;
      this.x += this.vx * k;
      this.y += this.vy * k;
    }
    draw() {
      ctx.shadowBlur  = 8;
      ctx.shadowColor = '#88f';
      ctx.fillStyle   = '#ccf';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI); ctx.fill();
      ctx.shadowBlur  = 0;
    }
    inBounds() {
      return this.x >= -10 && this.x <= canvas.width  + 10 &&
             this.y >= -10 && this.y <= canvas.height + 10;
    }
  }

  function firePlayerBullet(targetX, targetY) {
    if (playerFireCooldownMs > 0) return;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const L  = Math.hypot(dx, dy) || 1;
    playerBullets.push(new PlayerBullet(player.x, player.y, dx / L * 7, dy / L * 7));
    playerFireCooldownMs = PLAYER_FIRE_COOLDOWN;
  }

  // ── Boss ──────────────────────────────────────────────────────────────────
  class Boss {
    constructor() {
      this.size      = 80;
      this.x         = canvas.width  / 2;
      this.y         = canvas.height / 2;
      this.maxHp     = 600;
      this.hp        = this.maxHp;
      this.rotate    = 0;
      this.fireTickMs  = 0;
      this.phase       = 'burst';
      this.moveAngle   = 0;
      this.baseX       = canvas.width  / 2;
      this.baseY       = canvas.height / 2;
      // aimed 페이즈 연발: setTimeout 대신 내부 큐
      this.burstQueue  = 0;
      this.burstTickMs = 0;
      // 피격 flash
      this.hitFlashMs  = 0;
    }

    hit(dmg) {
      this.hp -= dmg;
      this.hitFlashMs = 80;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotate);

      if (this.hitFlashMs > 0) {
        ctx.fillStyle = '#fff';
      } else {
        const phaseColors = { burst: '#0ff', spiral: '#ffa500', aimed: '#f55' };
        ctx.fillStyle = phaseColors[this.phase] || '#0ff';
      }
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

      // HP에 따라 어두워지는 코어
      const hpRatio = this.hp / this.maxHp;
      ctx.fillStyle = `rgba(0,0,0,${0.3 + (1 - hpRatio) * 0.5})`;
      ctx.fillRect(-this.size / 4, -this.size / 4, this.size / 2, this.size / 2);

      ctx.restore();
    }

    update(dt) {
      const hpRatio = this.hp / this.maxHp;
      if      (hpRatio >= 0.70) this.phase = 'burst';
      else if (hpRatio >= 0.40) this.phase = 'spiral';
      else                       this.phase = 'aimed';

      const rotSpeeds = { burst: 0.001, spiral: 0.002, aimed: 0.004 };
      this.rotate += rotSpeeds[this.phase] * dt;

      this._updateMovement(dt);

      if (this.hitFlashMs > 0) this.hitFlashMs -= dt;

      this.fireTickMs += dt;
      const bossDmg = player.maxHp / 15; // 기존 *2에서 절반으로 낮춤

      if (this.phase === 'burst') {
        if (this.fireTickMs >= 800) {
          this.fireTickMs = 0;
          // 생성 정책 함수 — burst만 20% destructible, 나머지 페이즈는 강제 false
          spawnBossBurstBullets(this.x, this.y, bossDmg, 0.20);
        }
      } else if (this.phase === 'spiral') {
        if (this.fireTickMs >= 40) {
          this.fireTickMs = 0;
          const a = (performance.now() / 30) % (2 * Math.PI);
          // spiral: non-destructible 강제
          bullets.push(new Bullet(this.x, this.y, Math.cos(a)           * 2.8, Math.sin(a)           * 2.8, 5.5, '#ffa500', bossDmg, false));
          bullets.push(new Bullet(this.x, this.y, Math.cos(a + Math.PI) * 2.8, Math.sin(a + Math.PI) * 2.8, 5.5, '#ffa500', bossDmg, false));
        }
      } else {
        // aimed: non-destructible 강제 — 핵심 위협이므로 제거 불가
        if (this.fireTickMs >= 500 && this.burstQueue === 0) {
          this.fireTickMs  = 0;
          this.burstQueue  = 3;
          this.burstTickMs = 0;
        }
        if (this.burstQueue > 0) {
          this.burstTickMs += dt;
          if (this.burstTickMs >= 100) {
            this.burstTickMs = 0;
            this.burstQueue--;
            const dx = player.x - this.x, dy = player.y - this.y;
            const L  = Math.hypot(dx, dy) || 1;
            bullets.push(new Bullet(this.x, this.y, dx / L * 3.6, dy / L * 3.6, 6, '#f0f', bossDmg, false));
          }
        }
      }
    }

    _updateMovement(dt) {
      const k = dt / 1000;
      this.moveAngle += k;

      if (this.phase === 'burst') {
        // 중앙 기준 원형 궤도
        this.x = this.baseX + Math.cos(this.moveAngle * 0.6) * 100;
        this.y = this.baseY + Math.sin(this.moveAngle * 0.6) * 100;
      } else if (this.phase === 'spiral') {
        // 플레이어 추적 + 사인 오프셋
        const dx = player.x - this.x, dy = player.y - this.y;
        const L  = Math.hypot(dx, dy) || 1;
        this.x += (dx / L) * 60 * k + Math.sin(this.moveAngle * 3) * 30 * k;
        this.y += (dy / L) * 60 * k + Math.cos(this.moveAngle * 2) * 20 * k;
        this.x = Math.max(80, Math.min(canvas.width  - 80, this.x));
        this.y = Math.max(80, Math.min(canvas.height - 80, this.y));
      } else {
        // 빠른 지그재그 추적
        const dx = player.x - this.x, dy = player.y - this.y;
        const L  = Math.hypot(dx, dy) || 1;
        this.x += (dx / L) * 100 * k + Math.sin(this.moveAngle * 5) * 60 * k;
        this.y += (dy / L) * 100 * k + Math.cos(this.moveAngle * 4) * 40 * k;
        this.x = Math.max(80, Math.min(canvas.width  - 80, this.x));
        this.y = Math.max(80, Math.min(canvas.height - 80, this.y));
      }
    }
  }

  // ── UI 업데이트 ───────────────────────────────────────────────────────────
  function updateHpBar() {
    const pct = Math.max(0, player.hp) / player.maxHp;
    hpBarDiv.style.width = `${200 * Math.max(0, Math.min(1, pct))}px`;
    hpText.textContent   = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
  }
  function updateBossHpBar() {
    if (!bossHpFill || !boss) return;
    bossHpFill.style.width = `${240 * Math.max(0, Math.min(1, boss.hp / boss.maxHp))}px`;
  }

  // ── 초기화 ────────────────────────────────────────────────────────────────
  function initGame() {
    player = { x: 400, y: 300, r: 8, speed: 4, hp: 100, maxHp: 100, color: skins[selectedSkin].color };
    bullets           = [];
    playerBullets     = [];
    healthPacks       = [];
    effects           = [];
    score             = 0;
    gameOver          = false;
    spawnIntervalMs   = 1000;
    spawnTimerMs      = 0;
    difficultyTimerMs = 0;
    bossActive        = false;
    nextBossIdx       = 0;
    lastHealthThreshold  = 0;
    lastMaxHpThreshold   = 0;
    boss              = null;
    playerFireCooldownMs = 0;
    warningActive        = false;
    warningElapsedMs     = 0;
    isSubmittingScore    = false;
    scoreSubmitted       = false;

    menu.style.display           = 'none';
    ui.style.display             = 'block';
    canvas.style.display         = 'block';
    warningDiv.style.display     = 'none';
    gameOverScreen.style.display = 'none';
    if (bossUi) bossUi.style.display = 'none';
    submitBtn.disabled = true;
    updateHpBar();
    if (bossHpFill) bossHpFill.style.width = '240px';
    scoreSpan.textContent = 0;
    lastTime = performance.now();
  }

  function doGameOver() {
    gameOver = true;
    gameOverScreen.style.display = 'flex';
    finalScoreSpan.textContent   = score | 0;
    submitBtn.disabled           = false;
    submitBtn.textContent        = '점수 제출';
    if (score > bestScore) {
      bestScore = score | 0;
      localStorage.setItem('best', bestScore);
      bestSpan.textContent = bestScore;
    }
  }

  async function handleSubmit() {
    if (!gameOver || isSubmittingScore || scoreSubmitted) return;

    let name = localStorage.getItem('nickname');
    if (!name) {
      name = prompt('이름 입력 (한글 1~4자)');
      if (!name) return;
      if (!/^[가-힣]{1,4}$/.test(name)) { alert('이름은 한글 1~4자만'); return; }
      localStorage.setItem('nickname', name);
    }

    const normalizedName = name.trim();
    if (!normalizedName) return;

    isSubmittingScore = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '제출 중...';

    try {
      const { data: existingRows, error: fetchError } = await supabase
        .from('scores')
        .select('*')
        .eq('userId', normalizedName)
        .order('score', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const existing = existingRows && existingRows.length ? existingRows[0] : null;
      const currentScore = score | 0;

      if (!existing) {
        const { error: insertError } = await supabase
          .from('scores')
          .insert([{ userId: normalizedName, score: currentScore }]);
        if (insertError) throw insertError;
      } else if (currentScore > (existing.score | 0)) {
        const { error: updateError } = await supabase
          .from('scores')
          .update({ score: currentScore })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      }

      scoreSubmitted = true;
      submitBtn.textContent = '제출 완료';

      const { data, error: fe } = await supabase
        .from('scores')
        .select('*')
        .order('score', { ascending: false });

      if (fe) {
        boardList.innerHTML = `<li>불러오기 실패:${fe.message}</li>`;
      } else {
        const bestByName = new Map();
        for (const row of data) {
          const rowName = String(row.userId ?? '익명').trim() || '익명';
          const key = rowName.toLowerCase();
          const rowScore = row.score | 0;
          const prev = bestByName.get(key);
          if (!prev || rowScore > (prev.score | 0)) {
            bestByName.set(key, { userId: rowName, score: rowScore });
          }
        }
        const deduped = Array.from(bestByName.values())
          .sort((a, b) => (b.score | 0) - (a.score | 0));
        boardList.innerHTML = deduped
          .map((e, i) => `<li>${i + 1}위 — ${e.userId}: ${e.score}점</li>`)
          .join('');
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = '점수 제출';
      alert('저장 실패:' + (err?.message || err));
    } finally {
      isSubmittingScore = false;
    }
  }

  function maybeSpawnBoss() {
    if (nextBossIdx < bossSchedule.length && score >= bossSchedule[nextBossIdx]) {
      warningDiv.style.display = 'block';
      warningActive    = true;
      warningElapsedMs = 0;
      nextBossIdx++;
    }
  }

  // ── 이펙트 시스템 ─────────────────────────────────────────────────────────
  // effects[]는 단순 데이터 객체 배열. 클래스 불필요 — 수명과 위치만 관리.
  // type: 'ring' | 'particle'
  function spawnHitEffect(x, y) {
    const LIFESPAN = 150; // ms

    // 링 1개 — 반경이 시간에 따라 확장
    effects.push({ type: 'ring', x, y, life: LIFESPAN, maxLife: LIFESPAN });

    // 파티클 4개 — 랜덤 방향으로 짧게 퍼짐
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = 1.5 + Math.random() * 1.5; // px/frame
      effects.push({
        type: 'particle',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: LIFESPAN,
        maxLife: LIFESPAN,
      });
    }
  }

  // ── 메인 업데이트 ─────────────────────────────────────────────────────────
  function update(dt) {
    if (gameOver) return;

    // 이동
    if (keys['ArrowLeft']  || keys['a']) player.x -= player.speed * dt / FRAME_REF;
    if (keys['ArrowRight'] || keys['d']) player.x += player.speed * dt / FRAME_REF;
    if (keys['ArrowUp']    || keys['w']) player.y -= player.speed * dt / FRAME_REF;
    if (keys['ArrowDown']  || keys['s']) player.y += player.speed * dt / FRAME_REF;
    player.x = Math.max(player.r, Math.min(canvas.width  - player.r, player.x));
    player.y = Math.max(player.r, Math.min(canvas.height - player.r, player.y));

    // 발사 쿨다운
    if (playerFireCooldownMs > 0) playerFireCooldownMs -= dt;

    // 스페이스바 연사 (마우스 방향)
    if (keys[' ']) firePlayerBullet(mouseX, mouseY);

    // 적 탄환 스폰 — 생성 정책 함수 사용
    spawnTimerMs += dt;
    if (spawnTimerMs >= spawnIntervalMs) {
      spawnTimerMs -= spawnIntervalMs;
      spawnNormalBullets(); // 내부에서 25% 확률로 destructible 결정
    }
    difficultyTimerMs += dt;
    if (difficultyTimerMs >= 5000) {
      difficultyTimerMs -= 5000;
      spawnIntervalMs = Math.max(300, spawnIntervalMs - 50);
    }

    // 힐팩 스폰
    const healThr = (score | 0) / 500 | 0;
    if (healThr > lastHealthThreshold) {
      lastHealthThreshold = healThr;
      healthPacks.push(new HealthPack());
    }

    // 최대 HP 성장
    const hpIncThr = (score | 0) / 2000 | 0;
    if (hpIncThr > lastMaxHpThreshold) {
      lastMaxHpThreshold = hpIncThr;
      const inc = player.maxHp / 15;
      player.maxHp += inc; player.hp += inc;
    }

    maybeSpawnBoss();

    // 경고 타이머 — warningActive 중엔 경과 시간 누적, 완료 시 보스 스폰
    if (warningActive) {
      warningElapsedMs += dt;
      if (warningElapsedMs >= WARNING_DURATION) {
        warningActive = false;
        warningDiv.style.display = 'none';
        bossActive = true;
        boss       = new Boss();
        if (bossUi) bossUi.style.display = 'block';
      }
    }

    // 보스
    if (bossActive && boss) {
      boss.update(dt);
      // 접촉 데미지
      const dx = player.x - boss.x, dy = player.y - boss.y;
      if (Math.abs(dx) <= boss.size / 2 + player.r && Math.abs(dy) <= boss.size / 2 + player.r) {
        player.hp -= 0.2 * dt / FRAME_REF;
      }
      // 보스 사망
      if (boss.hp <= 0) {
        score     += BOSS_KILL_BONUS;
        bossActive = false;
        boss       = null;
        if (bossUi) bossUi.style.display = 'none';
      }
    }

    // 적 탄환 이동
    bullets.forEach(b => b.update(dt));

    // 플레이어 탄환 이동
    playerBullets.forEach(pb => pb.update(dt));

    // ── playerBullet vs 보스 충돌 ──
    if (bossActive && boss) {
      for (const pb of playerBullets) {
        if (!pb.alive) continue;
        const dx = pb.x - boss.x, dy = pb.y - boss.y;
        if (Math.abs(dx) <= boss.size / 2 + pb.r && Math.abs(dy) <= boss.size / 2 + pb.r) {
          boss.hit(pb.dmg);
          pb.alive = false;
        }
      }
    }

    // ── playerBullet vs destructible bullet 충돌 ──
    // 제곱거리 비교 (sqrt 없음), destructible=false는 스킵
    for (const pb of playerBullets) {
      if (!pb.alive) continue;
      for (const b of bullets) {
        if (!b.alive || !b.destructible) continue;
        const dx = pb.x - b.x, dy = pb.y - b.y;
        const rSum = pb.r + b.r;
        if (dx * dx + dy * dy < rSum * rSum) {
          pb.alive = false; // 플레이어 탄환 1발 소멸 (관통 없음)
          b.alive  = false; // 적 탄환 제거
          spawnHitEffect(b.x, b.y);
          break; // pb 소멸됨, 더 검사 불필요
        }
      }
    }

    // ── 플레이어 피격 (alive인 탄환만 체크) ──
    for (const b of bullets) {
      if (!b.alive) continue;
      const dx = b.x - player.x, dy = b.y - player.y;
      const rSum = b.r + player.r;
      if (dx * dx + dy * dy < rSum * rSum) {
        player.hp -= b.dmg;
        b.alive = false;
      }
    }

    // ── 일괄 정리 (alive=false + 화면 밖) ──
    bullets       = bullets.filter(b  => b.alive  && b.inBounds());
    playerBullets = playerBullets.filter(pb => pb.alive && pb.inBounds());

    // ── 이펙트 업데이트 ──
    effects.forEach(e => e.life -= dt);
    effects = effects.filter(e => e.life > 0);

    // 힐팩
    healthPacks.forEach((pack, i) => {
      if (Math.hypot(pack.x - player.x, pack.y - player.y) < pack.r + player.r) {
        const missing = player.maxHp - player.hp;
        player.hp = Math.min(player.maxHp, player.hp + missing * 0.1 + player.maxHp / 15);
        healthPacks.splice(i, 1);
      }
    });

    score += (dt / 1000) * SCORE_PER_SEC;
    updateHpBar();
    updateBossHpBar();
    scoreSpan.textContent = score | 0;
    if (player.hp <= 0) doGameOver();
  }

  // ── 렌더링 ────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 경계
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, 5);
    ctx.fillRect(0, 0, 5, canvas.height);
    ctx.fillRect(canvas.width - 5, 0, 5, canvas.height);
    ctx.fillRect(0, canvas.height - 5, canvas.width, 5);

    // 보스 스폰 예고 레티클 — warningActive 중에만 렌더
    if (warningActive) {
      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;
      const progress = warningElapsedMs / WARNING_DURATION; // 0 → 1
      // 링이 수축하며 스폰 지점으로 좁혀지는 연출
      const ringR  = 80 * (1 - progress) + 20;
      const alpha  = 0.4 + progress * 0.6; // 점점 진해짐
      const pulse  = Math.sin(performance.now() / 80) * 0.15; // 미세 pulse

      ctx.save();
      ctx.globalAlpha  = Math.min(1, alpha + pulse);
      ctx.strokeStyle  = '#f00';
      ctx.lineWidth    = 2;
      // 외부 링
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, 2 * Math.PI); ctx.stroke();
      // 십자선
      const armLen = ringR * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - armLen, cy); ctx.lineTo(cx + armLen, cy);
      ctx.moveTo(cx, cy - armLen); ctx.lineTo(cx, cy + armLen);
      ctx.stroke();
      // 중앙 점
      ctx.fillStyle   = '#f00';
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r / 2, 0, 2 * Math.PI); ctx.fill();

    // 조준선 (마우스 방향)
    ctx.save();
    ctx.strokeStyle = 'rgba(150,150,255,0.25)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.restore();

    // ── 이펙트 업데이트 (위치 이동) ──
    // update()에서 life 감소는 했고, 여기서 particle 이동
    effects.forEach(e => {
      if (e.type === 'particle') {
        e.x += e.vx;
        e.y += e.vy;
      }
    });

    if (bossActive && boss) boss.draw();
    healthPacks.forEach(hp => hp.draw());
    playerBullets.forEach(pb => pb.draw());
    bullets.forEach(b => b.draw());

    // ── 이펙트 렌더 (탄환 위에 그려야 잘 보임) ──
    effects.forEach(e => {
      const alpha = e.life / e.maxLife; // 1.0 → 0.0 선형 감소
      if (e.type === 'ring') {
        // 반경: 수명 남을수록 작음 → 커짐
        const r = (1 - alpha) * 12 + 3;
        ctx.save();
        ctx.globalAlpha  = alpha * 0.9;
        ctx.strokeStyle  = '#afffaf'; // 초록 계열 링
        ctx.lineWidth    = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 2 * Math.PI); ctx.stroke();
        ctx.restore();
      } else {
        // particle: 작은 흰 점
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#fff';
        ctx.beginPath(); ctx.arc(e.x, e.y, 2, 0, 2 * Math.PI); ctx.fill();
        ctx.restore();
      }
    });
  }

  // ── 게임 루프 ─────────────────────────────────────────────────────────────
  function loop(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min(50, time - lastTime);
    lastTime = time;
    update(dt); draw();
    if (!gameOver) requestAnimationFrame(loop);
  }

  // ── 이벤트 ────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

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
    firePlayerBullet(mouseX, mouseY);
  });

  btnStart.addEventListener('click', () => { initGame(); requestAnimationFrame(loop); });
  btnRetry.addEventListener('click', () => {
    menu.style.display = 'block'; ui.style.display = 'none';
    canvas.style.display = 'none'; gameOverScreen.style.display = 'none';
    gameOver = false;
  });
  submitBtn.addEventListener('click', handleSubmit);

  menu.style.display           = 'block';
  ui.style.display             = 'none';
  canvas.style.display         = 'none';
  gameOverScreen.style.display = 'none';
});
