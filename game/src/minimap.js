// The minimap: a small live map in the HUD corner showing roads, the sea,
// the player, police, the mission marker and shops.
import { WORLD } from './config.js';
import { SHOPS } from './config.js';

export function drawMinimap(ctx, world, x, y, size) {
  const s = size / WORLD.w;
  ctx.save();
  ctx.translate(x, y);
  // Frame.
  ctx.fillStyle = 'rgba(8, 12, 18, 0.85)';
  ctx.fillRect(-4, -4, size + 8, size + 8);
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 2;
  ctx.strokeRect(-4, -4, size + 8, size + 8);
  // Sea and land.
  ctx.fillStyle = '#1f5f84';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#3f7a4e';
  ctx.fillRect(0, 0, size, world.city.beach.y * s);
  // Roads.
  ctx.strokeStyle = '#55555e';
  ctx.lineWidth = Math.max(2, 110 * s);
  ctx.beginPath();
  for (const c of world.city.centres) {
    ctx.moveTo(c * s, 0);
    ctx.lineTo(c * s, size);
    ctx.moveTo(0, c * s);
    ctx.lineTo(size, c * s);
  }
  ctx.stroke();
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(wx * s, wy * s, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Shops.
  for (const key of Object.keys(SHOPS)) {
    const shop = SHOPS[key];
    dot(shop.x, shop.y, '#7fd4ff', 3);
  }
  // Mission marker.
  const marker = world.missionMarker();
  if (marker) {
    const pulse = 4 + Math.sin(world.time * 5) * 1.5;
    dot(marker.x, marker.y, '#ffd76a', pulse);
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(marker.x * s, marker.y * s, pulse + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police.
  for (const car of world.cars) {
    if (car.police) dot(car.x, car.y, '#ff4d4d', 3);
  }
  for (const cop of world.cops) {
    if (!cop.dead) dot(cop.x, cop.y, '#ff4d4d', 2.5);
  }
  // The player, always on top, with a white ring.
  const p = world.player;
  dot(p.x, p.y, '#ffffff', 4);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x * s, p.y * s, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
