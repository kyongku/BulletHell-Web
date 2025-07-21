const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// 플레이어
const player = { x: W/2, y: H/2, r: 15, speed: 4, hp: 100 };
let keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// 탄환 클래스
class Bullet {
    constructor() {
        const corners = [{x:0,y:0},{x:W,y:0},{x:0,y:H},{x:W,y:H}];
        const c = corners[Math.floor(Math.random() * 4)];
        this.x = c.x; this.y = c.y;
        const dx = player.x - this.x, dy = player.y - this.y;
        const len = Math.hypot(dx, dy);
        this.vx = dx / len * 3;
        this.vy = dy / len * 3;
        this.r = 6;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
    draw() {
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
        ctx.fill();
    }
}
let bullets = [];
let score = 0;

// UI 요소
const hpBarDiv = document.getElementById('hpBar');
const scoreSpan = document.getElementById('score');
const submitBtn = document.getElementById('submitScore');
const boardList = document.getElementById('boardList');

function update() {
    // 플레이어 이동
    if (keys['ArrowLeft'] || keys['a']) player.x -= player.speed;
    if (keys['ArrowRight'] || keys['d']) player.x += player.speed;
    if (keys['ArrowUp'] || keys['w']) player.y -= player.speed;
    if (keys['ArrowDown'] || keys['s']) player.y += player.speed;
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    player.y = Math.max(player.r, Math.min(H - player.r, player.y));

    // 탄환 업데이트 및 제거
    bullets.forEach(b => b.update());
    bullets = bullets.filter(b => b.x >= -10 && b.x <= W+10 && b.y >= -10 && b.y <= H+10);

    // 충돌 검사
    bullets.forEach(b => {
        const dx = b.x - player.x, dy = b.y - player.y;
        if (Math.hypot(dx, dy) < b.r + player.r) {
            player.hp -= 10;
            b.y = H * 2; // 화면 밖으로 내보내 제거
        }
    });

    score++;
    updateUI();
}

function draw() {
    ctx.clearRect(0, 0, W, H);
    // 플레이어
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, 2 * Math.PI);
    ctx.fill();
    // 탄환
    bullets.forEach(b => b.draw());
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 탄환 생성 주기
setInterval(() => bullets.push(new Bullet()), 800);

// UI 갱신
function updateUI() {
    const pct = Math.max(0, player.hp) / 100;
    hpBarDiv.innerHTML = `<div style="width:${pct*100}%"></div>`;
    scoreSpan.textContent = score;
}

gameLoop();

// 점수 제출 및 리더보드 fetch (백엔드 예시)
submitBtn.onclick = async () => {
    const name = prompt('이름 입력');
    if (!name) return;
    await fetch('https://example.com/submit', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ userId: name, score })
    });
    fetchBoard();
};
async function fetchBoard() {
    const resp = await fetch('https://example.com/scores');
    const data = await resp.json();
    boardList.innerHTML = data.map(x => `<li>${x.userId}: ${x.score}</li>`).join('');
}
