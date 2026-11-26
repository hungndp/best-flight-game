// Input for AZURE REACH: keyboard flight controls plus mouse clicks for
// menus, buttons and the hangar. The game never needs a networked input.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // Flight intents, -1..1 (throttle is a 0..1 target).
    pitch: 0,
    roll: 0,
    throttle: 0.35,
    throttleTarget: 0.35,
    mouse: { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 },
    // Buttons the UI polls and clears each frame.
    pressed: new Set(),

    attach() {
      window.addEventListener('keydown', (ev) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key)) {
          ev.preventDefault();
        }
        if (!ev.repeat) this.pressed.add(ev.key.toLowerCase());
        this.keys.add(ev.key.toLowerCase());
      });
      window.addEventListener('keyup', (ev) => {
        this.keys.delete(ev.key.toLowerCase());
      });
      canvas.addEventListener('mousemove', (ev) => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = (ev.clientX - rect.left) * (canvas.width / rect.width);
        this.mouse.y = (ev.clientY - rect.top) * (canvas.height / rect.height);
      });
      canvas.addEventListener('mousedown', (ev) => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.clickX = (ev.clientX - rect.left) * (canvas.width / rect.width);
        this.mouse.clickY = (ev.clientY - rect.top) * (canvas.height / rect.height);
        this.mouse.clicked = true;
      });
    },

    // Read the held keys into flight intents. Call once per frame.
    pollFlight() {
      const k = this.keys;
      let pitch = 0;
      let roll = 0;
      if (k.has('arrowup') || k.has('w')) pitch += 1;
      if (k.has('arrowdown') || k.has('s')) pitch -= 1;
      if (k.has('arrowleft') || k.has('a')) roll -= 1;
      if (k.has('arrowright') || k.has('d')) roll += 1;
      // Throttle: Shift/W up, Ctrl/S down — and W/S double as pitch, so
      // throttle uses Shift/Ctrl plus the +/- keys.
      if (k.has('shift')) this.throttleTarget = Math.min(1, this.throttleTarget + 0.011);
      if (k.has('control')) this.throttleTarget = Math.max(0, this.throttleTarget - 0.011);
      if (k.has('=' ) || k.has('+')) this.throttleTarget = Math.min(1, this.throttleTarget + 0.011);
      if (k.has('-') || k.has('_')) this.throttleTarget = Math.max(0, this.throttleTarget - 0.011);
      if (k.has(' ')) this.throttleTarget = Math.max(0, this.throttleTarget - 0.02);
      this.pitch = pitch;
      this.roll = roll;
      this.throttle = this.throttleTarget;
      return { pitch, roll, throttle: this.throttleTarget };
    },

    wasPressed(key) {
      return this.pressed.has(key.toLowerCase());
    },

    consumeClick() {
      if (!this.mouse.clicked) return null;
      this.mouse.clicked = false;
      return { x: this.mouse.clickX, y: this.mouse.clickY };
    },

    endFrame() {
      this.pressed.clear();
    },
  };
  return input;
}

// Hit test for a rectangular menu button, in canvas coordinates.
export function hitButton(click, x, y, w, h) {
  if (!click) return false;
  return click.x >= x && click.x <= x + w && click.y >= y && click.y <= y + h;
}
