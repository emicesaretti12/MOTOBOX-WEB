/**
 * MOTOBOX — Ruta nocturna del hero, dibujada en un hilo aparte (OffscreenCanvas).
 * El hilo principal queda libre para el scroll y los toques: aunque la página esté
 * ocupada, la ruta no se traba, y aunque la ruta tarde, la página no se traba.
 * Mensajes que recibe (motion.js):
 *   { type: "init", canvas, w, h, dpr, small }   canvas transferido + tamaño
 *   { type: "size", w, h }                        el hero cambió de tamaño
 *   { type: "run", on }                           visible / oculto
 *   { type: "goal", x, pitch, roll }              inclinación (mouse o giroscopio)
 *   { type: "sway", on }                          balanceo propio (celular sin giroscopio)
 *   { type: "boost", v }                          acelerar (dedo o mouse apretado)
 *   { type: "scroll", y }                         posición del scroll (suma velocidad)
 */
"use strict";

const FAR = 260, CAM_H = 1.25, LIGHT_H = 0.62;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const TONES_ON = ["rgb(255,238,214)", "rgb(255,238,214)", "rgb(255,238,214)", "rgb(190,215,255)"];
const TONES_OUT = ["rgb(232,46,36)", "rgb(232,46,36)", "rgb(232,46,36)", "rgb(255,112,64)"];
const raf = self.requestAnimationFrame ? self.requestAnimationFrame.bind(self) : (cb) => setTimeout(() => cb(performance.now()), 16);
const caf = self.cancelAnimationFrame ? self.cancelAnimationFrame.bind(self) : clearTimeout;

let canvas = null, ctx = null, glow = null, W = 0, H = 0, dpr = 1, small = true, quality = 1;
let running = false, handle = 0, last = 0, dash = 0, boost = 1, sway = false;
let scrollY = 0, lastScroll = 0, slowFrames = 0, sampled = 0;
const cars = [];
const cam = { x: 0, pitch: 0, roll: 0, speed: 1 };
const goal = { x: 0, pitch: 0, roll: 0, speed: 1 };
const vel = { x: 0, pitch: 0, roll: 0, speed: 0 };

function spawn(car, initial) {
  const oncoming = Math.random() < 0.5;
  car.oncoming = oncoming;
  car.x = oncoming ? -rand(1.6, 6.4) : rand(1.6, 6.4);
  car.z = initial ? rand(2, FAR) : (oncoming ? FAR + rand(0, 40) : rand(1.5, 4));
  car.len = rand(5, 16);
  car.v = oncoming ? rand(55, 85) : rand(10, 26);
  car.gap = rand(0.28, 0.42);
  car.tone = (oncoming ? TONES_ON : TONES_OUT)[Math.floor(Math.random() * 4)];
  return car;
}

function resize(w, h) {
  // En celular la barra del navegador cambia el alto al scrollear: solo se rehace si cambia mucho.
  if (w === W && Math.abs(h - H) < 140) return;
  W = w; H = h;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Resplandor de la ciudad: se pinta una vez y se reutiliza en cada cuadro.
  glow = new OffscreenCanvas(Math.max(1, Math.round(W * 1.1)), Math.max(1, Math.round(W * 0.6)));
  const g = glow.getContext("2d");
  const rg = g.createRadialGradient(glow.width / 2, glow.height / 2, 0, glow.width / 2, glow.height / 2, glow.width / 2);
  rg.addColorStop(0, "rgba(224,46,36,0.22)");
  rg.addColorStop(0.35, "rgba(224,46,36,0.07)");
  rg.addColorStop(1, "rgba(224,46,36,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, glow.width, glow.height);
}

function frame(now) {
  const ms = now - last;
  const dt = Math.min(0.05, ms / 1000 || 0.016);
  last = now;
  // Calidad automática: si muchos cuadros tardan más de 24 ms, baja un escalón.
  if (++sampled > 20) {
    if (ms > 24) slowFrames++;
    if (sampled > 110) {
      if (slowFrames > 30 && quality > 0) {
        quality--;
        if (quality === 0) cars.length = Math.floor(cars.length / 2);
      }
      sampled = 20; slowFrames = 0;
    }
  }
  if (sway) {
    // Celular sin giroscopio: la cámara se balancea sola, despacio.
    const t = now / 1000;
    goal.x = Math.sin(t * 0.55) * 0.6;
    goal.pitch = Math.sin(t * 0.8) * -3.6;
    goal.roll = Math.sin(t * 0.55) * -0.0125;
  }
  goal.speed = boost + clamp(Math.abs(scrollY - lastScroll) * 0.08, 0, 2.5);
  lastScroll = scrollY;
  for (const k in cam) {
    const stiff = k === "speed" ? 18 : 40, damp = k === "speed" ? 8 : 12;
    vel[k] += (stiff * (goal[k] - cam[k]) - damp * vel[k]) * dt;
    cam[k] += vel[k] * dt;
  }

  const f = H * 1.05 * (1 - clamp(cam.speed - 1, 0, 3) * 0.07);
  const cx = W / 2;
  // El horizonte queda debajo de los botones: las luces nunca pasan detrás del texto.
  const hy = H * (small ? 0.86 : 0.8) + cam.pitch;
  const px = (x, z) => cx + (x - cam.x) * f / z;
  const py = (y, z) => hy + (CAM_H - y) * f / z;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(cx, hy);
  ctx.rotate(cam.roll);
  ctx.translate(-cx, -hy);
  if (glow) ctx.drawImage(glow, cx - glow.width / 2, hy - glow.height / 2);

  ctx.globalCompositeOperation = quality === 2 ? "lighter" : "source-over";
  ctx.lineCap = "round";

  // Bordes de la ruta y línea central discontinua que corre hacia la cámara
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.moveTo(px(-7.6, 1.2), py(0, 1.2)); ctx.lineTo(px(-7.6, FAR), py(0, FAR));
  ctx.moveTo(px(7.6, 1.2), py(0, 1.2)); ctx.lineTo(px(7.6, FAR), py(0, FAR));
  ctx.stroke();
  const travel = 34 * cam.speed;
  dash = (dash + travel * dt) % 9;
  for (let z = 9 - dash; z < FAR * 0.7; z += 9) {
    if (z < 3) continue;
    ctx.globalAlpha = 0.32 * (1 - z / (FAR * 0.7));
    ctx.lineWidth = clamp(0.16 * f / z, 0.6, 3);
    ctx.beginPath();
    ctx.moveTo(px(0, z), py(0, z));
    ctx.lineTo(px(0, z + 4), py(0, z + 4));
    ctx.stroke();
  }

  // Luces de los autos: un solo trazo para las dos luces (más un halo si la calidad lo permite).
  const near = small ? 7 : 4;
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    c.z += (c.oncoming ? -(c.v + travel) : c.v * 2.2) * dt;
    if (c.oncoming && c.z < 1) spawn(c, false);
    else if (!c.oncoming && c.z > FAR) spawn(c, false);
    const z1 = Math.max(1, c.z), z2 = z1 + c.len * (0.6 + cam.speed * 0.4);
    const fade = clamp((z1 - 1.5) / near, 0, 1) * clamp((FAR - z1) / (FAR * 0.35), 0, 1);
    if (fade <= 0.01) continue;
    const w = clamp(0.11 * f / z1, 0.5, small ? 3.2 : 6);
    const ya = py(LIGHT_H, z1), yb = py(LIGHT_H, z2);
    ctx.beginPath();
    ctx.moveTo(px(c.x - c.gap, z1), ya); ctx.lineTo(px(c.x - c.gap, z2), yb);
    ctx.moveTo(px(c.x + c.gap, z1), ya); ctx.lineTo(px(c.x + c.gap, z2), yb);
    ctx.strokeStyle = c.tone;
    if (quality === 2) {
      ctx.globalAlpha = 0.1 * fade;
      ctx.lineWidth = w * 4;
      ctx.stroke();
    }
    ctx.globalAlpha = 0.85 * fade;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.restore();
  if (running) handle = raf(frame);
}

function start() {
  if (running || !ctx) return;
  running = true;
  last = performance.now();
  handle = raf(frame);
}
function stop() {
  running = false;
  caf(handle);
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "init") {
    canvas = m.canvas;
    ctx = canvas.getContext("2d");
    if (!ctx) return;
    dpr = m.dpr || 1;
    small = !!m.small;
    quality = small ? 1 : 2;
    for (let i = 0; i < (small ? 40 : 96); i++) cars.push(spawn({}, true));
    resize(m.w, m.h);
  } else if (m.type === "size" && ctx) {
    resize(m.w, m.h);
  } else if (m.type === "run") {
    if (m.on) start(); else stop();
  } else if (m.type === "goal") {
    goal.x = m.x; goal.pitch = m.pitch; goal.roll = m.roll;
  } else if (m.type === "sway") {
    sway = !!m.on;
  } else if (m.type === "boost") {
    boost = m.v;
  } else if (m.type === "scroll") {
    scrollY = m.y;
  }
};
