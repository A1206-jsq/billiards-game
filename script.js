const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const messageEl = document.querySelector('#message');
const turnEl = document.querySelector('#turn');
const scoreEl = document.querySelector('#score');
const overlay = document.querySelector('#startOverlay');
const startBtn = document.querySelector('#startBtn');
const newGameBtn = document.querySelector('#newGameBtn');
const placeBtn = document.querySelector('#placeBtn');

// 物理单位：canvas 像素近似桌面长度；固定时间步避免不同刷新率导致手感不同。
const table = { x: 85, y: 75, w: 930, h: 470 };
const R = 13;
const pocketR = 27;
const pockets = [[85,75],[550,75],[1015,75],[85,545],[550,545],[1015,545]].map(([x,y])=>({x,y}));
const colors = ['#f8fafc','#facc15','#2563eb','#ef4444','#7c3aed','#f97316','#10b981','#ec4899','#dc2626','#f8fafc','#f8fafc','#f8fafc','#f8fafc','#f8fafc','#f8fafc'];
const striped = n => n >= 9;
let balls = [], running = false, dragging = false, aim = null, score = [0,0], player = 0, group = [null,null], ballInHand = false, shot = null, accumulator = 0, lastTime = 0;

function ball(x,y,n, cue=false) { return {x,y,vx:0,vy:0,r:R,n,cue,pocketed:false}; }
function cueBall() { return balls.find(b=>b.cue && !b.pocketed); }
function moving() { return balls.some(b=>!b.pocketed && Math.hypot(b.vx,b.vy) > .04); }
function setMessage(s) { messageEl.textContent = s; }
function updateHud() { turnEl.textContent = `玩家 ${player+1} 回合${group[player] ? ` · ${group[player] === 'solid' ? '全色' : '花色'}` : ''}`; scoreEl.textContent = `${score[0]} : ${score[1]}`; }
function resetGame() {
  balls = [ball(285,310,0,true)];
  // 三角架：1 在前端，8 在中间。
  const rack = [[0,0,1],[1,-1,2],[1,1,3],[2,-2,4],[2,0,8],[2,2,5],[3,-3,6],[3,-1,7],[3,1,9],[3,3,10],[4,-4,11],[4,-2,12],[4,0,13],[4,2,14],[4,4,15]];
  rack.forEach(([row,offset,n]) => balls.push(ball(715 + row * R * 1.75, 310 + offset * R * 1.04, n)));
  score=[0,0]; player=0; group=[null,null]; ballInHand=false; shot=null; running=true; overlay.classList.remove('visible'); placeBtn.disabled=true; updateHud(); setMessage('拖拽白球瞄准，释放击球');
}
function pos(e) { const r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}; }
function validPlacement(p) { if (p.x<table.x+R||p.x>table.x+table.w-R||p.y<table.y+R||p.y>table.y+table.h-R) return false; return balls.filter(b=>!b.cue&&!b.pocketed).every(b=>Math.hypot(b.x-p.x,b.y-p.y)>R*2+2); }
function shoot() {
  const c=cueBall(); if(!c||!aim||ballInHand) return;
  const dx=c.x-aim.x, dy=c.y-aim.y, len=Math.hypot(dx,dy); if(len<8) return;
  const power=Math.min(len*.16, 15); c.vx=dx/len*power; c.vy=dy/len*power;
  shot={cueHit:false, first:null, pocketed:[], eight:false, foul:false}; ballInHand=false; placeBtn.disabled=true; setMessage('击球中…');
}
canvas.addEventListener('pointerdown', e=>{
  if(!running||moving()) return; const p=pos(e), c=cueBall();
  if(ballInHand) { if(validPlacement(p)){ c.x=p.x;c.y=p.y;ballInHand=false;placeBtn.disabled=true;setMessage('白球已放置，拖动白球击球'); } return; }
  if(c && Math.hypot(p.x-c.x,p.y-c.y)<R+12) { dragging=true; aim=p; }
});
canvas.addEventListener('pointermove', e=>{ if(dragging) aim=pos(e); });
window.addEventListener('pointerup', ()=>{ if(dragging){dragging=false;shoot();} });
placeBtn.addEventListener('click',()=>{ const c=cueBall(); if(c){c.x=285;c.y=310;ballInHand=true;placeBtn.disabled=true;setMessage('点击桌面选择白球位置');} });
startBtn.addEventListener('click',resetGame); newGameBtn.addEventListener('click',resetGame);

function cushion(b) {
  const left=table.x+R,right=table.x+table.w-R,top=table.y+R,bottom=table.y+table.h-R;
  if(b.x<left){b.x=left;b.vx=-b.vx*.94;} if(b.x>right){b.x=right;b.vx=-b.vx*.94;}
  if(b.y<top){b.y=top;b.vy=-b.vy*.94;} if(b.y>bottom){b.y=bottom;b.vy=-b.vy*.94;}
}
function pocketCheck() {
  for(const b of balls) if(!b.pocketed) for(const p of pockets) if(Math.hypot(b.x-p.x,b.y-p.y)<pocketR) { b.pocketed=true;b.vx=b.vy=0;if(shot){shot.pocketed.push(b.n);if(b.n===8)shot.eight=true;} break; }
}
function collisions() {
  for(let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++) { const a=balls[i],b=balls[j]; if(a.pocketed||b.pocketed)continue; let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy); if(!d||d>=a.r+b.r)continue; const nx=dx/d,ny=dy/d, overlap=(a.r+b.r-d)/2; a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap; const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny; if(rel<0){const impulse=-(1.96)*rel/2;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;if(shot&&!shot.first){shot.first=a.cue?b.n:b.cue?a.n:null; if(shot.first)shot.cueHit=true;}} }
}
function step(dt) {
  const sub=4, h=dt/sub;
  for(let k=0;k<sub;k++){ for(const b of balls) if(!b.pocketed){b.x+=b.vx*h*60;b.y+=b.vy*h*60;b.vx*=Math.pow(.991,h*60);b.vy*=Math.pow(.991,h*60);if(Math.hypot(b.vx,b.vy)<.018)b.vx=b.vy=0;cushion(b);} collisions();pocketCheck(); }
  balls=balls.filter(b=>!b.pocketed);
  if(shot&&!moving()) finishShot();
}
function finishShot() {
  const objectPotted=shot.pocketed.filter(n=>n!==0), legal=objectPotted.filter(n=>n!==8);
  const own=(group[player]==='solid'?legal.filter(n=>n<8):group[player]==='stripe'?legal.filter(n=>n>8):legal);
  if(!shot.cueHit || shot.first===8 || (!shot.first && legal.length===0)) shot.foul=true;
  if(shot.pocketed.includes(0)) shot.foul=true;
  const remaining=balls.filter(b=>!b.cue&&b.n!==8).length;
  if(shot.eight) { const win=!!group[player]&&remaining===0&&!shot.foul; setMessage(win?`玩家 ${player+1} 获胜！`:'犯规：8 号球提前入袋，玩家 '+(1-player+1)+' 获胜'); running=false;shot=null;return; }
  if(!group[player]&&legal.length){ const first=legal[0];group[player]=first<8?'solid':'stripe';group[1-player]=group[player]==='solid'?'stripe':'solid'; }
  const keep=own.length>0&&!shot.foul; if(shot.foul){ballInHand=true;placeBtn.disabled=false;setMessage('犯规：对手获得全桌自由球');} else setMessage(keep?'继续击球':'换人回合'); if(!keep&&!shot.foul)player=1-player; if(!keep||shot.foul)updateHud(); shot=null;
}
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#08713d';ctx.fillRect(table.x,table.y,table.w,table.h); ctx.strokeStyle='#ffffff55';ctx.lineWidth=3;ctx.strokeRect(table.x,table.y,table.w,table.h);
  for(const p of pockets){ctx.beginPath();ctx.fillStyle='#020617';ctx.arc(p.x,p.y,pocketR,0,Math.PI*2);ctx.fill();}
  for(const b of balls){ if(b.pocketed)continue;ctx.beginPath();ctx.fillStyle=colors[b.n];ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fill(); if(striped(b.n)){ctx.save();ctx.beginPath();ctx.arc(b.x,b.y,R*.65,0,Math.PI*2);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(b.x-R,b.y-R*.28,R*2,R*.56);ctx.restore();}ctx.beginPath();ctx.fillStyle='#ffffff88';ctx.arc(b.x-R*.35,b.y-R*.35,R*.28,0,Math.PI*2);ctx.fill(); if(b.n&&b.n!==0){ctx.fillStyle='#111827';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.n,b.x,b.y);}}
  const c=cueBall(); if(dragging&&c&&aim){ctx.beginPath();ctx.strokeStyle='#fff';ctx.setLineDash([8,8]);ctx.moveTo(c.x,c.y);ctx.lineTo(aim.x,aim.y);ctx.stroke();ctx.setLineDash([]);}
  if(ballInHand&&c){ctx.strokeStyle='#fbbf24';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(c.x,c.y,R+7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
}
function loop(t){if(!lastTime)lastTime=t;accumulator+=Math.min((t-lastTime)/1000,.05);lastTime=t;while(accumulator>=1/120){if(running&&!ballInHand)step(1/120);accumulator-=1/120;}draw();requestAnimationFrame(loop);}
resetGame(); overlay.classList.add('visible'); running=false; requestAnimationFrame(loop);
