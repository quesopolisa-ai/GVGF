window.Sword = function(canvas, ctx, W, H){
  var GROUND = H - 60;
  var GRAV = 0.6, JUMP = -13;
  var BH = 90, BW = 22, HR = 11;

  // Difficulty: crit chance scaled by tier. No dodge — that's armor/emblem only.
  var DIFFS = [
    {n:'EASY',    spd:2.7, react:400, pred:0.0,  jump:0.05, aggr:0.35, crit:0.10},
    {n:'NORMAL',  spd:3.9, react:240, pred:0.25, jump:0.15, aggr:0.55, crit:0.20},
    {n:'HARD',    spd:5.1, react:140, pred:0.55, jump:0.25, aggr:0.75, crit:0.40},
    {n:'INSANE',  spd:6.3, react:80,  pred:0.80, jump:0.35, aggr:0.90, crit:0.55},
    {n:'GODLIKE', spd:7.5, react:40,  pred:1.00, jump:0.45, aggr:1.00, crit:0.75}
  ];

  var SWORDS = [
    {n:'DAGGER',      reach:60,  dmg:9,  cd:162, color:'#cfd8dc'},
    {n:'SHORT SWORD', reach:70,  dmg:15, cd:229, color:'#b0bec5'},
    {n:'LONGSWORD',   reach:100,  dmg:18, cd:324, color:'#e0e0e0'},
    {n:'GREATSWORD',  reach:120, dmg:28, cd:448, color:'#ffd54f'},
    {n:'KATANA',      reach:95,  dmg:19, cd:248, color:'#80deea'},
    {n:'RAPIER',      reach:102,  dmg:15, cd:191, color:'#f48fb1'}
  ];

  var ARMORS = [
    {n:'NONE',        hp:100, dr:0,  adodge:0.00, color:'#666'},
    {n:'LEATHER',     hp:120, dr:10, adodge:0.05, color:'#8d6e63'},
    {n:'CHAINMAIL',   hp:150, dr:15, adodge:0.10, color:'#9e9e9e'},
    {n:'PLATE',       hp:200, dr:25, adodge:0.20, color:'#cfd8dc'},
    {n:'DRAGONSCALE', hp:260, dr:35, adodge:0.40, color:'#66bb6a'}
  ];

  // Emblems modify HP, DR, dodge, damage output, and lifesteal.
  // hpMult  — multiplies armor HP
  // drMod   — added to armor DR (percent, can go negative)
  // dodgeMod— added to armor dodge (fraction)
  // dmgMult — multiplies outgoing sword damage
  // steal   — fraction of damage dealt that heals self
  var EMBLEMS = [
    {n:'NONE',     desc:'No modifiers',                    hpMult:1.0, drMod:0,   dodgeMod:0.00, dmgMult:1.0, steal:0.00},
    {n:'ASSASSIN', desc:'+150% dmg, -40% HP',               hpMult:0.6, drMod:0,   dodgeMod:0.00, dmgMult:2.5, steal:0.00},
    {n:'TANK',     desc:'+50% HP, +20% DR, -20% dmg',      hpMult:1.5, drMod:20,  dodgeMod:0.00, dmgMult:0.8, steal:0.00},
    {n:'FIGHTER',  desc:'+10% DR, +50% lifesteal, +10% dodge', hpMult:1.0, drMod:10,  dodgeMod:0.10, dmgMult:1.0, steal:0.50},
    {n:'HEALER',   desc:'+100% HP, -20% DR, +5% dodge',   hpMult:2.0, drMod:-20, dodgeMod:0.05, dmgMult:1.0, steal:0.00}
  ];

  var CLASH_LOCKOUT_MS = 600;

  var SEL = 0, FIGHT = 1, OVER = 2;
  var st = SEL;
  var pickStage = 0;
  // 8 stages per side: sword, armor, emblem, difficulty (x2)
  var selIdx = [1, 0, 0, 1, 1, 0, 0, 1];

  var STAGES = [
    {label:'GREEN SWORD',      items:SWORDS,  col:'#0f0'},
    {label:'GREEN ARMOR',      items:ARMORS,  col:'#0f0'},
    {label:'GREEN EMBLEM',     items:EMBLEMS, col:'#0f0'},
    {label:'GREEN DIFFICULTY', items:DIFFS,   col:'#0f0'},
    {label:'RED SWORD',        items:SWORDS,  col:'#f00'},
    {label:'RED ARMOR',        items:ARMORS,  col:'#f00'},
    {label:'RED EMBLEM',       items:EMBLEMS, col:'#f00'},
    {label:'RED DIFFICULTY',   items:DIFFS,   col:'#f00'}
  ];

  var f1, f2, over = false, winner = 0;
  var texts = [], sparks = [];

  function totalReach(sw){ return 28 + sw.reach; }

  function mkFighter(x, dir, swIdx, arIdx, emIdx, dfIdx, col){
    var sw = SWORDS[swIdx];
    var ar = ARMORS[arIdx];
    var em = EMBLEMS[emIdx];
    var df = DIFFS[dfIdx];

    // Compute combined stats
    var maxHp  = Math.round(ar.hp * em.hpMult);
    var dr     = ar.dr + em.drMod;                  // percent, can be negative
    var dodge  = Math.min(0.95, ar.adodge + em.dodgeMod);

    return {
      x:x, y:0, vx:0, vy:0, onGround:true, dir:dir,
      sw:sw, ar:ar, em:em, df:df, col:col,
      hp:maxHp, maxHp:maxHp,
      dr:dr, dodge:dodge,
      dmgMult: em.dmgMult,
      steal: em.steal,
      cd:0, swing:0, resolved:false,
      stun:0, flash:0, lthink:0, qjump:false, qdodge:0,
      clashCd: 0,
      hx: x + dir*22, hy: GROUND - BH + 30,
      pHx:0, pHy:0, pTx:0, pTy:0,
      tx:0, ty:0
    };
  }

  function initFight(){
    f1 = mkFighter(180,  1, selIdx[0], selIdx[1], selIdx[2], selIdx[3], '#0f0');
    f2 = mkFighter(620, -1, selIdx[4], selIdx[5], selIdx[6], selIdx[7], '#f00');
    over = false; winner = 0; texts = []; sparks = [];
    st = FIGHT;
  }

  function spark(x, y, color, n){
    for(var i = 0; i < n; i++){
      var a = Math.random()*Math.PI*2, s = 1.5 + Math.random()*3;
      sparks.push({x:x, y:y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 1, life:1, color:color});
    }
  }

  // Attacker deals damage to target. Rolls crit, applies dmg multiplier,
  // applies target DR (can be negative = more damage taken), handles lifesteal.
  function damage(attacker, target){
    var crit = Math.random() < attacker.df.crit;
    var critMult = crit ? 1.5 : 1.0;
    var raw = attacker.sw.dmg * attacker.dmgMult * critMult;

    // DR can be negative (healer) — then damage is amplified
    var drFrac = target.dr / 100;
    var dmg = Math.max(1, Math.round(raw * (1 - drFrac)));

    target.hp -= dmg;
    target.flash = 1;
    target.stun = Math.max(target.stun, 140);
    target.vx += (target.x < attacker.x ? -1 : 1) * 3;

    texts.push({
      x: target.x,
      y: GROUND - BH - target.y - 30,
      vy: -0.9, life: 1,
      text: (crit ? 'CRIT -' : '-') + dmg,
      color: crit ? '#ffcc33' : '#ff5252',
      big: crit
    });

    // Sparks — bigger burst on crit
    spark(target.x, GROUND - BH/2 - target.y, crit ? '#ffcc33' : '#fff', crit ? 20 : 12);

    // Lifesteal
    if(attacker.steal > 0){
      var heal = Math.max(1, Math.round(dmg * attacker.steal));
      var before = attacker.hp;
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      var actualHeal = attacker.hp - before;
      if(actualHeal > 0){
        texts.push({
          x: attacker.x,
          y: GROUND - BH - attacker.y - 30,
          vy: -0.9, life: 1,
          text: '+' + actualHeal,
          color: '#66ff88'
        });
      }
    }

    if(target.hp <= 0){
      target.hp = 0;
      over = true;
      winner = (target === f1) ? 2 : 1;
      st = OVER;
    }
  }

  function dodgePop(t, srcX){
    t.vx += (t.x < srcX ? -1 : 1) * 4;
    texts.push({
      x: t.x,
      y: GROUND - BH - t.y - 30,
      vy: -0.9, life: 1,
      text: 'DODGE',
      color: '#66ccff'
    });
    spark(t.x, GROUND - BH/2 - t.y, '#66ccff', 10);
  }

  function shoulder(f){
    return { x: f.x + f.dir*6, y: (GROUND - f.y) - BH + 20 };
  }

  function poseHand(f, dt){
    var sh = shoulder(f);
    var tx, ty;

    if(f.swing > 0){
      var t = 1 - f.swing;
      var ang;

      if(t < 0.2){
        ang = -Math.PI * 0.55;
      } else if(t < 0.65){
        var u = (t - 0.2) / 0.45;
        ang = -Math.PI * 0.55 + u * Math.PI * 0.9;
      } else {
        ang = Math.PI * 0.35;
      }

      var worldAng = (f.dir > 0) ? ang : (Math.PI - ang);

      var armLen = 26 + f.sw.reach * 0.35;
      tx = sh.x + Math.cos(worldAng) * armLen;
      ty = sh.y + Math.sin(worldAng) * armLen;
    } else {
      tx = sh.x + f.dir * 22;
      ty = sh.y - 4;
    }

    var rate = f.swing > 0 ? 0.75 : 0.3;
    f.hx += (tx - f.hx) * rate * dt;
    f.hy += (ty - f.hy) * rate * dt;
  }

  function updateTip(f){
    var sh = shoulder(f);
    var dx = f.hx - sh.x, dy = f.hy - sh.y;
    var len = Math.sqrt(dx*dx + dy*dy) || 1;
    f.tx = f.hx + (dx/len) * f.sw.reach;
    f.ty = f.hy + (dy/len) * f.sw.reach;
  }

  function segRect(x1, y1, x2, y2, rx1, ry1, rx2, ry2){
    var dx = x2 - x1, dy = y2 - y1;
    var t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy];
    var q = [x1 - rx1, rx2 - x1, y1 - ry1, ry2 - y1];
    for(var i = 0; i < 4; i++){
      if(p[i] === 0){
        if(q[i] < 0) return false;
      } else {
        var r = q[i] / p[i];
        if(p[i] < 0){ if(r > t1) return false; if(r > t0) t0 = r; }
        else        { if(r < t0) return false; if(r < t1) t1 = r; }
      }
    }
    return true;
  }

  function bladeHits(f, target){
    var bx1 = target.x - BW/2;
    var bx2 = target.x + BW/2;
    var by1 = GROUND - BH - target.y;
    var by2 = GROUND - target.y;

    var N = 12;
    for(var i = 0; i <= N; i++){
      var u = i / N;
      var hx = f.pHx + (f.hx - f.pHx) * u;
      var hy = f.pHy + (f.hy - f.pHy) * u;
      var tx = f.pTx + (f.tx - f.pTx) * u;
      var ty = f.pTy + (f.ty - f.pTy) * u;
      if(segRect(hx, hy, tx, ty, bx1, by1, bx2, by2)) return true;
    }
    return false;
  }

  function segSeg(x1,y1,x2,y2,x3,y3,x4,y4){
    var d = (x2-x1)*(y4-y3) - (y2-y1)*(x4-x3);
    if(Math.abs(d) < 0.0001) return null;
    var t = ((x3-x1)*(y4-y3) - (y3-y1)*(x4-x3)) / d;
    var u = ((x3-x1)*(y2-y1) - (y3-y1)*(x2-x1)) / d;
    if(t >= 0 && t <= 1 && u >= 0 && u <= 1){
      return { x: x1 + t*(x2-x1), y: y1 + t*(y2-y1) };
    }
    return null;
  }

  function startSwing(f, now){
    if(f.cd > 0 || f.stun > 0 || f.swing > 0) return;
    if(f.clashCd > now) return;
    f.swing = 1;
    f.resolved = false;
    f.cd = f.sw.cd;
  }

  function think(f, opp, now){
    var df = f.df;
    var dist = Math.abs(f.x - opp.x);
    var myReach = totalReach(f.sw);

    var predictX = opp.x + opp.vx * df.pred * 10;
    var aim = Math.abs(f.x - predictX);

    if(aim < myReach - 10 && f.cd <= 0 && f.stun <= 0 && Math.random() < df.aggr){
      startSwing(f, now);
      return;
    }

    if(f.onGround && Math.random() < df.jump * 0.25 && dist > myReach) f.qjump = true;

    var ideal = myReach * 0.7;
    if(dist > ideal + 20)               f.vx += f.dir * df.spd * 0.4;
    else if(dist < ideal - 20 && Math.random() > df.aggr * 0.5)
                                        f.vx -= f.dir * df.spd * 0.35;
  }

  function stepFighter(f, opp, now, dt){
    if(now - f.lthink >= f.df.react){ think(f, opp, now); f.lthink = now; }

    f.cd = Math.max(0, f.cd - dt * 16.667);
    f.stun = Math.max(0, f.stun - dt * 16.667);
    f.flash = Math.max(0, f.flash - dt * 0.06);

    if(f.qjump && f.onGround){ f.vy = JUMP; f.onGround = false; f.qjump = false; }
    if(f.qdodge !== 0){ f.vx += f.qdodge * f.df.spd * 1.4; f.qdodge = 0; }

    f.x += f.vx * dt;
    f.vx *= 0.85;
    f.vy += GRAV * dt;
    f.y -= f.vy * dt;

    if(f.y <= 0){ f.y = 0; f.vy = 0; f.onGround = true; }
    if(f.x < 40)   { f.x = 40; f.vx = 0; }
    if(f.x > W-40) { f.x = W-40; f.vx = 0; }

    f.pHx = f.hx; f.pHy = f.hy; f.pTx = f.tx; f.pTy = f.ty;

    if(f.swing > 0){
      var prevSwing = f.swing;
      f.swing = Math.max(0, f.swing - dt * 0.1155);
      poseHand(f, dt);
      updateTip(f);

      if(!f.resolved && prevSwing <= 0.9 && prevSwing >= 0.15){
        if(bladeHits(f, opp)){
          if(Math.random() < opp.dodge){
            dodgePop(opp, f.x);
          } else {
            damage(f, opp);
            spark(f.tx, f.ty, f.sw.color, 14);
          }
          f.resolved = true;
          f.swing = Math.min(f.swing, 0.2);
        }
      }
    } else {
      poseHand(f, dt);
      updateTip(f);
    }
  }

  function step(now, dt){
    if(over) return;

    stepFighter(f1, f2, now, dt);
    stepFighter(f2, f1, now, dt);

    if(f1.swing > 0.25 && f2.swing > 0.25){
      var clash = segSeg(f1.hx, f1.hy, f1.tx, f1.ty, f2.hx, f2.hy, f2.tx, f2.ty);
      if(clash){
        f1.swing = 0; f2.swing = 0;

        var nudge1 = 18 + Math.random() * 16;
        var nudge2 = 18 + Math.random() * 16;
        f1.x -= f1.dir * nudge1;
        f2.x -= f2.dir * nudge2;

        f1.vx -= f1.dir * 7;
        f2.vx -= f2.dir * 7;

        f1.cd = Math.max(f1.cd, CLASH_LOCKOUT_MS);
        f2.cd = Math.max(f2.cd, CLASH_LOCKOUT_MS);
        f1.clashCd = now + CLASH_LOCKOUT_MS;
        f2.clashCd = now + CLASH_LOCKOUT_MS;

        spark(clash.x, clash.y, '#ff0', 18);
        texts.push({x:clash.x, y:clash.y - 20, vy:-0.8, life:1, text:'CLASH', color:'#ffee55'});
      }
    }

    var gap = Math.abs(f1.x - f2.x);
    if(gap < BW + 4){
      var push = (BW + 4 - gap) / 2;
      if(f1.x < f2.x){ f1.x -= push; f2.x += push; }
      else           { f1.x += push; f2.x -= push; }
    }

    if(f1.x < f2.x){ f1.dir = 1; f2.dir = -1; }
    else           { f1.dir = -1; f2.dir = 1; }

    for(var i = texts.length - 1; i >= 0; i--){
      var t = texts[i]; t.y += t.vy*dt; t.life -= dt*0.02;
      if(t.life <= 0) texts.splice(i, 1);
    }
    for(var s = sparks.length - 1; s >= 0; s--){
      var p = sparks[s]; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 0.25*dt; p.life -= dt*0.04;
      if(p.life <= 0) sparks.splice(s, 1);
    }
  }

  function drawFighter(f){
    var body = f.flash > 0.5 ? '#fff' : f.ar.color;
    var gy = GROUND - f.y;

    var sc = Math.max(0.3, 1 - f.y/200);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(f.x, GROUND + 2, 18*sc, 4*sc, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = body;
    ctx.fillRect(f.x - BW/2, gy - BH, BW, BH);
    ctx.beginPath(); ctx.arc(f.x, gy - BH - HR, HR, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = f.col;
    ctx.fillRect(f.x + (f.dir > 0 ? 4 : -8), gy - BH - HR - 2, 4, 4);

    var sh = shoulder(f);
    var dx = f.hx - sh.x, dy = f.hy - sh.y;
    var alen = Math.sqrt(dx*dx + dy*dy);
    if(alen > 60){
      f.hx = sh.x + dx*(60/alen); f.hy = sh.y + dy*(60/alen);
      dx = f.hx - sh.x; dy = f.hy - sh.y;
    }
    var px = -dy, py = dx;
    var pl = Math.sqrt(px*px + py*py) || 1;
    var bend = f.swing > 0 ? 14 : 6;
    var sgn = f.dir > 0 ? 1 : -1;
    var ex = sh.x + dx*0.5 + (px/pl)*bend*-sgn;
    var ey = sh.y + dy*0.5 + (py/pl)*bend*-sgn;

    ctx.strokeStyle = body; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(ex, ey); ctx.lineTo(f.hx, f.hy); ctx.stroke();

    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(f.hx, f.hy, 4, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = f.sw.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(f.hx, f.hy); ctx.lineTo(f.tx, f.ty); ctx.stroke();

    var gdx = f.tx - f.hx, gdy = f.ty - f.hy;
    var gl = Math.sqrt(gdx*gdx + gdy*gdy) || 1;
    ctx.strokeStyle = '#444'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.hx - (-gdy/gl*6), f.hy - (gdx/gl*6));
    ctx.lineTo(f.hx + (-gdy/gl*6), f.hy + (gdx/gl*6));
    ctx.stroke();

    var w = 80, bh2 = 7;
    var bx = f.x - w/2, by = gy - BH - HR - 30;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, w, bh2);
    ctx.fillStyle = f.col; ctx.fillRect(bx, by, w*Math.max(0, f.hp/f.maxHp), bh2);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, w, bh2);

    ctx.font = '10px monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'center';
    ctx.fillText(f.sw.n + ' / ' + f.ar.n + ' / ' + f.em.n, f.x, by - 6);
    ctx.textAlign = 'left';
  }

  function drawArena(){
    var sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#0a0a14'); sky.addColorStop(1, '#141414');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GROUND);
    ctx.fillStyle = '#221a14'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    for(var i = 100; i < W; i += 100){
      ctx.beginPath(); ctx.moveTo(i, GROUND); ctx.lineTo(i, H); ctx.stroke();
    }
  }

  function drawHUD(){
    var dodge1 = Math.round(f1.dodge * 100);
    var dodge2 = Math.round(f2.dodge * 100);
    var crit1  = Math.round(f1.df.crit * 100);
    var crit2  = Math.round(f2.df.crit * 100);

    // GREEN side
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f0';
    ctx.fillText('GREEN: ' + f1.sw.n + ' / ' + f1.ar.n + ' / ' + f1.em.n + ' / ' + f1.df.n, 16, 22);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#0a0';
    ctx.fillText('HP ' + f1.hp + '/' + f1.maxHp +
                 '   DR ' + f1.dr + '%' +
                 '   Dodge ' + dodge1 + '%' +
                 '   Crit ' + crit1 + '%', 16, 38);

    // RED side
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f00';
    ctx.fillText(f2.df.n + ' / ' + f2.em.n + ' / ' + f2.ar.n + ' / ' + f2.sw.n + ' :RED', W - 16, 22);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#a00';
    ctx.fillText('HP ' + f2.hp + '/' + f2.maxHp +
                 '   DR ' + f2.dr + '%' +
                 '   Dodge ' + dodge2 + '%' +
                 '   Crit ' + crit2 + '%', W - 16, 38);

    ctx.textAlign = 'center';
    ctx.font = '11px monospace';
    ctx.fillStyle = '#666';
    ctx.fillText('ESC = back to menu', W/2, H - 12);
    ctx.textAlign = 'left';

    if(over){
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, H/2 - 70, W, 140);
      ctx.font = '36px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = winner === 1 ? '#0f0' : '#f00';
      ctx.fillText((winner === 1 ? 'GREEN' : 'RED') + ' WINS', W/2, H/2 - 10);
      ctx.font = '16px monospace'; ctx.fillStyle = '#aaa';
      ctx.fillText('SPACE = rematch  |  C = change loadout  |  ESC = menu', W/2, H/2 + 30);
      ctx.textAlign = 'left';
    }
  }

  function drawFight(){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    drawArena();

    for(var i = 0; i < sparks.length; i++){
      var p = sparks[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    drawFighter(f1);
    drawFighter(f2);

    for(var t = 0; t < texts.length; t++){
      var ft = texts[t];
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.fillStyle = ft.color || '#ff5252';
      ctx.font = (ft.big ? 'bold 20px' : 'bold 16px') + ' monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;

    drawHUD();
  }

  function drawSelect(){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    var stage = STAGES[pickStage];
    var items = stage.items;
    var cur = selIdx[pickStage];
    var isArmor  = (stage.items === ARMORS);
    var isEmblem = (stage.items === EMBLEMS);

    ctx.textAlign = 'center'; ctx.font = '22px monospace';
    ctx.fillStyle = stage.col;
    ctx.fillText('CHOOSE ' + stage.label, W/2, 40);

    var startY = 90, lineH = 46;
    for(var i = 0; i < items.length; i++){
      var y = startY + i*lineH;
      if(i === cur){
        ctx.fillStyle = stage.col;
        ctx.fillRect(W/2 - 320, y - 26, 640, 38);
      }
      ctx.fillStyle = (i === cur) ? '#000' : '#ccc';
      ctx.font = '18px monospace'; ctx.textAlign = 'left';
      ctx.fillText(items[i].n, W/2 - 300, y);

      if(isArmor){
        ctx.font = '12px monospace';
        ctx.fillStyle = (i === cur) ? '#111' : '#666';
        ctx.textAlign = 'right';
        var stat = 'HP ' + items[i].hp +
                   '   DR ' + items[i].dr + '%' +
                   '   Dodge ' + Math.round(items[i].adodge * 100) + '%';
        ctx.fillText(stat, W/2 + 300, y);
        ctx.textAlign = 'left';
      } else if(isEmblem){
        ctx.font = '12px monospace';
        ctx.fillStyle = (i === cur) ? '#111' : '#666';
        ctx.textAlign = 'right';
        ctx.fillText(items[i].desc, W/2 + 300, y);
        ctx.textAlign = 'left';
      }
    }

    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    var summary = [];
    if(pickStage > 3){
      summary.push('G: ' + SWORDS[selIdx[0]].n + ' / ' + ARMORS[selIdx[1]].n + ' / ' + EMBLEMS[selIdx[2]].n + ' / ' + DIFFS[selIdx[3]].n);
    }
    if(pickStage > 7){
      summary.push('R: ' + SWORDS[selIdx[4]].n + ' / ' + ARMORS[selIdx[5]].n + ' / ' + EMBLEMS[selIdx[6]].n + ' / ' + DIFFS[selIdx[7]].n);
    }
    if(summary.length){
      ctx.fillStyle = '#444';
      ctx.fillText(summary.join('   '), W/2, H - 50);
    }
    ctx.fillStyle = '#666';
    ctx.fillText('UP/DOWN = move  |  ENTER = confirm  |  ESC = menu', W/2, H - 25);
    ctx.textAlign = 'left';
  }

  function key(e){
    var k = e.key;
    if(k === 'Escape' || k === 'Esc'){ stop(); return; }

    if(st === SEL){
      var stage = STAGES[pickStage];
      if(k === 'ArrowUp' || k === 'ArrowDown'){
        var c = selIdx[pickStage];
        c += (k === 'ArrowUp' ? -1 : 1);
        if(c < 0) c = stage.items.length - 1;
        if(c >= stage.items.length) c = 0;
        selIdx[pickStage] = c;
        e.preventDefault();
      } else if(k === 'Enter'){
        pickStage++;
        if(pickStage >= 8){ initFight(); pickStage = 0; }
        e.preventDefault();
      }
      return;
    }

    if(st === OVER){
      if(k === ' ' || k === 'Spacebar'){ initFight(); e.preventDefault(); }
      else if(k === 'c' || k === 'C'){ st = SEL; pickStage = 0; e.preventDefault(); }
    }
  }

  var raf = null, last = 0;

  function loop(now){
    var dt = (now - last) / 16.667;
    if(dt > 1.5) dt = 1.5;
    if(dt < 0.1) dt = 0.1;
    last = now;

    if(st === FIGHT || st === OVER) step(now, dt);
    if(st === FIGHT || st === OVER) drawFight();
    else drawSelect();

    raf = requestAnimationFrame(loop);
  }

  function start(){
    st = SEL; pickStage = 0;
    selIdx = [1, 0, 0, 1, 1, 0, 0, 1];
    over = false; winner = 0;
    texts = []; sparks = [];
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
