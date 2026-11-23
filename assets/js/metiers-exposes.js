/* =======================================================
   Tracker « Métiers exposés à l'IA générative »
   Lit les CSV de data/ai-trackers/metiers-exposes/ (voir LISEZMOI.md).
   Chaque section se dessine indépendamment : un fichier absent
   affiche « données en préparation » sans bloquer le reste.
   ======================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------- config
  const base = (() => {
    const p = window.location.pathname;
    const i = p.indexOf('/ai-trackers/');
    return i >= 0 ? p.slice(0, i) : '';
  })();
  const DATA_DIR = window.ME_DATA_DIR || base + '/data/ai-trackers/metiers-exposes/';
  const TOPO = window.ME_TOPO || base + '/data/ai-trackers/diffusion-emploi/france_zones.topo.json';

  const C = {
    navy: '#0E2A47', cornflower: '#5F84E8', coral: '#E46A4E',
    olive: '#5B6B2F', muted: '#55657D', grid: '#E3E8EF',
  };
  // Q1 (le moins exposé) clair → Q5 (le plus exposé) foncé
  const Q_COLORS = ['#C3D0EE', '#93A9E6', '#5F84E8', '#2F509F', '#0E2A47'];
  // groupes d'exposition : cinquièmes des salariés de la base Tous salariés 2022 présents au 31/12 (même définition partout)
  const Q_LABELS = ['Q1 · salariés les moins exposés', 'Q2', 'Q3', 'Q4', 'Q5 · salariés les plus exposés'];
  const P_LABELS = ['1er cinquième\n(salariés les moins exposés)', '2e cinquième', '3e cinquième', '4e cinquième', '5e cinquième\n(salariés les plus exposés)'];
  const SEXE = { F: 'Femmes', H: 'Hommes' };
  const AGE_LAB = (a) => (a === 'tous' ? 'Tous âges' : a.endsWith('+') ? a.slice(0, -1) + ' ans et plus' : a + ' ans');
  const BASE_MOIS = '2022-11';          // mise en ligne de ChatGPT
  const REPERES = [[BASE_MOIS, 'ChatGPT']];  // ligne verticale (repère « IA agentique » retiré le 15/11/2026)
  const FENETRE = 12;                   // somme glissante sur 12 mois

  const FONT = "'IBM Plex Sans', Helvetica, sans-serif";

  // --------------------------------------------------------------- helpers
  const $ = (id) => document.getElementById(id);
  const nf = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt = (x, d = 0) => (x == null || Number.isNaN(x) ? '—' : nf(d).format(x).replace(/^-/, '−'));
  const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : nf(d).format(100 * x) + ' %');
  const num = (v) => (v === '' || v == null ? null : +v);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moisFR = (m) => {
    const [a, mm] = m.split('-');
    return ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][+mm - 1] + ' ' + a;
  };

  async function loadCSV(name) {
    try {
      const r = await fetch(DATA_DIR + name, { cache: 'no-cache' });
      if (!r.ok) return null;
      const txt = await r.text();
      const rows = Papa.parse(txt.trim(), { header: true, skipEmptyLines: true }).data;
      return rows.length ? rows : null;
    } catch (e) {
      console.warn('[metiers-exposes] lecture impossible :', name, e);
      return null;
    }
  }

  function pending(el, what) {
    if (!el) return;
    el.innerHTML = `<div class="me-pending">Données en préparation${what ? ' : ' + esc(what) : ''}.</div>`;
  }

  const charts = [];
  function chart(el) {
    const old = echarts.getInstanceByDom(el);
    if (old) return old;
    const c = echarts.init(el, null, { renderer: 'svg' });
    charts.push(c);
    return c;
  }
  window.addEventListener('resize', () => charts.forEach((c) => c.resize()));

  const axisCommon = {
    axisLine: { lineStyle: { color: '#B9C3D1' } },
    axisLabel: { color: C.muted, fontFamily: FONT },
    splitLine: { lineStyle: { color: C.grid } },
    nameTextStyle: { color: C.muted, fontFamily: FONT },
  };
  const tooltipCommon = {
    backgroundColor: '#fff', borderColor: '#D5DDE8',
    textStyle: { color: C.navy, fontFamily: FONT, fontSize: 12 },
  };

  function segmented(container, options, initial, onChange) {
    container.innerHTML = '';
    container.classList.add('ai-tri-toggle');
    options.forEach(([val, lab]) => {
      const b = document.createElement('button');
      b.className = 'tri-btn' + (val === initial ? ' active' : '');
      b.textContent = lab;
      b.onclick = () => {
        container.querySelectorAll('.tri-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        onChange(val);
      };
      container.appendChild(b);
    });
  }

  // ------------------------------------------------- séries : indice base 100
  // Somme glissante sur 12 mois, rapportée à celle des 12 mois qui s'achèvent
  // en novembre 2022. Retourne [[mois, indice], ...] à partir du 12e mois.
  function indexSeries(points) {
    const s = points.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const roll = [];
    for (let i = FENETRE - 1; i < s.length; i++) {
      let tot = 0, ok = true;
      for (let k = i - FENETRE + 1; k <= i; k++) {
        if (s[k][1] == null) { ok = false; break; }
        tot += s[k][1];
      }
      roll.push([s[i][0], ok ? tot : null]);
    }
    const b = roll.find((p) => p[0] === BASE_MOIS);
    if (!b || !b[1]) return [];
    return roll.map(([m, v]) => [m, v == null ? null : (100 * v) / b[1]]);
  }

  function lineOption(series, { yName = 'Indice (nov. 2022 = 100)', pct = false } = {}) {
    const sgn = (v) => (v > 0 ? '+' : '') + fmt(v, 1) + (pct ? ' %' : '');
    const months = [...new Set(series.flatMap((s) => s.data.map((p) => p[0])))].sort();
    return {
      textStyle: { fontFamily: FONT },
      grid: { left: 56, right: 24, top: 48, bottom: 40 },
      legend: { top: 0, textStyle: { color: C.navy, fontFamily: FONT } },
      tooltip: {
        ...tooltipCommon, trigger: 'axis',
        valueFormatter: (v) => (v == null ? '—' : sgn(v)),
        axisPointer: { label: { formatter: (p) => moisFR(p.value) } },
      },
      xAxis: {
        type: 'category', data: months, boundaryGap: false, ...axisCommon,
        axisLabel: { ...axisCommon.axisLabel, formatter: (m) => (m.endsWith('-01') ? m.slice(0, 4) : ''), interval: 0 },
        axisTick: { show: false },
      },
      yAxis: { type: 'value', scale: true, name: pct ? 'Écart à novembre 2022 (%)' : yName, axisLabel: { ...axisCommon.axisLabel, formatter: (v) => (pct ? (v > 0 ? '+' : '') + fmt(v, 0) + ' %' : fmt(v, 0)) }, nameLocation: 'end', nameGap: 14, ...axisCommon, nameTextStyle: { ...axisCommon.nameTextStyle, align: 'left' } },
      series: series.map((s, i) => ({
        name: s.name, type: 'line', showSymbol: false, smooth: false,
        lineStyle: { width: s.width ?? 2.2, color: s.color, type: s.dashed ? 'dashed' : 'solid' },
        itemStyle: { color: s.color },
        data: months.map((m) => {
          const p = s.data.find((d) => d[0] === m);
          return p ? p[1] : null;
        }),
        markLine: i === 0 ? {
          symbol: 'none', silent: true,
          lineStyle: { color: C.coral, type: 'dashed', width: 1 },
          label: { color: C.coral, fontFamily: FONT, position: 'end' },
          data: [
            ...REPERES.filter(([m]) => months.includes(m)).map(([m, t]) => ({ xAxis: m, label: { formatter: t }, lineStyle: { color: C.coral, type: 'dashed', width: 1 } })),
            ...(pct ? [{ yAxis: 0, lineStyle: { color: '#B9C3D1', type: 'solid', width: 1 }, label: { show: false } }] : []),
          ],
        } : undefined,
      })),
    };
  }

  // =================================================================== DATA
  const D = {};

  // ================================================== 1. Embauches (MMO)
  function pick(rows, f) {
    return rows.filter(f).map((r) => [r.mois, num(r.embauches)]);
  }


  // Courbes d'embauche : log, désaisonnalisation par indicatrices de mois, filtre HP (λ = 1 000),
  // écart relatif à novembre 2022. Affichées telles quelles. Deux définitions des groupes :
  // cinquièmes des salariés (défaut, comme le profil et la carte) ou cinquièmes des métiers (PP 2026-02).
  const FLUX = [['embauches_cdi', 'Embauches en CDI'], ['embauches_cdd', 'Embauches en CDD'], ['fins_cdi', 'Fins de CDI'], ['fins_cdd', 'Fins de CDD']];
  // cinquièmes des professions (défaut, chaque profession compte pour une, comme le PP 2026-02 et Palladino et al., 2026)
  // ou cinquièmes des salariés (définition du profil, de la carte, du tableau et des fiches) ; e : accord de « exposé »
  const MODES = {
    nw: { lab: 'Cinquièmes des professions', unite: 'professions', e: 'es', def: 'metiers' },
    p: { lab: 'Cinquièmes des salariés', unite: 'salariés', e: 's', def: 'salaries' },
  };
  const MODE_NOTE = {
    nw: 'Chaque groupe réunit un cinquième des professions, chacune comptant pour une quelle que soit sa taille, comme dans le Policy Paper 2026-02.',
    p: 'Chaque groupe réunit un cinquième des salariés, comme le profil des groupes, la carte et les fiches de cette page.',
  };
  // sélecteur réaffiché le 23/11/2026 (demande des coauteurs) : l'écart avec le PP 2026-02 vient du passage de la PCS à la PCS-ESE
  const AVEC_VARIANTE = true;
  const ES = { mode: 'nw', flux: 'embauches_cdi', age: '21-29', groupe: '5', flux2: 'embauches_cdi', ageS: '21-29', ageM: '21-29' };
  const qLab = (i) => (i === 0 ? `Q1 · ${MODES[ES.mode].unite} les moins exposé${MODES[ES.mode].e}` : i === 4 ? `Q5 · ${MODES[ES.mode].unite} les plus exposé${MODES[ES.mode].e}` : 'Q' + (i + 1));
  const tri = (a) => a.sort((x, y) => (x[0] < y[0] ? -1 : 1));

  function drawEmbauches() {
    const M = MODES[ES.mode], C2 = D.courbes[ES.mode], CS = D.courbesSexe[ES.mode];
    const elQ = $('me-chart-quintiles'), elG = $('me-chart-ages'), elS = $('me-chart-sexe');
    if (!C2) { [elQ, elG].forEach((e) => pending(e, 'courbes lissées des embauches (MMO)')); }
    else {
      const ages = [...new Set(C2.map((r) => r.age))].sort();
      const serie = (flux, q, a) => tri(C2.filter((r) => r.groupe === q && r.age === a).map((r) => [r.mois, 100 * num(r[flux])]));
      const cQ = chart(elQ);
      const drawQ = () => {
        cQ.setOption(lineOption(['1', '2', '3', '4', '5'].map((q, i) => ({ name: qLab(i), color: Q_COLORS[i], data: serie(ES.flux, q, ES.age) })), { pct: true }), true);
        $('me-sub-quintiles').textContent = `${FLUX.find((f) => f[0] === ES.flux)[1]} · ${AGE_LAB(ES.age)} · ${M.lab.toLowerCase()}`;
      };
      segmented($('me-ctrl-flux'), FLUX, ES.flux, (v) => { ES.flux = v; drawQ(); });
      segmented($('me-ctrl-age-quintiles'), ages.map((a) => [a, AGE_LAB(a)]), ES.age, (v) => { ES.age = v; drawQ(); });
      drawQ();
      const cG = chart(elG);
      const ageColors = ['#E46A4E', '#5F84E8', '#5B6B2F', '#0E2A47'];
      const agesG = ages.filter((a) => a !== 'tous');
      const drawG = () => cG.setOption(lineOption(agesG.map((a, i) => ({ name: AGE_LAB(a), color: ageColors[i % 4], data: serie(ES.flux2, ES.groupe, a) })), { pct: true }), true);
      segmented($('me-ctrl-groupe'), ['1', '2', '3', '4', '5'].map((q) => [q, 'Q' + q]), ES.groupe, (v) => { ES.groupe = v; drawG(); });
      segmented($('me-ctrl-flux2'), FLUX, ES.flux2, (v) => { ES.flux2 = v; drawG(); });
      drawG();
      // chiffre clé
      const last = C2.map((r) => r.mois).sort().pop();
      const v = (q) => num(C2.find((r) => r.mois === last && r.groupe === q && r.age === ages[0]).embauches_cdi);
      $('me-kpi-embauches').textContent = fmt(100 * v('5'), 1) + ' %';
      if ($('me-kpi-embauches-t')) $('me-kpi-embauches-t').textContent = `Embauches des jeunes, ${M.unite} les plus exposé${M.e}`;
      $('me-kpi-embauches-note').textContent = `embauches en CDI des ${ages[0]} ans dans le cinquième des ${M.unite} les plus exposé${M.e}, nov. 2022 → ${moisFR(last)}, contre ${fmt(100 * v('1'), 1)} % dans le moins exposé`;
      if (!D.meta && $('me-maj')) $('me-maj').textContent = moisFR(last);
      const lec = $('me-lecture-q');
      if (lec) lec.innerHTML = `<b>Lecture :</b> en ${moisFR(last)}, la tendance des embauches en CDI des ${ages[0]} ans est inférieure de ${fmt(-100 * v('5'), 0)} % à son niveau de novembre 2022 dans le cinquième des ${M.unite} les plus exposé${M.e}, et de ${fmt(-100 * v('1'), 0)} % dans le moins exposé. Source : Dares, mouvements de main-d'œuvre (MMO) ; calculs LIFT.`;
    }
    // femmes et hommes
    if (!CS) pending(elS, 'courbes lissées par sexe (MMO)');
    else {
      const agesS = [...new Set(CS.map((r) => r.age))].sort();
      const serieS = (q, a, sx) => tri(CS.filter((r) => r.groupe === q && r.age === a && r.sexe === sx).map((r) => [r.mois, 100 * num(r.embauches_cdi)]));
      const cS = chart(elS);
      const drawS = () => cS.setOption(lineOption([
        { name: 'Femmes · Q5', color: Q_COLORS[4], data: serieS('5', ES.ageS, 'F') },
        { name: 'Hommes · Q5', color: Q_COLORS[4], dashed: true, data: serieS('5', ES.ageS, 'H') },
        { name: 'Femmes · Q1', color: Q_COLORS[1], data: serieS('1', ES.ageS, 'F') },
        { name: 'Hommes · Q1', color: Q_COLORS[1], dashed: true, data: serieS('1', ES.ageS, 'H') },
      ], { pct: true }), true);
      segmented($('me-ctrl-sexe'), agesS.map((a) => [a, AGE_LAB(a)]), ES.ageS, (v) => { ES.ageS = v; drawS(); });
      drawS();
    }
  }

  // ================================================= 2. Composition (BTS)
  function drawComposition() {
    const el = $('me-chart-composition');
    const P = (D.prof || []).map(profFromRow).filter((p) => !p.agregat && p.quintile != null && p.sal != null);
    if (!P.length || P.every((p) => p.femmes == null)) return pending(el, 'salariés par groupe, sexe et âge (base Tous salariés)');
    const c = chart(el);
    // part de chaque groupe dans les salariés d'une population ; poids = salariés × part
    const pops = [
      ['Ensemble des salariés', () => 1], ['Femmes', (p) => p.femmes], ['Hommes', (p) => 1 - p.femmes],
      ['Moins de 30 ans', (p) => p.jeunes], ['30 ans et plus', (p) => 1 - p.jeunes],
    ];
    const data = pops.map(([, f]) => {
      const w = [0, 0, 0, 0, 0];
      P.forEach((p) => { const x = f(p); if (x != null && !Number.isNaN(x)) w[p.quintile - 1] += p.sal * x; });
      const t = w.reduce((a, b) => a + b, 0);
      return w.map((v) => (t ? (100 * v) / t : null));
    });
    c.setOption({
      textStyle: { fontFamily: FONT },
      grid: { left: 130, right: 24, top: 40, bottom: 30 },
      legend: { top: 0, textStyle: { color: C.navy } },
      tooltip: { ...tooltipCommon, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => fmt(v, 1) + ' %' },
      xAxis: { type: 'value', max: 100, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: '{value} %' } },
      yAxis: { type: 'category', data: pops.map(([l]) => l), inverse: true, ...axisCommon },
      series: [0, 1, 2, 3, 4].map((i) => ({
        name: Q_LABELS[i], type: 'bar', stack: 'q', barWidth: '55%', itemStyle: { color: Q_COLORS[i] },
        label: { show: true, formatter: (q) => (q.value >= 8 ? fmt(q.value, 0) + ' %' : ''), color: i >= 3 ? '#fff' : C.navy, fontSize: 11 },
        data: data.map((row) => row[i]),
      })),
    });
  }

  // ======================================== 3. Profil des cinq groupes
  function drawProfil() {
    const el = $('me-chart-profil');
    if (!D.profil) return pending(el, 'profil des groupes');
    const c = chart(el);
    const R = D.profil;
    const dec = (r) => (r.unite === 'h' ? 0 : 1);
    const lab = (r, v) => fmt(v, dec(r)) + (r.unite === '%' ? ' %' : r.unite === '€' ? ' €' : r.unite === 'ans' ? ' ans' : ' h');
    const QS = ['q1', 'q2', 'q3', 'q4', 'q5'];
    let nc0 = 0;
    const draw = () => {
      const W = el.clientWidth || 960;
      const nc = W < 340 ? 1 : W < 760 ? 2 : W < 980 ? 3 : 4;
      if (nc === nc0) return; nc0 = nc;
      const nr = Math.ceil(R.length / nc), PH = 150, GAP = 46;
      el.style.height = nr * (PH + GAP) + 8 + 'px'; c.resize();
      const gw = 100 / nc;
      const grid = [], xAxis = [], yAxis = [], series = [], title = [];
      R.forEach((r, i) => {
        const col = i % nc, top = Math.floor(i / nc) * (PH + GAP) + 34;
        const vals = QS.map((k) => num(r[k])), ens = num(r.ensemble);
        grid.push({ left: col * gw + 2 + '%', width: gw - 4 + '%', top, height: PH - 26 });
        title.push({ text: r.indicateur, subtext: 'ensemble : ' + lab(r, ens), left: col * gw + 2 + '%', top: top - 34, itemGap: 2,
          textStyle: { fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: C.navy }, subtextStyle: { fontFamily: FONT, fontSize: 10.5, color: C.coral } });
        xAxis.push({ gridIndex: i, type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'], axisTick: { show: false }, axisLine: axisCommon.axisLine, axisLabel: { color: C.muted, fontFamily: FONT, fontSize: 10 } });
        yAxis.push({ gridIndex: i, type: 'value', min: 0, max: Math.max(...vals, ens) * 1.28, show: false });
        series.push({ type: 'bar', name: r.indicateur, xAxisIndex: i, yAxisIndex: i, barWidth: '60%',
          data: vals.map((v, k) => ({ value: v, itemStyle: { color: Q_COLORS[k] } })),
          label: { show: true, position: 'top', fontSize: 10, color: C.navy, fontFamily: FONT, formatter: (p) => fmt(p.value, dec(r)) },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: C.coral, type: 'dashed', width: 1 }, label: { show: false }, data: [{ yAxis: ens }] } });
      });
      c.setOption({ textStyle: { fontFamily: FONT }, title, grid, xAxis, yAxis, series,
        tooltip: { ...tooltipCommon, trigger: 'item', formatter: (p) => { const r = R[p.seriesIndex]; return `<b>${esc(r.indicateur)}</b><br>${p.name} : ${lab(r, p.value)}<br>Ensemble des salariés : ${lab(r, num(r.ensemble))}`; } } }, true);
    };
    draw();
    let tm; window.addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(draw, 150); });
    CSVF['me-chart-profil'] = () => [['indicateur', 'unite', 'q1', 'q2', 'q3', 'q4', 'q5', 'ensemble'], ...R.map((r) => [r.indicateur, r.unite, ...QS.map((k) => num(r[k])), num(r.ensemble)])];
  }

  // ========================================== 4. Explorateur de professions
  let pcsRows = [];
  let sortKey = 'centile', sortDir = -1;

  // colonne `provenance` de pcs_exposure_v22
  const ORIGINE = {
    direct: null,
    parent: null,   // code détaillé de la PCS-ESE : même valeur que son code parent, par nomenclature
    famille_fap: 'Valeur reprise d\'une famille professionnelle voisine',
  };

  function profFromRow(r) {
    return {
      pcs: r.pcs, pcs03: r.pcs03 || r.pcs, libelle: r.libelle, fap: r.fap, libelle_fap: r.libelle_fap,
      famille: r.famille || 'Autres', origine: r.origine || 'direct',
      indice: num(r.indice), brute: num(r.exposition_brute), centile: num(r.centile),
      quintile: num(r.groupe ?? r.quintile), atlas: num(r.atlas), sal: num(r.salaries ?? r.postes), agregat: r.agregat || '',
      femmes: num(r.part_femmes), age: num(r.age_moyen), jeunes: num(r.part_moins_30),
      salaire: num(r.salaire_horaire_net), cdi: num(r.part_cdi), fonct: num(r.part_fonctionnaires),
      tp: num(r.part_temps_partiel), apprentis: num(r.part_apprentis),
    };
  }

  function weightedMean(rows, k) {
    rows = rows.filter((r) => !r.agregat);   // les regroupements doublonneraient leurs codes détaillés
    let s = 0, w = 0;
    rows.forEach((r) => { if (r[k] != null && r.sal) { s += r[k] * r.sal; w += r.sal; } });
    return w ? s / w : null;
  }

  function initExplorer() {
    const box = $('me-explorer');
    if (!D.prof) {
      pending(box, 'indice par profession');
      pending($('me-table'), 'indice par profession');
      return;
    }
    pcsRows = D.prof.map(profFromRow);
    D.hasBTS = pcsRows.some((p) => p.sal != null);
    D.centilePostes = pcsRows.some((p) => p.centile != null);
    if (!D.centilePostes) {
      const ref = [...new Map(pcsRows.filter((p) => p.indice != null).map((p) => [p.pcs03, p.indice])).values()];
      pcsRows.forEach((p) => {
        if (p.indice == null) return;
        const below = ref.filter((v) => v < p.indice).length, eq = ref.filter((v) => v === p.indice).length;
        p.centile = Math.max(1, Math.round((100 * (below + eq / 2)) / ref.length));
      });
    }
    D.moy = {};
    ['femmes', 'age', 'jeunes', 'salaire', 'cdi', 'fonct', 'tp', 'apprentis', 'indice'].forEach((k) => (D.moy[k] = weightedMean(pcsRows, k)));


    // recherche
    const input = $('me-search');
    const list = $('me-search-list');
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'en', 'et', 'a', 'au', 'aux', 'un', 'une', 'pour', 'par', 'sur']);
    const toks = (t) => norm(t).split(/[^a-z0-9]+/).filter((w) => w && !VIDES.has(w)).map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w));
    const lev1 = (a, b) => { // distance d'édition au plus 1
      if (Math.abs(a.length - b.length) > 1) return false;
      let i = 0; while (i < a.length && a[i] === b[i]) i++;
      return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
    };
    // score d'un texte découpé en mots : plus petit = meilleur ; null si un mot de la requête manque
    const score = (qt, words, last) => {
      let sc = 0;
      for (let k = 0; k < qt.length; k++) {
        const q = qt[k]; let b = 999;
        for (const w of words) {
          const v = w === q ? 0 : w.startsWith(q) ? (k === last ? 0.5 : 1) : w.includes(q) && q.length > 2 ? 2 : q.length >= 5 && (lev1(q, w) || lev1(q, w.slice(0, q.length))) ? 100 : 999;
          if (v < b) b = v;
        }
        if (b === 999) return null;
        sc += b;
      }
      return sc;
    };
    // métiers du répertoire ROME 4.0 (appellations France Travail), chargés au premier usage
    const byPcs = new Map(pcsRows.map((p) => [p.pcs, p]));
    let fiches = null, loading = null;
    const loadRome = () => loading || (loading = Promise.all([loadCSV('rome_metiers.csv'), loadCSV('rome_appellations.csv'), loadCSV('rome_professions.csv'), loadCSV('intitules_insee.csv')]).then(([m, a, l, ins]) => {
      R.met = new Map((m || []).map((r) => [r.rome, { ...r, s: num(r.s), rang: num(r.rang_pct), n: num(r.n_savoir_faire), app: [], nI: norm(r.intitule), mI: norm(masculin(r.intitule)), wI: toks(r.intitule) }]));
      (a || []).forEach((r) => { const f = R.met.get(r.rome); if (f) f.app.push({ t: r.appellation, n: norm(r.appellation), m: norm(masculin(r.appellation)), w: toks(r.appellation) }); });
      R.liens = new Map();
      (l || []).forEach((r) => { if (!R.liens.has(r.rome)) R.liens.set(r.rome, []); R.liens.get(r.rome).push({ pcs03: r.pcs03, part: num(r.part_salaries ?? r.part_postes), ese: (r.pcs_ese || '').split(' ').filter(Boolean), lib: r.pcs03_lib }); });
      fiches = [...R.met.values()];
      // intitulés de l'Insee (matrice de codification PCS 2020) : un intitulé, ses codes selon le statut et le niveau
      // appellations au masculin (« Abatteur / Abatteuse d'arbres » -> « abatteur d'arbres ») pour reconnaître les doublons
      const masc = (s) => norm(s.replace(/(\S+) \/ \S+/g, '$1'));
      const vusRome = new Set(); fiches.forEach((f) => { [f.intitule, ...f.app.map((x) => x.t)].forEach((s) => { vusRome.add(norm(s)); vusRome.add(masc(s)); }); });
      const parLib = new Map();
      (ins || []).forEach((r) => {
        if (!parLib.has(r.libelle)) parLib.set(r.libelle, { t: r.libelle, tf: r.libelle_f, n: norm(r.libelle), w: toks(r.libelle + ' ' + (r.libelle_f || '')), opts: [] });
        parLib.get(r.libelle).opts.push({ statut: r.statut, niveaux: r.niveaux, defaut: r.defaut === '1', pcs2020: r.pcs2020, pcs: r.pcs.split('|'), parts: r.parts.split('|').map(Number) });
      });
      // un intitulé déjà présent parmi les appellations du ROME n'est proposé qu'une fois, côté ROME
      R.ins = [...parLib.values()].filter((x) => !vusRome.has(x.n));
      // tous les intitulés de l'Insee, pour classer une appellation du ROME qui en reprend un
      R.insN = new Map([...parLib.values()].map((x) => [x.n, x]));
      show();
      return R;
    }));
    R.load = loadRome;
    const miniBar = (r) => (r == null ? '' : `<span class="me-mini" title="Plus exposé que la profession de ${fmt(r, 0)} % des salariés"><span style="width:${Math.max(2, r)}%"></span></span>`);
    let actif = -1;
    const show = () => {
      const raw = input.value.trim(), q = norm(raw);
      actif = -1;
      if (!q) { list.hidden = true; return; }
      if (!fiches) loadRome();
      let h = '';
      if (/^[0-9]{2}/.test(q)) {           // code PCS-ESE
        const hitsP = pcsRows.filter((p) => !p.agregat && (p.pcs.toLowerCase().startsWith(q) || p.pcs03.toLowerCase().startsWith(q))).sort((a, b) => (b.sal || 0) - (a.sal || 0)).slice(0, 8);
        h = hitsP.map((p) => `<li data-pcs="${esc(p.pcs)}"><span class="me-hit-main">${esc(p.libelle)}<span class="me-hit-sub">Profession de l'Insee · PCS-ESE ${esc(p.pcs)}</span></span></li>`).join('');
      } else if (fiches) {
        let hits;
        if (/^[a-n][0-9]/.test(q)) hits = fiches.filter((f) => f.rome.toLowerCase().startsWith(q)).slice(0, 8).map((f) => ({ f, best: null }));
        else {
          const qt = toks(raw); const last = qt.length - 1;
          if (!qt.length) { list.hidden = true; return; }
          hits = fiches.map((f) => {
            let best = null, bs = score(qt, f.wI, last), bl = f.intitule.length;
            if (bs != null) bs -= 0.25 + (f.nI.startsWith(q) || f.mI.startsWith(q) ? 1 : 0) + (f.mI === q ? 1 : 0);
            for (const x of f.app) {
              const v = score(qt, x.w, last);
              if (v == null) continue;
              const vv = v - (x.n.startsWith(q) || x.m.startsWith(q) ? 1 : 0) - (x.m === q ? 1 : 0);
              if (bs == null || vv < bs || (vv === bs && x.t.length < bl)) { bs = vv; best = x; bl = x.t.length; }
            }
            return bs == null ? null : { f, best, sc: bs, len: bl };
          }).filter(Boolean).sort((x, y) => x.sc - y.sc || x.len - y.len);
          const hitsI = (R.ins || []).map((x, i) => {
            const v = score(qt, x.w, last);
            return v == null ? null : { ins: i, x, sc: v - (x.n.startsWith(q) ? 1 : 0) - (x.n === q ? 1 : 0) + 0.1, len: x.t.length };
          }).filter(Boolean);
          hits = hits.concat(hitsI).sort((x, y) => x.sc - y.sc || x.len - y.len);
          // les rapprochements par faute de frappe ne servent que s'il y a peu de résultats exacts
          const exacts = hits.filter((x) => x.sc < 50);
          hits = (exacts.length >= 3 ? exacts : hits).slice(0, 8);
        }
        const sub = (c) => (c[0] ? `<span class="me-hit-sub">Profession : ${esc(c[0].libelle)}</span>` : '');
        h = hits.map((hh) => {
          if (hh.x) { const c = candidats(hh.x.t, null, hh.x); return `<li data-ins="${hh.ins}"><span class="me-hit-main">${esc(hh.x.t)}${sub(c)}</span>${miniBar(c[0] ? c[0].centile : null)}</li>`; }
          const t = hh.best ? hh.best.t : hh.f.intitule, c = candidats(t, hh.f);
          return `<li data-rome="${esc(hh.f.rome)}" data-app="${esc(t)}"><span class="me-hit-main">${esc(t)}${sub(c)}</span>${miniBar(centileEmploi(hh.f.s))}</li>`;
        }).join('');
      }
      if (!fiches && !h) h = '<li class="me-empty">Chargement des métiers…</li>';
      list.innerHTML = (h || '<li class="me-empty">Aucun métier trouvé</li>') +
        '<li class="me-hit-foot">Votre métier n\'apparaît pas ? <a href="#sec-tableau">Parcourez le tableau des professions</a>.</li>';
      list.hidden = false;
    };
    input.addEventListener('input', show);
    input.addEventListener('focus', () => { loadRome(); show(); });
    input.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('[data-rome],[data-pcs],[data-ins]')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        actif = (actif + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((li, n) => li.classList.toggle('active', n === actif));
        items[actif].scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter') { const li = items[Math.max(0, actif)]; if (li) li.click(); }
      if (e.key === 'Escape') list.hidden = true;
    });
    list.addEventListener('click', (e) => {
      const li = e.target.closest('[data-rome],[data-pcs],[data-ins]');
      if (!li) return;
      input.value = '';
      list.hidden = true;
      if (li.dataset.rome) showMetier(li.dataset.app, li.dataset.rome); else if (li.dataset.ins) showMetier(R.ins[+li.dataset.ins].t); else showFiche(li.dataset.pcs);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.me-search-wrap')) list.hidden = true; });

    // raccourcis
    const chips = $('me-chips');
    const EXEMPLES = [['M1855', 'Développeur web'], ['M1302', "Chef d'entreprise"], ['M1203', 'Comptable'], ['K1310', 'Assistant maternel'], ['F1702', 'Ouvrier qualifié des travaux publics']];
    loadRome().then(() => {
      EXEMPLES.filter(([c]) => R.met.has(c)).forEach(([c, t]) => {
        const b = document.createElement('button');
        b.className = 'me-chip';
        b.textContent = t;
        b.onclick = () => showMetier(null, c);
        chips.appendChild(b);
      });
      const hr = decodeURIComponent(location.hash.replace('#rome-', ''));
      if (location.hash.startsWith('#rome-') && R.met.has(hr)) showMetier(null, hr, 0, false);
      if (location.hash.startsWith('#metier-')) { const [c, t] = decodeURIComponent(location.hash.slice(8)).split('|'); if (c && R.met.has(c)) showMetier(t || null, c, 0, false); else if (t) showMetier(t, null, 0, false); }
    });

    buildTable();
    const h = decodeURIComponent(location.hash.replace('#pcs-', ''));
    if (location.hash.startsWith('#pcs-') && pcsRows.some((p) => p.pcs === h)) showFiche(h, false);
  }

  const R = {};
  // profession de la BTS correspondant à une PCS 2003 : le code lui-même, son regroupement,
  // ou l'agrégation à la volée de ses codes PCS-ESE (moyennes pondérées par les salariés)
  function profDe(l) {
    const direct = pcsRows.find((p) => p.pcs === l.pcs03 && (p.agregat || l.ese.length <= 1));
    if (direct) return direct;
    const k = pcsRows.filter((p) => l.ese.includes(p.pcs) && !p.agregat);
    if (!k.length) return null;
    if (k.length === 1) return k[0];
    const w = (key) => { let a = 0, b = 0; k.forEach((p) => { if (p[key] != null && p.sal) { a += p[key] * p.sal; b += p.sal; } }); return b ? a / b : null; };
    const sum = (key) => k.reduce((a, p) => a + (p[key] || 0), 0);
    const base = k.slice().sort((a, b) => (b.sal || 0) - (a.sal || 0))[0];
    return { ...base, pcs: l.pcs03, libelle: l.lib, agregat: k.map((p) => p.pcs).join('|'), virtuel: true,
      sal: sum('sal') || null, femmes: w('femmes'), age: w('age'), jeunes: w('jeunes'), cdi: w('cdi'), fonct: w('fonct'), tp: w('tp'), apprentis: w('apprentis'),
      salaire: w('salaire') };
  }

  function profilHTML(p) {
    const M = D.moy;
    if (p.sal == null) return `<div class="me-pending">${D.hasBTS ? 'Moins de 5 salariés : données couvertes par le secret statistique.' : 'Profil des salariés en préparation (base Tous salariés 2022).'}</div>`;
    return `<p class="me-legend-ref"><span class="me-bar-ref me-bar-ref-inline"></span> moyenne de l'ensemble des salariés</p>
          ${bar('Femmes', p.femmes, M.femmes, 1, (v) => pct(v, 0))}
          ${bar('Moins de 30 ans', p.jeunes, M.jeunes, 1, (v) => pct(v, 0))}
          ${bar('CDI', p.cdi, M.cdi, 1, (v) => pct(v, 0))}
          ${bar('Fonctionnaires', p.fonct, M.fonct, 1, (v) => pct(v, 0))}
          ${bar('Temps partiel', p.tp, M.tp, 1, (v) => pct(v, 0))}
          ${bar('Apprentis', p.apprentis, M.apprentis, 0.3, (v) => pct(v, 1))}
          ${bar('Salaire horaire net', p.salaire, M.salaire, 50, (v) => (v == null ? '—' : fmt(v, 1) + ' €'))}
          ${bar('Âge moyen', p.age, M.age, 65, (v) => (v == null ? '—' : fmt(v, 1) + ' ans'))}
          <p class="me-note">Base Tous salariés 2022 de l'Insee : salariés de la profession présents au 31 décembre, sur leur poste principal, public compris ; les indépendants ne sont pas couverts.${p.agregat ? ' Moyennes pondérées par les salariés des codes regroupés.' : ''}</p>`;
  }

  // ---------------------------------------------------------------- fiche d'un métier
  // Un métier n'a pas de statistiques propres : ses salariés sont comptés dans une profession, catégorie plus large.
  // La page ne montre pas d'où vient chaque intitulé ; la règle est décrite dans « À propos » :
  // 1. intitulé de la liste de l'Insee : la profession de son codage par défaut, puis celles de ses autres codages ;
  // 2. sinon, les professions reliées à la fiche ROME, la première étant celle dont le libellé partage le plus de mots
  //    avec l'intitulé (bonus de niveau : directeur, responsable… vers les cadres), à égalité la plus nombreuse.
  const normT = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const mascT = (s) => normT(s.replace(/(\S+) \/ \S+/g, '$1'));
  const MOTS_VIDES = new Set('de la le les des du d l et en a au aux ou un une sur pour par avec non sans dans hors autres autre divers diverses'.split(' '));
  const seqR = (t) => mascT(t).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !MOTS_VIDES.has(w)).map((w) => w.replace(/[sx]$/, '').slice(0, 6));
  const paires = (a) => a.slice(1).map((w, i) => a[i] + ' ' + w);
  const NIV_MOTS = [[/\b(directeur|directrice|dirigeant|dirigeante|responsable|ingenieur|ingenieure|manager|cadre)\b/, '23'],
    [/\bchef\b(?! d.equipe)/, '23'], [/\b(technicien|technicienne|assistant|assistante)\b/, '4'], [/\b(agent|agente|employe|employee)\b/, '5'], [/\b(ouvrier|ouvriere|operateur|operatrice)\b/, '6']];
  // score : mots communs, plus un point par paire de mots consécutifs commune (« chef de chantier »), plus le bonus de niveau
  function preselection(t, opts) {
    const a = seqR(t), m = new Set(a), pa = new Set(paires(a)), n = mascT(t);
    const niv = (NIV_MOTS.find(([rx]) => rx.test(n)) || [null, ''])[1];
    const sc = (o) => { const b = seqR(o.lib); return [...new Set(b)].filter((w) => m.has(w)).length + paires(b).filter((x) => pa.has(x)).length + (niv.includes(o.pcs03[0]) ? 0.5 : 0); };
    return opts.slice().sort((a, b) => sc(b) - sc(a) || b.part - a.part)[0];
  }
  const profCode = (c) => pcsRows.find((z) => z.pcs === c) || null;
  // professions possibles d'un intitulé, la plus plausible en premier
  function candidats(t, f, x = null) {
    const out = [], vus = new Set();
    const add = (q) => { if (q && !vus.has(q.pcs)) { vus.add(q.pcs); out.push(q); } };
    x = x || (R.insN && R.insN.get(mascT(t)));
    if (x) {
      const st0 = x.opts[0].statut;
      [...x.opts.filter((y) => y.statut === st0 && y.defaut), ...x.opts.filter((y) => y.statut === st0 && !y.defaut), ...x.opts.filter((y) => y.statut !== st0)]
        .forEach((y) => add(profCode(y.pcs[0])));
    }
    if (!out.length && f) {
      const opts = (R.liens.get(f.rome) || []).filter((l) => l.part != null && profDe(l)).sort((a, b) => b.part - a.part);
      if (opts.length) { const sel = preselection(t, opts); [sel, ...opts.filter((l) => l !== sel)].forEach((l) => add(profDe(l))); }
    }
    return out;
  }
  // exemples de métiers d'une profession : intitulés des fiches ROME qui y sont rangées, celles qui existaient déjà
  // dans le ROME V3 et celles qui ont le plus d'appellations d'abord, puis intitulés de l'Insee, les plus courts d'abord
  const masculin = (s) => { const i = s.indexOf(' / '); if (i < 0) return s; const g = s.slice(0, i), d = s.slice(i + 3).split(' '); return [g, ...d.slice(g.split(' ').length)].join(' ').trim(); };
  const minus1 = (s) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
  let EX = null;
  function exemples(pcs, exclRome = null, exclT = '') {
    if (!R.met) return [];
    if (!EX) {
      EX = new Map(); const push = (k, v) => { if (!EX.has(k)) EX.set(k, []); EX.get(k).push(v); };
      R.met.forEach((f) => { const c = candidats(f.intitule, f); if (c[0]) push(c[0].pcs, { t: masculin(f.intitule), rome: f.rome, r: 0, v: f.voie === 'code_v3' ? 0 : 1, n: -f.app.length }); });
      (R.ins || []).forEach((x) => { const c = candidats(x.t, null, x); if (c[0]) push(c[0].pcs, { t: x.t, rome: null, r: 1, v: 0, n: x.t.length }); });
      EX.forEach((a) => a.sort((u, w) => u.r - w.r || u.v - w.v || u.n - w.n));
    }
    // intitulés courts seulement, sans parenthèse, sans doublon ni le métier cherché
    const nt = normT(masculin(exclT || '')).replace(/\s*\(.*?\)\s*/g, ' ').trim(), vus = new Set([nt]), out = [];
    for (const e of EX.get(pcs) || []) {
      if (exclRome && e.rome === exclRome) continue;
      const x = e.t.replace(/\s*\(.*?\)\s*/g, ' ').trim(), k = normT(x);
      if (x.length > 40 || vus.has(k)) continue;
      vus.add(k); out.push(minus1(x));
      if (out.length === 3) break;
    }
    return out;
  }
  const deX = (x) => (/^[aeiouyhàâéèêëîïôûü]/i.test(x) ? 'd’' : 'de ') + x;
  const metiersDe = (ex) => (ex.length < 2 ? ex.map(deX).join('') : ex.slice(0, -1).map(deX).join(', ') + ' et ' + deX(ex[ex.length - 1]));
  const codeFiche = (q) => (q.virtuel ? q.agregat.split('|')[0] : q.pcs);

  async function showMetier(t, code = null, k = 0, scroll = true) {
    await R.load();
    const f = code ? R.met.get(code) : null;
    if (!f && !t) return;
    t = t || f.intitule;
    const el = $('me-fiche');
    history.replaceState(null, '', '#metier-' + encodeURIComponent((code || '') + '|' + t));
    const c = candidats(t, f);
    const pm = c[k] || c[0] || null;
    const autres = c.filter((q) => q !== pm).slice(0, 3);
    const ex = pm ? exemples(pm.pcs, f && f.rome, t) : [];
    const cle = f ? new Set(f.wI.filter((w) => w.length >= 4)) : null;
    const apps = f ? f.app.filter((x) => x.t !== t && x.t !== f.intitule && x.w.some((w) => cle.has(w))).map((x) => x.t).sort((a, b) => a.length - b.length) : [];
    el.innerHTML = `
      <div class="me-fiche-head">
        <div>
          <p class="me-fiche-kind">Métier</p>
          <h4>${esc(t)}</h4>
          ${apps.length ? `<p class="me-fiche-fap">Intitulés proches : ${esc(apps.slice(0, 5).join(' · '))}${apps.length > 5 ? ` et ${apps.length - 5} autres` : ''}</p>` : ''}
        </div>
        <button class="me-close" aria-label="Fermer" onclick="this.closest('#me-fiche').hidden=true;history.replaceState(null,'',location.pathname)">×</button>
      </div>
      ${rangsHTML(f ? centileEmploi(f.s) : null, pm ? pm.centile : null, { prof: true })}
      ${pm ? `<div class="me-fiche-grid">
        <div>
          <h5>Sa profession</h5>
          <p class="me-metier-prof">Dans la classification que nous utilisons, ce métier fait partie d’une catégorie plus large, la profession <a href="#pcs-${esc(codeFiche(pm))}" class="me-prof-lien"><b>${esc(pm.libelle)}</b></a>${ex.length ? `, qui comprend aussi, par exemple, les métiers ${esc(metiersDe(ex))}` : ''}.</p>
          <p class="me-metier-prof">${pm.sal != null ? `Elle réunit ${fmt(pm.sal)} salariés. ` : ''}Le nombre et le profil des salariés ne sont connus qu’à ce niveau : les chiffres ci-contre décrivent l’ensemble de la profession.</p>
          ${autres.length ? `<p class="me-metier-alt">Selon le poste ou l’employeur, ce métier peut aussi être rangé dans ${autres.length > 1 ? 'les professions' : 'la profession'} ${listeFR(autres.map((q) => `<a href="#" data-k="${c.indexOf(q)}">${esc(q.libelle)}</a>`))}.</p>` : ''}
        </div>
        <div>
          <h5>Qui sont les salariés de cette profession</h5>
          ${profilHTML(pm)}
        </div>
      </div>` : '<div class="me-pending">Aucune profession salariée n’est rattachée à ce métier.</div>'}`;
    el.hidden = false;
    const depuis = { t, code };
    el.querySelectorAll('.me-prof-lien').forEach((a) => (a.onclick = (e) => { e.preventDefault(); showFiche(codeFiche(pm), true, depuis); }));
    el.querySelectorAll('[data-k]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); showMetier(t, code, +a.dataset.k, false); }));
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // position d'un indice sur l'échelle des salariés (centile pondéré par les salariés des professions)
  let ECH = null;
  function centileEmploi(sv) {
    if (sv == null) return null;
    if (!ECH) {
      const m = new Map();
      pcsRows.forEach((p) => { if (!p.agregat && p.indice != null && p.sal) m.set(p.indice, (m.get(p.indice) || 0) + p.sal); });
      const a = [...m.entries()].sort((x, y) => x[0] - y[0]); const W = a.reduce((t, x) => t + x[1], 0); let c = 0;
      ECH = a.map(([v, w]) => { const r = [v, 100 * (c + w / 2) / W]; c += w; return r; });
    }
    if (sv <= ECH[0][0]) return ECH[0][1] * sv / (ECH[0][0] || 1);
    for (let i = 1; i < ECH.length; i++) if (sv <= ECH[i][0]) { const [x0, y0] = ECH[i - 1], [x1, y1] = ECH[i]; return y0 + (y1 - y0) * (sv - x0) / (x1 - x0); }
    return Math.min(99.9, ECH[ECH.length - 1][1] + (100 - ECH[ECH.length - 1][1]) * 0.5);
  }

  function rangsHTML(rMetier, cProf, { prof } = {}) {
    if (rMetier == null && cProf == null) return '';
    const pos = (v) => Math.min(99.5, Math.max(0.5, v));
    const n = (v) => (v > 99 ? 'plus de 99' : fmt(Math.round(v), 0));
    const v = rMetier != null ? rMetier : cProf;
    const quoi = rMetier != null ? 'que ce métier' : prof ? 'que la sienne' : 'que celle-ci';
    let txt = `Sur 100 salariés en France, <b>${n(v)}</b> ont une profession moins exposée ${quoi}.`;
    if (rMetier != null && cProf != null) {
      const d = cProf - rMetier;
      txt += Math.abs(d) < 5 ? ' Sa profession, dans son ensemble, se situe au même niveau.'
        : d > 0 ? ` Sa profession, dans son ensemble, se situe plus haut (${n(cProf)}) : elle réunit aussi des métiers plus exposés que celui-ci.`
        : ` Sa profession, dans son ensemble, se situe plus bas (${n(cProf)}) : elle réunit aussi des métiers moins exposés que celui-ci.`;
    }
    const deux = rMetier != null && cProf != null;
    return `<div class="me-rangs">
      <div class="me-rang"><div class="me-rang-t">Exposition à l’IA générative</div>
        <div class="me-rang-bar">${deux ? `<span class="me-rang-p" style="left:${pos(cProf)}%" title="Sa profession"></span>` : ''}<span style="left:${pos(v)}%"></span></div>
        <div class="me-rang-x">${txt}</div></div>
      <div class="me-rang-ech"><span>moins exposé</span>${deux ? '<span class="me-rang-leg"><i class="me-leg-m"></i>ce métier <i class="me-leg-p"></i>sa profession</span>' : ''}<span>plus exposé</span></div>
      <p class="me-rang-note">Salariés présents au 31 décembre 2022, public compris ; les indépendants ne sont pas couverts.</p>
    </div>`;
  }

  function bar(label, v, ref, max, f) {
    const w = v == null ? 0 : Math.min(100, (100 * v) / max);
    const r = ref == null ? null : Math.min(100, (100 * ref) / max);
    return `<div class="me-bar-row">
      <span class="me-bar-label">${label}</span>
      <span class="me-bar-track"><span class="me-bar-fill" style="width:${w}%"></span>${r != null ? `<span class="me-bar-ref" style="left:${r}%" title="Ensemble : ${f(ref)}"></span>` : ''}</span>
      <span class="me-bar-val">${f(v)}</span></div>`;
  }

  function famHTML(p) {
    const li = (x) => `<li data-pcs="${esc(x.pcs)}"><span class="me-code">${esc(x.pcs)}</span>${esc(x.libelle)}<span class="me-fam-n">${x.sal != null ? fmt(x.sal) + ' salariés' : 'secret'}</span></li>`;
    if (p.agregat) {
      const k = pcsRows.filter((x) => p.agregat.split('|').includes(x.pcs)).sort((a, b) => (b.sal || 0) - (a.sal || 0));
      return `<h5>Les codes détaillés regroupés</h5>
        <p class="me-note" style="margin-top:0">Les déclarations des employeurs utilisent ces codes PCS-ESE ; ils ont la même exposition que ${esc(p.pcs)}.</p>
        <ul class="me-fam">${k.map(li).join('')}</ul>`;
    }
    const fam = pcsRows.filter((x) => x.fap === p.fap && !x.agregat && x.pcs !== p.pcs)
      .sort((a, b) => (b.sal || 0) - (a.sal || 0)).slice(0, 8);
    if (!fam.length) return `<h5>Famille professionnelle ${esc(p.fap)}</h5><p class="me-note" style="margin-top:0">Seule profession de sa famille professionnelle : son exposition lui est propre.</p>`;
    return `<h5>Les professions de la même famille</h5>
      <p class="me-note" style="margin-top:0">L'exposition est calculée par famille professionnelle (${esc(p.fap)}) : ces professions partagent la même valeur, avec des salariés différents.</p>
      <ul class="me-fam">${fam.map(li).join('')}</ul>`;
  }

  const NIV = { c: 'cadre', t: 'technicien', m: 'agent de maîtrise', e: 'employé', q: 'ouvrier qualifié', p: 'ouvrier peu qualifié', A: 'catégorie A', B: 'catégorie B', C: 'catégorie C' };
  const listeFR = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ou ' + a[a.length - 1]);
  // choix par défaut : statut par défaut de l'Insee (premier dans le fichier), puis code par défaut de ce statut
  function showInsee(i, statut = null, code = null, scroll = true) {
    const x = R.ins[i]; if (!x) return;
    const st = statut || x.opts[0].statut;
    const opts = x.opts.filter((o) => o.statut === st);
    const o = opts.find((y) => y.pcs2020 === code) || opts.find((y) => y.defaut) || opts[0];
    showFiche(o.pcs[0], scroll, null, { i, x, st, o, opts });
  }
  function inseeHTML(c) {
    const { x, st, o, opts } = c;
    const statuts = [...new Set(x.opts.map((y) => y.statut))];
    const btn = (attr, val, lab, on) => `<button class="tri-btn${on ? ' active' : ''}" ${attr}="${esc(val)}">${esc(lab)}</button>`;
    const stLab = { prive: 'Salarié du privé', public: 'Salarié du public' };
    const nivLab = (y) => (y.niveaux ? listeFR(y.niveaux.split('').map((k) => NIV[k])) : 'niveau non précisé');
    const autres = o.pcs.slice(1).map((p, k) => { const q = pcsRows.find((z) => z.pcs === p); return q ? `<a href="#pcs-${esc(p)}" data-goto="${esc(p)}">${esc(q.libelle)}</a> (${fmt(o.parts[k + 1], 0)} %)` : ''; }).filter(Boolean);
    return `<div class="me-insee">
      <p class="me-insee-t"><span class="me-src me-src-ins">Insee</span>« ${esc(x.t)}${x.tf ? ' / ' + esc(x.tf) : ''} »</p>
      ${statuts.length > 1 ? `<div class="ai-tri-toggle me-insee-ctrl">${statuts.map((s) => btn('data-ins-st', s, stLab[s], s === st)).join('')}</div>` : ''}
      ${opts.length > 1 ? `<p class="me-insee-q">Le classement dépend du niveau du poste :</p><div class="me-class-opts">${opts.map((y) => `<button class="me-class-opt${y === o ? ' active' : ''}" data-ins-code="${esc(y.pcs2020)}"><span class="me-class-niv">${esc(nivLab(y))}</span>${esc((pcsRows.find((z) => z.pcs === y.pcs[0]) || {}).libelle || y.pcs[0])}</button>`).join('')}</div>` : ''}
      <p class="me-note">Codé ${esc(o.pcs2020)} dans la PCS 2020 de l'Insee, ce qui correspond à la profession ci-dessous${o.pcs.length > 1 ? ` dans ${fmt(o.parts[0], 0)} % des cas ; ${autres.length > 1 ? 'autres possibilités' : 'autre possibilité'} : ${autres.join(', ')}` : ''}. ${opts.length > 1 || statuts.length > 1 ? 'Valeurs présélectionnées : celles que retient l\'Insee quand le statut ou le niveau ne sont pas connus.' : ''}</p>
    </div>`;
  }
  function showFiche(code, scroll = true, depuis = null, insee = null) {
    const p = pcsRows.find((x) => x.pcs === code);
    const el = $('me-fiche');
    if (!p) return;
    history.replaceState(null, '', '#pcs-' + encodeURIComponent(code));
    const M = D.moy;
    const warn = ORIGINE[p.origine];
    const kids = (p.agregat || '').split('|').filter(Boolean);
    const sameFap = pcsRows.filter((x) => x.fap === p.fap && x.pcs !== p.pcs && !x.agregat && !kids.includes(x.pcs) && x.pcs !== p.pcs03);

    el.innerHTML = (insee ? inseeHTML(insee) : '') + `
      <div class="me-fiche-head">
        <div>
          ${depuis ? `<p class="me-back"><a href="#" data-back="1">← ${esc(depuis.t)}</a></p>` : ''}
          <p class="me-fiche-kind">Profession</p>
          <p class="me-fiche-code">${p.agregat ? 'PCS ' + esc(p.pcs) + ' · regroupe les codes PCS-ESE ' + p.agregat.split('|').map((c) => `<a href="#pcs-${esc(c)}" data-goto="${esc(c)}">${esc(c)}</a>`).join(', ') : 'PCS-ESE ' + esc(p.pcs) + (p.pcs03 !== p.pcs ? ' · rattachée à ' + esc(p.pcs03) : '')} · ${esc(p.famille)}</p>
          <h4>${esc(p.libelle)}</h4>
          ${(() => { const ex = exemples(p.pcs); return ex.length ? `<p class="me-fiche-ex">Par exemple : ${esc(ex.join(', '))}…</p>` : ''; })()}
          <p class="me-fiche-fap">Exposition calculée sur la famille professionnelle ${esc(p.fap)}${p.libelle_fap ? ' · ' + esc(p.libelle_fap) : ''}${p.atlas != null ? ` · usage observé (Atlas) : ${fmt(p.atlas, 0)} % des tâches de la famille` : ''}${sameFap.length ? ` · valeur partagée avec ${sameFap.length} autre${sameFap.length > 1 ? 's' : ''} PCS` : ''}</p>
          ${warn ? `<p class="me-warn">${warn} : à lire avec prudence.</p>` : ''}
        </div>
        <button class="me-close" aria-label="Fermer" onclick="this.closest('#me-fiche').hidden=true;history.replaceState(null,'',location.pathname)">×</button>
      </div>
      ${rangsHTML(null, p.centile)}
      <div class="me-fiche-grid">
        <div>
          <h5>Les salariés de cette profession</h5>
          ${p.sal != null ? `<p class="me-note" style="margin-top:0">${fmt(p.sal)} salariés au 31 décembre 2022.</p>` : ''}
          ${profilHTML(p)}
        </div>
        <div>
          ${famHTML(p)}
        </div>
      </div>
`;
    el.hidden = false;

    el.querySelectorAll('[data-goto]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); showFiche(a.dataset.goto, true, depuis); }));
    el.querySelectorAll('[data-pcs]').forEach((a) => (a.onclick = () => showFiche(a.dataset.pcs, true, depuis)));
    el.querySelectorAll('[data-back]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); showMetier(depuis.t, depuis.code); }));
    if (insee) {
      el.querySelectorAll('[data-ins-st]').forEach((b) => (b.onclick = () => showInsee(insee.i, b.dataset.insSt, null, false)));
      el.querySelectorAll('[data-ins-code]').forEach((b) => (b.onclick = () => showInsee(insee.i, insee.st, b.dataset.insCode, false)));
    }
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildTable() {
    const wrap = $('me-table');
    const fam = $('me-filter-famille');
    const grp = $('me-filter-groupe');
    [...new Set(pcsRows.map((p) => p.famille))].sort().forEach((f) => {
      const o = document.createElement('option'); o.value = f; o.textContent = f; fam.appendChild(o);
    });
    const cols = [
      ['pcs', 'PCS', (p) => `<span class="me-code">${esc(p.pcs)}</span>`],
      ['libelle', 'Profession', (p) => esc(p.libelle) + (ORIGINE[p.origine] ? ' <span class="me-tag" title="' + ORIGINE[p.origine] + '">*</span>' : '')],
      ['centile', 'Centile parmi les salariés', (p) => fmt(p.centile)],
      ['sal', 'Salariés', (p) => fmt(p.sal)],
      ['femmes', 'Femmes', (p) => pct(p.femmes, 0)],
      ['jeunes', '< 30 ans', (p) => pct(p.jeunes, 0)],
      ['salaire', 'Salaire h. net', (p) => (p.salaire == null ? '—' : fmt(p.salaire, 1) + ' €')],
    ];
    const render = () => {
      const f = fam.value, g = grp.value ? +grp.value : null;
      const rows = pcsRows.filter((p) => !p.agregat && (!f || p.famille === f) && (g == null || p.quintile === g))
        .sort((a, b) => {
          const x = a[sortKey], y = b[sortKey];
          if (x == null) return 1; if (y == null) return -1;
          const d = (typeof x === 'string' ? x.localeCompare(y, 'fr') : x - y) * sortDir;
          return d || ((b.indice ?? -1) - (a.indice ?? -1));
        });
      $('me-table-count').textContent = `${fmt(rows.length)} professions`;
      wrap.innerHTML = `<table class="me-tbl"><thead><tr>${colsVis.map(([k, l]) =>
        `<th data-k="${k}" class="${k === sortKey ? (sortDir > 0 ? 'asc' : 'desc') : ''}">${l}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((p) => `<tr data-pcs="${esc(p.pcs)}">${colsVis.map(([k, , f]) => `<td class="${k}">${f(p)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };
    wrap.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-k]');
      if (th) {
        const k = th.dataset.k;
        sortDir = k === sortKey ? -sortDir : (k === 'libelle' || k === 'pcs' ? 1 : -1);
        sortKey = k; render(); return;
      }
      const tr = e.target.closest('tr[data-pcs]');
      if (tr) showFiche(tr.dataset.pcs);
    });
    const colsVis = cols;
    fam.onchange = render; grp.onchange = render;
    render();
    CSVF['me-table'] = () => [['pcs', 'libelle', 'fap', 'indice', 'centile', 'groupe', 'salaries', 'part_femmes', 'part_moins_30', 'salaire_horaire_net'],
      ...pcsRows.filter((p) => !p.agregat).map((p) => [p.pcs, p.libelle, p.fap, p.indice, p.centile, p.quintile, p.sal, p.femmes, p.jeunes, p.salaire])];
    D.tableCSV = () => Papa.unparse(pcsRows.map((p) => ({
      pcs: p.pcs, libelle: p.libelle, fap: p.fap, indice: p.indice, centile: p.centile, quintile: p.quintile,
      salaries: p.sal, part_femmes: p.femmes, part_moins_30: p.jeunes, salaire_horaire_net: p.salaire,
    })));
  }

  // ================================================ 5. Indice et usage Atlas (familles professionnelles)
  function wcorr(x, y, w) {
    const m = (v) => v.reduce((a, b, i) => a + b * w[i], 0) / w.reduce((a, b) => a + b, 0);
    const mx = m(x), my = m(y);
    const dx = x.map((v) => v - mx), dy = y.map((v) => v - my);
    return m(dx.map((v, i) => v * dy[i])) / Math.sqrt(m(dx.map((v) => v * v)) * m(dy.map((v) => v * v)));
  }
  function drawAtlas() {
    const el = $('me-chart-atlas');
    if (!D.fap) return pending(el, 'indice et usage Atlas par famille professionnelle');
    const pts = D.fap.map((r) => ({ fap: r.fap, libelle: r.libelle, indice: num(r.indice), atlas: num(r.atlas), emploi: num(r.salaries ?? r.emploi), pcs: (r.pcs || '').split('|') }))
      .filter((p) => p.indice != null && p.atlas != null && p.emploi > 0);
    if (!pts.length) return pending(el, 'usage Atlas');
    const r0 = wcorr(pts.map((p) => p.indice), pts.map((p) => p.atlas), pts.map(() => 1));
    const r1 = wcorr(pts.map((p) => p.indice), pts.map((p) => p.atlas), pts.map((p) => p.emploi));
    $('me-atlas-corr').textContent = `Corrélation de ${fmt(r0, 2)} entre les ${fmt(pts.length)} familles professionnelles, de ${fmt(r1, 2)} en pondérant chacune par ses salariés.`;
    $('me-kpi-atlas').textContent = fmt(r1, 2);
    CSVF['me-chart-atlas'] = () => [['fap', 'libelle', 'indice', 'usage_atlas_pct_taches', 'salaries_2022', 'pcs'],
      ...pts.map((p) => [p.fap, p.libelle, p.indice, p.atlas, p.emploi, p.pcs.join('|')])];
    const maxE = Math.max(...pts.map((p) => p.emploi));
    const byPcs = new Map(pcsRows.map((p) => [p.pcs, p]));
    const c = chart(el);
    c.setOption({
      textStyle: { fontFamily: FONT },
      grid: { left: 64, right: 24, top: 24, bottom: 52 },
      tooltip: {
        ...tooltipCommon,
        formatter: (q) => { const p = q.data.p; return `<b>${esc(p.libelle)}</b> (${esc(p.fap)})<br>Indice : ${fmt(p.indice, 2)}<br>Usage observé : ${fmt(p.atlas, 0)} % des tâches<br>${fmt(p.emploi)} salariés<br><span style="color:#55657D">${p.pcs.map(esc).join(', ')}</span>`; },
      },
      xAxis: { type: 'value', name: "Indice d'exposition", nameLocation: 'middle', nameGap: 32, ...axisCommon },
      yAxis: { type: 'value', name: 'Usage observé (Atlas, % des tâches)', nameLocation: 'middle', nameGap: 44, max: 100, ...axisCommon },
      series: [{
        type: 'scatter',
        data: pts.map((p) => ({ value: [p.indice, p.atlas], p, symbolSize: 4 + 40 * Math.sqrt(p.emploi / maxE) })),
        itemStyle: { color: 'rgba(95,132,232,0.45)', borderColor: C.navy, borderWidth: 0.6 },
        emphasis: { itemStyle: { color: C.coral } },
      }],
    });
    // clic : la plus grande profession salariée de la famille
    c.on('click', (q) => {
      const m = q.data.p.pcs.map((c) => byPcs.get(c)).filter((p) => p && !p.agregat).sort((a, b) => (b.sal || 0) - (a.sal || 0))[0];
      if (m) showFiche(m.pcs);
    });
  }

  // =========================================================== 6. Territoires
  async function drawZones() {
    const elMap = $('me-map');
    const elBins = $('me-chart-taille');
    if (!D.zones || !('centile_moyen' in D.zones[0])) { pending(elMap, 'centile moyen des salariés par zone d\'emploi'); pending(elBins); return; }
    // centile_moyen : moyenne, sur les salariés de la zone, du centile (pondéré par les salariés) de leur profession.
    // Sur la France entière il vaut 50 ; on affiche l'écart à la moyenne des zones, en points.
    const zones0 = D.zones.map((r) => ({ code: r.ze2020 ?? r.zone, zone: r.libelle ?? r.zone, nom: r.libelle_insee || r.libelle || r.zone, sal: num(r.salaries ?? r.postes), c: num(r.centile_moyen) }))
      .filter((z) => z.c != null && z.sal);
    const ref = zones0.reduce((a, z) => a + z.c * z.sal, 0) / zones0.reduce((a, z) => a + z.sal, 0);
    const zones = zones0.map((z) => ({ ...z, indice: z.c - ref }));
    const pts = (v, d = 1) => (v > 0 ? '+' : '') + fmt(v, d) + ' pt' + (Math.abs(v) >= 2 ? 's' : '');
    const byName = new Map(zones.map((z) => [z.zone, z]));

    // groupes de zones par taille, chacun ≈ un cinquième des salariés
    const sorted = zones.slice().sort((a, b) => a.sal - b.sal);
    const totP = sorted.reduce((s, z) => s + z.sal, 0);
    const bins = [[], [], [], [], []];
    let cum = 0;
    sorted.forEach((z) => { const k = Math.min(4, Math.floor((5 * (cum + z.sal / 2)) / totP)); bins[k].push(z); cum += z.sal; });
    CSVF['me-chart-taille'] = () => [['groupe_de_taille', 'nombre_de_zones', 'salaries', 'taille_mediane_salaries', 'ecart_centile_moyen_pts'],
      ...bins.map((b, k) => { let s = 0, w = 0; b.forEach((z) => { s += z.indice * z.sal; w += z.sal; }); return [k + 1, b.length, w, med(b), +(s / w).toFixed(2)]; })];
    const cb = chart(elBins);
    const med = (a) => { const s = a.map((z) => z.sal).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    cb.setOption({
      textStyle: { fontFamily: FONT },
      grid: { left: 50, right: 16, top: 40, bottom: 56 },
      tooltip: { ...tooltipCommon, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => pts(v) },
      xAxis: { type: 'category', data: bins.map((b) => (b.length <= 2 ? b.map((z) => z.zone).join(', ') : fmt(med(b)) + ' salariés')), ...axisCommon, axisLabel: { ...axisCommon.axisLabel, interval: 0, fontSize: 11 }, name: 'Taille médiane de la zone', nameLocation: 'middle', nameGap: 36 },
      yAxis: { type: 'value', ...axisCommon, min: (v) => Math.floor(v.min - 2), max: (v) => Math.ceil(v.max + 1), name: 'Écart à la moyenne (points de centile)', nameTextStyle: { color: C.muted, fontFamily: FONT, align: 'left' } },
      series: [{
        type: 'bar', barWidth: '50%', itemStyle: { color: C.cornflower },
        label: { show: true, position: 'top', color: C.navy, formatter: (p) => pts(p.value) },
        data: bins.map((b) => { let s = 0, w = 0; b.forEach((z) => { s += z.indice * z.sal; w += z.sal; }); const v = w ? s / w : null; return { value: v, label: { position: v < 0 ? 'bottom' : 'top' } }; }),
      }],
    });

    { // lecture du graphique par taille
      const b0 = bins[0]; let s0 = 0, w0 = 0; b0.forEach((z) => { s0 += z.indice * z.sal; w0 += z.sal; });
      const e0 = s0 / w0, lec = $('me-lecture-taille');
      if (lec) lec.innerHTML = `<b>Lecture :</b> dans les plus petites zones d'emploi, qui comptent ${fmt(Math.round(med(b0) / 1000))} 000 salariés en médiane et réunissent ensemble un cinquième des salariés, les salariés occupent des professions situées en moyenne ${fmt(Math.abs(e0), 1)} places ${e0 < 0 ? 'plus bas' : 'plus haut'} que la moyenne nationale, si l'on classe tous les salariés de France de 0 (le moins exposé à l'IA générative) à 100 (le plus exposé).`;
    }
    // carte
    try {
      const topo = await (await fetch(TOPO)).json();
      const obj = Object.keys(topo.objects)[0];
      const fc = topojson.feature(topo, topo.objects[obj]);
      const W = 1000, H = 880;
      elMap.innerHTML = '';
      const svg = d3.select(elMap).append('svg').attr('viewBox', `0 0 ${W} ${H}`).style('width', '100%').style('height', '100%');
      const proj = d3.geoConicConformal().parallels([44, 49]).rotate([-3, 0]).fitSize([W, H], fc);
      const path = d3.geoPath(proj);
      const medC = d3.median(zones, (z) => z.c);
      zones.forEach((z) => { z.em = z.c - medC; });
      CSVF['me-map'] = () => [['zone', 'libelle', 'salaries', 'centile_moyen', 'ecart_zone_mediane_pts'], ...zones.map((z) => [z.code, z.nom, z.sal, z.c, +z.em.toFixed(2)])];
      const vals = zones.map((z) => z.em).sort((a, b) => a - b);
      const lo = d3.quantile(vals, 0.02), hi = d3.quantile(vals, 0.98);
      const m = Math.max(Math.abs(lo), Math.abs(hi));
      const col = d3.scaleDiverging(d3.interpolateRdBu).domain([m, 0, -m]).clamp(true);
      const tip = d3.select('body').append('div').attr('class', 'ai-map-tip').style('opacity', 0);
      const info = $('me-map-info');
      svg.selectAll('path').data(fc.features).join('path')
        .attr('d', path)
        .attr('fill', (f) => { const z = byName.get(f.properties.zone); return z ? col(z.em) : '#eee'; })
        .attr('stroke', '#fff').attr('stroke-width', 0.6)
        .on('mousemove', (ev, f) => {
          const z = byName.get(f.properties.zone);
          tip.style('opacity', 1).style('left', ev.pageX + 12 + 'px').style('top', ev.pageY - 10 + 'px')
            .html(`<b>${esc(f.properties.zone)}</b><br>${z ? pts(z.em) + ' par rapport à la zone médiane' : 'non diffusé'}`);
        })
        .on('mouseleave', () => tip.style('opacity', 0))
        .on('click', (ev, f) => {
          const z = byName.get(f.properties.zone);
          if (!z) return;
          const pos = vals.filter((v) => v > z.em).length + 1;
          const rg = pos === 1 ? 'la zone la plus exposée' : pos === vals.length ? 'la zone la moins exposée' : `la ${fmt(pos)}<sup>e</sup> zone la plus exposée`;
          info.innerHTML = `<h4>${esc(z.nom)}</h4>
            <p class="me-big">${pts(z.em)}</p>
            <p class="me-phrase">${Math.abs(z.em) < 0.5
              ? 'Les salariés de cette zone occupent des professions aussi exposées à l\'IA générative que ceux de la zone d\'emploi médiane.'
              : `Si l'on classe tous les salariés de France de 0 (le moins exposé à l'IA générative) à 100 (le plus exposé), ceux de cette zone se situent en moyenne ${fmt(Math.abs(z.em), 0)} place${Math.abs(z.em) >= 1.5 ? 's' : ''} ${z.em > 0 ? 'plus haut' : 'plus bas'} que ceux de la zone d'emploi médiane.`}</p>
            <p>${fmt(z.sal)} salariés · ${rg} sur ${fmt(vals.length)}</p>`;
        });
      // légende
      const lg = $('me-map-legend');
      D.mapLegend = { lo: pts(-m, 0), hi: pts(m, 0), colors: [-m, -m / 2, 0, m / 2, m].map((v) => col(v)) };
      lg.innerHTML = `<span>${pts(-m, 0)}</span><span class="me-grad" style="background:linear-gradient(90deg,${col(-m)},${col(0)},${col(m)})"></span><span>${pts(m, 0)}</span>`;
    } catch (e) {
      console.error(e);
      pending(elMap, 'fond de carte');
    }
  }

  // ======================================================= téléchargements
  function wireDownloads() {
    document.querySelectorAll('[data-me-dl]').forEach((a) => {
      const f = a.dataset.meDl;
      a.href = DATA_DIR + f;
      a.setAttribute('download', f);
    });
    document.querySelectorAll('[data-copy]').forEach((b) => {
      b.onclick = () => {
        const txt = $(b.dataset.copy).innerText;
        navigator.clipboard.writeText(txt).then(() => {
          const old = b.textContent; b.textContent = 'Copié'; setTimeout(() => (b.textContent = old), 1500);
        });
      };
    });
    document.querySelectorAll('.ai-nav-btn[data-target]').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('.ai-nav-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        $(b.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
  }

  // ===================================================== métadonnées (tracker.json)
  async function loadJSON(name) {
    try { const r = await fetch(DATA_DIR + name, { cache: 'no-cache' }); return r.ok ? await r.json() : null; }
    catch (e) { return null; }
  }
  function showMeta() {
    const m = D.meta;
    if (!m) return;
    if ($('me-maj')) $('me-maj').textContent = moisFR(m.donnees_au);
    document.querySelectorAll('[data-me-meta="donnees_au"]').forEach((el) => { el.textContent = moisFR(m.donnees_au); });
    document.querySelectorAll('[data-me-meta="livraison"]').forEach((el) => {
      if (m.livraison) el.textContent = new Date(m.livraison).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    });
  }
  // chiffres clés tirés du profil des groupes (plus de valeurs écrites en dur dans la page)
  function kpiProfil() {
    const row = (lab) => (D.profil || []).find((r) => r.indicateur === lab);
    const f = row('Femmes'), a = row('Apprentis');
    if (f && $('me-kpi-femmes')) { $('me-kpi-femmes').textContent = fmt(num(f.q5), 0) + ' %'; $('me-kpi-femmes-note').textContent = `contre ${fmt(num(f.ensemble), 0)} % de l'ensemble des salariés`; }
    if (a && $('me-kpi-apprentis')) { $('me-kpi-apprentis').textContent = fmt(num(a.q5), 1) + ' %'; $('me-kpi-apprentis-note').textContent = `contre ${fmt(num(a.q1), 1)} % dans le cinquième le moins exposé`; }
  }

  // ===================================================== export : image et données de chaque graphique
  const SITE = 'heclift.github.io/website';
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  // sélection en cours dans la carte du graphique : boutons actifs et listes déroulantes
  function selection(card) {
    const parts = [];
    const g = $('me-ctrl-groupes');
    if (card.closest('.ai-tracker') && card.id && card.id.startsWith('sec-emb') && g) {
      const b = g.querySelector('.tri-btn.active'); if (b) parts.push(b.textContent.trim());
    }
    card.querySelectorAll('.ai-chart-controls .tri-btn.active, .ai-chart-controls select').forEach((x) => {
      parts.push(x.tagName === 'SELECT' ? x.options[x.selectedIndex]?.textContent.trim() : x.textContent.trim());
    });
    return parts.filter(Boolean);
  }
  async function imageOf(el) {
    const r = el.getBoundingClientRect();
    const ec = echarts.getInstanceByDom(el);
    let url;
    if (ec) url = ec.getDataURL({ type: 'svg', backgroundColor: '#ffffff' });
    else {
      const svg = el.querySelector('svg'); if (!svg) return null;
      const c = svg.cloneNode(true);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', r.width); c.setAttribute('height', r.height);
      url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
    }
    const img = new Image(); img.src = url; await img.decode();
    return { img, w: r.width, h: r.height };
  }
  function wrap(ctx, txt, maxW) {
    const out = []; let line = '';
    String(txt || '').split(/\s+/).forEach((w) => { const t2 = line ? line + ' ' + w : w; if (ctx.measureText(t2).width > maxW && line) { out.push(line); line = w; } else line = t2; });
    if (line) out.push(line); return out;
  }
  // image composée : titre, sélection, graphique, source, signature du LIFT et date des données
  async function composePNG(el, extra) {
    const card = el.closest('.ai-chart-section');
    const titre = card.querySelector('h3')?.textContent.trim() || '';
    const sel = selection(card).join(' · ');
    const note = card.querySelector('.me-note');
    const src = note ? (note.innerText.match(/Sources? ?:[^]*$/) || [''])[0].trim() : '';
    const im = await imageOf(el); if (!im) return null;
    const S = 2, pad = 28, W = Math.max(720, Math.round(im.w)) + 2 * pad;
    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
    const F = (s, w) => `${w || 400} ${s}px 'IBM Plex Sans', Helvetica, Arial, sans-serif`;
    ctx.font = F(20, 700); const lt = wrap(ctx, titre, W - 2 * pad);
    ctx.font = F(13); const ls = wrap(ctx, sel, W - 2 * pad);
    ctx.font = F(11); const lsrc = wrap(ctx, src, W - 2 * pad);
    const scale = (W - 2 * pad) / im.w, ih = im.h * Math.min(1, scale);
    const leg = el.id === 'me-map' && D.mapLegend ? 34 : 0;
    const H = pad + lt.length * 26 + ls.length * 18 + 14 + ih + leg + 14 + lsrc.length * 15 + 26 + pad;
    cv.width = W * S; cv.height = H * S; ctx.scale(S, S);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    let y = pad + 18;
    ctx.fillStyle = C.navy; ctx.font = F(20, 700); lt.forEach((l) => { ctx.fillText(l, pad, y); y += 26; });
    ctx.fillStyle = C.muted; ctx.font = F(13); ls.forEach((l) => { ctx.fillText(l, pad, y - 4); y += 18; });
    y += 4; ctx.drawImage(im.img, pad, y, im.w * Math.min(1, scale), ih); y += ih + 18;
    if (leg) { // légende de la carte
      const L = D.mapLegend, gw = 260, gx = pad + 70;
      const gr = ctx.createLinearGradient(gx, 0, gx + gw, 0); L.colors.forEach((c, i) => gr.addColorStop(i / (L.colors.length - 1), c));
      ctx.fillStyle = gr; ctx.fillRect(gx, y - 10, gw, 10);
      ctx.fillStyle = C.muted; ctx.font = F(11); ctx.fillText(L.lo, pad, y); ctx.fillText(L.hi, gx + gw + 10, y); y += leg - 6;
    }
    ctx.fillStyle = C.muted; ctx.font = F(11); lsrc.forEach((l) => { ctx.fillText(l, pad, y); y += 15; });
    y += 8; ctx.strokeStyle = '#D5DDE8'; ctx.beginPath(); ctx.moveTo(pad, y - 10); ctx.lineTo(W - pad, y - 10); ctx.stroke();
    ctx.fillStyle = C.navy; ctx.font = F(11, 500);
    const au = D.meta && card.id && card.id.startsWith('sec-emb') ? ' · données au ' + moisFR(D.meta.donnees_au) : '';
    ctx.fillText(`LIFT, HEC Paris · Métiers exposés à l'IA générative · ${SITE}${au}`, pad, y + 4);
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
  // données du graphique tel qu'il est affiché (ECharts : axe des catégories et séries)
  function chartRows(el, xName) {
    const ec = echarts.getInstanceByDom(el); if (!ec) return null;
    const o = ec.getOption(); const S = o.series || [];
    const val = (v) => (v == null ? '' : typeof v === 'object' && !Array.isArray(v) ? v.value : Array.isArray(v) ? v[1] : v);
    const ax = [...(o.xAxis || []), ...(o.yAxis || [])].find((a) => a.type === 'category');
    if (!ax) return null;
    const head = [xName || 'categorie', ...S.map((s, i) => s.name || ('serie_' + (i + 1)))];
    const rows = ax.data.map((c, i) => [String(c).replace(/\n/g, ' '), ...S.map((s) => { const v = val(s.data[i]); return v == null || v === '' ? '' : +(+v).toFixed(4); })]);
    return [head, ...rows];
  }
  const CSVF = {};   // exports particuliers (nuage, carte, tailles de zones)
  function toCSV(rows) { return rows.map((r) => r.map((x) => { const s = x == null ? '' : String(x); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n'); }
  function save(blob, name, kind, info) {
    if (window.ME_SAVE) return window.ME_SAVE(blob, name, kind, info);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const LIBS = { XLSX: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', JSZip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' };
  const libs = {};
  function loadLib(n) {
    if (window[n]) return Promise.resolve(window[n]);
    return libs[n] || (libs[n] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIBS[n];
      s.onload = () => (window[n] ? res(window[n]) : rej(new Error(n))); s.onerror = () => { libs[n] = null; rej(new Error(n)); };
      document.head.appendChild(s);
    }));
  }
  const ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7,10 12,15 17,10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  const asof = () => (D.meta ? D.meta.donnees_au : '');
  async function toXLSX(rows, titre, source) {
    const XLSX = await loadLib('XLSX');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map((h) => ({ wch: Math.min(48, Math.max(10, String(h).length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Données');
    const info = XLSX.utils.aoa_to_sheet([['Graphique', titre], ['Source', source], ['Données au', D.meta ? moisFR(D.meta.donnees_au) : ''],
      ['Tracker', "Métiers exposés à l'IA générative (LIFT, HEC Paris)"], ['Page', location.href.split('#')[0]], ['Licence', 'CC BY 4.0']]);
    info['!cols'] = [{ wch: 16 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, info, 'À lire');
    return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function wireExports() {
    document.querySelectorAll('.me-export[data-chart]').forEach((box) => {
      const el = $(box.dataset.chart); if (!el) return;
      const card = el.closest('.ai-chart-section');
      const nom = () => 'lift_metiers-exposes_' + [box.dataset.nom, ...selection(card).map(slug)].filter(Boolean).join('_') + (asof() ? '_' + asof() : '');
      const rowsOf = () => {
        const rows = CSVF[box.dataset.chart] ? CSVF[box.dataset.chart]() : chartRows(el, box.dataset.x);
        if (rows && box.dataset.unite && !CSVF[box.dataset.chart]) rows[0] = rows[0].map((h, k) => (k ? `${h} (${box.dataset.unite})` : h));
        return rows;
      };
      const img = box.dataset.png !== 'non';
      const d = document.createElement('details'); d.className = 'dash-dl';
      d.innerHTML = `<summary title="${img ? 'Télécharger ce graphique ou ses données' : 'Télécharger ces données'}">${ICON}<span>Télécharger</span></summary>
        <div class="dash-dl-menu">${img ? '<button type="button" data-k="png">Image <span>PNG</span></button>' : ''}<button type="button" data-k="xlsx">Données <span>Excel</span></button><button type="button" data-k="csv">Données <span>CSV</span></button></div>`;
      box.replaceWith(d);
      d.querySelector('.dash-dl-menu').addEventListener('click', async (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        d.removeAttribute('open');
        try {
          if (b.dataset.k === 'png') { const bl = await composePNG(el); if (bl) save(bl, nom() + '.png', 'png'); return; }
          const rows = rowsOf(); if (!rows) return;
          if (b.dataset.k === 'csv') save(new Blob(['﻿' + toCSV(rows) + '\n'], { type: 'text/csv;charset=utf-8' }), nom() + '.csv', 'csv');
          else {
            const note = card.querySelector('.me-note'); const src = note ? (note.innerText.match(/Sources? ?:[^]*$/) || [''])[0].trim() : '';
            save(await toXLSX(rows, card.querySelector('h3')?.textContent.trim() || '', src), nom() + '.xlsx', 'xlsx');
          }
        } catch (e) { console.error('[metiers-exposes] téléchargement', e); }
      });
    });
    document.addEventListener('click', (ev) => document.querySelectorAll('.dash-dl[open]').forEach((x) => { if (!x.contains(ev.target)) x.removeAttribute('open'); }));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') document.querySelectorAll('.dash-dl[open]').forEach((x) => x.removeAttribute('open')); });
    // Toutes les données : ZIP des fichiers livrés et dictionnaire des variables
    const zb = $('me-zip');
    if (zb) zb.onclick = async () => {
      const st = $('me-zip-status'); zb.disabled = true; if (st) st.textContent = 'Préparation de l’archive…';
      try {
        const JSZip = await loadLib('JSZip'); const zip = new JSZip();
        const noms = Object.keys((D.meta && D.meta.fichiers) || {});
        for (const f of noms) zip.file(f, await (await fetch(DATA_DIR + f)).text());
        zip.file('tracker.json', JSON.stringify(D.meta, null, 2));
        const dico = [...document.querySelectorAll('.me-dico h5, .me-dico tr')].map((x) => (x.tagName === 'H5' ? '\n' + x.textContent.trim() : '  ' + [...x.cells].map((c) => c.innerText.trim()).join(' : '))).join('\n');
        zip.file('LISEZMOI.txt', ["Métiers exposés à l'IA générative, tracker du LIFT (HEC Paris)", 'Données d’embauche au ' + (D.meta ? moisFR(D.meta.donnees_au) : '') + '. Page : ' + location.href.split('#')[0],
          'Auteurs : Antonin Bergeaud et Oscar Degos. Licence : CC BY 4.0.', '', 'Format : CSV en UTF-8, virgule, point décimal ; case vide = secret statistique ou valeur absente ; parts entre 0 et 1.', '', 'Dictionnaire des variables', dico].join('\n'));
        save(await zip.generateAsync({ type: 'blob' }), 'lift_metiers-exposes_donnees' + (asof() ? '_' + asof() : '') + '.zip', 'zip', [...noms, 'tracker.json', 'LISEZMOI.txt']);
        if (st) st.textContent = '';
      } catch (e) { console.error('[metiers-exposes] ZIP', e); if (st) st.textContent = 'Archive indisponible pour le moment.'; }
      zb.disabled = false;
    };
  }

  // ===================================================== section « Données » : tailles et lignes
  function fillDonnees() {
    const F = D.meta && D.meta.fichiers; if (!F) return;
    const ko = (o) => (o >= 1e6 ? fmt(o / 1e6, 1) + ' Mo' : fmt(Math.max(1, Math.round(o / 1e3))) + ' ko');
    document.querySelectorAll('[data-me-fichier]').forEach((tr) => {
      const m = F[tr.dataset.meFichier]; if (!m) return;
      const l = tr.querySelector('.me-f-lignes'), o = tr.querySelector('.me-f-taille');
      if (l) l.textContent = fmt(m.lignes); if (o) o.textContent = ko(m.octets);
    });
  }

  // ================================================================== init
  async function init() {
    wireDownloads();
    let tend;
    [D.profil, D.prof, D.zones, D.fap, tend, D.meta] = await Promise.all([
      loadCSV('quintiles_profil.csv'), loadCSV('professions.csv'), loadCSV('zones.csv'), loadCSV('fap.csv'),
      loadCSV('embauches_tendances.csv'), loadJSON('tracker.json'),
    ]);
    // embauches_tendances.csv : une ligne par définition × mois × groupe × âge × sexe
    const parDef = (d, f) => (tend ? tend.filter((r) => r.definition === d && f(r)) : null);
    D.courbes = {}; D.courbesSexe = {};
    Object.entries(MODES).forEach(([k, m]) => {
      D.courbes[k] = parDef(m.def, (r) => r.sexe === 'tous');
      D.courbesSexe[k] = parDef(m.def, (r) => r.sexe !== 'tous' && r.embauches_cdi !== '');
    });
    showMeta(); kpiProfil();
    const ctrl = AVEC_VARIANTE ? $('me-ctrl-groupes') : null;
    if (!AVEC_VARIANTE && $('me-ctrl-groupes')) $('me-ctrl-groupes').hidden = true;
    if (ctrl) segmented(ctrl, Object.entries(MODES).map(([k, m]) => [k, m.lab]), ES.mode, (v) => {
      ES.mode = v; drawEmbauches();
      $('me-groupes-note').innerHTML = MODE_NOTE[v];
    });
    if ($('me-groupes-note')) $('me-groupes-note').innerHTML = MODE_NOTE[ES.mode];
    const steps = [drawEmbauches, drawComposition, drawProfil, initExplorer, drawAtlas, drawZones, wireExports, fillDonnees];
    for (const f of steps) {
      try { await f(); } catch (e) { console.error('[metiers-exposes]', f.name, e); }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
