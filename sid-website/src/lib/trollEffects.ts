// Effets visuels "troll" déclenchés par des commandes tapées dans le chat
// (/shake, /matrix, ...). Tout est purement côté client et éphémère : rien
// n'est stocké en base, les effets sont diffusés aux autres participants du
// salon via un broadcast Supabase Realtime (voir chat/page.tsx), pas via un
// vrai message de chat_messages.

const CSS_EFFECTS = {
  shake: { className: "troll-shake", durationMs: 2000 },
  earthquake: { className: "troll-earthquake", durationMs: 2400 },
  invert: { className: "troll-invert", durationMs: 2000 },
  spin: { className: "troll-spin", durationMs: 2000 },
  glitch: { className: "troll-glitch", durationMs: 2100 },
  party: { className: "troll-party", durationMs: 3000 },
  drunk: { className: "troll-drunk", durationMs: 3000 },
  gravity: { className: "troll-gravity", durationMs: 1200 },
} as const;

type CssEffectName = keyof typeof CSS_EFFECTS;

export const TROLL_COMMANDS = [
  "shake", "earthquake", "invert", "spin", "glitch", "rain", "confetti",
  "party", "matrix", "boom", "jumpscare", "gravity", "drunk", "404", "rickroll", "troll",
] as const;

function normalize(raw: string): string {
  return raw.replace(/^\//, "").toLowerCase().trim();
}

export function isTrollCommand(text: string): boolean {
  return (TROLL_COMMANDS as readonly string[]).includes(normalize(text));
}

function playCssEffect(name: CssEffectName) {
  const el = document.body;
  const { className, durationMs } = CSS_EFFECTS[name];
  el.classList.add(className);
  window.setTimeout(() => el.classList.remove(className), durationMs);
}

function spawnParticles(kind: "rain" | "confetti") {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.zIndex = "9998";
  container.style.pointerEvents = "none";
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  const count = kind === "rain" ? 70 : 90;
  const colors = ["#D99A9A", "#8FB3D9", "#E8C547", "#3F8F5F", "#B23B2E", "#EDE6D3"];

  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const left = Math.random() * 100;
    const delay = Math.random() * 1.2;
    const duration = kind === "rain" ? 0.8 + Math.random() * 0.6 : 2 + Math.random() * 1.5;
    p.style.position = "absolute";
    p.style.left = `${left}vw`;
    p.style.top = "-5vh";
    p.style.animation = `troll-fall ${duration}s linear ${delay}s forwards`;
    if (kind === "rain") {
      p.style.width = "2px";
      p.style.height = "16px";
      p.style.background = "rgba(143,179,217,0.6)";
      p.style.borderRadius = "2px";
    } else {
      const size = 6 + Math.random() * 6;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.background = colors[i % colors.length];
      p.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
    }
    container.appendChild(p);
  }

  window.setTimeout(() => container.remove(), 4000);
}

function playMatrix() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "9998";
  canvas.style.pointerEvents = "none";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const fontSize = 16;
  const columns = Math.floor(canvas.width / fontSize);
  const drops = new Array(columns).fill(1);
  const chars = "SID01アイウエオカキクケコ";

  const interval = window.setInterval(() => {
    ctx.fillStyle = "rgba(27, 30, 39, 0.12)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#3F8F5F";
    ctx.font = `${fontSize}px monospace`;
    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }, 50);

  window.setTimeout(() => {
    window.clearInterval(interval);
    canvas.remove();
  }, 4000);
}

function playBoom() {
  const flash = document.createElement("div");
  flash.className = "troll-flash-overlay";
  document.body.appendChild(flash);
  window.setTimeout(() => flash.remove(), 500);
  playCssEffect("earthquake");
}

function playJumpscare() {
  const el = document.createElement("div");
  el.className = "troll-jumpscare-text";
  el.textContent = "👻";
  document.body.appendChild(el);
  playCssEffect("shake");
  window.setTimeout(() => el.remove(), 900);
}

function play404() {
  const el = document.createElement("div");
  el.className = "troll-404-overlay";
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:4rem;font-weight:bold;letter-spacing:0.05em;">404</div>
    <div style="font-family:var(--font-mono);font-size:1rem;opacity:0.7;">Page introuvable — ou peut-être que si.</div>
  `;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 3200);
}

function playRickroll() {
  const el = document.createElement("div");
  el.className = "troll-rickroll-overlay";
  el.innerHTML = `
    <div class="troll-rickroll-dance">🕺</div>
    <div style="font-family:var(--font-display);font-size:1.4rem;text-transform:uppercase;color:#1b1e27;text-align:center;padding:0 1rem;">Tu viens de te faire avoir.</div>
  `;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 4000);
}

/** Joue l'effet correspondant à une commande ("/shake" ou "shake"). Renvoie false si la commande est inconnue. */
export function playTrollEffect(rawCommand: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const command = normalize(rawCommand);

  if ((Object.keys(CSS_EFFECTS) as CssEffectName[]).includes(command as CssEffectName)) {
    playCssEffect(command as CssEffectName);
    return true;
  }

  switch (command) {
    case "rain":
      spawnParticles("rain");
      return true;
    case "confetti":
      spawnParticles("confetti");
      return true;
    case "matrix":
      playMatrix();
      return true;
    case "boom":
      playBoom();
      return true;
    case "jumpscare":
      playJumpscare();
      return true;
    case "404":
      play404();
      return true;
    case "rickroll":
      playRickroll();
      return true;
    case "troll": {
      const pool = TROLL_COMMANDS.filter((c) => c !== "troll");
      const random = pool[Math.floor(Math.random() * pool.length)];
      return playTrollEffect(random);
    }
    default:
      return false;
  }
}
