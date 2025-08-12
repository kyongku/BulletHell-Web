// game.js (fixed-time scoring + boss HP phases + 1s warning)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://racbwrlvquamhqbqzsix.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhY2J3cmx2cXVhbWhxYnF6c2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMTM0MzMsImV4cCI6MjA2ODY4OTQzM30.pT24RRHE4oX9__fdldUT6Cic5P4MgGFk1HiIM46gXGE'; // 교체
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', ()=>{
  // DOM
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

  // 상태
  let player, bullets, healthPacks, score, gameOver;
  let spawnIntervalMs, spawnTimerMs, difficultyTimerMs;
  let nextBossIdx=0, bossSchedule=[3000,6000,9000];
  let bossActive=false, bossTimerMs=0, bossDurationMs=15000;
  let lastHealthThreshold=0, keys={};
  let boss = null;

  // 시간 고정용
  let lastTime = 0;
  const FRAME_REF = 16.6667; // 60fps 기준 프레임(ms)
  const SCORE_PER_SEC = 60;  // 1초당 60점 고정

  // 스킨 & 최고점
  const skins = [
    {color:'#ff0',cost:0},
    {color:'#0f0',cost:5000},
    {color:'#fff',cost:10000}
  ];
  let selectedSkin=0;
  let bestScore = parseInt(localStorage.getItem('best')||'0',10);
  bestSpan.textContent = bestScore;

  // 스킨 UI
  skins.forEach((s,i)=>{
    const d=document.createElement('div');
    d.className='skin';
    d.style.background=s.color;
    if(bestScore<s.cost) d.classList.add('locked');
    d.onclick=()=>{
      if(bestScore>=s.cost){
        selectedSkin=i;
        document.querySelectorAll('.skin').forEach(x=>x.style.borderColor='#fff');
        d.style.borderColor='#f00';
      }
    };
    skinsDiv.appendChild(d);
  });
  document.querySelectorAll('.skin')[0].style.borderColor='#f00';

  // 헬스팩
  class HealthPack {
    constructor(){
      this.r=6; this.color='#f0f';
      this.x=Math.random()*(canvas.width-20)+10;
      this.y=Math.random()*(canvas.height-20)+10;
    }
    draw(){
      ctx.fillStyle=this.color;
      ctx.fillRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2);
    }
  }

  // 탄환: 속도는 '프레임 기준'으로 정의 후 dt 비례 이동
  class Bullet {
    constructor(x,y,vx,vy,r,color,dmg){
      this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.r=r; this.color=color; this.dmg=dmg;
    }
    static aimedFromEdge(){
      // 모서리 랜덤 스폰 → 플레이어 조준
      let x,y;
      if(Math.random()<0.5){
        x=Math.random()*canvas.width;
        y=Math.random()<0.5?0:canvas.height;
      } else {
        x=Math.random()<0.5?0:canvas.width;
        y=Math.random()*canvas.height;
      }
      const dx=player.x-x, dy=player.y-y;
      const L=Math.hypot(dx,dy)||1;
      // 속도 증가량 80%로 축소 (기존 3 + score/4000 → 3 + score/5000)
      const sp=3 + score/5000;
      const vx=dx/L*sp, vy=dy/L*sp; // px/프레임(60fps 기준)
      return new Bullet(x,y,vx,vy,5,'#f00',10);
    }
    draw(){
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,2*Math.PI); ctx.fill();
    }
    update(dt){
      const k = dt/FRAME_REF; // 프레임 보정
      this.x += this.vx * k;
      this.y += this.vy * k;
    }
    inBounds(){
      return (this.x>=-20&&this.x<=canvas.width+20&&this.y>=-20&&this.y<=canvas.height+20);
    }
  }

  // 보스 (정사각형)
  class Boss {
    constructor(){
      this.size=80;
      this.x=canvas.width/2;
      this.y=canvas.height/2;
      this.maxHp=400;
      this.hp=this.maxHp;
      this.fireTickMs=0;
      this.rotate=0;
      this.phase='burst'; // 시작 페이즈
    }
    draw(){
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotate);
      ctx.fillStyle='#0ff';
      const s=this.size;
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.restore();
    }
    update(dt){
      // HP 기반 페이즈 전환
      const r = this.hp / this.maxHp;
      if (r >= 0.70) this.phase = 'burst';
      else if (r >= 0.40) this.phase = 'spiral';
      else this.phase = 'aimed';

      // 회전
      this.rotate += 0.002 * dt;

      // 시간 누적
      this.fireTickMs += dt;

      // 각 페이즈별 패턴/속도
      if(this.phase==='burst'){
        // 0.8초마다 원형 탄막 16발
        if(this.fireTickMs>=800){
          this.fireTickMs=0;
          const n=16;
          for(let i=0;i<n;i++){
            const a = (2*Math.PI*i)/n;
            const vx = Math.cos(a)*2.2, vy=Math.sin(a)*2.2;
            bullets.push(new Bullet(this.x,this.y,vx,vy,6,'#ff0',20));
          }
        }
      } else if(this.phase==='spiral'){
        // 연속 나선 탄막 (조금 더 빠름)
        if(this.fireTickMs>=40){
          this.fireTickMs=0;
          const a = (performance.now()/ 30) % (2*Math.PI);
          const vx = Math.cos(a)*2.8, vy=Math.sin(a)*2.8;
          bullets.push(new Bullet(this.x,this.y,vx,vy,5.5,'#ffa500',18));
        }
      } else { // aimed
        // 플레이어 조준 삼연타 (더 빠름)
        if(this.fireTickMs>=500){
          this.fireTickMs=0;
          for(let k=0;k<3;k++){
            const delay = k*100;
            setTimeout(()=>{
              if(!bossActive || !player) return;
              const dx=player.x-this.x, dy=player.y-this.y;
              const L=Math.hypot(dx,dy)||1;
              const sp=3.6;
              const vx=dx/L*sp, vy=dy/L*sp;
              bullets.push(new Bullet(this.x,this.y,vx,vy,6,'#0ff',22));
            }, delay);
          }
        }
      }

      // 임시: 보스 HP를 시간에 따라 서서히 감소시켜 페이즈 전환이 일어나도록 함
      // (추후 플레이어 공격/스킬 시스템과 연결 예정)
      const hpDecayPerMs = this.maxHp / bossDurationMs;
      this.hp = Math.max(0, this.hp - hpDecayPerMs * dt);
    }
  }

  // HP 바
  function updateHpBar(){
    const pct = Math.max(0, player.hp)/player.maxHp;
    hpBarDiv.style.width = `${200*Math.max(0,Math.min(1,pct))}px`;
  }
  function updateBossHpBar(){
    if(!bossHpFill || !boss) return;
    const pct = boss.hp / boss.maxHp;
    bossHpFill.style.width = `${240*Math.max(0,Math.min(1,pct))}px`;
  }

  // 초기화
  function initGame(){
    player={x:400,y:300,r:8,speed:4,hp:100,maxHp:100,color:skins[selectedSkin].color};
    bullets=[]; healthPacks=[]; score=0; gameOver=false;
    spawnIntervalMs=1000; spawnTimerMs=0; difficultyTimerMs=0;
    bossActive=false; bossTimerMs=0; nextBossIdx=0; lastHealthThreshold=0; boss=null;

    menu.style.display='none';
    ui.style.display='block';
    canvas.style.display='block';
    warningDiv.style.display='none';
    gameOverScreen.style.display='none';
    if(bossUi) bossUi.style.display='none';
    submitBtn.disabled=true;

    updateHpBar();
    if(bossHpFill) bossHpFill.style.width='240px';
    scoreSpan.textContent=score;

    lastTime = performance.now();
  }

  // 게임오버
  function doGameOver(){
    gameOver=true;
    gameOverScreen.style.display='flex';
    finalScoreSpan.textContent=score|0;
    submitBtn.disabled=false;
    if(score>bestScore){
      bestScore=score|0;
      localStorage.setItem('best',bestScore);
      bestSpan.textContent=bestScore;
    }
  }

  // 점수 제출 & 조회
  async function handleSubmit(){
    if (!gameOver) return;
    let name = localStorage.getItem('nickname');
    if (!name) {
      name = prompt('이름 입력 (한글 1~4자), 이름은 한번 저장되면 바꿀수 없으니 조심 하세요!');
      if (!name) return;
      const re = /^[가-힣]{1,4}$/;
      if (!re.test(name)){
        alert('이름은 한글 1~4자만 가능합니다.');
        return;
      }
      localStorage.setItem('nickname', name);
    }
    const {error:ie}=await supabase.from('scores').insert([{userId:name,score:score|0}]);
    if(ie){ alert('저장 실패:'+ie.message); return; }
    const {data, error:fe}=await supabase.from('scores').select('*').order('score',{ascending:false});
    if(fe) boardList.innerHTML=`<li>불러오기 실패:${fe.message}</li>`;
    else boardList.innerHTML=data.map((e,i)=>`<li>${i+1}위 — ${e.userId}: ${e.score}점</li>`).join('');
  }

  // 보스 스폰 트리거
  function maybeSpawnBoss(){
    if(nextBossIdx<bossSchedule.length && score>=bossSchedule[nextBossIdx]){
      warningDiv.style.display = 'block';
      setTimeout(() => {
        warningDiv.style.display = 'none';
        bossActive = true;
        bossTimerMs = 0;
        boss = new Boss();
        if(bossUi) bossUi.style.display='block';
      }, 1000); // 1초 경고
      nextBossIdx++;
    }
  }

  // 업데이트
  function update(dt){
    if(gameOver) return;

    // 이동 (dt-independent: frame-based speed로 처리)
    if(keys['ArrowLeft']||keys['a']) player.x-=player.speed*dt/FRAME_REF;
    if(keys['ArrowRight']||keys['d']) player.x+=player.speed*dt/FRAME_REF;
    if(keys['ArrowUp']||keys['w']) player.y-=player.speed*dt/FRAME_REF;
    if(keys['ArrowDown']||keys['s']) player.y+=player.speed*dt/FRAME_REF;
    player.x=Math.max(player.r,Math.min(canvas.width-player.r,player.x));
    player.y=Math.max(player.r,Math.min(canvas.height-player.r,player.y));

    // 일반 탄환 스폰 (시간 누적식)
    spawnTimerMs += dt;
    if(spawnTimerMs>=spawnIntervalMs){
      spawnTimerMs -= spawnIntervalMs;
      bullets.push(Bullet.aimedFromEdge());
      bullets.push(Bullet.aimedFromEdge());
    }
    // 난이도 상승 (5초마다 스폰 간격 감소, 최소 300ms)
    difficultyTimerMs += dt;
    if(difficultyTimerMs>=5000){
      difficultyTimerMs -= 5000;
      spawnIntervalMs = Math.max(300, spawnIntervalMs - 50);
    }

    // 헬스팩 1000점마다
    let thr=(score|0)/1000|0;
    if(thr>lastHealthThreshold){
      lastHealthThreshold=thr;
      healthPacks.push(new HealthPack());
    }

    // 보스 스케줄
    maybeSpawnBoss();

    // 보스 동작
    if(bossActive && boss){
      bossTimerMs += dt;
      boss.update(dt);

      // (선택) 플레이어와 보스 충돌시 지속 피해
      const dx=player.x-boss.x, dy=player.y-boss.y;
      const half=boss.size/2;
      if(Math.abs(dx)<=half+player.r && Math.abs(dy)<=half+player.r){
        player.hp -= 0.2 * dt/FRAME_REF;
      }

      // 보스 종료 조건: 시간 또는 HP 0
      if(bossTimerMs >= bossDurationMs || boss.hp<=0){
        bossActive=false; boss=null;
        if(bossUi) bossUi.style.display='none';
      }
    }

    // 탄환 갱신/충돌
    bullets.forEach(b=>b.update(dt));
    bullets=bullets.filter(b=>b.inBounds());
    bullets.forEach(b=>{
      const dx=b.x-player.x,dy=b.y-player.y;
      if(Math.hypot(dx,dy)<b.r+player.r){
        player.hp-=b.dmg;
        b.y=1e4;
      }
    });

    // 헬스팩
    healthPacks.forEach((hp,i)=>{
      const dx=hp.x-player.x,dy=hp.y-player.y;
      if(Math.hypot(dx,dy)<hp.r+player.r){
        player.hp=Math.min(player.maxHp,player.hp+hp.r);
        healthPacks.splice(i,1);
      }
    });

    // 점수(고정 시간 기준): 1초당 60점
    score += (dt/1000) * SCORE_PER_SEC;

    // HP/점수 UI
    updateHpBar();
    updateBossHpBar();
    scoreSpan.textContent = (score|0);

    if(player.hp<=0) doGameOver();
  }

  // 렌더
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,5);
    ctx.fillRect(0,0,5,canvas.height);
    ctx.fillRect(canvas.width-5,0,5,canvas.height);
    ctx.fillRect(0,canvas.height-5,canvas.width,5);

    // 플레이어 (원)
    ctx.fillStyle=player.color;
    ctx.beginPath();
    ctx.arc(player.x,player.y,player.r/2,0,2*Math.PI);
    ctx.fill();

    // 보스 (정사각형)
    if(bossActive && boss){
      boss.draw();
    }

    healthPacks.forEach(hp=>hp.draw());
    bullets.forEach(b=>b.draw());
  }

  // 루프
  function loop(time){
    if(!lastTime) lastTime = time;
    const dt = Math.min(50, time - lastTime); // 안전 캡
    lastTime = time;
    update(dt); draw();
    if(!gameOver) requestAnimationFrame(loop);
  }

  // 입력
  window.addEventListener('keydown',e=>keys[e.key]=true);
  window.addEventListener('keyup',  e=>keys[e.key]=false);

  // 버튼
  btnStart.addEventListener('click', ()=>{ initGame(); requestAnimationFrame(loop); });
  btnRetry.addEventListener('click', ()=>{
    menu.style.display='block'; ui.style.display='none';
    canvas.style.display='none'; gameOverScreen.style.display='none';
    gameOver=false;
  });
  submitBtn.addEventListener('click', handleSubmit);

  // 초기
  menu.style.display='block';
  ui.style.display='none';
  canvas.style.display='none';
  gameOverScreen.style.display='none';
});
