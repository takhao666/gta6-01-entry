// Keyboard and mouse input: one shared state object, read by the player,
// the car and the menus. Pointer position is kept in screen space; the game
// converts it to world space when aiming.
export function createInput(canvas) {
  const input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false, clicked: false },
    pressed: {}, // keys pressed since last consume (edge-triggered actions)
    init() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        if (!this.keys[e.key.toLowerCase()]) this.pressed[e.key.toLowerCase()] = true;
        this.keys[e.key.toLowerCase()] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left;
        this.mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      });
      window.addEventListener('mouseup', () => { this.mouse.down = false; });
      window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; });
    },
    down(...names) { return names.some((n) => this.keys[n]); },
    // Edge-triggered: true once per physical press.
    consume(name) {
      if (this.pressed[name]) { this.pressed[name] = false; return true; }
      return false;
    },
    endFrame() { this.pressed = {}; this.mouse.clicked = false; },
  };
  return input;
}
