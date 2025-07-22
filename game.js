// game.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://racbwrlvquamhqbqzsix.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…'; // 교체
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

  // 상태
  let player, bullets, healthPacks, score, gameOver, tick, spawnInterval;
  let bossSchedule = [3000,6000,9000], nextBossIdx=0;
  let bossActive=false, bossTimer=0, bossDuration=1500;
  let lastHealthThreshold=0, keys={};

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

  // 탄환
  class Bullet {
    constructor(isBoss=false){
      this.isBoss=isBoss;
      if(!isBoss){
        // 모서리 랜덤 스폰
        if(Math.random()<0.5){
          this.x=Math.random()*canvas.width;
          this.y=Math.random()<0.5?0:canvas.height;
        } else {
          this.x=Math.random()<0.5?0:canvas.width;
          this.y=Math.random()*canvas.height;
        }
        const dx=player.x-this.x, dy=player.y-this.y;
        const L=Math.hypot(dx,dy), sp=3+score/2000;
        this.vx=dx/L*sp; this.vy=dy/L*sp;
        this.r=5; this.color='#f00'; this.dmg=10;
      } else {
        // 보스 중앙
        this.x=canvas.width/2; this.y=canvas.height/2;
        this.r=6; this.color='#ff0'; this.dmg=20;
        const angle=Math.random()*2*Math.PI;
        this.vx=Math.cos(angle)*2; this.vy=Math.sin(angle)*2;
      }
    }
    update(){this.x+=this.vx; this.y+=this.vy;}
    draw(){
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,2*Math.PI); ctx.fill();
    }
  }

  // HP 바
  function updateHpBar(){
    const pct = player.hp/player.maxHp;
    hpBarDiv.style.width = `${200*pct}px`;
  }

  // 초기화
  function initGame(){
    player={x:400,y:300,r:8,speed:4,hp:100,maxHp:100,color:skins[selectedSkin].color};
    bullets=[]; healthPacks=[]; score=0; gameOver=false; tick=0; spawnInterval=1000;
    bossActive=false; bossTimer=0; nextBossIdx=0; lastHealthThreshold=0;

    menu.style.display='none';
    ui.style.display='block';
    canvas.style.display='block';
    warningDiv.style.display='none';
    gameOverScreen.style.display='none';
    submitBtn.disabled=true;

    updateHpBar();
    scoreSpan.textContent=score;
  }

  // 게임오버
  function doGameOver(){
    gameOver=true;
    gameOverScreen.style.display='flex';
    finalScoreSpan.textContent=score;
    submitBtn.disabled=false;
    if(score>bestScore){
      bestScore=score;
      localStorage.setItem('best',bestScore);
      bestSpan.textContent=bestScore;
    }
  }

  // 점수 제출 & 조회
  async function handleSubmit(){
    if(!gameOver) return;
    const name=prompt('이름 입력'); if(!name) return;
    const {error:ie}=await supabase.from('scores').insert([{userId:name,score}]);
    if(ie){ alert('저장 실패:'+ie.message); return; }
    const {data, error:fe}=await supabase.from('scores').select('*').order('score',{ascending:false});
    if(fe) boardList.innerHTML=`<li>불러오기 실패:${fe.message}</li>`;
    else boardList.innerHTML=data.map((e,i)=>`<li>${i+1}위 — ${e.userId}: ${e.score}점</li>`).join('');
  }

  // 업데이트
  function update(){
    if(gameOver) return;
    tick+=16;

    // 이동
    if(keys['ArrowLeft']||keys['a']) player.x-=player.speed;
    if(keys['ArrowRight']||keys['d']) player.x+=player.speed;
    if(keys['ArrowUp']||keys['w']) player.y-=player.speed;
    if(keys['ArrowDown']||keys['s']) player.y+=player.speed;
    player.x=Math.max(player.r,Math.min(canvas.width-player.r,player.x));
    player.y=Math.max(player.r,Math.min(canvas.height-player.r,player.y));

    // 일반 탄환 2발
    if(tick%spawnInterval<16){
      bullets.push(new Bullet(false));
      bullets.push(new Bullet(false));
    }
    if(spawnInterval>300 && tick%5000<16) spawnInterval-=50;

    // 헬스팩 1000점마다
    let thr=Math.floor(score/1000);
    if(thr>lastHealthThreshold){
      lastHealthThreshold=thr;
      healthPacks.push(new HealthPack());
    }

    // 보스 스케줄
    if(nextBossIdx<bossSchedule.length && score>=bossSchedule[nextBossIdx]){
      warningDiv.style.display='block';
      setTimeout(()=>{
        warningDiv.style.display='none';
        bossActive=true; bossTimer=0;
      },1000);
      nextBossIdx++;
    }

    // 보스 동작
    if(bossActive){
      bossTimer+=16;
      if(bossTimer<bossDuration){
        // 보스 탄환 초당 2발
        if(tick%500<16){
          bullets.push(new Bullet(true));
          bullets.push(new Bullet(true));
        }
      } else {
        bossActive=false;
      }
    }

    bullets.forEach(b=>b.update());
    bullets=bullets.filter(b=>b.x>=-20&&b.x<=canvas.width+20&&b.y>=-20&&b.y<=canvas.height+20);

    // 충돌
    bullets.forEach(b=>{
      const dx=b.x-player.x,dy=b.y-player.y;
      if(Math.hypot(dx,dy)<b.r+player.r){
        player.hp-=b.dmg;
        b.y=1e4;
      }
    });
    healthPacks.forEach((hp,i)=>{
      const dx=hp.x-player.x,dy=hp.y-player.y;
      if(Math.hypot(dx,dy)<hp.r+player.r){
        player.hp=Math.min(player.maxHp,player.hp+hp.r);
        healthPacks.splice(i,1);
      }
    });

    score++;
    updateHpBar();
    scoreSpan.textContent=score;

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

    ctx.fillStyle=player.color;
    ctx.beginPath();
    ctx.arc(player.x,player.y,player.r/2,0,2*Math.PI);
    ctx.fill();

    healthPacks.forEach(hp=>hp.draw());
    bullets.forEach(b=>b.draw());
  }

  // 루프
  function loop(){
    update(); draw();
    if(!gameOver) requestAnimationFrame(loop);
  }

  // 입력
  window.addEventListener('keydown',e=>keys[e.key]=true);
  window.addEventListener('keyup',  e=>keys[e.key]=false);

  // 버튼
  btnStart.addEventListener('click', ()=>{ initGame(); loop(); });
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
