// Keyboard + mouse state, polled once per fixed step. Keys are tracked by
// physical code so the layout does not matter, and every press is also
// recorded as an edge (justPressed) for menu and action keys.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseJustDown = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      if (!this.mouseDown) this.mouseJustDown = true;
      this.mouseDown = true;
    };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  pressed(...codes) { return codes.some((c) => this.justPressed.has(c)); }
  pressedMouse() { return this.mouseJustDown; }

  // Call at the end of each fixed step: edges live exactly one step.
  endStep() {
    this.justPressed.clear();
    this.mouseJustDown = false;
  }

  moveVector() {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }
}
