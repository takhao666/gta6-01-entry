// Rendering: the city, the cars, the people, the effects and the HUD.
// Everything is drawn on one canvas with a camera that follows the player;
// the sun-soaked look comes from warm colours, long shadows and a golden
// haze at the screen edges.
import { WORLD, ROAD_W, PALETTE } from './config.js';
import { drawMinimap } from './minimap.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    ctx,
    resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    },
    draw(world) {
      const w = canvas.width;
      const h = canvas.height;
      const cam = world.camera;
      ctx.clearRect(0, 0, w, h);
      // Sky-tinted background beyond the city edge.
      ctx.fillStyle = '#274b63';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      if (world.shake > 0.3) {
        ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
      }
      ctx.translate(w / 2 - cam.x, h / 2 - cam.y);
      const view = {
        x0: cam.x - w / 2 - 60, y0: cam.y - h / 2 - 60,
        x1: cam.x + w / 2 + 60, y1: cam.y + h / 2 + 60,
      };
      drawGround(ctx, world, view);
      drawPickups(ctx, world, view);
      drawMissionMarker(ctx, world);
      drawCars(ctx, world, view);
      drawPeds(ctx, world, view);
      drawCops(ctx, world, view);
      drawPlayer(ctx, world);
      drawParticles(ctx, world);
      drawFloaters(ctx, world);
      ctx.restore();
      drawVignette(ctx, w, h);
      drawHud(ctx, world, w, h);
    },
  };
}

function inView(view, x, y, pad = 80) {
  return x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - pad && y < view.y1 + pad;
}

function drawGround(ctx, world, view) {
  const city = world.city;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Park.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
  // Plaza paving.
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
  ctx.strokeStyle = '#a89a7c';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(city.plaza.x + (city.plaza.w / 4) * i, city.plaza.y);
    ctx.lineTo(city.plaza.x + (city.plaza.w / 4) * i, city.plaza.y + city.plaza.h);
    ctx.stroke();
  }
  // Beach and sea (south edge).
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(view.x0, city.beach.y, view.x1 - view.x0, 140);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(view.x0, city.beach.y + 120, view.x1 - view.x0, view.y1 - (city.beach.y + 120));
  ctx.fillStyle = PALETTE.waterDeep;
  for (let i = 0; i < 8; i += 1) {
    const wy = city.beach.y + 150 + i * 26;
    if (wy < view.y0 || wy > view.y1) continue;
    ctx.fillRect(view.x0 + ((i * 397) % 700), wy, 90, 3);
  }
  // Sidewalks then roads.
  for (const c of city.centres) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(view.x0, c - ROAD_W / 2 - 16, view.x1 - view.x0, ROAD_W + 32);
    ctx.fillRect(c - ROAD_W / 2 - 16, view.y0, ROAD_W + 32, view.y1 - view.y0);
  }
  for (const c of city.centres) {
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(view.x0, c - ROAD_W / 2, view.x1 - view.x0, ROAD_W);
    ctx.fillRect(c - ROAD_W / 2, view.y0, ROAD_W, view.y1 - view.y0);
  }
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const c of city.centres) {
    ctx.moveTo(view.x0, c);
    ctx.lineTo(view.x1, c);
    ctx.moveTo(c, view.y0);
    ctx.lineTo(c, view.y1);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Buildings: a shaded side (long afternoon shadow) and a roof with windows.
  for (const b of city.buildings) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    const off = b.height * 7;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + off, b.y + off, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Windows.
    ctx.fillStyle = b.lit ? '#ffe9a8' : 'rgba(255,255,255,0.35)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 13 + b.height) % 4 === 0) continue;
        ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 12, 9);
      }
    }
  }
  // Trees.
  for (const t of city.trees) {
    if (!inView(view, t.x, t.y)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 5, t.y + 6, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5da244';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Shop markers on the ground: a coloured pad with the shop's letter.
  for (const key of Object.keys(world.shops)) {
    const shop = world.shops[key];
    if (!inView(view, shop.x, shop.y)) continue;
    ctx.fillStyle = 'rgba(127,212,255,0.9)';
    ctx.beginPath();
    ctx.arc(shop.x, shop.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b2233';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shop.icon, shop.x, shop.y + 1);
  }
}

function drawPickups(ctx, world, view) {
  for (const pk of world.pickups) {
    if (pk.taken || !inView(view, pk.x, pk.y)) continue;
    const bob = Math.sin(world.time * 4 + pk.x) * 3;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#7CFC00';
      ctx.fillRect(pk.x - 10, pk.y - 6 + bob, 20, 12);
      ctx.fillStyle = '#2f6b00';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 3 + bob);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
      ctx.fillStyle = '#e33';
      ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
      ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
    } else if (pk.kind === 'crate') {
      ctx.fillStyle = '#8a6d3b';
      ctx.fillRect(pk.x - 12, pk.y - 12 + bob, 24, 24);
      ctx.strokeStyle = '#5d4a26';
      ctx.lineWidth = 2;
      ctx.strokeRect(pk.x - 12, pk.y - 12 + bob, 24, 24);
      ctx.beginPath();
      ctx.moveTo(pk.x - 12, pk.y - 12 + bob);
      ctx.lineTo(pk.x + 12, pk.y + 12 + bob);
      ctx.moveTo(pk.x + 12, pk.y - 12 + bob);
      ctx.lineTo(pk.x - 12, pk.y + 12 + bob);
      ctx.stroke();
    }
  }
}

function drawMissionMarker(ctx, world) {
  const marker = world.missionMarker();
  if (!marker) return;
  const pulse = 1 + Math.sin(world.time * 5) * 0.12;
  const r = 34 * pulse;
  ctx.save();
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,215,106,0.18)';
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
  ctx.fill();
  // A beam of light so the marker reads from far away.
  const grad = ctx.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
  grad.addColorStop(0, 'rgba(255,215,106,0)');
  grad.addColorStop(1, 'rgba(255,215,106,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(marker.x - 12, marker.y - 260, 24, 260);
  ctx.restore();
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-24 + 4, -13 + 5, 48, 26);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -24, -13, 48, 26, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin and windshield.
  ctx.fillStyle = car.police ? '#dfe9f2' : 'rgba(20,30,44,0.85)';
  roundRect(ctx, -6, -10, 18, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(10, -9, 4, 18);
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-18, -15, 10, 5);
  ctx.fillRect(-18, 10, 10, 5);
  ctx.fillRect(8, -15, 10, 5);
  ctx.fillRect(8, 10, 10, 5);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(22, -9, 3, 5);
  ctx.fillRect(22, 4, 3, 5);
  // Police livery and light bar.
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-24, -13, 48, 26);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(-24, -13, 48, 26);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-10, -13, 20, 26);
    ctx.fillStyle = '#1a6fd4';
    ctx.fillRect(-24, -13, 48, 6);
    const blink = Math.floor(Date.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-4, -16, 8, 5);
    ctx.fillStyle = blink ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(4, -16, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 22);
  }
  // Damage smoke.
  if (car.smoke > 0.3) {
    ctx.fillStyle = 'rgba(120,120,120,0.7)';
    ctx.beginPath();
    ctx.arc(-20 + Math.random() * 8, -4 + Math.random() * 8, 6 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, world, view) {
  for (const car of world.cars) {
    if (!inView(view, car.x, car.y, 60)) continue;
    drawCarShape(ctx, car);
    if (car.burning) {
      ctx.fillStyle = 'rgba(255,90,20,0.8)';
      ctx.beginPath();
      ctx.arc(car.x, car.y, 10 + Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPerson(ctx, x, y, angle, skin, shirt, walkPhase, dead) {
  ctx.save();
  ctx.translate(x, y);
  if (dead) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.fillRect(-7, -14, 14, 28);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  const swing = Math.sin(walkPhase) * 4;
  // Legs.
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(-swing, 12);
  ctx.moveTo(0, 4);
  ctx.lineTo(swing, 12);
  ctx.stroke();
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(9, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPeds(ctx, world, view) {
  for (const ped of world.peds) {
    if (!inView(view, ped.x, ped.y)) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.skin, ped.shirt, ped.walkPhase, ped.dead);
    if (ped.hostile && !ped.dead) {
      // Red ring marks gang members.
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawCops(ctx, world, view) {
  for (const cop of world.cops) {
    if (!inView(view, cop.x, cop.y)) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#e8b88a', '#1a3a5c', cop.walkPhase, cop.dead);
    // Cap.
    if (!cop.dead) {
      ctx.fillStyle = '#0f2a44';
      ctx.beginPath();
      ctx.arc(cop.x + Math.cos(cop.angle) * 9, cop.y + Math.sin(cop.angle) * 9, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (p.car) return; // the player is inside the car shape
  drawPerson(ctx, p.x, p.y, p.angle, '#f2c89b', '#ff7a1a', world.time * 10, false); // orange jacket: the hero reads at a glance
  // The gun, aimed at the mouse.
  if (p.weapon === 'pistol') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle || 0);
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -2, 14, 4);
    ctx.restore();
  }
  // Punch flash.
  if (p.punchTimer > 0.3) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.aimAngle || 0) * 24, p.y + Math.sin(p.aimAngle || 0) * 24, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    const a = Math.max(0, pt.life / pt.max);
    ctx.globalAlpha = a;
    if (pt.ring) {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.6 - a), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, world) {
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - (1.2 - f.life) * 30);
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx, w, h) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(255,190,90,0)');
  grad.addColorStop(1, 'rgba(255,170,60,0.14)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawHud(ctx, world, w, h) {
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: health bar + cash.
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  roundRect(ctx, 14, 14, 220, 62, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${world.money.toLocaleString('en-US')}`, 26, 38);
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 46, 196, 12);
  ctx.fillStyle = p.health > 30 ? '#37d67a' : '#ff4d4d';
  ctx.fillRect(26, 46, 196 * (p.health / 100), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 46, 196, 12);
  // Wanted stars, top-right above the minimap.
  const stars = world.wanted.level;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? (world.wanted.flash > 0.4 ? '#ffd76a' : '#ffb400') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 24 - i * 30, 40);
  }
  drawMinimap(ctx, world, w - 194, 52, 180);
  // Objective banner, top-centre.
  if (world.objective) {
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(world.objective).width;
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    roundRect(ctx, w / 2 - tw / 2 - 16, 14, tw + 32, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.fillText(world.objective, w / 2, 37);
  }
  // Mission timer.
  const m = world.mission;
  if (m.active && m.stageTimer > 0) {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = m.stageTimer < 30 ? '#ff6b6b' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${Math.ceil(m.stageTimer)}s`, w / 2, 78);
  }
  // Bottom-left: weapon (on foot only — behind the wheel the car is the weapon).
  if (!p.car) {
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    roundRect(ctx, 14, h - 58, 210, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    const weaponText = p.weapon === 'pistol' ? `Pistol — ${p.ammo} ammo` : 'Fists';
    ctx.fillText(weaponText, 26, h - 30);
  }
  // Bottom-right: speed when driving.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    roundRect(ctx, w - 164, h - 58, 150, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh} km/h`, w - 26, h - 28);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(p.car.name, w - 26, h - 44);
  }
  // Context hint near the bottom centre.
  if (world.hint) {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    const tw = ctx.measureText(world.hint).width;
    roundRect(ctx, w / 2 - tw / 2 - 12, h - 46, tw + 24, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(world.hint, w / 2, h - 25);
  }
  // Damage flash.
  if (p.health < 30 && p.health > 0) {
    const a = 0.12 + Math.sin(world.time * 6) * 0.06;
    ctx.fillStyle = `rgba(255,0,0,${a})`;
    ctx.fillRect(0, 0, w, h);
  }
}
