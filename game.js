// Modified game.js with hard mode, pink heart health packs, HP gain, and HP text
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://racbwrlvquamhqbqzsix.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhY2J3cmx2cXVhbWhxYnF6c2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMTM0MzMsImV4cCI6MjA2ODY4OTQzM30.pT24RRHE4oX9__fdldUT6Cic5P4MgGFk1HiIM46gXGE';
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
  const hpText         = document.createElement('div');
  hpText.id = 'hpText';
  hpText.style.position = 'absolute';
  hpText.style.width = '200px';
  hpText.style.textAlign = 'center';
  hpText.style.fontSize = '12px';
  hpText.style.color = '#fff';
  document.getElementById('hpBarContainer').appendChild(hpText);

  // 상태
  let player, bullets, healthPacks, score, gameOver;
  let spawnIntervalMs, spawnTimerMs, difficultyTimerMs;
  let nextBossIdx=0, bossSchedule=[3000,6000,9000];
  let bossActive=false, bossTimerMs=0, bossDurationMs=15000;
  let lastHealthThreshold=0, lastMaxHpThreshold=0, keys={};
  let boss = null;

  let lastTime = 0;
  const FRAME_REF = 16.6667;
  const SCORE_PER_SEC = 60;

  // 스킨 & 최고점
  const skins = [
    {color:'#ff0',cost:0},
    {color:'#0f0',cost:5000},
    {color:'#fff',cost:10000}
  ];
  let selectedSkin=0;
  let bestScore = parseInt(localStorage.getItem('best')||'0',10);
  bestSpan.textContent = bestScore;

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
      this.r=8; this.color='#ff66cc';
      this.x=Math.random()*(canvas.width-20)+10;
      this.y=Math.random()*(canvas.height-20)+10;
    }
    draw(){
      ctx.fillStyle=this.color;
      ctx.beginPath();
      const topCurveHeight = this.r * 0.3;
      ctx.moveTo(this.x, this.y + this.r * 0.3);
      ctx.bezierCurveTo(this.x - this.r, this.y - topCurveHeight,
                        this.x - this.r*1.5, this.y + this.r*0.8,
                        this.x, this.y + this.r*1.6);
      ctx.bezierCurveTo(this.x + this.r*1.5, this.y + this.r*0.8,
                        this.x + this.r, this.y - topCurveHeight,
                        this.x, this.y + this.r * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 탄환
  class Bullet {
    constructor(x,y,vx,vy,r,color,dmg){
      this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.r=r; this.color=color; this.dmg=dmg;
    }
    static aimedFromEdge(){
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
      const sp=3 + score/5000;
      const vx=dx/L*sp, vy=dy/L*sp;
      return new Bullet(x,y,vx,vy,5,'#f00',player.maxHp/15);
    }
    draw(){
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,2*Math.PI); ctx.fill();
    }
    update(dt){
      const k = dt/FRAME_REF;
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
      this.phase='burst';
    }
    draw(){
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotate);
      ctx.fillStyle='#0ff';
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
      ctx.restore();
    }
    update(dt){
      const r = this.hp / this.maxHp;
      if (r >= 0.70) this.phase = 'burst';
      else if (r >= 0.40) this.phase = 'spiral';
      else this.phase = 'aimed';

      this.rotate += 0.002 * dt;
      this.fireTickMs += dt;

      const bossDmg = player.maxHp/15*2;
      if(this.phase==='burst'){
        if(this.fireTickMs>=800){
          this.fireTickMs=0;
          const n=16;
          for(let i=0;i<n;i++){
            const a = (2*Math.PI*i)/n;
            const vx = Math.cos(a)*2.2, vy=Math.sin(a)*2.2;
            bullets.push(new Bullet(this.x,this.y,vx,vy,6,'#ff0',bossDmg));
          }
        }
      } else if(this.phase==='spiral'){
        if(this.fireTickMs>=40){
          this.fireTickMs=0;
          const a = (performance.now()/30)%(2*Math.PI);
          const vx = Math.cos(a)*2.8, vy=Math.sin(a)*2.8;
          bullets.push(new Bullet(this.x,this.y,vx,vy,5.5,'#ffa500',bossDmg));
        }
      } else {
        if(this.fireTickMs>=500){
          this.fireTickMs=0;
          for(let k=0;k<3;k++){
            const delay=k*100;
            setTimeout(()=>{
              if(!bossActive||!player) return;
              const dx=player.x-this.x, dy=player.y-this.y;
              const L=Math.hypot(dx,dy)||1;
              const sp=3.6;
              const vx=dx/L*sp, vy=dy/L*sp;
              bullets.push(new Bullet(this.x,this.y,vx,vy,6,'#0ff',bossDmg));
            }, delay);
          }
        }
      }
      const hpDecayPerMs = this.maxHp / bossDurationMs;
      this.hp = Math.max(0, this.hp - hpDecayPerMs * dt);
    }
  }

  function updateHpBar(){
    const pct = Math.max(0, player.hp)/player.maxHp;
    hpBarDiv.style.width = `${200*Math.max(0,Math.min(1,pct))}px`;
    hpText.textContent = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
  }
  function updateBossHpBar(){
    if(!bossHpFill || !boss) return;
    const pct = boss.hp / boss.maxHp;
    bossHpFill.style.width = `${240*Math.max(0,Math.min(1,pct))}px`;
  }

  function initGame(){
    player={x:400,y:300,r:8,speed:4,hp:100,maxHp:100,color:skins[selectedSkin].color};
    bullets=[]; healthPacks=[]; score=0; gameOver=false;
    spawnIntervalMs=1000; spawnTimerMs=0; difficultyTimerMs=0;
    bossActive=false; bossTimerMs=0; nextBossIdx=0; lastHealthThreshold=0; lastMaxHpThreshold=0; boss=null;
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

  async function handleSubmit(){
    if (!gameOver) return;
    let name = localStorage.getItem('nickname');
    if (!name) {
      name = prompt('이름 입력 (한글 1~4자)');
      if (!name) return;
      const re = /^[가-힣]{1,4}$/;
      if (!re.test(name)){ alert('이름은 한글 1~4자만'); return; }
      localStorage.setItem('nickname', name);
    }
    const {error:ie}=await supabase.from('scores').insert([{userId:name,score:score|0}]);
    if(ie){ alert('저장 실패:'+ie.message); return; }
    const {data, error:fe}=await supabase.from('scores').select('*').order('score',{ascending:false});
    if(fe) boardList.innerHTML=`<li>불러오기 실패:${fe.message}</li>`;
    else boardList.innerHTML=data.map((e,i)=>`<li>${i+1}위 — ${e.userId}: ${e.score}점</li>`).join('');
  }

  function maybeSpawnBoss(){
    if(nextBossIdx<bossSchedule.length && score>=bossSchedule[nextBossIdx]){
      warningDiv.style.display = 'block';
      setTimeout(() => {
        warningDiv.style.display = 'none';
        bossActive = true;
        bossTimerMs = 0;
        boss = new Boss();
        if(bossUi) bossUi.style.display='block';
      }, 1000);
      nextBossIdx++;
    }
  }

  function update(dt){
    if(gameOver) return;
    if(keys['ArrowLeft']||keys['a']) player.x-=player.speed*dt/FRAME_REF;
    if(keys['ArrowRight']||keys['d']) player.x+=player.speed*dt/FRAME_REF;
    if(keys['ArrowUp']||keys['w']) player.y-=player.speed*dt/FRAME_REF;
    if(keys['ArrowDown']||keys['s']) player.y+=player.speed*dt/FRAME_REF;
    player.x=Math.max(player.r,Math.min(canvas.width-player.r,player.x));
    player.y=Math.max(player.r,Math.min(canvas.height-player.r,player.y));

    spawnTimerMs+=dt;
    if(spawnTimerMs>=spawnIntervalMs){
      spawnTimerMs-=spawnIntervalMs;
      bullets.push(Bullet.aimedFromEdge());
      bullets.push(Bullet.aimedFromEdge());
    }
    difficultyTimerMs+=dt;
    if(difficultyTimerMs>=5000){
      difficultyTimerMs-=5000;
      spawnIntervalMs=Math.max(300,spawnIntervalMs-50);
    }

    let healThr=(score|0)/500|0;
    if(healThr>lastHealthThreshold){
      lastHealthThreshold=healThr;
      healthPacks.push(new HealthPack());
    }

    let hpIncThr=(score|0)/2000|0;
    if(hpIncThr>lastMaxHpThreshold){
      lastMaxHpThreshold=hpIncThr;
      const inc=player.maxHp/15;
      player.maxHp+=inc;
      player.hp+=inc;
    }

    maybeSpawnBoss();

    if(bossActive && boss){
      bossTimerMs+=dt;
      boss.update(dt);
      const dx=player.x-boss.x, dy=player.y-boss.y;
      const half=boss.size/2;
      if(Math.abs(dx)<=half+player.r && Math.abs(dy)<=half+player.r){
        player.hp -= 0.2 * dt/FRAME_REF;
      }
      if(bossTimerMs>=bossDurationMs || boss.hp<=0){
        bossActive=false; boss=null;
        bossUi.style.display='none';
      }
    }

    bullets.forEach(b=>b.update(dt));
    bullets=bullets.filter(b=>b.inBounds());
    bullets.forEach(b=>{
      const dx=b.x-player.x, dy=b.y-player.y;
      if(Math.hypot(dx,dy)<b.r+player.r){
        player.hp-=b.dmg;
        b.y=1e4;
      }
    });

    healthPacks.forEach((hpPack,i)=>{
      const dx=hpPack.x-player.x, dy=hpPack.y-player.y;
      if(Math.hypot(dx,dy)<hpPack.r+player.r){
        const missing=player.maxHp-player.hp;
        const healAmt=missing*0.05 + (player.maxHp/15)*0.5;
        player.hp=Math.min(player.maxHp, player.hp+healAmt);
        healthPacks.splice(i,1);
      }
    });

    score += (dt/1000) * SCORE_PER_SEC;
    updateHpBar();
    updateBossHpBar();
    scoreSpan.textContent = (score|0);
    if(player.hp<=0) doGameOver();
  }

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
    if(bossActive && boss) boss.draw();
    healthPacks.forEach(hp=>hp.draw());
    bullets.forEach(b=>b.draw());
  }

  function loop(time){
    if(!lastTime) lastTime = time;
    const dt = Math.min(50, time - lastTime);
    lastTime = time;
    update(dt); draw();
    if(!gameOver) requestAnimationFrame(loop);
  }

  window.addEventListener('keydown',e=>keys[e.key]=true);
  window.addEventListener('keyup',e=>keys[e.key]=false);

  btnStart.addEventListener('click', ()=>{ initGame(); requestAnimationFrame(loop); });
  btnRetry.addEventListener('click', ()=>{
    menu.style.display='block'; ui.style.display='none';
    canvas.style.display='none'; gameOverScreen.style.display='none';
    gameOver=false;
  });
  submitBtn.addEventListener('click', handleSubmit);

  menu.style.display='block';
  ui.style.display='none';
  canvas.style.display='none';
  gameOverScreen.style.display='none';
});
