/* build.js - Genera una página por camiseta y una por categoría (para que Google las encuentre),
   leyendo tu planilla de Google Sheets. GitHub lo ejecuta solo cada hora.
   Para probarlo en tu compu: node build.js  (necesita Node 18 o más nuevo) */
const fs = require("fs"), path = require("path");

const SITE = "https://juegosagradocamisetas.com";
const ROOT = __dirname;
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const pick = re => (index.match(re) || [])[1] || "";
const SHEET_URL = process.env.SHEET_URL || pick(/const SHEET_URL="([^"]+)"/);   // se lee del index.html
const WA = pick(/const WA="(\d+)"/);                                             // idem
const SZ = ["S", "M", "L", "XL", "XXL"];
const CATS = {
  argentino: { n: "Camisetas fútbol argentino", s: "camisetas-futbol-argentino", d: "Camisetas de clubes del fútbol argentino y de la Selección Argentina." },
  europeas:  { n: "Camisetas europeas",         s: "camisetas-europeas",         d: "Camisetas de los clubes más importantes de Europa." },
  mundial:   { n: "Mundial 2026",               s: "mundial-2026",               d: "Camisetas de las selecciones para el Mundial 2026." },
  retro:     { n: "Camisetas retro",            s: "camisetas-retro",            d: "Camisetas retro y clásicos del fútbol que marcaron época." },
  shorts:    { n: "Shorts",                     s: "shorts-de-futbol",           d: "Shorts de fútbol de clubes y selecciones." }
};

/* ---------- utilidades ---------- */
function csv(t) { const rows = []; let r = [], c = "", q = false; for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else if (ch === '"') q = true; else if (ch === ",") { r.push(c); c = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; r.push(c); rows.push(r); r = []; c = ""; } else c += ch; } if (c || r.length) { r.push(c); rows.push(r); } return rows; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
const money = n => "$" + Number(n).toLocaleString("es-AR");
const abs = u => /^https?:\/\//i.test(u) ? u : `${SITE}/${u.replace(/^\/+/, "")}`;
const imgUrl = u => { const m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || u.match(/drive\.google\.com\/open\?id=([\w-]+)/); return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000` : u; };
const dem = v => /^(si|sí|true|x|1)$/i.test(v) ? "7 a 10 días" : v;
const catKey = v => { const n = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); return CATS[n] ? n : n.includes("europe") ? "europeas" : n.includes("argent") ? "argentino" : n.includes("mundial") ? "mundial" : n.includes("retro") ? "retro" : n.includes("short") ? "shorts" : n; };
const cut = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

const CSS = `:root{--bg:#0A0A0A;--s1:#121212;--s2:#1E1E1E;--tx:#F2F5E8;--mu:#9aa08c;--ac:#00FF38;--ln:#2a2a2a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:400 15px/1.55 Inter,system-ui,sans-serif}a{color:inherit}
h1,h2{font-family:"Bebas Neue",Impact,sans-serif;font-weight:400;letter-spacing:.02em;margin:0}
.top{display:flex;gap:10px 22px;align-items:center;flex-wrap:wrap;padding:12px 16px;max-width:1100px;margin:auto}
.logo{font:400 30px/1 "Bebas Neue",Impact,sans-serif;text-decoration:none;display:flex;align-items:flex-end;gap:3px}.logo i{width:8px;height:8px;border-radius:50%;background:var(--ac);margin-bottom:3px}
.top nav{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:14px;color:var(--mu)}.top nav a{text-decoration:none}.top nav a:hover{color:var(--ac)}
main{max-width:1100px;margin:auto;padding:8px 16px 48px}
.bc{font-size:13px;color:var(--mu);margin:8px 0 16px}.bc a{text-decoration:none}
.pd{display:grid;grid-template-columns:1fr 1fr;gap:28px}@media(max-width:700px){.pd{grid-template-columns:1fr}}
.ph{background:var(--s2);border-radius:12px;aspect-ratio:1/1.05;overflow:hidden;display:grid;place-items:center;color:var(--mu);text-align:center;padding:8px}.ph img{width:100%;height:100%;object-fit:cover;display:block}
.ths{display:flex;gap:8px;margin-top:8px;overflow-x:auto}.ths button{border:2px solid transparent;background:var(--s2);border-radius:8px;width:64px;height:64px;padding:0;overflow:hidden;cursor:pointer;flex:none}.ths img{width:100%;height:100%;object-fit:cover}
.tag{color:var(--ac);font-size:12px;font-weight:600}
h1{font-size:clamp(34px,6vw,54px);line-height:1}
.pr{font-weight:800;font-size:26px;margin:8px 0}
.box{border:1px solid var(--ac);border-radius:10px;padding:10px 12px;margin:12px 0}
.sz{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 18px;padding:0;list-style:none}.sz li{border:1px solid var(--ln);border-radius:6px;padding:6px 12px;background:var(--s1)}.sz li.no{opacity:.4;text-decoration:line-through}
.btn{display:block;text-align:center;background:var(--ac);color:#0A0A0A;border-radius:6px;padding:13px 22px;font-weight:800;text-decoration:none;margin-top:10px}.btn.g{background:none;color:var(--tx);border:1px solid var(--ln)}
.info h2{font-size:28px;margin:26px 0 6px}.info ul{padding-left:18px;color:var(--mu)}.info p{color:var(--mu);max-width:70ch}
.g2{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-top:18px}@media(max-width:700px){.g2{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
.cd{background:var(--s1);border:1px solid var(--ln);border-radius:10px;overflow:hidden;text-decoration:none;display:block}.cd:hover{border-color:var(--ac)}.cd .ph{border-radius:0}.cd .i{padding:10px}.cd h2{font-size:20px;line-height:1.1;margin:2px 0 4px}
footer{border-top:1px solid var(--ln);padding:24px 16px;text-align:center;color:var(--mu);font-size:14px}footer a{text-decoration:none}`;

const layout = ({ title, desc, url, image, type = "website", ld = [], body, noindex = false }) => `<!doctype html>
<!--generado por build.js-->
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}">
<meta property="og:type" content="${type}"><meta property="og:locale" content="es_AR"><meta property="og:site_name" content="Juego Sagrado Camisetas">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0A0A0A">
<link rel="icon" type="image/png" href="/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head><body>
<header class="top"><a class="logo" href="/">JS<i></i></a><nav aria-label="Categorías">${Object.values(CATS).map(c => `<a href="/categoria/${c.s}/">${esc(c.n)}</a>`).join("")}</nav></header>
${body}
<footer><p><a href="/">Juego Sagrado Camisetas</a> · Córdoba, Argentina · Envíos a todo el país y retiro en Córdoba Capital</p></footer>
</body></html>`;

const card = p => `<a class="cd" href="/camisetas/${p.slug}/"><div class="ph">${p.images[0] ? `<img src="${esc(abs(p.images[0]))}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : esc(p.club)}</div><div class="i"><span class="tag">${esc(CATS[p.cat].n)}</span><h2>${esc(p.name)}</h2><b>${money(p.price)}</b></div></a>`;
const write = (rel, content) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

(async () => {
  /* ---------- 1. Leer la planilla ---------- */
  let text;
  if (process.env.CSV_FILE) text = fs.readFileSync(process.env.CSV_FILE, "utf8");
  else {
    const r = await fetch(SHEET_URL);
    if (!r.ok) throw new Error("No se pudo leer la planilla: HTTP " + r.status);
    text = await r.text();
  }
  const [h, ...rows] = csv(text), k = h.map(x => x.trim());
  const products = rows.filter(x => (x[k.indexOf("name")] || "").trim()).map((x, n) => {
    const g = c => (x[k.indexOf(c)] || "").trim();
    return { id: +g("id") || n + 1, name: g("name"), club: g("club"), country: g("country"), cat: catKey(g("cat")), price: +g("price").replace(/[^\d]/g, "") || 0, year: g("year"), active: g("active").toUpperCase() !== "FALSE", stock: Object.fromEntries(SZ.map(z => [z, parseInt(g(z)) || 0])), images: g("images").split(/[\s,|]+/).filter(Boolean).map(imgUrl), demora: dem(g("demora")) };
  }).filter(p => p.active && CATS[p.cat]);
  if (!products.length) throw new Error("La planilla no tiene productos válidos. No se modificó nada.");

  const used = new Set();
  for (const p of products) { let s = slug(p.name) || "camiseta"; if (used.has(s)) s += "-" + p.id; used.add(s); p.slug = s; p.url = `${SITE}/camisetas/${s}/`; }

  /* ---------- 2. Borrar lo generado antes y volver a crear ---------- */
  // Solo borra las carpetas que generó este script (tienen la marca); tus fotos u otros archivos no se tocan.
  for (const base of ["camisetas", "categoria"]) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name, "index.html");
      if (e.isDirectory() && fs.existsSync(f) && fs.readFileSync(f, "utf8").includes("<!--generado por build.js-->")) fs.rmSync(path.join(dir, e.name), { recursive: true, force: true });
    }
  }

  /* ---------- 3. Una página por camiseta ---------- */
  for (const p of products) {
    const c = CATS[p.cat], total = SZ.reduce((a, z) => a + p.stock[z], 0), disp = SZ.filter(z => p.stock[z] > 0);
    const catUrl = `${SITE}/categoria/${c.s}/`;
    const desc = cut(`${p.name}. ${c.n} de ${p.club}${p.year ? " (" + p.year + ")" : ""}. ${total ? "Talles disponibles: " + disp.join(", ") + "." : "Sin stock por ahora."} Envíos a todo el país y retiro en Córdoba Capital.`, 158);
    const wa = `https://wa.me/${WA}?text=${encodeURIComponent(`Hola! Quiero consultar por: ${p.name} (${p.url})`)}`;
    const gallery = p.images.length
      ? `<div class="ph"><img id="m" src="${esc(abs(p.images[0]))}" alt="${esc(p.name)}" fetchpriority="high"></div>${p.images.length > 1 ? `<div class="ths">${p.images.map((u, i) => `<button type="button" onclick="document.getElementById('m').src=this.dataset.s" data-s="${esc(abs(u))}" aria-label="Foto ${i + 1}"><img src="${esc(abs(u))}" alt="${esc(p.name)} - foto ${i + 1}" loading="lazy"></button>`).join("")}</div>` : ""}`
      : `<div class="ph">${esc(p.club)}<br>Foto próximamente</div>`;
    const body = `<main>
<nav class="bc" aria-label="Ruta"><a href="/">Inicio</a> › <a href="/categoria/${c.s}/">${esc(c.n)}</a> › ${esc(p.name)}</nav>
<div class="pd"><div>${gallery}</div><div>
<span class="tag">${esc(c.n)}</span><h1>${esc(p.name)}</h1><div class="pr">${money(p.price)}</div>
${p.demora ? `<div class="box"><b>Demora ${esc(p.demora)} después de la compra</b><br><small>Es un producto a pedido: el plazo se cuenta desde que confirmás la compra.</small></div>` : ""}
<b>Talles</b><ul class="sz">${SZ.map(z => `<li class="${p.stock[z] > 0 ? "" : "no"}">${z}${p.stock[z] > 0 && p.stock[z] <= 3 ? ` · quedan ${p.stock[z]}` : ""}</li>`).join("")}</ul>
${total ? `<a class="btn" href="/#p${p.id}">Elegir talle y comprar</a>` : `<p><b>Sin stock por el momento.</b> Escribinos y te avisamos cuando vuelva.</p>`}
<a class="btn g" href="${wa}" rel="nofollow">Consultar por WhatsApp</a>
</div></div>
<section class="info"><h2>Sobre esta camiseta</h2>
<p>${esc(p.name)}: ${esc(c.n.toLowerCase())} de ${esc(p.club)}${p.country ? " (" + esc(p.country) + ")" : ""}${p.year ? ", " + esc(p.year) : ""}.</p>
<ul><li>Club o selección: ${esc(p.club)}</li>${p.country ? `<li>País: ${esc(p.country)}</li>` : ""}${p.year ? `<li>Año: ${esc(p.year)}</li>` : ""}<li>Categoría: ${esc(c.n)}</li><li>Talles disponibles: ${disp.length ? disp.join(", ") : "sin stock"}</li></ul>
<h2>Envíos y retiro</h2>
<p>Enviamos a todo el país por Correo Argentino, hacemos envíos dentro de Córdoba y podés retirar en nuestro local de Córdoba Capital sin costo. Coordinamos la compra por WhatsApp.</p></section>
</main>`;
    const ld = [
      { "@context": "https://schema.org", "@type": "Product", name: p.name, description: desc, sku: String(p.id), category: c.n, url: p.url, image: p.images.length ? p.images.map(abs) : [SITE + "/og.jpg"],
        ...(p.price ? { offers: { "@type": "Offer", url: p.url, priceCurrency: "ARS", price: p.price, availability: "https://schema.org/" + (total ? "InStock" : "OutOfStock") } } : {}) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: c.n, item: catUrl },
        { "@type": "ListItem", position: 3, name: p.name, item: p.url } ] }
    ];
    write(`camisetas/${p.slug}/index.html`, layout({ title: `${p.name} | Juego Sagrado Camisetas`, desc, url: p.url, image: p.images.length ? abs(p.images[0]) : SITE + "/og.jpg", type: "website", ld, body }));
  }

  /* ---------- 4. Una página por categoría ---------- */
  const urls = [SITE + "/"];
  for (const [key, c] of Object.entries(CATS)) {
    const list = products.filter(p => p.cat === key), url = `${SITE}/categoria/${c.s}/`;
    if (list.length) urls.push(url);
    const body = `<main><nav class="bc" aria-label="Ruta"><a href="/">Inicio</a> › ${esc(c.n)}</nav>
<h1>${esc(c.n)}</h1><p style="color:var(--mu);max-width:70ch">${esc(c.d)} Envíos a todo el país y retiro en Córdoba Capital.</p>
${list.length ? `<div class="g2">${list.map(card).join("")}</div>` : `<p>Pronto vamos a sumar camisetas en esta categoría.</p>`}</main>`;
    const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: c.n, url, description: c.d }];
    write(`categoria/${c.s}/index.html`, layout({ title: `${c.n} | Juego Sagrado Camisetas`, desc: cut(`${c.d} Envíos a todo el país y retiro en Córdoba Capital.`, 158), url, image: SITE + "/og.jpg", ld, body, noindex: !list.length }));
  }

  /* ---------- 5. Sitemap ---------- */
  products.forEach(p => urls.push(p.url));
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => ` <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  console.log(`Listo: ${products.length} camisetas, ${Object.keys(CATS).length} categorías, ${urls.length} URLs en el sitemap.`);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
