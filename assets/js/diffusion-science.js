// =============================================================================
// Diffusion de l'IA (science) : tableau de bord
// Données : data/ai-trackers/diffusion-science/ (remplacer les fichiers = mettre à jour le tracker).
// Date des données : attributs data-asof et data-asof-label de <main class="ds-main"> dans la page.
// Style : charte du site LIFT (IBM Plex Sans, Space Grotesk ; bleu nuit, bleuet, corail).
// Chaque graphique a ses commandes (boutons, pastilles, menus) et un menu « Télécharger » :
// image PNG avec titre et source, données Excel ou CSV. Le bouton « Toutes les données »
// rassemble les fichiers du tracker dans un ZIP avec un dictionnaire des variables.
// superstars.js (onglet Acteurs clés) se sert des mêmes outils via window.LIFTDash.
// =============================================================================
(function () {
  'use strict';

  // ------------------------------------------------------------------ chemins
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const ROOT = SRC ? SRC.replace(/assets\/js\/[^/?#]*([?#].*)?$/, '') : location.pathname.replace(/ai-trackers\/.*$/, '');
  const DATA = ROOT + 'data/ai-trackers/diffusion-science/';
  const NUTS_URL = ROOT + 'assets/maps/nuts1_europe.geojson';
  const LIBS = {
    XLSX: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    JSZip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
  };
  const FILES = ['brevets_by_year.csv', 'pays.csv', 'ipc4.csv', 'ipc4_series.csv', 'ipc4_share_series.csv',
    'publications.csv', 'topics.csv', 'superstars.json', 'world_map.json', 'europe_map.json'];
  const MAIN = document.querySelector('.ds-main');
  const ASOF = (MAIN && MAIN.dataset.asof) || new Date().toISOString().slice(0, 10);
  const ASOF_LABEL = (MAIN && MAIN.dataset.asofLabel) || ASOF;
  const SOURCE = 'Source : LIFT, tracker « Diffusion de l’IA (science) », données au ' + ASOF_LABEL +
    '. D’après Google Patents, patCit, OpenAlex et REGPAT (OCDE).';

  // ------------------------------------------------------------------ charte
  const T = {
    navy: '#0E2A47', corn: '#5F84E8', cornSoft: '#B9C9F3', coral: '#E46A4E', coralDark: '#B4472F', olive: '#5B6B2F',
    muted: '#55657D', note: '#7A879A', grid: '#E6EBF2', line: '#D5DDE8', prov: '#C9D3E3', ctx: '#C5CEDA', land: '#F5F6F8'
  };
  const SERIES = ['#0E2A47', '#5F84E8', '#E46A4E', '#5B6B2F', '#20A39A', '#9B5DA8', '#D4A13A', '#8A97AB'];
  const SERIES15 = SERIES.concat(['#3E66D2', '#C4523A', '#8C9C40', '#4A9FD8', '#B5651D', '#6C4F8C', '#A23E6E']);
  const SEQ = [[0, '#E3EAF8'], [0.2, '#C2D1F4'], [0.45, '#8BA6EA'], [0.7, '#4A6CB8'], [1, '#0E2A47']];
  // Échelle resserrée vers le bas, pour les volumes très concentrés (quelques pays ou régions dominent).
  const SEQ_SKEW = [[0, '#E3EAF8'], [0.03, '#D0DCF6'], [0.1, '#AFC3F1'], [0.25, '#7593DE'], [0.5, '#3A5A9E'], [1, '#0E2A47']];
  const SANS = "'IBM Plex Sans', Helvetica, Arial, sans-serif";
  const DISP = "'Space Grotesk', 'IBM Plex Sans', Helvetica, Arial, sans-serif";
  const NB = ' ';
  const CFG = { responsive: true, displayModeBar: false };

  const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 1) => fr(v, d) + NB + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h2r = (hex, a) => 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + a + ')';
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  function merge(a, b) {
    const out = Object.assign({}, a);
    for (const k in b) out[k] = (isObj(a[k]) && isObj(b[k])) ? merge(a[k], b[k]) : b[k];
    return out;
  }
  const narrowOf = el => el.clientWidth < 520;
  const visible = el => !!(el && el.getClientRects().length);

  function base(o) {
    return merge({
      margin: { l: 48, r: 16, t: 34, b: 34 },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: SANS, size: 12, color: T.muted },
      separators: ',' + NB,
      showlegend: false,
      dragmode: false,
      hovermode: 'x unified',
      hoverlabel: { bgcolor: '#FFFFFF', bordercolor: T.line, font: { family: SANS, size: 13, color: T.navy } },
      xaxis: { showgrid: false, zeroline: false, showline: false, ticks: '', fixedrange: true },
      yaxis: { showgrid: true, gridcolor: T.grid, zeroline: false, showline: false, ticks: '', fixedrange: true },
      bargap: 0.22
    }, o || {});
  }
  const ann = o => Object.assign({ showarrow: false, font: { family: SANS, size: 12, color: T.muted } }, o);
  const unit = (text, ml) => ann({ xref: 'paper', yref: 'paper', x: 0, y: 1, xanchor: 'left', yanchor: 'bottom',
    xshift: -ml + 4, yshift: 12, align: 'left', text });
  const keyNote = text => ann({ xref: 'paper', yref: 'paper', x: 1, y: 1, xanchor: 'right', yanchor: 'bottom', yshift: 12,
    align: 'right', text: '<i>' + text + '</i>', font: { family: SANS, size: 11, color: T.note } });
  const legendTop = { orientation: 'h', x: 1, xanchor: 'right', y: 1, yanchor: 'bottom', font: { size: 11.5, color: T.navy }, traceorder: 'normal' };

  // Barres horizontales ; sur téléphone, les noms passent au-dessus des barres.
  function hbar(o) {
    const names = o.names.slice().reverse();
    const vals = o.values.slice().reverse();
    const colors = Array.isArray(o.colors) ? o.colors.slice().reverse() : (o.colors || T.navy);
    const vmax = Math.max(0, ...vals);
    const n = o.narrow, ml = n ? 16 : (o.ml || 150), mt = 30, mb = o.labels ? 12 : 30;
    const gap = n ? 0.5 : 0.3;
    const tr = {
      y: names, x: vals, type: 'bar', orientation: 'h', marker: { color: colors, cornerradius: 2 },
      customdata: vals.map(o.fmt),
      hovertemplate: '<b>%{y}</b><br>%{customdata}' + (o.hover || '') + '<extra></extra>'
    };
    if (o.labels) {
      Object.assign(tr, { text: vals.map(o.fmt), textposition: 'outside', cliponaxis: false,
        textfont: { family: DISP, size: 12, color: T.navy } });
    }
    const annots = [unit(o.unit, ml)];
    if (n) {
      const slot = Math.max(10, (o.height - mt - mb) / Math.max(1, names.length));
      const shift = slot * (1 - gap) / 2 + 2;
      names.forEach(nm => annots.push(ann({ x: 0, y: nm, xref: 'x', yref: 'y', xanchor: 'left', yanchor: 'bottom',
        yshift: shift, text: esc(nm), font: { family: SANS, size: 12, color: T.navy } })));
    }
    return {
      data: [tr],
      layout: base({
        hovermode: 'closest', margin: { l: ml, r: o.labels ? 52 : 16, t: mt, b: mb }, bargap: gap,
        xaxis: o.labels ? { visible: false, range: [0, vmax * 1.14] }
          : { showgrid: true, gridcolor: T.grid, tickformat: o.tickformat || ',d', ticksuffix: o.ticksuffix || '', rangemode: 'tozero' },
        yaxis: n ? { showgrid: false, showticklabels: false }
          : { showgrid: false, automargin: true, tickmode: 'array', tickvals: names, tickfont: { size: 12, color: T.navy } },
        annotations: annots
      })
    };
  }
  const hbarHeight = (count, n) => n ? Math.round(count * 40 + 60) : Math.round(count * 25 + 70);

  // ------------------------------------------------------------------ données
  function parseCSV(text) {
    const rows = []; let row = [], field = '', q = false;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
  }
  function records(text) {
    const r = parseCSV(text), h = r[0];
    return r.slice(1).map(row => Object.fromEntries(h.map((k, i) => [k, row[i]])));
  }
  const N = v => Number(v);
  const D = {};
  let PY = [], YEARS = [], LAST = null;

  function buildData(F) {
    D.py = records(F['brevets_by_year.csv']).map(r => ({ y: N(r.annee), tot: N(r.brevets_total), ai: N(r.brevets_ia),
      obs: N(r.ia_observes), pred: N(r.ia_predits), sh: N(r.part_ia_pct) }));
    D.ct = records(F['pays.csv']).map(r => ({ c: r.code_pays, n: r.pays, ai: N(r.brevets_ia_pondere), tot: N(r.brevets_total_pondere), sh: N(r.part_ia_pct) }));
    D.ipc = records(F['ipc4.csv']).map(r => ({ k: r.ipc4, n: r.domaine, ai: N(r.brevets_ia), tot: N(r.brevets_total), sh: N(r.part_ia_pct) }));
    D.pubs = records(F['publications.csv']).map(r => ({ y: N(r.annee), n: N(r.publications_mappees) }));
    D.topics = records(F['topics.csv']).map(r => ({ t: r.topic, n: N(r.count) }));
    D.ipcYears = []; D.ipcSer = {};
    records(F['ipc4_series.csv']).forEach(r => {
      const y = N(r.annee);
      if (!D.ipcYears.includes(y)) D.ipcYears.push(y);
      (D.ipcSer[r.ipc4] = D.ipcSer[r.ipc4] || []).push(N(r.brevets_ia));
    });
    D.ipcShare = {};
    records(F['ipc4_share_series.csv']).forEach(r => { (D.ipcShare[r.ipc4] = D.ipcShare[r.ipc4] || []).push(N(r.part_pct)); });
    D.ipcName = Object.fromEntries(D.ipc.map(r => [r.k, r.n]));
    D.top8 = D.ipc.filter(r => D.ipcSer[r.k]).slice(0, 8).map(r => r.k);
    D.top8NoG06 = D.ipc.filter(r => !r.k.startsWith('G06') && D.ipcSer[r.k]).slice(0, 8).map(r => r.k);
    PY = D.py; YEARS = PY.map(r => r.y); LAST = PY[PY.length - 1];
  }
  async function getText(f) {
    const r = await fetch(DATA + f);
    if (!r.ok) throw new Error(f + ' : HTTP ' + r.status);
    return r.text();
  }
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url.split('/').pop() + ' : HTTP ' + r.status);
    return r.json();
  }

  const isProv = r => LAST && r.y === LAST.y;
  const provTxt = () => PY.map(r => isProv(r) ? ' <i>(provisoire)</i>' : '');
  const yearTicks = n => {
    const last = LAST ? LAST.y : 2024;
    return n ? [1990, 2000, 2010, last] : [1990, 1995, 2000, 2005, 2010, 2015, 2020, last];
  };

  // Barres annuelles des brevets IA, dernière année hachurée (provisoire).
  function yearBars(colorOf, extra) {
    return Object.assign({
      x: YEARS, y: PY.map(r => r.ai), type: 'bar', name: 'Brevets IA',
      marker: {
        color: PY.map(r => isProv(r) ? T.prov : colorOf(r)), cornerradius: 2,
        pattern: { shape: PY.map(r => isProv(r) ? '/' : ''), fgcolor: T.navy, bgcolor: T.prov, size: 6, solidity: 0.5 }
      },
      customdata: provTxt(),
      hovertemplate: '<b>%{y:,d}</b> brevets IA%{customdata}<extra></extra>'
    }, extra || {});
  }
  // Courbe d'une part (en %) ; le dernier segment, provisoire, en pointillé.
  function lineWithTail(ys, color, name, hover, withFill) {
    const full = { x: YEARS.slice(0, -1), y: ys.slice(0, -1) }, tail = { x: YEARS.slice(-2), y: ys.slice(-2) };
    const tr = [
      Object.assign({ type: 'scatter', mode: 'lines', name, legendgroup: name, line: { color, width: 2.6 }, hoverinfo: 'skip' }, full,
        withFill ? { fill: 'tozeroy', fillcolor: 'rgba(228,106,78,0.09)' } : {}),
      Object.assign({ type: 'scatter', mode: 'lines', name, legendgroup: name, showlegend: false, line: { color, width: 2.6, dash: 'dot' }, hoverinfo: 'skip' }, tail,
        withFill ? { fill: 'tozeroy', fillcolor: 'rgba(228,106,78,0.05)' } : {})
    ];
    tr.push(Object.assign({ type: 'scatter', mode: 'markers', name, legendgroup: name, showlegend: false, x: YEARS, y: ys,
      marker: { size: 8, color, opacity: 0 } }, hover));
    return tr;
  }

  // ------------------------------------------------------------------ registre
  const REG = {};
  const STATE = {};
  const ICON_DL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  function register(spec) {
    REG[spec.id] = spec;
    STATE[spec.id] = Object.assign({}, spec.defaults || {});
    setupCard(spec);
  }
  function cardOf(spec) { const el = document.getElementById(spec.id); return el ? el.closest('.chart-card') : null; }
  function cardTitle(spec) { const c = cardOf(spec); const h = c && c.querySelector('h3'); return h ? h.textContent.trim() : spec.id; }

  function setupCard(spec) {
    const el = document.getElementById(spec.id);
    if (!el) return;
    const card = el.closest('.chart-card');
    if (!card) return;
    card.classList.add('dash-card');
    const bar = document.createElement('div');
    bar.className = 'dash-bar';
    const ctrl = document.createElement('div');
    ctrl.className = 'dash-ctrl';
    bar.appendChild(ctrl);
    spec._ctrl = ctrl;
    buildControls(spec);
    bar.appendChild(downloadMenu(spec));
    el.parentNode.insertBefore(bar, el);
    const h = card.querySelector('h3');
    if (h && !h.dataset.title) h.dataset.title = h.textContent.trim();
  }

  function buildControls(spec) {
    const box = spec._ctrl;
    if (!box) return;
    box.innerHTML = '';
    (spec.controls || []).forEach(c => {
      if (c.type === 'seg') box.appendChild(segControl(spec, c));
      else if (c.type === 'select') box.appendChild(selectControl(spec, c));
      else if (c.type === 'chips') box.appendChild(chipControl(spec, c));
    });
  }
  function segControl(spec, c) {
    const g = document.createElement('div');
    g.className = 'dash-seg';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', c.label);
    c.options.forEach(([v, l]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l;
      b.setAttribute('aria-pressed', String(STATE[spec.id][c.key] === v));
      b.addEventListener('click', () => {
        STATE[spec.id][c.key] = v;
        g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        draw(spec);
      });
      g.appendChild(b);
    });
    return g;
  }
  function selectControl(spec, c) {
    const wrap = document.createElement('label');
    wrap.className = 'dash-select';
    const span = document.createElement('span');
    span.className = 'dash-select-lbl';
    span.textContent = c.label;
    const s = document.createElement('select');
    s.id = spec.id + '-' + c.key;
    (c.groups || [{ options: c.options }]).forEach(gr => {
      const parent = gr.label ? document.createElement('optgroup') : s;
      if (gr.label) parent.label = gr.label;
      gr.options.forEach(([v, l]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        if (STATE[spec.id][c.key] === v) o.selected = true;
        parent.appendChild(o);
      });
      if (gr.label) s.appendChild(parent);
    });
    s.addEventListener('change', () => { STATE[spec.id][c.key] = s.value; draw(spec); });
    wrap.appendChild(span);
    wrap.appendChild(s);
    return wrap;
  }
  function chipControl(spec, c) {
    const box = document.createElement('div');
    box.className = 'dash-chips';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', c.label);
    const sel = STATE[spec.id][c.key];
    c.options().forEach(([v, l, color]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(sel.has(v)));
      b.style.setProperty('--c', color);
      b.innerHTML = '<span class="dot" aria-hidden="true"></span>';
      b.appendChild(document.createTextNode(l));
      b.addEventListener('click', () => {
        const s = STATE[spec.id][c.key];
        if (s.has(v)) { if (s.size > 1) s.delete(v); } else s.add(v);
        b.setAttribute('aria-pressed', String(s.has(v)));
        draw(spec);
      });
      box.appendChild(b);
    });
    return box;
  }

  // ------------------------------------------------------------------ dessin
  async function draw(spec) {
    const el = document.getElementById(spec.id);
    if (!spec.build || !el || !visible(el) || !window.Plotly) return;
    if (spec.needs && !spec._ready) {
      if (!spec._loading) spec._loading = spec.needs().then(() => { spec._ready = true; });
      try { await spec._loading; } catch (e) { fail(el, e); return; }
    }
    const n = narrowOf(el);
    const st = STATE[spec.id];
    const h = typeof spec.height === 'function' ? spec.height(n, st) : (spec.height || 320);
    el.style.height = h + 'px';
    let fig;
    try { fig = spec.build(n, st, h); } catch (e) { fail(el, e); return; }
    fig.layout.height = h;
    Plotly.react(el, fig.data, fig.layout, CFG);
    spec._drawn = true;
    spec._narrow = n;
    if (spec.title) {
      const c = cardOf(spec), hh = c && c.querySelector('h3');
      if (hh) hh.textContent = spec.title(st, hh.dataset.title || hh.textContent);
    }
  }
  function fail(el, e) {
    console.error('[diffusion-science]', e);
    el.innerHTML = '<p class="dash-msg">Ce graphique n’a pas pu être affiché. Recharger la page ; si le problème persiste, signaler-le au LIFT.</p>';
  }
  function refresh() {
    Object.values(REG).forEach(spec => {
      const el = document.getElementById(spec.id);
      if (!spec.build || !visible(el)) return;
      if (!spec._drawn || spec._narrow !== narrowOf(el)) draw(spec);
      else if (el._fullLayout) Plotly.Plots.resize(el);
    });
  }
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(refresh, 180); });

  // ------------------------------------------------------------------ téléchargements
  const loading = {};
  function loadLib(name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (!loading[name]) {
      loading[name] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = LIBS[name];
        s.onload = () => (window[name] ? res(window[name]) : rej(new Error(name + ' indisponible')));
        s.onerror = () => { loading[name] = null; rej(new Error('Chargement impossible : ' + LIBS[name])); };
        document.head.appendChild(s);
      });
    }
    return loading[name];
  }
  function save(href, name) {
    const a = document.createElement('a');
    a.href = href; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    save(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const fileName = (spec, ext) => 'lift_ia-science_' + spec.slug + '_' + ASOF + '.' + ext;

  function downloadMenu(spec) {
    const d = document.createElement('details');
    d.className = 'dash-dl';
    const img = spec.build && !spec.noImage;
    d.innerHTML = '<summary title="' + (img ? 'Télécharger ce graphique ou ses données' : 'Télécharger ces données') + '">' + ICON_DL + '<span>Télécharger</span></summary>' +
      '<div class="dash-dl-menu">' +
      (img ? '<button type="button" data-k="png">Image <span>PNG</span></button>' : '') +
      '<button type="button" data-k="xlsx">Données <span>Excel</span></button>' +
      '<button type="button" data-k="csv">Données <span>CSV</span></button>' +
      '</div>';
    d.querySelector('.dash-dl-menu').addEventListener('click', async ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      d.removeAttribute('open');
      const k = b.dataset.k;
      try {
        if (k === 'png') await exportPNG(spec);
        else if (k === 'csv') exportCSV(spec);
        else await exportXLSX(spec);
      } catch (e) {
        console.error('[diffusion-science] téléchargement', e);
        flash(d, 'Téléchargement impossible pour le moment.');
      }
    });
    return d;
  }
  document.addEventListener('click', ev => {
    document.querySelectorAll('.dash-dl[open]').forEach(d => { if (!d.contains(ev.target)) d.removeAttribute('open'); });
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') document.querySelectorAll('.dash-dl[open]').forEach(d => d.removeAttribute('open'));
  });
  function flash(anchor, text) {
    const p = document.createElement('span');
    p.className = 'dash-flash';
    p.textContent = text;
    anchor.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }

  async function exportPNG(spec) {
    const el = document.getElementById(spec.id);
    const st = STATE[spec.id];
    const W = 1200;
    const H = Math.max(675, Math.round((el.clientHeight || 400) * 1.1));
    const fig = spec.build(false, st, H);
    const L = fig.layout;
    L.width = W; L.height = H;
    L.paper_bgcolor = '#FFFFFF'; L.plot_bgcolor = '#FFFFFF';
    L.margin = Object.assign({}, L.margin);
    const live = el._fullLayout && el._fullLayout._size;
    if (live && !L.geo) L.margin.l = Math.max(L.margin.l || 0, Math.round(live.l));
    L.margin.t = (L.margin.t || 30) + 64;
    L.margin.b = (L.margin.b || 30) + 34;
    if (L.geo) { L.margin.l = Math.max(L.margin.l || 0, 20); L.margin.r = Math.max(L.margin.r || 0, 20); }
    if (L.xaxis && L.xaxis.rangeslider) {
      const r = el._fullLayout && el._fullLayout.xaxis && el._fullLayout.xaxis.range;
      L.xaxis = Object.assign({}, L.xaxis, { rangeslider: { visible: false } }, r ? { range: r.slice() } : {});
      L.margin.b = 34 + 34;
    }
    const cap = spec.caption ? spec.caption(st) : '';
    if (cap) L.margin.t += 22;
    L.title = { text: '<b>' + esc(cardTitle(spec)) + '</b>' + (cap ? '<br><span style="font-size:15px;color:' + T.muted + '">' + esc(cap) + '</span>' : ''),
      x: 0, xref: 'container', xanchor: 'left', y: 1, yref: 'container', yanchor: 'top', pad: { t: 22, l: 14 },
      font: { family: DISP, size: 22, color: T.navy } };
    // Les séries choisies par pastilles n'ont pas de légende sur la page : l'image en reçoit une.
    const named = fig.data.filter(d => d.name && d.showlegend !== false);
    if (!L.showlegend && named.length > 1 && fig.data.every(d => d.type === 'scatter')) {
      L.showlegend = true;
      L.legend = { orientation: 'h', x: 0, xanchor: 'left', y: -0.07, yanchor: 'top', traceorder: 'normal',
        font: { family: SANS, size: 13, color: T.navy }, entrywidth: 0.33, entrywidthmode: 'fraction' };
      L.margin.b += 26 * Math.ceil(named.length / 3);
    }
    L.annotations = (L.annotations || []).concat([ann({ xref: 'paper', yref: 'paper', x: 0, y: 0, xanchor: 'left', yanchor: 'top',
      xshift: -(L.margin.l || 0) + 12, yshift: -(L.margin.b || 0) + 26, align: 'left', text: esc(SOURCE), font: { family: SANS, size: 11.5, color: T.note } })]);
    const url = await Plotly.toImage({ data: fig.data, layout: L }, { format: 'png', width: W, height: H, scale: 2 });
    save(url, fileName(spec, 'png'));
  }
  function tableOf(spec) { return spec.table(STATE[spec.id]); }
  function exportCSV(spec) {
    const t = tableOf(spec);
    const cell = v => {
      if (v == null || (typeof v === 'number' && !isFinite(v))) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [t.columns.map(c => c[0]).join(',')].concat(t.rows.map(r => t.columns.map(c => cell(r[c[0]])).join(',')));
    saveBlob(new Blob(['﻿' + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }), fileName(spec, 'csv'));
  }
  async function exportXLSX(spec) {
    const XLSX = await loadLib('XLSX');
    const t = tableOf(spec);
    const wb = XLSX.utils.book_new();
    const aoa = [t.columns.map(c => c[1])].concat(t.rows.map(r => t.columns.map(c => (r[c[0]] == null ? '' : r[c[0]]))));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = t.columns.map(c => ({ wch: Math.min(48, Math.max(10, c[1].length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Données');
    const info = [
      ['Graphique', cardTitle(spec)],
      ['Source', SOURCE.replace(/^Source : /, '')],
      ['Données au', ASOF_LABEL],
      ['Page', location.href.split('#')[0]],
      [],
      ['Colonne', 'Définition']
    ].concat(t.columns.map(c => [c[1], c[2] || '']));
    const wi = XLSX.utils.aoa_to_sheet(info);
    wi['!cols'] = [{ wch: 34 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, wi, 'À lire');
    XLSX.writeFile(wb, fileName(spec, 'xlsx'));
  }

  // Toutes les données : ZIP des fichiers du tracker et dictionnaire des variables.
  const README = () => [
    'Diffusion de l’IA (science), tracker du LIFT',
    'Données au ' + ASOF_LABEL + '. Page : ' + location.href.split('#')[0],
    '',
    'Ce que mesure le tracker',
    'Les brevets européens (EP) publiés de 1990 à 2024 qui citent au moins une publication scientifique d’intelligence artificielle.',
    'Une publication est dite IA si son thème principal (primary topic) dans OpenAlex figure dans une liste de 34 thèmes.',
    'Une citation est « observée » quand elle a été reliée à une publication OpenAlex : par patCit, par le DOI écrit dans la',
    'citation, ou en retrouvant le titre cité dans arXiv, Crossref ou Semantic Scholar. Les citations qui n’ont pu être reliées à',
    'aucune publication sont classées par un modèle appliqué à leur titre (« prédites »). Chaque brevet est compté une fois,',
    'l’année de sa première publication. La dernière année est provisoire : une partie de ses brevets n’a pas encore de rapport',
    'de recherche dans les données.',
    '',
    'Fichiers et variables',
    '',
    'brevets_by_year.csv : brevets par année',
    '  annee           année de première publication du brevet',
    '  brevets_total   brevets EP du corpus (au moins une citation de littérature non brevet)',
    '  brevets_ia      brevets citant au moins une publication IA, observée ou prédite',
    '  ia_observes     brevets dont au moins une citation IA est observée',
    '  ia_predits      brevets dont au moins une citation est classée IA par le modèle (un brevet peut être observé et prédit)',
    '  part_ia_pct     brevets_ia / brevets_total, en %',
    '',
    'pays.csv : 25 premiers pays par brevets IA, géographie des inventeurs (poids fractionnés REGPAT), toute la période',
    '  code_pays, pays, brevets_ia_pondere, brevets_total_pondere, part_ia_pct (en %)',
    '',
    'ipc4.csv : 20 premiers domaines technologiques (classe IPC à 4 caractères) ; un brevet peut relever de plusieurs domaines',
    '  ipc4, domaine, brevets_ia, brevets_total, part_ia_pct (part des brevets du domaine qui sont IA, en %)',
    '',
    'ipc4_series.csv : brevets IA par année et par domaine',
    '  annee, ipc4, brevets_ia',
    '',
    'ipc4_share_series.csv : part de chaque domaine parmi les brevets IA des 8 premiers domaines, par année (total = 100)',
    '  annee, ipc4, part_pct',
    '',
    'publications.csv : publications IA citées par les brevets IA, par année de publication de l’article',
    '  (citations observées seulement, chaque publication comptée une fois)',
    '  annee, publications_mappees',
    '',
    'topics.csv : 20 premiers thèmes OpenAlex des publications IA citées',
    '  topic, count (nombre de publications distinctes)',
    '',
    'superstars.json : acteurs clés',
    '  applicants  déposants : name, patents (brevets IA), equiv (équivalent fractionné), papers (publications IA citées)',
    '  inventors   inventeurs : name, patents, equiv',
    '  papers      publications les plus citées : title, year, topic, citing_patents, applicants (déposants distincts),',
    '              cited_by (citations OpenAlex), openalex (lien)',
    '  time_series brevets IA par année des 15 premiers déposants (équivalent fractionné)',
    '',
    'world_map.json : par pays (ctry_code, ISO à 2 lettres), pour les inventeurs et les déposants (role)',
    '  weighted_total_patents, weighted_ai_patents (brevets pondérés REGPAT), weighted_ai_share (entre 0 et 1)',
    '',
    'europe_map.json : par région NUTS1 et par année (years), inventeurs (inv) et déposants (app), des lignes',
    '  [région, pays, brevets pondérés, brevets IA pondérés, part de la région dans les brevets IA européens',
    '  de l’année (entre 0 et 1), part IA des brevets de la région (entre 0 et 1)]',
    '',
    'Sources : Google Patents (citations des brevets), patCit (EPO), OpenAlex, arXiv, Crossref, Semantic Scholar,',
    'REGPAT (OCDE). Calculs du LIFT.'
  ].join('\r\n') + '\r\n';

  async function downloadAll(btn, status) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Préparation…';
    status.textContent = '';
    try {
      const JSZip = await loadLib('JSZip');
      const zip = new JSZip();
      for (const f of FILES) zip.file(f, await getText(f));
      zip.file('LISEZMOI.txt', README());
      saveBlob(await zip.generateAsync({ type: 'blob' }), 'lift_ia-science_donnees_' + ASOF + '.zip');
    } catch (e) {
      console.error('[diffusion-science] ZIP', e);
      status.textContent = 'Téléchargement impossible pour le moment. Les fichiers restent disponibles un par un dans le dossier data/ai-trackers/diffusion-science/ du dépôt du site.';
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
  function setupDataBar() {
    const bar = document.getElementById('dash-databar');
    if (!bar) return;
    bar.innerHTML =
      '<p><strong>Données au ' + esc(ASOF_LABEL) + '.</strong> Chaque graphique a un bouton « Télécharger » : image PNG, données Excel ou CSV.</p>' +
      '<div class="dash-databar-act"><button type="button" class="dash-allbtn">' + ICON_DL + '<span>Toutes les données (ZIP)</span></button>' +
      '<span class="dash-databar-hint">10 fichiers et un dictionnaire des variables</span></div>' +
      '<p class="dash-status" role="status"></p>';
    const btn = bar.querySelector('.dash-allbtn');
    btn.addEventListener('click', () => downloadAll(btn, bar.querySelector('.dash-status')));
  }

  // ------------------------------------------------------------------ colonnes des exports
  const COL = {
    annee: ['annee', 'Année', 'Année de première publication du brevet'],
    tot: ['brevets_total', 'Brevets EP du corpus', 'Brevets EP avec au moins une citation de littérature non brevet'],
    ai: ['brevets_ia', 'Brevets IA', 'Brevets citant au moins une publication IA, observée ou prédite'],
    obs: ['ia_observes', 'Brevets IA observés', 'Brevets dont au moins une citation IA est reliée à une publication OpenAlex'],
    predOnly: ['ia_predits_seulement', 'Brevets IA prédits seulement', 'Brevets IA sans citation IA observée, retenus par le modèle de titres'],
    sh: ['part_ia_pct', 'Part des brevets IA (%)', 'Brevets IA / brevets EP du corpus, en %'],
    shObs: ['part_ia_observes_pct', 'Part des brevets IA observés (%)', 'Brevets IA observés / brevets EP du corpus, en %'],
    obsShare: ['part_observes_pct', 'Part des brevets IA observés parmi les brevets IA (%)', 'Brevets IA observés / brevets IA, en %'],
    prov: ['provisoire', 'Provisoire', '1 pour la dernière année, encore incomplète']
  };
  const yearRows = f => PY.map(r => Object.assign({ annee: r.y, provisoire: isProv(r) ? 1 : 0 }, f(r)));
  const round = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

  // ------------------------------------------------------------------ graphiques
  function patentSpecs() {
    // Vue d'ensemble : brevets IA par année
    register({
      id: 'ch-overview-patents', slug: 'brevets_ia_par_annee',
      controls: [{ type: 'seg', key: 'view', label: 'Vue', options: [['total', 'Total'], ['split', 'Observés et prédits']] }],
      defaults: { view: 'total' },
      height: n => n ? 300 : 320,
      build: (n, st) => {
        const ticks = { tickvals: yearTicks(n) };
        if (st.view === 'total') {
          return {
            data: [yearBars(() => T.navy, {
              customdata: PY.map(r => [r.obs, fr(r.sh, 2), isProv(r) ? ' <i>(provisoire)</i>' : '']),
              hovertemplate: '<b>%{y:,d}</b> brevets IA%{customdata[2]}<br>dont %{customdata[0]:,d} observés<br>%{customdata[1]}' + NB + '% des brevets EP<extra></extra>'
            })],
            layout: base({ xaxis: ticks, yaxis: { tickformat: ',d' }, annotations: [unit('Nombre de brevets IA', 48), keyNote('hachuré : ' + LAST.y + ' provisoire')] })
          };
        }
        return stackedObs(n, 'n');
      },
      table: () => ({
        columns: [COL.annee, COL.ai, COL.obs, COL.predOnly, COL.sh, COL.tot, COL.prov],
        rows: yearRows(r => ({ brevets_ia: r.ai, ia_observes: r.obs, ia_predits_seulement: Math.max(0, r.ai - r.obs), part_ia_pct: r.sh, brevets_total: r.tot }))
      })
    });

    // Vue d'ensemble : part des brevets IA, avec réglette de période
    register({
      id: 'ch-overview-share', slug: 'part_brevets_ia',
      height: n => n ? 320 : 340,
      build: n => shareFig(n, false),
      table: () => ({
        columns: [COL.annee, COL.sh, COL.ai, COL.tot, COL.prov],
        rows: yearRows(r => ({ part_ia_pct: r.sh, brevets_ia: r.ai, brevets_total: r.tot }))
      })
    });

    // Brevets : observés et prédits
    register({
      id: 'ch-patents-stacked', slug: 'brevets_ia_observes_predits',
      controls: [{ type: 'seg', key: 'mode', label: 'Unité', options: [['n', 'Nombre'], ['p', 'En % des brevets IA']] }],
      defaults: { mode: 'n' },
      height: n => n ? 320 : 380,
      build: (n, st) => stackedObs(n, st.mode),
      table: () => ({
        columns: [COL.annee, COL.ai, COL.obs, COL.predOnly, COL.obsShare, COL.prov],
        rows: yearRows(r => ({ brevets_ia: r.ai, ia_observes: r.obs, ia_predits_seulement: Math.max(0, r.ai - r.obs),
          part_observes_pct: r.ai ? round(100 * r.obs / r.ai, 2) : null }))
      })
    });

    // Brevets : part des brevets IA, totale et observée
    register({
      id: 'ch-patents-share', slug: 'part_brevets_ia_observes',
      height: n => n ? 340 : 380,
      build: n => shareFig(n, true),
      table: () => ({
        columns: [COL.annee, COL.sh, COL.shObs, COL.ai, COL.obs, COL.tot, COL.prov],
        rows: yearRows(r => ({ part_ia_pct: r.sh, part_ia_observes_pct: r.tot ? round(100 * r.obs / r.tot, 3) : null,
          brevets_ia: r.ai, ia_observes: r.obs, brevets_total: r.tot }))
      })
    });

    // Brevets : corpus et brevets IA, échelle linéaire ou log
    register({
      id: 'ch-patents-total', slug: 'corpus_et_brevets_ia',
      controls: [{ type: 'seg', key: 'scale', label: 'Échelle', options: [['linear', 'Échelle linéaire'], ['log', 'Échelle log']] }],
      defaults: { scale: 'linear' },
      height: n => n ? 320 : 380,
      build: (n, st) => {
        const prov = provTxt();
        const data = [
          { x: YEARS, y: PY.map(r => r.tot), type: 'scatter', mode: 'lines', name: 'Brevets EP du corpus', line: { color: T.ctx, width: 2 },
            fill: st.scale === 'log' ? 'none' : 'tozeroy', fillcolor: 'rgba(197,206,218,0.25)', customdata: prov,
            hovertemplate: 'Brevets EP du corpus : <b>%{y:,d}</b>%{customdata}<extra></extra>' },
          { x: YEARS, y: PY.map(r => r.ai), type: 'scatter', mode: 'lines', name: 'Brevets IA', line: { color: T.navy, width: 2.6 },
            customdata: prov, hovertemplate: 'Brevets IA : <b>%{y:,d}</b>%{customdata}<extra></extra>' }
        ];
        return { data, layout: base({ showlegend: true, legend: legendTop, xaxis: { tickvals: yearTicks(n) },
          yaxis: st.scale === 'log' ? { type: 'log', tickformat: ',d', dtick: 1 } : { tickformat: ',d', rangemode: 'tozero' },
          annotations: [unit('Nombre de brevets', 48)] }) };
      },
      table: () => ({ columns: [COL.annee, COL.tot, COL.ai, COL.prov], rows: yearRows(r => ({ brevets_total: r.tot, brevets_ia: r.ai })) })
    });
  }

  function stackedObs(n, mode) {
    const share = mode === 'p';
    const pat = c => ({ shape: PY.map(r => isProv(r) ? '/' : ''), fgcolor: c, bgcolor: T.prov, size: 6, solidity: 0.5 });
    const val = (r, v) => share ? (r.ai ? 100 * v / r.ai : 0) : v;
    const fmt = share ? '%{y:.1f}' + NB + '%' : '%{y:,d}';
    const prov = provTxt();
    const obs = { x: YEARS, y: PY.map(r => val(r, r.obs)), type: 'bar', name: 'Observés', customdata: prov,
      marker: { color: PY.map(r => isProv(r) ? T.prov : T.navy), pattern: pat(T.navy) },
      hovertemplate: 'Observés : <b>' + fmt + '</b>%{customdata}<extra></extra>' };
    const pred = { x: YEARS, y: PY.map(r => val(r, Math.max(0, r.ai - r.obs))), type: 'bar', name: 'Prédits seulement', customdata: prov,
      marker: { color: PY.map(r => isProv(r) ? T.prov : T.cornSoft), pattern: pat(T.corn), cornerradius: 2 },
      hovertemplate: 'Prédits seulement : <b>' + fmt + '</b>%{customdata}<extra></extra>' };
    return { data: [obs, pred], layout: base({ barmode: 'stack', showlegend: true, legend: legendTop, xaxis: { tickvals: yearTicks(n) },
      yaxis: share ? { tickformat: '.0f', ticksuffix: NB + '%', range: [0, 100] } : { tickformat: ',d' },
      annotations: [unit(share ? '% des brevets IA' : 'Nombre de brevets IA', 48)] }) };
  }

  function shareFig(n, withObserved) {
    const prov = PY.map(r => isProv(r) ? ' <i>(provisoire)</i>' : '');
    const hover = {
      customdata: PY.map((r, i) => [r.ai, r.tot, prov[i]]),
      hovertemplate: '<b>%{y:.2f}' + NB + '%</b> des brevets EP%{customdata[2]}<br>%{customdata[0]:,d} brevets IA sur %{customdata[1]:,d}<extra></extra>'
    };
    let data = lineWithTail(PY.map(r => r.sh), T.coral, 'Tous les brevets IA', hover, !withObserved);
    if (withObserved) {
      data = data.concat(lineWithTail(PY.map(r => r.tot ? 100 * r.obs / r.tot : 0), T.navy, 'Brevets IA observés', {
        customdata: PY.map((r, i) => [r.obs, prov[i]]),
        hovertemplate: 'observés : <b>%{y:.2f}' + NB + '%</b>%{customdata[1]}<extra></extra>'
      }, false));
      data[0].hovertemplate = undefined;
      data[2].hovertemplate = 'tous : <b>%{y:.2f}' + NB + '%</b>%{customdata[2]}<br>%{customdata[0]:,d} brevets IA sur %{customdata[1]:,d}<extra></extra>';
    }
    const x0 = YEARS[0] - 1.2, x1 = YEARS[YEARS.length - 1] + 0.5;
    return { data, layout: base({
      showlegend: withObserved, legend: legendTop, margin: { b: 16 },
      xaxis: { tickvals: yearTicks(n), range: [x0, x1],
        rangeslider: { visible: true, thickness: n ? 0.11 : 0.12, bgcolor: '#FFFFFF', bordercolor: T.line, borderwidth: 1, range: [x0, x1] } },
      yaxis: { tickformat: '.1~f', ticksuffix: NB + '%', rangemode: 'tozero' },
      annotations: [unit('% des brevets EP', 48)].concat(withObserved ? [] : [keyNote('pointillé : ' + LAST.y + ' provisoire')])
    }) };
  }

  function countryTable(rows) {
    return {
      columns: [['rang', 'Rang', 'Rang selon la mesure affichée'], ['code_pays', 'Code pays', 'Code ISO à 2 lettres'], ['pays', 'Pays', ''],
        ['brevets_ia_pondere', 'Brevets IA (pondérés)', 'Brevets IA, poids fractionnés REGPAT selon les inventeurs, toute la période'],
        ['brevets_total_pondere', 'Brevets EP (pondérés)', 'Brevets EP du corpus, mêmes poids'],
        ['part_ia_pct', 'Part des brevets IA (%)', 'Brevets IA / brevets EP du pays, en %']],
      rows: rows.map((r, i) => ({ rang: i + 1, code_pays: r.c, pays: r.n, brevets_ia_pondere: r.ai, brevets_total_pondere: r.tot, part_ia_pct: r.sh }))
    };
  }
  const sortedCountries = (k, m) => D.ct.slice(0, k).sort((a, b) => m === 's' ? b.sh - a.sh : b.ai - a.ai);
  function countryFig(n, st, h) {
    const rows = sortedCountries(Number(st.k), st.m);
    const share = st.m === 's';
    return hbar({
      names: rows.map(r => r.n), values: rows.map(r => share ? r.sh : r.ai), narrow: n, height: h, ml: 112,
      fmt: v => share ? pct(v, 2) : fr(v), hover: share ? ' des brevets du pays' : ' brevets IA (pondérés)',
      unit: share ? 'Part des brevets IA dans les brevets du pays (%)' : 'Brevets IA, pondérés par inventeur',
      tickformat: share ? '.1~f' : ',d', ticksuffix: share ? NB + '%' : '', colors: T.navy
    });
  }

  function geoSpecs() {
    register({
      id: 'ch-overview-ctry', slug: 'pays',
      controls: [
        { type: 'seg', key: 'm', label: 'Mesure', options: [['n', 'Brevets IA'], ['s', 'Part IA']] },
        { type: 'seg', key: 'k', label: 'Nombre de pays', options: [['10', 'Top 10'], ['25', 'Top 25']] }
      ],
      defaults: { m: 'n', k: '10' },
      height: (n, st) => hbarHeight(Number(st.k), n),
      title: (st, t) => t.replace(/Top \d+/, 'Top ' + st.k),
      build: countryFig,
      table: st => countryTable(sortedCountries(Number(st.k), st.m))
    });
    register({
      id: 'ch-geo-bar', slug: 'pays_top25',
      controls: [{ type: 'seg', key: 'm', label: 'Mesure', options: [['n', 'Brevets IA'], ['s', 'Part IA']] }],
      defaults: { m: 'n', k: '25' },
      height: n => hbarHeight(25, n),
      build: countryFig,
      table: st => countryTable(sortedCountries(25, st.m))
    });
    register({
      id: 'ch-geo-scatter', slug: 'pays_volume_part',
      height: n => n ? 380 : 460,
      build: n => {
        const cd = D.ct;
        const labelled = new Set(cd.slice().sort((a, b) => b.ai - a.ai).slice(0, n ? 10 : cd.length).map(r => r.c));
        return { data: [{
          x: cd.map(r => r.tot), y: cd.map(r => r.sh), mode: 'markers+text', type: 'scatter', text: cd.map(r => labelled.has(r.c) ? r.c : ''),
          textposition: 'top center', textfont: { size: 10.5, color: T.navy, family: SANS }, cliponaxis: false,
          marker: { size: cd.map(r => Math.sqrt(r.ai) * (n ? 0.9 : 1.15) + 6), color: 'rgba(95,132,232,0.55)', line: { color: T.navy, width: 1 } },
          customdata: cd.map(r => [r.n, fr(r.ai), fr(r.tot), pct(r.sh, 2)]),
          hovertemplate: '<b>%{customdata[0]}</b><br>Brevets IA : %{customdata[1]}<br>Brevets EP : %{customdata[2]}<br>Part IA : %{customdata[3]}<extra></extra>'
        }], layout: base({ hovermode: 'closest', margin: { l: 48, b: 46 },
          xaxis: Object.assign({ type: 'log', showgrid: true, gridcolor: T.grid, tickformat: ',d', title: { text: 'Brevets EP du pays (pondérés, échelle log)', font: { size: 12 } } },
            n ? { dtick: 1 } : {}),
          yaxis: { tickformat: '.1~f', ticksuffix: NB + '%', rangemode: 'tozero' },
          annotations: [unit('Part des brevets IA (%)', 48)] }) };
      },
      table: () => ({
        columns: [['code_pays', 'Code pays', 'Code ISO à 2 lettres'], ['pays', 'Pays', ''],
          ['brevets_total_pondere', 'Brevets EP (pondérés)', 'Brevets EP du corpus, poids fractionnés REGPAT selon les inventeurs'],
          ['part_ia_pct', 'Part des brevets IA (%)', 'Brevets IA / brevets EP du pays, en %'],
          ['brevets_ia_pondere', 'Brevets IA (pondérés)', 'Taille des bulles']],
        rows: D.ct.map(r => ({ code_pays: r.c, pays: r.n, brevets_total_pondere: r.tot, part_ia_pct: r.sh, brevets_ia_pondere: r.ai }))
      })
    });
    mapSpecs();
  }

  // ------------------------------------------------------------------ cartes
  const ISO3 = Object.fromEntries('ADAND,AEARE,AFAFG,AGATG,AIAIA,ALALB,AMARM,AOAGO,AQATA,ARARG,ASASM,ATAUT,AUAUS,AWABW,AXALA,AZAZE,BABIH,BBBRB,BDBGD,BEBEL,BFBFA,BGBGR,BHBHR,BIBDI,BJBEN,BLBLM,BMBMU,BNBRN,BOBOL,BQBES,BRBRA,BSBHS,BTBTN,BVBVT,BWBWA,BYBLR,BZBLZ,CACAN,CCCCK,CDCOD,CFCAF,CGCOG,CHCHE,CICIV,CKCOK,CLCHL,CMCMR,CNCHN,COCOL,CRCRI,CUCUB,CVCPV,CWCUW,CXCXR,CYCYP,CZCZE,DEDEU,DJDJI,DKDNK,DMDMA,DODOM,DZDZA,ECECU,EEEST,EGEGY,EHESH,ERERI,ESESP,ETETH,FIFIN,FJFJI,FKFLK,FMFSM,FOFRO,FRFRA,GAGAB,GBGBR,GDGRD,GEGEO,GFGUF,GGGGY,GHGHA,GIGIB,GLGRL,GMGMB,GNGIN,GPGLP,GQGNQ,GRGRC,GSSGS,GTGTM,GUGUM,GWGNB,GYGUY,HKHKG,HMHMD,HNHND,HRHRV,HTHTI,HUHUN,IDIDN,IEIRL,ILISR,IMIMN,ININD,IOIOT,IQIRQ,IRIRN,ISISL,ITITA,JEJEY,JMJAM,JOJOR,JPJPN,KEKEN,KGKGZ,KHKHM,KIKIR,KMCOM,KNKNA,KPPRK,KRKOR,KWKWT,KYCYM,KZKAZ,LALAO,LBLBN,LCLCA,LILIE,LKLKA,LRLBR,LSLSO,LTLTU,LULUX,LVLVA,LYLBY,MAMAR,MCMCO,MDMDA,MEMNE,MFMAF,MGMDG,MHMHL,MKMKD,MLMLI,MMMMR,MNMNG,MOMAC,MPMNP,MQMTQ,MRMRT,MSMSR,MTMLT,MUMUS,MVMDV,MWMWI,MXMEX,MYMYS,MZMOZ,NANAM,NCNCL,NENER,NFNFK,NGNGA,NINIC,NLNLD,NONOR,NPNPL,NRNRU,NUNIU,NZNZL,OMOMN,PAPAN,PEPER,PFPYF,PGPNG,PHPHL,PKPAK,PLPOL,PMSPM,PNPCN,PRPRI,PSPSE,PTPRT,PWPLW,PYPRY,QAQAT,REREU,ROROU,RSSRB,RURUS,RWRWA,SASAU,SBSLB,SCSYC,SDSDN,SESWE,SGSGP,SHSHN,SISVN,SJSJM,SKSVK,SLSLE,SMSMR,SNSEN,SOSOM,SRSUR,SSSSD,STSTP,SVSLV,SXSXM,SYSYR,SZSWZ,TCTCA,TDTCD,TFATF,TGTGO,THTHA,TJTJK,TKTKL,TLTLS,TMTKM,TNTUN,TOTON,TRTUR,TTTTO,TVTUV,TWTWN,TZTZA,UAUKR,UGUGA,UMUMI,USUSA,UYURY,UZUZB,VAVAT,VCVCT,VEVEN,VGVGB,VIVIR,VNVNM,VUVUT,WFWLF,WSWSM,YEYEM,YTMYT,ZAZAF,ZMZMB,ZWZWE'
    .split(',').map(s => [s.slice(0, 2), s.slice(2)]));
  let regionFr = null;
  try { regionFr = new Intl.DisplayNames(['fr'], { type: 'region' }); } catch (e) { regionFr = null; }
  const ctryName = c => { try { return (regionFr && regionFr.of(c)) || c; } catch (e) { return c; } };
  const MIN_SHARE_BASE = 100;
  const PERIODS = { all: [1990, 2024, '1990–2024'], p3: [2019, 2024, '2019–2024'], p2: [2005, 2018, '2005–2018'], p1: [1990, 2004, '1990–2004'] };
  const geoBase = n => ({ projection: { type: 'mercator' }, fitbounds: 'locations', showframe: false, showcoastlines: false,
    showcountries: true, countrycolor: '#FFFFFF', countrywidth: 0.6, showland: true, landcolor: T.land, bgcolor: 'rgba(0,0,0,0)', showlakes: false });
  function colorbar(n, title, isPct) {
    const cb = { title: { text: title, side: 'right', font: { size: 11.5, color: T.muted } }, thickness: 10, len: 0.75, outlinewidth: 0,
      tickformat: isPct ? '.1~f' : ',d', ticksuffix: isPct ? NB + '%' : '', tickfont: { size: 11, color: T.muted } };
    if (n) Object.assign(cb, { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.02, yanchor: 'top', len: 0.85, thickness: 9, title: { text: title, side: 'top', font: { size: 11.5, color: T.muted } } });
    return cb;
  }

  function europeRows(role, period) {
    const src = D.europe[role] || {};
    let years;
    if (PERIODS[period]) years = Object.keys(src).filter(y => Number(y) >= PERIODS[period][0] && Number(y) <= PERIODS[period][1]);
    else years = [period];
    const acc = {};
    years.forEach(y => (src[y] || []).forEach(r => {
      const a = acc[r[0]] = acc[r[0]] || { id: r[0], c: r[1], tot: 0, ai: 0 };
      a.tot += r[2]; a.ai += r[3];
    }));
    const rows = Object.values(acc);
    const aiAll = rows.reduce((s, r) => s + r.ai, 0);
    rows.forEach(r => { r.eu = aiAll ? 100 * r.ai / aiAll : 0; r.loc = r.tot ? 100 * r.ai / r.tot : 0; });
    return rows.sort((a, b) => b.ai - a.ai);
  }
  const EU_METRIC = { ai: ['Brevets IA (pondérés)', false], eu: ['Part des brevets IA européens (%)', true], loc: ['Part IA des brevets de la région (%)', true] };
  const periodLabel = p => PERIODS[p] ? PERIODS[p][2] : p;

  function mapSpecs() {
    const yearOpts = () => (D.europeYears || []).slice().reverse().map(y => [y, y]);
    register({
      id: 'ch-europe-map', slug: 'carte_europe_nuts1',
      caption: st => (st.role === 'inv' ? 'Géographie des inventeurs' : 'Géographie des déposants') + ' · ' + EU_METRIC[st.metric][0] + ' · ' + periodLabel(st.period),
      needs: async () => {
        const [e, g] = await Promise.all([getJSON(DATA + 'europe_map.json'), getJSON(NUTS_URL)]);
        D.europe = e; D.europeYears = e.years; D.nuts = g;
        D.nutsName = Object.fromEntries(g.features.map(f => [f.properties.NUTS_ID, f.properties.NAME || f.properties.NUTS_ID]));
        const ctl = REG['ch-europe-map'].controls.find(c => c.key === 'period');
        ctl.groups[1].options = yearOpts();
        buildControls(REG['ch-europe-map']);
      },
      controls: [
        { type: 'seg', key: 'role', label: 'Géographie', options: [['inv', 'Inventeurs'], ['app', 'Déposants']] },
        { type: 'seg', key: 'metric', label: 'Mesure', options: [['ai', 'Brevets IA'], ['eu', 'Part de l’Europe'], ['loc', 'Part IA locale']] },
        { type: 'select', key: 'period', label: 'Période', groups: [
          { label: 'Périodes', options: [['all', '1990–2024'], ['p3', '2019–2024'], ['p2', '2005–2018'], ['p1', '1990–2004']] },
          { label: 'Années', options: [] }] }
      ],
      defaults: { role: 'inv', metric: 'ai', period: 'all' },
      height: n => n ? 410 : 560,
      build: (n, st) => {
        const rows = europeRows(st.role, st.period);
        const [title, isPct] = EU_METRIC[st.metric];
        const z = rows.map(r => r[st.metric]);
        return { data: [{
          type: 'choropleth', geojson: D.nuts, featureidkey: 'properties.NUTS_ID', locations: rows.map(r => r.id), z,
          zmin: 0, colorscale: st.metric === 'loc' ? SEQ : SEQ_SKEW, marker: { line: { color: '#FFFFFF', width: 0.5 } },
          customdata: rows.map(r => [D.nutsName[r.id] || r.id, ctryName(r.c), fr(r.ai, 1), pct(r.eu, 2), pct(r.loc, 2), fr(r.tot)]),
          hovertemplate: '<b>%{customdata[0]}</b> (%{customdata[1]})<br>Brevets IA : %{customdata[2]}<br>Part de l’Europe : %{customdata[3]}<br>Part IA locale : %{customdata[4]}<br>Brevets EP : %{customdata[5]}<extra></extra>',
          colorbar: colorbar(n, title, isPct)
        }], layout: base({ hovermode: 'closest', margin: { l: 0, r: 0, t: 8, b: n ? 56 : 0 },
          geo: Object.assign(geoBase(n), { fitbounds: false, projection: { type: 'conic conformal', parallels: [35, 65], rotation: { lon: 10 } },
            lonaxis: { range: [-24, 44] }, lataxis: { range: [34, 71] } }) }) };
      },
      table: st => {
        const rows = europeRows(st.role, st.period);
        return {
          columns: [['region', 'Région NUTS1', 'Code NUTS 2021'], ['nom', 'Nom', 'Nom latin Eurostat'], ['pays', 'Pays', 'Code ISO à 2 lettres'],
            ['periode', 'Période', ''], ['geographie', 'Géographie', 'Inventeurs ou déposants'],
            ['brevets_pondere', 'Brevets EP (pondérés)', 'Brevets EP du corpus, poids fractionnés REGPAT'],
            ['brevets_ia_pondere', 'Brevets IA (pondérés)', 'Brevets IA, mêmes poids'],
            ['part_europe_pct', 'Part des brevets IA européens (%)', 'Brevets IA de la région / brevets IA des régions européennes, en %'],
            ['part_ia_locale_pct', 'Part IA locale (%)', 'Brevets IA / brevets EP de la région, en %']],
          rows: rows.map(r => ({ region: r.id, nom: D.nutsName[r.id] || '', pays: r.c, periode: periodLabel(st.period),
            geographie: st.role === 'inv' ? 'inventeurs' : 'déposants', brevets_pondere: round(r.tot, 2), brevets_ia_pondere: round(r.ai, 3),
            part_europe_pct: round(r.eu, 3), part_ia_locale_pct: round(r.loc, 3) }))
        };
      }
    });

    const W_METRIC = { ai: ['Brevets IA (pondérés)', false], s: ['Part des brevets IA (%)', true], tot: ['Brevets EP (pondérés)', false] };
    const worldVal = (r, m) => m === 'ai' ? r.weighted_ai_patents : m === 's' ? 100 * r.weighted_ai_share : r.weighted_total_patents;
    const worldRows = st => D.world.filter(r => r.role === (st.role === 'inv' ? 'inventor' : 'applicant') && ISO3[r.ctry_code] &&
      r.weighted_total_patents > 0 && (st.metric !== 's' || r.weighted_total_patents >= MIN_SHARE_BASE));
    register({
      id: 'ch-world-map', slug: 'carte_monde',
      caption: st => (st.role === 'inv' ? 'Géographie des inventeurs' : 'Géographie des déposants') + ' · ' + W_METRIC[st.metric][0] + ' · 1990–2024',
      needs: async () => { D.world = await getJSON(DATA + 'world_map.json'); },
      controls: [
        { type: 'seg', key: 'role', label: 'Géographie', options: [['inv', 'Inventeurs'], ['app', 'Déposants']] },
        { type: 'seg', key: 'metric', label: 'Mesure', options: [['ai', 'Brevets IA'], ['s', 'Part IA'], ['tot', 'Tous brevets']] }
      ],
      defaults: { role: 'inv', metric: 'ai' },
      height: n => n ? 380 : 520,
      build: (n, st) => {
        const rows = worldRows(st).filter(r => worldVal(r, st.metric) > 0);
        const [title, isPct] = W_METRIC[st.metric];
        return { data: [{
          type: 'choropleth', locationmode: 'ISO-3', locations: rows.map(r => ISO3[r.ctry_code]), z: rows.map(r => worldVal(r, st.metric)),
          zmin: 0, colorscale: st.metric === 's' ? SEQ : SEQ_SKEW, marker: { line: { color: '#FFFFFF', width: 0.4 } },
          customdata: rows.map(r => [ctryName(r.ctry_code), fr(r.weighted_ai_patents, 1), pct(100 * r.weighted_ai_share, 2), fr(r.weighted_total_patents)]),
          hovertemplate: '<b>%{customdata[0]}</b><br>Brevets IA : %{customdata[1]}<br>Part IA : %{customdata[2]}<br>Brevets EP : %{customdata[3]}<extra></extra>',
          colorbar: colorbar(n, title, isPct)
        }], layout: base({ hovermode: 'closest', margin: { l: 0, r: 0, t: 8, b: n ? 56 : 0 },
          geo: Object.assign(geoBase(n), { projection: { type: 'natural earth' }, fitbounds: false, lataxis: { range: [-58, 85] } }),
          annotations: st.metric === 's' ? [ann({ xref: 'paper', yref: 'paper', x: 0, y: 0, xanchor: 'left', yanchor: 'bottom',
            text: '<i>Pays d’au moins ' + MIN_SHARE_BASE + ' brevets pondérés</i>', font: { size: 11, color: T.note } })] : [] }) };
      },
      table: st => ({
        columns: [['code_pays', 'Code pays', 'Code ISO à 2 lettres'], ['pays', 'Pays', ''], ['geographie', 'Géographie', 'Inventeurs ou déposants'],
          ['brevets_pondere', 'Brevets EP (pondérés)', 'Brevets EP du corpus, poids fractionnés REGPAT, 1990–2024'],
          ['brevets_ia_pondere', 'Brevets IA (pondérés)', 'Brevets IA, mêmes poids'], ['part_ia_pct', 'Part des brevets IA (%)', 'Brevets IA / brevets EP du pays, en %']],
        rows: D.world.filter(r => r.role === (st.role === 'inv' ? 'inventor' : 'applicant') && r.weighted_total_patents > 0)
          .sort((a, b) => b.weighted_ai_patents - a.weighted_ai_patents)
          .map(r => ({ code_pays: r.ctry_code, pays: ctryName(r.ctry_code), geographie: st.role === 'inv' ? 'inventeurs' : 'déposants',
            brevets_pondere: r.weighted_total_patents, brevets_ia_pondere: r.weighted_ai_patents, part_ia_pct: round(100 * r.weighted_ai_share, 4) }))
      })
    });
  }

  // ------------------------------------------------------------------ domaines IPC
  const G = { g06: 'all' };
  const ipcList = () => G.g06 === 'all' ? D.ipc : D.ipc.filter(r => !r.k.startsWith('G06'));
  const top8 = () => G.g06 === 'all' ? D.top8 : D.top8NoG06;
  const ipcColor = k => SERIES[Math.max(0, top8().indexOf(k)) % SERIES.length];
  const ipcLabel = k => k + ' · ' + (D.ipcName[k] || k);

  function ipcSpecs() {
    const ipcTable = rows => ({
      columns: [['ipc4', 'Classe IPC4', '4 premiers caractères de la classification internationale des brevets'], ['domaine', 'Domaine', ''],
        ['brevets_ia', 'Brevets IA', 'Brevets IA du domaine, 1990–2024'], ['brevets_total', 'Brevets EP du domaine', 'Brevets EP du corpus dans le domaine'],
        ['part_ia_pct', 'Part des brevets IA (%)', 'Brevets IA / brevets EP du domaine, en %']],
      rows: rows.map(r => ({ ipc4: r.k, domaine: r.n, brevets_ia: r.ai, brevets_total: r.tot, part_ia_pct: r.sh }))
    });
    const ipcBars = (rows, n, st, h) => {
      const share = st.m === 's';
      const sorted = rows.slice().sort((a, b) => share ? b.sh - a.sh : b.ai - a.ai);
      return hbar({ names: sorted.map(r => r.n), values: sorted.map(r => share ? r.sh : r.ai), narrow: n, height: h, ml: 190,
        fmt: v => share ? pct(v, 1) : fr(v), hover: share ? ' des brevets du domaine' : ' brevets IA',
        unit: share ? 'Part des brevets IA dans le domaine (%)' : 'Nombre de brevets IA', tickformat: share ? '.0f' : ',d',
        ticksuffix: share ? NB + '%' : '', colors: T.navy });
    };
    register({
      id: 'ch-overview-ipc', slug: 'domaines_top10',
      controls: [{ type: 'seg', key: 'm', label: 'Mesure', options: [['n', 'Brevets IA'], ['s', 'Part IA du domaine']] }],
      defaults: { m: 'n' },
      height: n => hbarHeight(10, n),
      build: (n, st, h) => ipcBars(D.ipc.slice().sort((a, b) => st.m === 's' ? b.sh - a.sh : b.ai - a.ai).slice(0, 10), n, st, h),
      table: st => ipcTable(D.ipc.slice().sort((a, b) => st.m === 's' ? b.sh - a.sh : b.ai - a.ai).slice(0, 10))
    });
    register({
      id: 'ch-ipc-combo', slug: 'domaines',
      controls: [{ type: 'seg', key: 'm', label: 'Mesure', options: [['n', 'Volume'], ['s', 'Intensité']] }],
      defaults: { m: 'n' },
      height: n => hbarHeight(ipcList().length, n),
      build: (n, st, h) => ipcBars(ipcList(), n, st, h),
      table: () => ipcTable(ipcList())
    });
    register({
      id: 'ch-ipc-time', slug: 'domaines_par_annee',
      controls: [{ type: 'chips', key: 'sel', label: 'Domaines affichés', options: () => top8().map(k => [k, D.ipcName[k] || k, ipcColor(k)]) }],
      defaults: { sel: new Set(D.top8.slice(0, 3)) },
      height: n => n ? 360 : 420,
      build: (n, st) => ({
        data: top8().filter(k => st.sel.has(k)).map(k => ({ x: D.ipcYears, y: D.ipcSer[k], type: 'scatter', mode: 'lines', name: D.ipcName[k] || k,
          line: { color: ipcColor(k), width: 2.4 }, hovertemplate: '%{y:,d}' })),
        layout: base({ xaxis: { tickvals: yearTicks(n) }, yaxis: { tickformat: ',d', rangemode: 'tozero' }, annotations: [unit('Brevets IA par an', 48)] })
      }),
      table: () => ({
        columns: [['annee', 'Année', '']].concat(top8().map(k => [k, ipcLabel(k), 'Brevets IA du domaine ' + k + ' cette année-là'])),
        rows: D.ipcYears.map((y, i) => Object.assign({ annee: y }, Object.fromEntries(top8().map(k => [k, D.ipcSer[k][i]]))))
      })
    });
    const shares = () => {
      const keys = top8();
      if (G.g06 === 'all' && keys.every(k => D.ipcShare[k])) return Object.fromEntries(keys.map(k => [k, D.ipcShare[k]]));
      return Object.fromEntries(keys.map(k => [k, D.ipcYears.map((_, i) => {
        const tot = keys.reduce((s, x) => s + (D.ipcSer[x][i] || 0), 0);
        return tot > 0 ? round(100 * (D.ipcSer[k][i] || 0) / tot, 2) : 0;
      })]));
    };
    register({
      id: 'ch-ipc-share-time', slug: 'composition_domaines',
      height: n => n ? 520 : 440,
      build: n => {
        const sh = shares();
        return {
          data: top8().map(k => ({ x: D.ipcYears, y: sh[k], type: 'scatter', mode: 'lines', stackgroup: 'one', name: D.ipcName[k] || k,
            line: { color: ipcColor(k), width: 0.6 }, fillcolor: h2r(ipcColor(k), 0.8), hovertemplate: '%{y:.1f}' + NB + '%' })),
          layout: base({ showlegend: true, margin: { b: n ? 190 : 96 },
            legend: { orientation: 'h', x: 0, xanchor: 'left', y: -0.12, yanchor: 'top', font: { size: 11.5, color: T.navy }, traceorder: 'normal',
              entrywidth: n ? 1 : 0.5, entrywidthmode: 'fraction' },
            xaxis: { tickvals: yearTicks(n) }, yaxis: { tickformat: '.0f', ticksuffix: NB + '%', range: [0, 100] },
            annotations: [unit('% des brevets IA des 8 domaines', 48)] })
        };
      },
      table: () => {
        const sh = shares();
        return {
          columns: [['annee', 'Année', '']].concat(top8().map(k => [k, ipcLabel(k) + ' (%)', 'Part du domaine parmi les brevets IA des 8 domaines, en %'])),
          rows: D.ipcYears.map((y, i) => Object.assign({ annee: y }, Object.fromEntries(top8().map(k => [k, sh[k][i]]))))
        };
      }
    });

    // Filtre G06* commun aux trois graphiques de l'onglet
    const box = document.getElementById('ipc-filter');
    if (box) {
      const g = document.createElement('div');
      g.className = 'dash-seg';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', 'Domaines');
      [['all', 'Tous les domaines'], ['no', 'Hors G06*']].forEach(([v, l]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = l;
        b.setAttribute('aria-pressed', String(G.g06 === v));
        b.addEventListener('click', () => {
          G.g06 = v;
          g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          STATE['ch-ipc-time'].sel = new Set(top8().slice(0, 3));
          buildControls(REG['ch-ipc-time']);
          ['ch-ipc-combo', 'ch-ipc-time', 'ch-ipc-share-time'].forEach(id => draw(REG[id]));
        });
        g.appendChild(b);
      });
      box.insertBefore(g, box.querySelector('.ds-filter-hint'));
    }
  }

  // ------------------------------------------------------------------ publications
  function pubSpecs() {
    register({
      id: 'ch-pubs-year', slug: 'publications_par_annee',
      controls: [{ type: 'seg', key: 'from', label: 'Période', options: [['1980', 'Depuis 1980'], ['all', 'Toute la période']] }],
      defaults: { from: '1980' },
      height: n => n ? 320 : 380,
      build: (n, st) => {
        const rows = D.pubs.filter(r => st.from === 'all' || r.y >= Number(st.from));
        return { data: [{ x: rows.map(r => r.y), y: rows.map(r => r.n), type: 'bar', name: 'Publications IA', marker: { color: T.corn, cornerradius: 2 },
          hovertemplate: '<b>%{y:,d}</b> publications IA citées<extra></extra>' }],
          layout: base({ bargap: 0.18, xaxis: { dtick: st.from === 'all' ? 20 : 10 }, yaxis: { tickformat: ',d' },
            annotations: [unit('Publications IA, par année de publication de l’article', 48)] }) };
      },
      table: () => ({ columns: [['annee', 'Année de publication', 'Année de publication de l’article'],
        ['publications', 'Publications IA citées', 'Publications IA distinctes citées par les brevets IA (citations observées)']],
        rows: D.pubs.map(r => ({ annee: r.y, publications: r.n })) })
    });
    register({
      id: 'ch-topics', slug: 'thematiques',
      controls: [{ type: 'seg', key: 'k', label: 'Nombre de thèmes', options: [['10', 'Top 10'], ['20', 'Top 20']] }],
      defaults: { k: '20' },
      height: (n, st) => hbarHeight(Number(st.k), n),
      title: (st, t) => t.replace(/Top \d+/, 'Top ' + st.k),
      build: (n, st, h) => {
        const rows = D.topics.slice(0, Number(st.k));
        return hbar({ names: rows.map(r => r.t), values: rows.map(r => r.n), narrow: n, height: h, ml: 260, fmt: v => fr(v),
          hover: ' publications', unit: 'Publications IA distinctes, cumul', colors: T.corn });
      },
      table: st => ({ columns: [['rang', 'Rang', ''], ['theme', 'Thème OpenAlex', 'Primary topic OpenAlex'], ['publications', 'Publications', 'Publications IA distinctes citées']],
        rows: D.topics.slice(0, Number(st.k)).map((r, i) => ({ rang: i + 1, theme: r.t, publications: r.n })) })
    });
  }

  // ------------------------------------------------------------------ chiffres clés
  function renderKPIs() {
    const lastFull = PY[PY.length - 2];
    const totalAI = PY.reduce((a, r) => a + r.ai, 0);
    const topShare = D.ipc.reduce((m, r) => r.sh > m.sh ? r : m);
    const pubs = D.pubs.reduce((a, r) => a + r.n, 0);
    const box = document.getElementById('kpi-row');
    if (!box) return;
    box.innerHTML = `
      <div class="kpi"><div class="val">${fr(totalAI)}</div><div class="lbl">Brevets IA<br>${PY[0].y}–${LAST.y}</div></div>
      <div class="kpi"><div class="val">${fr(lastFull.ai)}</div><div class="lbl">Brevets IA<br>${lastFull.y}</div><div class="sub">${pct(lastFull.sh, 2)} du corpus</div></div>
      <div class="kpi"><div class="val txt">${esc(D.ct[0].n)}</div><div class="lbl">1er pays (inventeurs)<br>pondéré REGPAT</div><div class="sub">${fr(D.ct[0].ai)} brevets IA</div></div>
      <div class="kpi"><div class="val txt">${esc(topShare.n)}</div><div class="lbl">IPC4 le plus IA<br>par intensité</div><div class="sub">${pct(topShare.sh, 1)} du domaine</div></div>
      <div class="kpi"><div class="val">${fr(pubs)}</div><div class="lbl">Publications IA<br>citées (observées)</div></div>`;
  }

  // ------------------------------------------------------------------ onglets
  window.show = function (id, btn) {
    document.querySelectorAll('.section').forEach(s => { if (!s.closest('.ss-main')) s.classList.remove('active'); });
    document.querySelectorAll('.nav-btn').forEach(b => { if (!b.closest('.ss-nav')) b.classList.remove('active'); });
    const sec = document.getElementById(id);
    if (sec) sec.classList.add('active');
    if (btn) btn.classList.add('active');
    setTimeout(refresh, 30);
  };

  // ------------------------------------------------------------------ API pour superstars.js
  window.LIFTDash = { register, refresh, draw, base, ann, unit, hbar, hbarHeight, fr, pct, esc, T, SERIES15, SANS, DISP, NB, yearTicks: n => yearTicks(n), REG, STATE };

  async function init() {
    setupDataBar();
    const files = ['brevets_by_year.csv', 'pays.csv', 'ipc4.csv', 'publications.csv', 'topics.csv', 'ipc4_series.csv', 'ipc4_share_series.csv'];
    try {
      const F = {};
      await Promise.all(files.map(async f => { F[f] = await getText(f); }));
      buildData(F);
    } catch (e) {
      console.error('[diffusion-science] échec du chargement des données :', e);
      document.querySelectorAll('.ds-main div[id^="ch-"]').forEach(el => fail(el, e));
      return;
    }
    renderKPIs();
    patentSpecs();
    geoSpecs();
    ipcSpecs();
    pubSpecs();
    refresh();
    document.dispatchEvent(new Event('liftdash:ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
