// Acteurs clés : tracker Diffusion de l'IA (science)
// Données : data/ai-trackers/diffusion-science/superstars.json
// (généré par src/20_build_site_science_tracker.py dans openalex_project).
// Les graphiques utilisent les outils du tableau de bord (window.LIFTDash, défini
// dans diffusion-science.js, chargé avant ce fichier) : charte, commandes et menu
// « Télécharger » (image PNG, données Excel ou CSV).

function showSS(id, btn) {
  document.querySelectorAll('.ss-main .section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ss-nav .nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  setTimeout(() => { if (window.LIFTDash) window.LIFTDash.refresh(); }, 30);
}

(function () {
  'use strict';

  // Langue de la page (voir assets/js/lift-i18n.js) ; clé = texte français affiché
  const I18N = window.LIFT_I18N || { lang: 'fr', traducteur: () => (s, ...a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[i] !== undefined ? a[i] : m)) };
  const trad = I18N.traducteur({
    "Mesure": "Measure",
    "Brevets IA": "AI patents",
    "Équivalent fractionné": "Fractional equivalent",
    "Nombre": "Number",
    " brevets IA (équivalent fractionné)": " AI patents (fractional equivalent)",
    " brevets IA": " AI patents",
    "Brevets IA, équivalent fractionné": "AI patents, fractional equivalent",
    "Nombre de brevets IA": "Number of AI patents",
    "Rang": "Rank",
    "Rang selon la mesure affichée": "Rank by the measure shown",
    "Brevets IA européens, 1990–2024, chaque brevet compté une fois": "European AI patents, 1990–2024, each patent counted once",
    "Brevets IA pondérés par la part du ": "AI patents weighted by the ",
    " dans le brevet": "’s share of the patent",
    "Déposant": "Applicant",
    "Publications IA citées": "Cited AI publications",
    "Publications IA distinctes citées par les brevets du déposant": "Distinct AI publications cited by the applicant’s patents",
    "Inventeur": "Inventor",
    "<th class=\"num\">Brevets<br>citants</th><th class=\"num\">Déposants<br>distincts</th><th class=\"num\">Citations<br>OpenAlex</th></tr></thead><tbody></tbody></table></div>": "<th class=\"num\">Citing<br>patents</th><th class=\"num\">Distinct<br>applicants</th><th class=\"num\">OpenAlex<br>citations</th></tr></thead><tbody></tbody></table></div>",
    "<p class=\"dash-empty\" hidden>Aucune publication ne correspond.</p>": "<p class=\"dash-empty\" hidden>No matching publication.</p>",
    "Rang par nombre de brevets citants": "Rank by number of citing patents",
    "Titre": "Title",
    "Année": "Year",
    "Année de publication": "Publication year",
    "Thème OpenAlex": "OpenAlex topic",
    "Primary topic OpenAlex": "OpenAlex primary topic",
    "Brevets citants": "Citing patents",
    "Brevets IA européens qui citent la publication": "European AI patents citing the publication",
    "Déposants distincts": "Distinct applicants",
    "Déposants distincts de ces brevets": "Distinct applicants of these patents",
    "Citations OpenAlex": "OpenAlex citations",
    "Citations scientifiques selon OpenAlex": "Scientific citations according to OpenAlex",
    "Lien OpenAlex": "OpenAlex link",
    "<span class=\"dash-select-lbl\">Filtrer</span><input type=\"search\" id=\"papers-filter\" placeholder=\"Titre ou thème\" autocomplete=\"off\">": "<span class=\"dash-select-lbl\">Filter</span><input type=\"search\" id=\"papers-filter\" placeholder=\"Title or topic\" autocomplete=\"off\">",
    "Déposants affichés": "Applicants shown",
    "Brevets IA par an, équivalent fractionné": "AI patents per year, fractional equivalent",
    "Brevets IA de ": "AI patents of ",
    ", équivalent fractionné": ", fractional equivalent",
    "N°1 déposant<br>": "No. 1 applicant<br>",
    "N°1 inventeur<br>": "No. 1 inventor<br>",
    "Brevets IA avec<br>publication identifiée": "AI patents with an<br>identified publication",
    "Publications IA<br>citées (observées)": "Cited AI publications<br>(observed)",
    "<div class=\"ss-table-wrap\"><table class=\"ss-table\"><thead><tr><th class=\"rank\">#</th><th>Publication</th>": "<div class=\"ss-table-wrap\"><table class=\"ss-table\"><thead><tr><th class=\"rank\">#</th><th>Publication</th>"
  });
  const DATA_URL = (function () {
    const src = (document.currentScript && document.currentScript.src) || '';
    if (src) return src.replace(/assets\/js\/[^/?#]*([?#].*)?$/, '') + 'data/ai-trackers/diffusion-science/superstars.json';
    const p = window.location.pathname;
    const i = p.indexOf('/ai-trackers/');
    return (i >= 0 ? p.slice(0, i).replace(/\/en$/, '') : '') + '/data/ai-trackers/diffusion-science/superstars.json';
  })();

  function render(SD) {
    const L = window.LIFTDash;
    const { fr, esc, T, NB } = L;
    // En anglais : « Google (dont DeepMind) » devient « Google (incl. DeepMind) »
    if (I18N.lang === 'en') {
      SD.applicants.concat(SD.time_series).forEach(r => { r.name = r.name.replace('(dont ', '(incl. '); });
    }

    document.getElementById('ss-kpis').innerHTML = `
      <div class="ss-kpi"><div class="val txt">${esc(SD.applicants[0].name)}</div><div class="lbl">${trad('N°1 déposant<br>')}${fr(SD.applicants[0].patents)}${trad(' brevets IA')}</div></div>
      <div class="ss-kpi"><div class="val txt">${esc(SD.inventors[0].name.split(',')[0])}</div><div class="lbl">${trad('N°1 inventeur<br>')}${fr(SD.inventors[0].patents)}${trad(' brevets IA')}</div></div>
      <div class="ss-kpi"><div class="val">${fr(SD.meta.observed_ai_patents)}</div><div class="lbl">${trad('Brevets IA avec<br>publication identifiée')}</div></div>
      <div class="ss-kpi"><div class="val">${fr(SD.meta.observed_ai_papers)}</div><div class="lbl">${trad('Publications IA<br>citées (observées)')}</div></div>`;

    // Déposants et inventeurs : nombre de brevets ou équivalent fractionné, top 10 ou top 25
    const people = (id, list, slug, who, extraCols) => L.register({
      id, slug,
      controls: [
        { type: 'seg', key: 'm', label: trad('Mesure'), options: [['p', trad('Brevets IA')], ['e', trad('Équivalent fractionné')]] },
        { type: 'seg', key: 'k', label: trad('Nombre'), options: [['10', 'Top 10'], ['25', 'Top 25']] }
      ],
      defaults: { m: 'p', k: '25' },
      height: (n, st) => L.hbarHeight(Number(st.k), n),
      title: (st, t) => t.replace(/Top \d+/, 'Top ' + st.k),
      build: (n, st, h) => {
        const rows = list.slice().sort((a, b) => st.m === 'e' ? b.equiv - a.equiv : b.patents - a.patents).slice(0, Number(st.k));
        return L.hbar({
          names: rows.map(r => r.name), values: rows.map(r => st.m === 'e' ? r.equiv : r.patents), narrow: n, height: h, ml: 230,
          fmt: v => st.m === 'e' ? fr(v, 1) : fr(v), hover: st.m === 'e' ? trad(' brevets IA (équivalent fractionné)') : trad(' brevets IA'),
          unit: st.m === 'e' ? trad('Brevets IA, équivalent fractionné') : trad('Nombre de brevets IA'), colors: T.navy
        });
      },
      table: st => {
        const rows = list.slice().sort((a, b) => st.m === 'e' ? b.equiv - a.equiv : b.patents - a.patents).slice(0, Number(st.k));
        return {
          columns: [['rang', trad('Rang'), trad('Rang selon la mesure affichée')], ['nom', who, ''],
            ['brevets_ia', trad('Brevets IA'), trad('Brevets IA européens, 1990–2024, chaque brevet compté une fois')],
            ['equivalent_fractionne', trad('Équivalent fractionné'), trad('Brevets IA pondérés par la part du ') + who.toLowerCase() + trad(' dans le brevet')]].concat(extraCols || []),
          rows: rows.map((r, i) => ({ rang: i + 1, nom: r.name, brevets_ia: r.patents, equivalent_fractionne: r.equiv, publications_citees: r.papers }))
        };
      }
    });
    people('ch-applicants', SD.applicants, 'deposants', trad('Déposant'),
      [['publications_citees', trad('Publications IA citées'), trad('Publications IA distinctes citées par les brevets du déposant')]]);
    people('ch-inventors', SD.inventors, 'inventeurs', trad('Inventeur'));

    // Publications clés : tableau filtrable et téléchargeable
    const box = document.getElementById('papers-table');
    const clean = t => String(t == null ? '' : t).replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim();
    const papers = SD.papers.slice(0, 25).map((p, i) => Object.assign({}, p, { rank: i + 1, title: clean(p.title) }));
    box.innerHTML = trad('<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th class="rank">#</th><th>Publication</th>') +
      trad('<th class="num">Brevets<br>citants</th><th class="num">Déposants<br>distincts</th><th class="num">Citations<br>OpenAlex</th></tr></thead><tbody></tbody></table></div>') +
      trad('<p class="dash-empty" hidden>Aucune publication ne correspond.</p>');
    const tbody = box.querySelector('tbody');
    const fill = q => {
      const qq = q.trim().toLowerCase();
      const rows = papers.filter(p => !qq || (p.title + ' ' + p.topic).toLowerCase().includes(qq));
      tbody.innerHTML = rows.map(p => `
        <tr>
          <td class="rank">${p.rank}</td>
          <td class="name"><a href="${esc(p.openalex)}" target="_blank" rel="noopener">${esc(p.title)}</a><span class="meta">${p.year ?? ''} · ${esc(p.topic)}</span></td>
          <td class="num">${fr(p.citing_patents)}</td>
          <td class="num">${fr(p.applicants)}</td>
          <td class="num">${p.cited_by == null ? '–' : fr(p.cited_by)}</td>
        </tr>`).join('');
      box.querySelector('.dash-empty').hidden = rows.length > 0;
    };
    fill('');
    L.register({
      id: 'papers-table', slug: 'publications_cles', table: () => ({
        columns: [['rang', trad('Rang'), trad('Rang par nombre de brevets citants')], ['titre', trad('Titre'), ''], ['annee', trad('Année'), trad('Année de publication')],
          ['theme', trad('Thème OpenAlex'), trad('Primary topic OpenAlex')], ['brevets_citants', trad('Brevets citants'), trad('Brevets IA européens qui citent la publication')],
          ['deposants_distincts', trad('Déposants distincts'), trad('Déposants distincts de ces brevets')], ['citations_openalex', trad('Citations OpenAlex'), trad('Citations scientifiques selon OpenAlex')],
          ['lien', trad('Lien OpenAlex'), '']],
        rows: papers.map(p => ({ rang: p.rank, titre: p.title, annee: p.year, theme: p.topic, brevets_citants: p.citing_patents,
          deposants_distincts: p.applicants, citations_openalex: p.cited_by, lien: p.openalex }))
      }), noImage: true
    });
    const ctrl = L.REG['papers-table'] && L.REG['papers-table']._ctrl;
    if (ctrl) {
      const lab = document.createElement('label');
      lab.className = 'dash-search';
      lab.innerHTML = trad('<span class="dash-select-lbl">Filtrer</span><input type="search" id="papers-filter" placeholder="Titre ou thème" autocomplete="off">');
      ctrl.appendChild(lab);
      lab.querySelector('input').addEventListener('input', ev => fill(ev.target.value));
    }

    // Évolution des 15 premiers déposants : pastilles pour choisir les déposants
    const ts = SD.time_series;
    const color = name => L.SERIES15[Math.max(0, ts.findIndex(d => d.name === name)) % L.SERIES15.length];
    L.register({
      id: 'ch-timeseries', slug: 'deposants_par_annee',
      controls: [{ type: 'chips', key: 'sel', label: trad('Déposants affichés'), options: () => ts.map(d => [d.name, d.name, color(d.name)]) }],
      defaults: { sel: new Set(ts.slice(0, 5).map(d => d.name)) },
      height: n => n ? 380 : 460,
      build: (n, st) => ({
        data: ts.filter(d => st.sel.has(d.name)).map(d => ({ x: d.years, y: d.equiv, type: 'scatter', mode: 'lines', name: d.name,
          line: { color: color(d.name), width: 2.4 }, hovertemplate: '%{y:.1f}' })),
        layout: L.base({ xaxis: { tickvals: L.yearTicks(n) }, yaxis: { tickformat: ',d', rangemode: 'tozero' },
          annotations: [L.unit(trad('Brevets IA par an, équivalent fractionné'), 48)] })
      }),
      table: () => {
        const years = ts[0] ? ts[0].years : [];
        return {
          columns: [['annee', trad('Année'), '']].concat(ts.map((d, i) => ['d' + i, d.name, trad('Brevets IA de ') + d.name + trad(', équivalent fractionné')])),
          rows: years.map((y, j) => Object.assign({ annee: y }, Object.fromEntries(ts.map((d, i) => ['d' + i, d.equiv[j]]))))
        };
      }
    });
    L.refresh();
  }

  async function init() {
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`superstars.json: HTTP ${resp.status}`);
      const SD = await resp.json();
      if (window.LIFTDash) render(SD);
      else document.addEventListener('liftdash:ready', () => render(SD), { once: true });
    } catch (e) {
      console.error('[superstars] échec du chargement des données :', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
