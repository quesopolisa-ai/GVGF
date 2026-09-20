window.Pong = function(canvas, ctx, W, H){
  var pw = 12, ph = 90;
  var BASE = 6.1, MAXSPD = 500, HMULT = 1.2, RANGE = 0.5;
  var BARMAX = 10, MTRMAX = 520, WIN = 11;

  var p1, p2, ball, mult, over, winner;

  var DIFFS = [
    {n:'EASY',            sp:3.5,  er:60, tm:140, dz:14, mode:'n'},
    {n:'NORMAL',          sp:6,    er:22, tm:60,  dz:6,  mode:'n'},
    {n:'HARD',            sp:9,    er:8,  tm:30,  dz:3,  mode:'n'},
    {n:'IMPOSSIBLE',      sp:20,   er:0,  tm:8,   dz:1,  mode:'n'},
    {n:'VERY IMPOSSIBLE', sp:9999, er:0,  tm:0,   dz:0,  mode:'t'},
    {n:'IMPENETRABLE',    sp:9999, er:0,  tm:0,   dz:0,  mode:'t'}
  ];

  var S1=0, S2=1, SP=2, SO=3;
  var st = S1;
  var pk1=1, pk2=1, sl1=1, sl2=1;
  var t1, t2, lt1, lt2;

  function init(){
    p1 = {x:20, y:H/2 - ph/2, score:0};
    p2 = {x:W - 20 - pw, y:H/2 - ph/2, score:0};
    ball = {x:W/2, y:H/2, r:8, vx:BASE, vy:3};
    mult = 1; over = false; winner = 0;
    t1 = H/2; t2 = H/2; lt1 = 0; lt2 = 0;
  }

  function bspd(){ return Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy); }

  function clamp(){
    var s = bspd();
    if(s > MAXSPD){ var k = MAXSPD/s; ball.vx *= k; ball.vy *= k; }
  }

  function rball(d){
    ball.x = W/2; ball.y = H/2; mult = 1;
    ball.vx = BASE*d; ball.vy = Math.random()*6 - 3;
  }

  function rmatch(){
    p1.score = 0; p2.score = 0; over = false; winner = 0;
    rball(Math.random() < 0.5 ? 1 : -1);
  }

  function pred(x0, y0, vx, vy, tx){
    if(Math.abs(vx) < 0.0001) return y0;
    var t = (tx - x0) / vx;
    if(t < 0) return y0;
    var y = y0 + vy*t;
    var p = 2*H;
    var r = ((y % p) + p) % p;
    if(r > H) r = p - r;
    return r;
  }

  function think(pad, pr){
    var t;
    if(pad === p1 && ball.vx < 0)      t = pred(ball.x, ball.y, ball.vx, ball.vy, pad.x + pw);
    else if(pad === p2 && ball.vx > 0) t = pred(ball.x, ball.y, ball.vx, ball.vy, pad.x);
    else                               t = H/2;
    return t + (Math.random()*2 - 1) * pr.er;
  }

  function move(pad, tg, pr, dt){
    if(pr.mode === 't'){
      pad.y = tg - ph/2;
      pad.y = Math.max(0, Math.min(H - ph, pad.y));
      return;
    }
    var ctr = pad.y + ph/2;
    var d = tg - ctr;
    if(Math.abs(d) < pr.dz) return;
    var m = Math.sign(d) * pr.sp * dt;
    if(Math.abs(m) > Math.abs(d)) m = d;
    pad.y += m;
    pad.y = Math.max(0, Math.min(H - ph, pad.y));
  }

  function hit(b, pad){
    var x1 = pad.x, y1 = pad.y, x2 = pad.x + pw, y2 = pad.y + ph;
    if(b.x + b.r < x1 || b.x - b.r > x2 || b.y + b.r < y1 || b.y - b.r > y2) return 0;
    var dl = Math.abs(b.x + b.r - x1);
    var dr = Math.abs(x2 - (b.x - b.r));
    var dtp = Math.abs(b.y + b.r - y1);
    var db = Math.abs(y2 - (b.y - b.r));
    var m = Math.min(dl, dr, dtp, db);
    if(m === dl) return 1;
    if(m === dr) return 2;
    if(m === dtp) return 3;
    return 4;
  }

  function resolve(b, pad, sd){
    if(sd === 1){ b.x = pad.x - b.r - 0.5; b.vx = -Math.abs(b.vx); }
    else if(sd === 2){ b.x = pad.x + pw + b.r + 0.5; b.vx = Math.abs(b.vx); }
    else if(sd === 3){ b.y = pad.y - b.r - 0.5; b.vy = -Math.abs(b.vy); }
    else { b.y = pad.y + ph + b.r + 0.5; b.vy = Math.abs(b.vy); }

    if(sd === 1 || sd === 2){
      var rel = (b.y - (pad.y + ph/2)) / (ph/2);
      rel = Math.max(-1, Math.min(1, rel));
      var mg = bspd() * HMULT;
      var an = rel * 0.8 + (Math.random()*2 - 1) * RANGE;
      b.vx = Math.cos(an) * mg * (sd === 2 ? 1 : -1);
      b.vy = Math.sin(an) * mg;
      mult *= HMULT;
      clamp();
    }
  }

  function upd(now, dt){
    if(over) return;
    var pr1 = DIFFS[pk1], pr2 = DIFFS[pk2];

    if(now - lt1 >= pr1.tm){ t1 = think(p1, pr1); lt1 = now; }
    if(now - lt2 >= pr2.tm){ t2 = think(p2, pr2); lt2 = now; }

    move(p1, t1, pr1, dt);
    move(p2, t2, pr2, dt);

    var px = ball.x, py = ball.y;
    ball.x += ball.vx*dt;
    ball.y += ball.vy*dt;

    if(ball.y - ball.r < 0){ ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
    if(ball.y + ball.r > H){ ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); }

    var dx = ball.x - px, dy = ball.y - py;
    var ss = Math.min(pw, ball.r) / 2;
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / ss));
    var h = false;

    for(var i = 1; i <= steps && !h; i++){
      var t = i / steps;
      var bx = px + dx*t, by = py + dy*t;
      var tb = {x:bx, y:by, r:ball.r};
      var a = hit(tb, p1);
      if(a){ ball.x = bx; ball.y = by; resolve(ball, p1, a); h = true; break; }
      var b2 = hit(tb, p2);
      if(b2){ ball.x = bx; ball.y = by; resolve(ball, p2, b2); h = true; break; }
    }

    if(!h){
      var f1 = hit(ball, p1); if(f1) resolve(ball, p1, f1);
      var f2 = hit(ball, p2); if(f2) resolve(ball, p2, f2);
    }

    if(ball.x + ball.r < 0){
      p2.score++;
      if(p2.score >= WIN){ over = true; winner = 2; st = SO; }
      else rball(1);
    }
    if(ball.x - ball.r > W){
      p1.score++;
      if(p1.score >= WIN){ over = true; winner = 1; st = SO; }
      else rball(-1);
    }
  }

  function bar(bx, by, bw, bh, r, lb){
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh);
    var rr = Math.max(0, Math.min(r, 1));
    var g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#0f0'); g.addColorStop(0.5, '#ff0'); g.addColorStop(1, '#f00');
    ctx.fillStyle = g; ctx.fillRect(bx, by, rr*bw, bh);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
    ctx.font = '11px monospace'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'center';
    ctx.fillText(lb, W/2, by + bh + 12); ctx.textAlign = 'left';
  }

  function dch(){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.font = '28px monospace';
    var isP1 = (st === S1), col = isP1 ? '#0f0' : '#f00';
    ctx.fillStyle = col;
    ctx.fillText('CHOOSE ' + (isP1 ? 'GREEN (left)' : 'RED (right)') + ' BOT', W/2, 50);
    var cur = isP1 ? sl1 : sl2;
    for(var i = 0; i < DIFFS.length; i++){
      var y = 110 + i*50;
      if(i === cur){ ctx.fillStyle = col; ctx.fillRect(W/2 - 220, y - 26, 440, 42); }
      ctx.fillStyle = (i === cur) ? '#000' : '#aaa';
      ctx.font = '20px monospace';
      ctx.fillText(DIFFS[i].n, W/2, y);
    }
    ctx.fillStyle = '#666'; ctx.font = '14px monospace';
    ctx.fillText('UP/DOWN = move  |  ENTER = select  |  ESC = menu', W/2, H - 25);
    ctx.textAlign = 'left';
  }

  function dpl(){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#333'; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.setLineDash([]);

    var m1 = DIFFS[pk1].mode, m2 = DIFFS[pk2].mode;
    ctx.fillStyle = (m1 === 't') ? '#00ffff' : '#0f0'; ctx.fillRect(p1.x, p1.y, pw, ph);
    ctx.fillStyle = (m2 === 't') ? '#ff00ff' : '#f00'; ctx.fillRect(p2.x, p2.y, pw, ph);

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();

    ctx.font = '48px monospace';
    ctx.fillStyle = '#0f0'; ctx.fillText(p1.score, W/2 - 80, 130);
    ctx.fillStyle = '#f00'; ctx.fillText(p2.score, W/2 + 50, 130);

    bar((W - 240)/2, 8, 240, 14, mult/BARMAX, 'MULT ' + mult.toFixed(2) + 'x');
    var sp = bspd();
    bar((W - 240)/2, 50, 240, 14, sp/MTRMAX, 'SPEED ' + sp.toFixed(1) + ' px/f' + (sp >= MAXSPD ? ' [MAX]' : ''));

    ctx.font = '12px monospace';
    ctx.fillStyle = (m1 === 't') ? '#00ffff' : '#0f0';
    ctx.fillText(DIFFS[pk1].n, W/2 - 160, H - 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = (m2 === 't') ? '#ff00ff' : '#f00';
    ctx.fillText(DIFFS[pk2].n, W/2 + 160, H - 20);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.fillText('first to ' + WIN + '  |  ESC = menu', W/2, H - 20);
    ctx.textAlign = 'left';

    if(over){
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, H/2 - 70, W, 140);
      ctx.font = '36px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = winner === 1 ? '#0f0' : '#f00';
      ctx.fillText((winner === 1 ? 'GREEN' : 'RED') + ' WINS', W/2, H/2 - 10);
      ctx.font = '16px monospace'; ctx.fillStyle = '#aaa';
      ctx.fillText('SPACE = rematch  |  C = change bots  |  ESC = menu', W/2, H/2 + 30);
      ctx.textAlign = 'left';
    }
  }

  function drw(){
    if(st === S1 || st === S2) dch();
    else dpl();
  }

  function key(e){
    var k = e.key;
    if(k === 'Escape' || k === 'Esc'){ stop(); return; }

    if(st === S1 || st === S2){
      if(k === 'ArrowUp' || k === 'ArrowDown'){
        var cur = (st === S1) ? sl1 : sl2;
        cur += (k === 'ArrowUp' ? -1 : 1);
        if(cur < 0) cur = DIFFS.length - 1;
        if(cur >= DIFFS.length) cur = 0;
        if(st === S1) sl1 = cur; else sl2 = cur;
        e.preventDefault();
      } else if(k === 'Enter'){
        if(st === S1){ pk1 = sl1; st = S2; }
        else { pk2 = sl2; st = SP; rmatch(); lt1 = 0; lt2 = 0; t1 = H/2; t2 = H/2; }
        e.preventDefault();
      }
      return;
    }

    if(st === SO){
      if(k === ' ' || k === 'Spacebar'){
        st = SP; rmatch(); lt1 = 0; lt2 = 0; t1 = H/2; t2 = H/2;
        e.preventDefault();
      } else if(k === 'c' || k === 'C'){
        st = S1; sl1 = pk1; sl2 = pk2;
        e.preventDefault();
      }
    }
  }

  var raf = null, last = 0;

  function loop(now){
    var dt = (now - last) / 16.667;
    if(dt > 1.5) dt = 1.5;
    last = now;
    if(st === SP || st === SO) upd(now, dt);
    drw();
    raf = requestAnimationFrame(loop);
  }

  function start(){
    init();
    st = S1; sl1 = 1; sl2 = 1; pk1 = 1; pk2 = 1;
    document.removeEventListener('keydown', key, true);
    document.addEventListener('keydown', key, true);
    last = performance.now();
    if(raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stop(){
    if(raf){ cancelAnimationFrame(raf); raf = null; }
    document.removeEventListener('keydown', key, true);
  }

  return { start: start, stop: stop };
};
