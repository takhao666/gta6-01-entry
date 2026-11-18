// Saving: one localStorage slot holding money, story progress, weapons and
// lifetime stats. Saving happens at the safehouse and after every mission.
const KEY = 'solmar-city-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(world) {
  try {
    const data = {
      money: world.money,
      missionIndex: world.mission.index + (world.mission.done ? 1 : 0),
      pistolOwned: world.player.pistolOwned,
      ammo: world.player.ammo,
      stats: world.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
