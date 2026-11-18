// Keyboard + mouse state, with edge-triggered "pressed" events the game polls.
export class Input {
  constructor(canvas) {
    this.up = false; this.down = false; this.left = false; this.right = false;
    this.run = false;
    this.mouseX = 0; this.mouseY = 0;
    this.mouseDown = false;
    this.pressed = new Set();
    this.canvas = canvas;
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.anyKey = true;
      this.setKey(e.key.toLowerCase(), true);
    });
    window.addEventListener('keyup', (e) => this.setKey(e.key.toLowerCase(), false));
    window.addEventListener('blur', () => {
      this.up = this.down = this.left = this.right = this.run = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.pressed.add('mouse0'); }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  setKey(k, v) {
    if (k === 'w' || k === 'arrowup') this.up = v;
    if (k === 's' || k === 'arrowdown') this.down = v;
    if (k === 'a' || k === 'arrowleft') this.left = v;
    if (k === 'd' || k === 'arrowright') this.right = v;
    if (k === 'shift') this.run = v;
  }
  wasPressed(k) { return this.pressed.has(k.toLowerCase()); }
  endFrame() { this.pressed.clear(); this.anyKey = false; }
}
