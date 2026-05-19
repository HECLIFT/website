/**
 * AI Tracker (Emploi) - Chart.js + D3 Integration
 * Interactive dashboard for AI job market diffusion in France
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Detect base path from current page location
  const getBasePath = () => {
    const path = window.location.pathname;
    // If we're at /ai-trackers/diffusion-emploi/index.html, go up 2 levels
    const match = path.match(/^(.*?)\/ai-trackers\/diffusion-emploi/);
    return match ? match[1] : '';
  };

  const CONFIG = {
    dataPath: getBasePath() + '/data/ai-trackers/diffusion-emploi/',

    // LIFT design system colors
    colors: {
      navy: '#0E2A47',
      cornflower: '#5F84E8',
      olive: '#5B6B2F',
      coral: '#E46A4E',
      muted: '#55657D'
    },

    // Chart color palette (matching LIFT)
    chartColors: [
      '#E46A4E',  // coral
      '#5F84E8',  // cornflower
      '#5B6B2F',  // olive
      '#0E2A47',  // navy
      '#3E66D2',  // cornflower-700
      '#C4523A',  // coral-700
      '#435220',  // olive-700
      '#7B68EE',  // medium slate blue
      '#20B2AA',  // light sea green
      '#FF6347',  // tomato
    ],

    // Pastel palette for stacked areas
    pastelColors: i => `hsl(${(i * 40) % 360}, 45%, 72%)`,

    // Metier palette (from original)
    metierPalette: [
      'rgba(31,119,180,1.0)', 'rgba(174,199,232,1.0)', 'rgba(255,127,14,1.0)',
      'rgba(255,187,120,1.0)', 'rgba(44,160,44,1.0)', 'rgba(152,223,138,1.0)',
      'rgba(214,39,40,1.0)', 'rgba(255,152,150,1.0)', 'rgba(148,103,189,1.0)',
      'rgba(196,172,228,1.0)', 'rgba(140,86,75,1.0)', 'rgba(196,156,148,1.0)',
      'rgba(227,119,194,1.0)', 'rgba(247,182,210,1.0)', 'rgba(127,127,127,1.0)',
      'rgba(199,199,199,1.0)', 'rgba(188,189,34,1.0)', 'rgba(219,219,141,1.0)',
      'rgba(23,190,207,1.0)', 'rgba(158,218,229,1.0)', 'rgba(57,59,121,1.0)',
      'rgba(82,84,163,1.0)', 'rgba(107,110,207,1.0)', 'rgba(156,158,222,1.0)',
      'rgba(99,121,57,1.0)', 'rgba(140,162,82,1.0)', 'rgba(181,207,107,1.0)',
      'rgba(206,219,156,1.0)', 'rgba(140,109,49,1.0)', 'rgba(189,158,57,1.0)',
      'rgba(49,130,189,1.0)', 'rgba(107,174,214,1.0)', 'rgba(158,202,225,1.0)',
      'rgba(198,219,239,1.0)', 'rgba(230,85,13,1.0)', 'rgba(253,141,60,1.0)',
      'rgba(253,174,107,1.0)', 'rgba(253,208,162,1.0)', 'rgba(49,163,84,1.0)',
      'rgba(116,196,118,1.0)'
    ],

    startMonth: new Date(2019, 0, 1)
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchCsv = url =>
    fetch(url, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`Failed to fetch ${url}`);
      return r.text();
    });

  const parseCsv = txt => Papa.parse(txt, { header: false, skipEmptyLines: true }).data.slice(1);

  const toNum = v => {
    if (v == null) return NaN;
    const n = Number(String(v).replace(/[%\s\u00A0]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  const monthLabel = i => {
    const d = new Date(CONFIG.startMonth);
    d.setMonth(d.getMonth() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const quarterLabel = i => `Q${(i % 4) + 1} ${2019 + Math.floor(i / 4)}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART.JS GLOBAL SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  function setupChartDefaults() {
    Chart.defaults.font.family = "'Merriweather', Georgia, serif";
    Chart.defaults.color = CONFIG.colors.muted;
    Chart.defaults.elements.line.borderWidth = 2;
    Chart.defaults.elements.point.radius = 0;
    Chart.defaults.plugins.legend.labels.boxWidth = 14;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(14, 42, 71, 0.92)';
    Chart.defaults.plugins.tooltip.titleColor = '#fff';
    Chart.defaults.plugins.tooltip.bodyColor = '#fff';
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.animation.duration = 700;
    Chart.defaults.animation.easing = 'easeOutCubic';
    Chart.defaults.locale = 'fr-FR';

    // Rounded bar plugin
    const roundedBar = {
      id: 'roundedBar',
      beforeDatasetsDraw(chart) {
        chart.data.datasets.forEach((ds, i) => {
          const meta = chart.getDatasetMeta(i);
          if (meta.type !== 'bar') return;
          meta.data.forEach(bar => { bar.options.borderRadius = 6; });
        });
      }
    };
    Chart.register(roundedBar);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA STORAGE
  // ═══════════════════════════════════════════════════════════════════════════

  const DATA = {
    // Offers
    dateLabels: [],
    totalGen: [], totalAI: [], totalCV: [], totalNLP: [],
    shareGen: [], shareAI: [], shareCV: [], shareNLP: [],

    // Sectors
    qLabels: [],
    indTotGen: [], servTotGen: [], indTotNon: [], servTotNon: [],
    indShGen: [], servShGen: [], indShNon: [], servShNon: [],

    // Sector evolution
    evolDates: [], evolDatesGen: [],
    evolAI: [], evolGen: [], evolAll: [],

    // Size
    sizeLabels: [], sizeAi: [], sizeGen: [],

    // Metiers
    metierDates: [], metierDatesData: [],
    metierIA: [], metierData: [],

    // Skills
    skillsDates: { ml_library: [], method_skills: [], broad_skills: [] },
    skillsSets: { ml_library: [], method_skills: [], broad_skills: [] },

    // Map
    mapData: new Map(),
    zonesFC: null
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART INSTANCES
  // ═══════════════════════════════════════════════════════════════════════════

  let offersChart, sectorsChart, sectorEvolChart, sizeChart, metierChart, skillsChart;
  let offersMode = 'total';
  let secMode = 'total', secCat = 'gen';
  let evolType = 'ai';
  let sizeCat = 'ai';
  let metierMode = 'ia';
  let skillsType = 'ml_library';
  let mapMode = 'total', mapCat = 'ai';

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADERS
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadHome() {
    try {
      const rows = parseCsv(await fetchCsv(CONFIG.dataPath + 'general_results.csv'));
      const d = rows.reduce((h, r) => (h[r[0]] = +r[1] || 0, h), {});

      setText('aiOffersValue', formatNumber(d['Total IA offers'] ?? 0));
      setText('aiOffersLastQuarter', `+${formatNumber(d['Number of AI offers in last quarter'] ?? 0)} dernier trimestre`);
      setText('aiFirmsValue', formatNumber(d['Number of firms with AI offers'] ?? 0));
      setText('aiFirmsLastQuarter', `+${formatNumber(d['Number of new AI adopters in last quarter'] ?? 0)} dernier trimestre`);
      setText('genAiOffersValue', formatNumber(d['Total IA générative offers'] ?? 0));
      setText('genAiOffersLastQuarter', `+${formatNumber(d['Number of GenAI offers in last quarter'] ?? 0)} dernier trimestre`);
      setText('genAiFirmsValue', formatNumber(d['Number of firms with GenAI offers'] ?? 0));
      setText('genAiFirmsLastQuarter', `+${formatNumber(d['Number of new GenAI adopters in last quarter'] ?? 0)} dernier trimestre`);
    } catch (e) {
      console.error('Error loading home figures:', e);
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(n));
  }

  async function loadOffersFile(file) {
    const txt = await fetchCsv(CONFIG.dataPath + file);
    const raw = Papa.parse(txt, { header: false, skipEmptyLines: true }).data;

    const looksLikeHeader = raw.length && raw[0].some(v => {
      const s = String(v ?? '').trim();
      return s && Number.isNaN(Number(s.replace(',', '.')));
    });
    const rows = looksLikeHeader ? raw.slice(1) : raw;
    const parsed = rows.map(r => r.map(v => toNum(v)));

    if (!parsed.length) return { n: 0, gen: [], ai: [], cv: [], nlp: [] };

    const hasIndex = parsed[0].length >= 5;
    const off = hasIndex ? 1 : 0;

    const gen = [], ai = [], cv = [], nlp = [];
    parsed.forEach(r => {
      gen.push(r[off + 0]);
      ai.push(r[off + 1]);
      cv.push(r[off + 2]);
      nlp.push(r[off + 3]);
    });

    return { n: parsed.length, gen, ai, cv, nlp };
  }

  function padTo(arr, n) {
    const out = arr.slice();
    while (out.length < n) out.push(NaN);
    return out;
  }

  async function loadTwoSectors(file, fillLabels, indArr, servArr) {
    const parsed = Papa.parse(await fetchCsv(CONFIG.dataPath + file), {
      header: true, skipEmptyLines: true, dynamicTyping: true
    }).data;

    if (fillLabels) {
      DATA.qLabels = parsed.map(r => r.date);
    }
    parsed.forEach(r => {
      indArr.push(toNum(r.Industrie));
      servArr.push(toNum(r.Services));
    });
  }

  async function loadEvol(file, targetArr, dateArr) {
    const d = Papa.parse(await fetchCsv(CONFIG.dataPath + file), { header: true, skipEmptyLines: true }).data;
    if (d.length === 0) return;
    if (dateArr.length === 0) d.forEach(x => dateArr.push(x.date));
    Object.keys(d[0]).filter(k => k !== 'date' && k !== '').forEach((k, i) => {
      targetArr.push({
        label: k,
        data: d.map(x => +x[k]),
        borderColor: CONFIG.pastelColors(i),
        backgroundColor: CONFIG.pastelColors(i),
        fill: true,
        stack: 's'
      });
    });
  }

  async function loadMetier(file, targetArr, dateArr) {
    const txt = await fetchCsv(CONFIG.dataPath + file);
    const d = Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
    if (!d.length) return;

    if (dateArr.length === 0) d.forEach(x => dateArr.push(x.date));

    const keys = Object.keys(d[0]).filter(k => k !== 'date');
    keys.forEach((k, i) => {
      const fill = CONFIG.metierPalette[i % CONFIG.metierPalette.length];
      const bg = fill.replace(/1\.0\)$/, '0.35)');

      targetArr.push({
        label: (function(k) {
          var parts = k.split(' - ');
          // ROME code (letter + 3-4 digits): fully uppercase; else just capitalize first letter
          parts[0] = /^[a-zA-Z]\d{3,4}/.test(parts[0])
            ? parts[0].toUpperCase()
            : parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          // Description words after " - ": capitalize first letter of each word
          for (var i = 1; i < parts.length; i++) {
            parts[i] = parts[i].replace(/(^|\s)([a-zA-ZÀ-ÿ])/g, function(_, sp, c) { return sp + c.toUpperCase(); });
          }
          return parts.join(' - ');
        })(k),
        data: d.map(x => toNum(x[k])),
        borderColor: fill,
        backgroundColor: bg,
        fill: true,
        stack: 's',
        pointRadius: 0
      });
    });
  }

  async function loadSkills(file, key) {
    const d = Papa.parse(await fetchCsv(CONFIG.dataPath + file), { header: true, skipEmptyLines: true }).data;
    if (!d.length) return;
    DATA.skillsDates[key] = d.map(x => x.date);
    const keys = Object.keys(d[0]).filter(k => k !== 'date');
    DATA.skillsSets[key] = keys.map((k, i) => ({
      label: k,
      data: d.map(x => +x[k]),
      borderColor: CONFIG.chartColors[i % CONFIG.chartColors.length],
      pointRadius: 0,
      fill: false
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OFFERS CHART
  // ═══════════════════════════════════════════════════════════════════════════

  function buildOffers() {
    const ctx = document.getElementById('ai-offersChart');
    if (!ctx) return;

    offersChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: DATA.dateLabels,
        datasets: [
          { label: 'IA Générative', data: DATA.totalGen, backgroundColor: CONFIG.chartColors[0] },
          { label: 'IA Générale', data: DATA.totalAI, backgroundColor: CONFIG.chartColors[1] },
          { label: 'Vision par Ordinateur', data: DATA.totalCV, backgroundColor: CONFIG.chartColors[2] },
          { label: 'NLP', data: DATA.totalNLP, backgroundColor: CONFIG.chartColors[3] }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            title: { display: true, text: 'Nombre d\'offres' }
          }
        },
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  window.toggleOffersTotalShare = function() {
    offersMode = offersMode === 'total' ? 'share' : 'total';
    offersChart.data.datasets[0].data = offersMode === 'total' ? DATA.totalGen : DATA.shareGen;
    offersChart.data.datasets[1].data = offersMode === 'total' ? DATA.totalAI : DATA.shareAI;
    offersChart.data.datasets[2].data = offersMode === 'total' ? DATA.totalCV : DATA.shareCV;
    offersChart.data.datasets[3].data = offersMode === 'total' ? DATA.totalNLP : DATA.shareNLP;
    offersChart.options.scales.y.title.text = offersMode === 'total' ? 'Nombre d\'offres' : 'Part des offres (%)';
    offersChart.update();

    const btn = document.getElementById('btnOfferMode');
    const lbl = document.getElementById('lblOfferMode');
    if (btn) btn.classList.toggle('active', offersMode === 'share');
    if (lbl) lbl.textContent = offersMode === 'total' ? 'Total' : 'Part';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTORS CHART
  // ═══════════════════════════════════════════════════════════════════════════

  function buildSectors() {
    const ctx = document.getElementById('ai-sectorsChart');
    if (!ctx) return;

    sectorsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: DATA.qLabels,
        datasets: [
          { label: 'Industrie', backgroundColor: CONFIG.chartColors[2], data: [] },
          { label: 'Services', backgroundColor: CONFIG.chartColors[1], data: [] }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
    refreshSectors();
  }

  function refreshSectors() {
    let ind, serv;
    if (secMode === 'total' && secCat === 'gen') { ind = DATA.indTotGen; serv = DATA.servTotGen; }
    else if (secMode === 'total') { ind = DATA.indTotNon; serv = DATA.servTotNon; }
    else if (secCat === 'gen') { ind = DATA.indShGen; serv = DATA.servShGen; }
    else { ind = DATA.indShNon; serv = DATA.servShNon; }

    sectorsChart.data.datasets[0].data = ind;
    sectorsChart.data.datasets[1].data = serv;
    sectorsChart.update();
  }

  window.toggleSectorsTotalShare = function() {
    secMode = secMode === 'total' ? 'share' : 'total';
    const btn = document.getElementById('btnSectorMode');
    const lbl = document.getElementById('lblSectorMode');
    if (btn) btn.classList.toggle('active', secMode === 'share');
    if (lbl) lbl.textContent = secMode === 'total' ? 'Total' : 'Part';
    refreshSectors();
  };

  window.toggleSectorsGenNonGen = function() {
    secCat = secCat === 'gen' ? 'nongen' : 'gen';
    const btn = document.getElementById('btnSectorCat');
    const lbl = document.getElementById('lblSectorCat');
    if (btn) btn.classList.toggle('active', secCat !== 'gen');
    if (lbl) lbl.textContent = secCat === 'gen' ? 'IA Générative' : 'IA Non-générative';
    refreshSectors();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR EVOLUTION CHART
  // ═══════════════════════════════════════════════════════════════════════════

  function buildEvol() {
    const ctx = document.getElementById('ai-sectorEvolChart');
    if (!ctx) return;

    sectorEvolChart = new Chart(ctx, {
      type: 'line',
      data: { labels: DATA.evolDates, datasets: DATA.evolAI },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            stacked: true,
            min: 0,
            max: 1.02,
            suggestedMin: 0,
            suggestedMax: 1.02,
            ticks: {
              stepSize: 0.2,
              max: 1,
              callback: v => v <= 1 ? (v * 100).toFixed(0) + '%' : ''
            }
          }
        },
        elements: { line: { fill: true, tension: 0.3 } },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  window.setEvolType = function(t) {
    evolType = t;
    document.getElementById('btnAI')?.classList.toggle('active', t === 'ai');
    document.getElementById('btnGen')?.classList.toggle('active', t === 'gen');
    document.getElementById('btnAll')?.classList.toggle('active', t === 'all');

    if (t === 'ai') { sectorEvolChart.data.labels = DATA.evolDates; sectorEvolChart.data.datasets = DATA.evolAI; }
    else if (t === 'gen') { sectorEvolChart.data.labels = DATA.evolDatesGen; sectorEvolChart.data.datasets = DATA.evolGen; }
    else { sectorEvolChart.data.labels = DATA.evolDates; sectorEvolChart.data.datasets = DATA.evolAll; }
    sectorEvolChart.update();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SIZE CHART
  // ═══════════════════════════════════════════════════════════════════════════

  function buildSize() {
    const ctx = document.getElementById('ai-sizeChart');
    if (!ctx) return;

    sizeChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: DATA.sizeLabels,
        datasets: [{
          data: DATA.sizeAi,
          backgroundColor: CONFIG.chartColors,
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  window.toggleSizeAiGen = function() {
    sizeCat = sizeCat === 'ai' ? 'gen' : 'ai';
    const btn = document.getElementById('btnSizeCat');
    const lbl = document.getElementById('lblSizeCat');
    if (btn) btn.classList.toggle('active', sizeCat === 'gen');
    if (lbl) lbl.textContent = sizeCat === 'gen' ? 'IA Générative' : 'IA';
    sizeChart.data.datasets[0].data = sizeCat === 'ai' ? DATA.sizeAi : DATA.sizeGen;
    sizeChart.update();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // METIER CHART
  // ═══════════════════════════════════════════════════════════════════════════

  function buildMetier() {
    const ctx = document.getElementById('ai-metierChart');
    if (!ctx) return;

    metierChart = new Chart(ctx, {
      type: 'line',
      data: { labels: DATA.metierDates, datasets: DATA.metierIA },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            stacked: true,
            min: 0,
            max: 1.02,
            suggestedMin: 0,
            suggestedMax: 1.02,
            ticks: {
              stepSize: 0.2,
              max: 1,
              callback: v => v <= 1 ? (v * 100).toFixed(0) + '%' : ''
            }
          }
        },
        elements: { line: { fill: true, tension: 0.3 } },
        plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } }
      }
    });
  }

  window.toggleMetier = function() {
    metierMode = metierMode === 'ia' ? 'data' : 'ia';
    const btn = document.getElementById('btnMetierCat');
    const lbl = document.getElementById('lblMetierCat');
    if (btn) btn.classList.toggle('active', metierMode === 'data');
    if (lbl) lbl.textContent = metierMode === 'data' ? 'IA' : 'IA';
    metierChart.data.labels = metierMode === 'ia' ? DATA.metierDates : DATA.metierDatesData;
    metierChart.data.datasets = metierMode === 'ia' ? DATA.metierIA : DATA.metierData;
    metierChart.update();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SKILLS CHART
  // ═══════════════════════════════════════════════════════════════════════════

  function buildSkills() {
    const ctx = document.getElementById('ai-skillsChart');
    if (!ctx) return;

    skillsChart = new Chart(ctx, {
      type: 'line',
      data: { labels: DATA.skillsDates[skillsType], datasets: DATA.skillsSets[skillsType] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: { y: { stacked: false } },
        elements: { line: { fill: false, tension: 0.25 } },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  window.setSkillsType = function(t) {
    skillsType = t;
    document.getElementById('btnSkillsLibraries')?.classList.toggle('active', t === 'ml_library');
    document.getElementById('btnSkillsMethods')?.classList.toggle('active', t === 'method_skills');
    document.getElementById('btnSkillsBroad')?.classList.toggle('active', t === 'broad_skills');
    skillsChart.data.labels = DATA.skillsDates[t];
    skillsChart.data.datasets = DATA.skillsSets[t];
    skillsChart.update();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP (D3)
  // ═══════════════════════════════════════════════════════════════════════════

  let mapSvg, zonePaths, colorScale, shareScaleFactor = 1;
  let legendSvg, legendScale, legendGradient;
  let top10Chart = null;

  async function loadFranceMap() {
    try {
      // Load TopoJSON
      const topoResp = await fetch(CONFIG.dataPath + 'france_zones.topo.json');
      if (!topoResp.ok) throw new Error('Missing TopoJSON');
      const topo = await topoResp.json();
      const objName = Object.keys(topo.objects)[0];
      DATA.zonesFC = topojson.feature(topo, topo.objects[objName]);

      // Ensure join key
      DATA.zonesFC.features.forEach(f => {
        if (!f.properties.zone) {
          f.properties.zone =
            f.properties['Nom Officiel Zone emploi 2020'] ||
            f.properties.ZE2020 ||
            f.properties.nom ||
            f.properties.code_insee || null;
        }
      });

      // Load CSV values
      const csvTxt = await fetchCsv(CONFIG.dataPath + 'map_offers_values.csv');
      const rows = Papa.parse(csvTxt, { header: true, skipEmptyLines: true }).data;
      rows.forEach(r => {
        if (!r.zone) return;
        DATA.mapData.set(r.zone, {
          ia: +r.ia, ia_rel: +r.ia_rel,
          gen: +r.gen, gen_rel: +r.gen_rel,
          total_offers: +r.total_offers
        });
      });

      initMapStatic();
      updateMapLegend();
      buildTop10Chart();
    } catch (e) {
      console.error('Map failed:', e);
      const container = document.getElementById('ai-mapOffers');
      if (container) container.innerHTML = '<div style="text-align:center;padding:20px;color:#E46A4E">Carte non disponible</div>';
    }
  }

  let activeZonePath = null; // Track currently highlighted zone
  let selectedZone = null; // Track clicked/selected zone

  function initMapStatic() {
    const container = document.getElementById('ai-mapOffers');
    if (!container) return;
    container.innerHTML = '';

    const W = 1000, H = 880;
    mapSvg = d3.select('#ai-mapOffers').append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', '100%');

    const projection = d3.geoConicConformal().parallels([44, 49]).rotate([-3, 0]);
    projection.fitSize([W, H], DATA.zonesFC);
    const path = d3.geoPath(projection);

    updateColorScale();

    // Tooltip
    const tip = d3.select('body').append('div')
      .attr('class', 'ai-map-tip')
      .style('opacity', 0);

    // Helper to reset previous highlight
    function resetHighlight() {
      if (activeZonePath && activeZonePath !== selectedZone) {
        d3.select(activeZonePath).attr('stroke', '#d0d0d0').attr('stroke-width', 1);
      }
      activeZonePath = null;
    }

    // Helper to update info panel
    function updateInfoPanel(zone, v, feature) {
      const panel = document.getElementById('ai-mapInfo');
      if (!panel) return;

      if (!zone || !v) {
        panel.innerHTML = '<p class="ai-map-info-placeholder">Cliquez sur une zone pour voir les détails</p>';
        return;
      }

      const zoneCode = feature?.properties?.ZE2020 || feature?.properties?.code_insee || '-';

      panel.innerHTML = `
        <div class="ai-map-info-content">
          <h4>${zone}</h4>
          <p class="ai-map-info-code">Code zone : ${zoneCode}</p>
          <div class="ai-map-info-stats">
            <div class="ai-map-info-stat">
              <span class="ai-map-info-label">Offres IA</span>
              <span class="ai-map-info-value">${v.ia?.toLocaleString('fr-FR') ?? 'n/a'}</span>
              <span class="ai-map-info-pct">${v.ia_rel != null ? (v.ia_rel * 100).toFixed(2) + '%' : ''}</span>
            </div>
            <div class="ai-map-info-stat">
              <span class="ai-map-info-label">Offres IA Générative</span>
              <span class="ai-map-info-value">${v.gen?.toLocaleString('fr-FR') ?? 'n/a'}</span>
              <span class="ai-map-info-pct">${v.gen_rel != null ? (v.gen_rel * 100).toFixed(2) + '%' : ''}</span>
            </div>
            <div class="ai-map-info-stat">
              <span class="ai-map-info-label">Total offres</span>
              <span class="ai-map-info-value">${v.total_offers?.toLocaleString('fr-FR') ?? 'n/a'}</span>
            </div>
          </div>
        </div>
      `;
    }

    const gFill = mapSvg.append('g');
    zonePaths = gFill.selectAll('path')
      .data(DATA.zonesFC.features)
      .enter()
      .append('path')
        .attr('d', path)
        .attr('fill', d => fillValue(d))
        .attr('stroke', '#d0d0d0')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseenter', function() {
          // Reset any previous highlight first
          resetHighlight();
          // Highlight current
          activeZonePath = this;
          d3.select(this).attr('stroke', '#0E2A47').attr('stroke-width', 2).raise();
          tip.style('opacity', 1);
        })
        .on('mousemove', function(ev, d) {
          const zone = d.properties.zone;
          const v = DATA.mapData.get(zone);
          tip.html(`<b>${zone}</b><br/>` +
            (mapCat === 'ai'
              ? `IA: <b>${formatMapValue(v?.ia)}</b>${mapMode === 'share' ? ` (${formatMapValue(v?.ia_rel)}%)` : ''}`
              : `IA Gén.: <b>${formatMapValue(v?.gen)}</b>${mapMode === 'share' ? ` (${formatMapValue(v?.gen_rel)}%)` : ''}`
            )
          )
          .style('left', (ev.pageX + 12) + 'px')
          .style('top', (ev.pageY + 12) + 'px');
        })
        .on('mouseleave', function() {
          // Reset this element if not selected
          if (this !== selectedZone) {
            d3.select(this).attr('stroke', '#d0d0d0').attr('stroke-width', 1);
          }
          if (activeZonePath === this) {
            activeZonePath = null;
          }
          tip.style('opacity', 0);
        })
        .on('click', function(ev, d) {
          // Deselect previous
          if (selectedZone && selectedZone !== this) {
            d3.select(selectedZone).attr('stroke', '#d0d0d0').attr('stroke-width', 1);
          }

          // Toggle selection
          if (selectedZone === this) {
            selectedZone = null;
            d3.select(this).attr('stroke', '#d0d0d0').attr('stroke-width', 1);
            updateInfoPanel(null, null, null);
          } else {
            selectedZone = this;
            d3.select(this).attr('stroke', '#0E2A47').attr('stroke-width', 3).raise();
            const zone = d.properties.zone;
            const v = DATA.mapData.get(zone);
            updateInfoPanel(zone, v, d);
          }
        });

    // Also reset when mouse leaves the entire SVG
    mapSvg.on('mouseleave', function() {
      resetHighlight();
      tip.style('opacity', 0);
    });

    // Initialize info panel
    updateInfoPanel(null, null, null);
  }

  function formatMapValue(x) {
    if (!Number.isFinite(x)) return 'n/a';
    return mapMode === 'share' ? x.toFixed(2) : Math.round(x).toLocaleString('fr-FR');
  }

  function currentMapMetric(v) {
    if (mapCat === 'ai') return mapMode === 'total' ? v.ia : v.ia_rel;
    return mapMode === 'total' ? v.gen : v.gen_rel;
  }

  function fillValue(feature) {
    const v = DATA.mapData.get(feature.properties.zone);
    if (!v) return '#ccc';
    let x = currentMapMetric(v);
    if (!Number.isFinite(x)) return '#ccc';
    if (mapMode === 'share') x = x * shareScaleFactor;
    return colorScale(x);
  }

  function paletteForMode() {
    if (mapCat === 'ai') return d3.interpolateReds;
    return d3.interpolateBlues;
  }

  function updateColorScale() {
    const raw = DATA.zonesFC.features.map(f => {
      const v = DATA.mapData.get(f.properties.zone);
      return v ? currentMapMetric(v) : NaN;
    }).filter(Number.isFinite);

    if (!raw.length) {
      shareScaleFactor = 1;
      colorScale = d3.scaleSequential(paletteForMode()).domain([0, 1]).clamp(true);
      return;
    }

    const isShare = mapMode === 'share';
    const maxAbs = d3.max(raw.map(Math.abs)) || 0;
    shareScaleFactor = (isShare && maxAbs <= 1) ? 100 : 1;

    const vals = raw.map(x => x * shareScaleFactor);
    let min = d3.min(vals);
    let max = d3.max(vals);

    if (!(isFinite(min) && isFinite(max))) { min = 0; max = 1; }
    if (min === max) {
      const eps = (min === 0) ? 1 : Math.abs(min) * 0.01;
      min = min - eps / 2;
      max = max + eps / 2;
    }

    colorScale = d3.scaleSequential(paletteForMode()).domain([min, max]).clamp(true);
  }

  function recolorMap() {
    updateColorScale();
    updateMapLegend();
    if (zonePaths) zonePaths.attr('fill', d => fillValue(d));
  }

  function legendTickFormat(x) {
    const isShare = mapMode === 'share';
    if (isShare && shareScaleFactor === 100) return d3.format('.1f')(x) + '%';
    if (isShare) return d3.format('.3f')(x);
    if (x >= 1000) return d3.format('~s')(x);
    return d3.format(',')(x);
  }

  function initMapLegend() {
    const container = document.getElementById('ai-mapLegend');
    if (!container) return;

    const W = Math.min(container.clientWidth || 600, 1000);
    const H = 48, PAD = { l: 14, r: 14, t: 8, b: 20 };

    legendSvg = d3.select('#ai-mapLegend')
      .append('svg')
      .attr('width', W)
      .attr('height', H);

    const defs = legendSvg.append('defs');
    legendGradient = defs.append('linearGradient')
      .attr('id', 'aiLegendGradient')
      .attr('x1', '0%').attr('x2', '100%');

    legendSvg.append('rect')
      .attr('x', PAD.l)
      .attr('y', PAD.t)
      .attr('height', 12)
      .attr('rx', 2)
      .attr('width', W - PAD.l - PAD.r)
      .attr('fill', 'url(#aiLegendGradient)');

    legendScale = d3.scaleLinear().range([PAD.l, W - PAD.r]);

    legendSvg.append('g')
      .attr('class', 'legendAxis')
      .attr('transform', `translate(0, ${PAD.t + 12})`);
  }

  function updateMapLegend() {
    if (!legendSvg) initMapLegend();
    if (!colorScale) return;

    const [d0, d1] = colorScale.domain();
    legendScale.domain([d0, d1]);
    legendSvg.select('.legendAxis').call(
      d3.axisBottom(legendScale).ticks(6).tickFormat(legendTickFormat)
    );

    const interp = paletteForMode();
    const stops = d3.range(0, 1.0001, 0.1);
    legendGradient.selectAll('stop').remove();
    legendGradient.selectAll('stop')
      .data(stops)
      .enter().append('stop')
        .attr('offset', d => (d * 100) + '%')
        .attr('stop-color', d => interp(d));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP 10 BAR CHART (ECharts)
  // ═══════════════════════════════════════════════════════════════════════════

  function buildTop10Chart() {
    const container = document.getElementById('ai-mapTop10');
    if (!container) return;

    // Initialize ECharts if not already
    if (!top10Chart) {
      // Check if ECharts is available (loaded via CDN in the page)
      if (typeof echarts === 'undefined') {
        console.warn('ECharts not available for top 10 chart');
        return;
      }
      top10Chart = echarts.init(container, null, { renderer: 'canvas' });
    }

    // Get top 10 zones based on current category (use relative values: per 10,000 offers)
    const zones = [];
    DATA.mapData.forEach((v, zone) => {
      // ia_rel and gen_rel are percentages, multiply by 100 to get per 10,000
      const relValue = mapCat === 'ai' ? v.ia_rel : v.gen_rel;
      const valuePer10k = Number.isFinite(relValue) ? relValue * 10000 : 0;
      if (valuePer10k > 0) {
        zones.push({ zone, value: valuePer10k });
      }
    });

    // Sort descending and take top 10
    zones.sort((a, b) => b.value - a.value);
    const top10 = zones.slice(0, 10);

    // Prepare data for horizontal bar chart (reversed for bottom-to-top display)
    const labels = top10.map(d => d.zone).reverse();
    const values = top10.map(d => d.value).reverse();

    // Determine labels
    const catLabel = mapCat === 'ai' ? 'IA' : 'IA Générative';

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: `Offres ${catLabel}`,
        subtext: 'pour 10 000 offres',
        left: 'center',
        top: 0,
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 12,
          fontWeight: 600,
          color: '#0E2A47'
        },
        subtextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10,
          color: '#55657D'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#D5DDE8',
        borderWidth: 1,
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          color: '#0E1320',
          fontSize: 11
        },
        formatter: function(params) {
          const p = params[0];
          const formattedValue = p.value.toFixed(1);
          return `<strong>${p.name}</strong><br/>${catLabel}: <strong>${formattedValue}</strong> pour 10 000 offres`;
        }
      },
      grid: {
        left: 10,
        right: 35,
        top: 50,
        bottom: 25,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 9,
          formatter: v => v.toFixed(0)
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 9,
          width: 120,
          overflow: 'truncate',
          color: '#0E2A47'
        },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        data: values,
        itemStyle: {
          color: mapCat === 'ai'
            ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#E46A4E' },
                { offset: 1, color: '#C4523A' }
              ])
            : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#5F84E8' },
                { offset: 1, color: '#0E2A47' }
              ]),
          borderRadius: [0, 4, 4, 0]
        },
        barWidth: '65%',
        label: {
          show: true,
          position: 'right',
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 9,
          color: '#55657D',
          formatter: p => p.value.toFixed(1)
        }
      }]
    };

    top10Chart.setOption(option, true);
  }

  // Handle resize for top 10 chart
  window.addEventListener('resize', () => {
    if (top10Chart) top10Chart.resize();
  });

  window.toggleMapTotalShare = function() {
    mapMode = mapMode === 'total' ? 'share' : 'total';
    const btn = document.getElementById('btnMapMode');
    const lbl = document.getElementById('lblMapMode');
    if (btn) btn.classList.toggle('active', mapMode === 'share');
    if (lbl) lbl.textContent = mapMode === 'total' ? 'Total' : 'Part';
    recolorMap();
    // Top 10 chart always shows totals, no need to rebuild
  };

  window.toggleMapAiGen = function() {
    mapCat = mapCat === 'ai' ? 'gen' : 'ai';
    const btn = document.getElementById('btnMapCat');
    const lbl = document.getElementById('lblMapCat');
    if (btn) btn.classList.toggle('active', mapCat === 'gen');
    if (lbl) lbl.textContent = mapCat === 'gen' ? 'IA Générative' : 'IA';
    recolorMap();
    buildTop10Chart();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  window.scrollToAISection = function(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CSV DOWNLOAD FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function downloadCSV(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  window.downloadOffersCSV = function() {
    const headers = ['Date', 'IA Générative', 'IA Générale', 'Vision par Ordinateur', 'NLP'];
    const isShare = offersMode === 'share';
    const gen = isShare ? DATA.shareGen : DATA.totalGen;
    const ai = isShare ? DATA.shareAI : DATA.totalAI;
    const cv = isShare ? DATA.shareCV : DATA.totalCV;
    const nlp = isShare ? DATA.shareNLP : DATA.totalNLP;

    let csv = headers.join(',') + '\n';
    DATA.dateLabels.forEach((date, i) => {
      csv += `${date},${gen[i] ?? ''},${ai[i] ?? ''},${cv[i] ?? ''},${nlp[i] ?? ''}\n`;
    });

    downloadCSV(`offres_ia_${isShare ? 'share' : 'total'}_${today()}.csv`, csv);
  };

  window.downloadSectorsCSV = function() {
    const isShare = secMode === 'share';
    const isGen = secCat === 'gen';
    const ind = isShare ? (isGen ? DATA.indShGen : DATA.indShNon) : (isGen ? DATA.indTotGen : DATA.indTotNon);
    const serv = isShare ? (isGen ? DATA.servShGen : DATA.servShNon) : (isGen ? DATA.servTotGen : DATA.servTotNon);

    let csv = 'Date,Industrie,Services\n';
    DATA.qLabels.forEach((date, i) => {
      csv += `${date},${ind[i] ?? ''},${serv[i] ?? ''}\n`;
    });

    downloadCSV(`secteurs_${isGen ? 'gen' : 'nongen'}_${isShare ? 'share' : 'total'}_${today()}.csv`, csv);
  };

  window.downloadSectorEvolCSV = function() {
    const dates = evolType === 'gen' ? DATA.evolDatesGen : DATA.evolDates;
    const datasets = evolType === 'ai' ? DATA.evolAI : (evolType === 'gen' ? DATA.evolGen : DATA.evolAll);

    if (!datasets.length) return;

    const headers = ['Date', ...datasets.map(ds => ds.label)];
    let csv = headers.join(',') + '\n';

    dates.forEach((date, i) => {
      const row = [date, ...datasets.map(ds => ds.data[i] ?? '')];
      csv += row.join(',') + '\n';
    });

    downloadCSV(`evolution_sectorielle_${evolType}_${today()}.csv`, csv);
  };

  window.downloadSizeCSV = function() {
    const data = sizeCat === 'ai' ? DATA.sizeAi : DATA.sizeGen;
    let csv = 'Taille,Valeur\n';
    DATA.sizeLabels.forEach((label, i) => {
      csv += `"${label}",${data[i] ?? ''}\n`;
    });

    downloadCSV(`taille_entreprise_${sizeCat}_${today()}.csv`, csv);
  };

  window.downloadMetierCSV = function() {
    const isIA = metierMode === 'ia';
    const dates = isIA ? DATA.metierDates : DATA.metierDatesData;
    const datasets = isIA ? DATA.metierIA : DATA.metierData;

    if (!datasets.length) return;

    const headers = ['Date', ...datasets.map(ds => ds.label)];
    let csv = headers.join(',') + '\n';

    dates.forEach((date, i) => {
      const row = [date, ...datasets.map(ds => ds.data[i] ?? '')];
      csv += row.join(',') + '\n';
    });

    downloadCSV(`metiers_${isIA ? 'ia' : 'data'}_${today()}.csv`, csv);
  };

  window.downloadSkillsCSV = function() {
    const dates = DATA.skillsDates[skillsType];
    const datasets = DATA.skillsSets[skillsType];

    if (!datasets.length) return;

    const headers = ['Date', ...datasets.map(ds => ds.label)];
    let csv = headers.join(',') + '\n';

    dates.forEach((date, i) => {
      const row = [date, ...datasets.map(ds => ds.data[i] ?? '')];
      csv += row.join(',') + '\n';
    });

    downloadCSV(`competences_${skillsType}_${today()}.csv`, csv);
  };

  window.downloadMapCSV = function() {
    let csv = 'Zone,IA Total,IA Part (%),IA Gen Total,IA Gen Part (%),Total Offres\n';

    DATA.mapData.forEach((v, zone) => {
      csv += `"${zone}",${v.ia ?? ''},${v.ia_rel ?? ''},${v.gen ?? ''},${v.gen_rel ?? ''},${v.total_offers ?? ''}\n`;
    });

    downloadCSV(`carte_zones_emploi_${today()}.csv`, csv);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    setupChartDefaults();
    await loadHome();

    try {
      // Offers
      const tot = await loadOffersFile('offers_total.csv');
      const sha = await loadOffersFile('offers_share.csv');
      const n = Math.max(tot.n, sha.n);

      DATA.dateLabels = Array.from({ length: n }, (_, i) => monthLabel(i));
      DATA.totalGen = padTo(tot.gen, n);
      DATA.totalAI = padTo(tot.ai, n);
      DATA.totalCV = padTo(tot.cv, n);
      DATA.totalNLP = padTo(tot.nlp, n);
      DATA.shareGen = padTo(sha.gen, n);
      DATA.shareAI = padTo(sha.ai, n);
      DATA.shareCV = padTo(sha.cv, n);
      DATA.shareNLP = padTo(sha.nlp, n);
      buildOffers();

      // Sectors
      await loadTwoSectors('two_sectors_total_ia.csv', true, DATA.indTotGen, DATA.servTotGen);
      await loadTwoSectors('two_sectors_total_iagen.csv', false, DATA.indTotNon, DATA.servTotNon);
      await loadTwoSectors('two_sectors_share_ia.csv', false, DATA.indShGen, DATA.servShGen);
      await loadTwoSectors('two_sectors_share_iagen.csv', false, DATA.indShNon, DATA.servShNon);
      buildSectors();

      // Sector evolution
      await loadEvol('share_sector_ia.csv', DATA.evolAI, DATA.evolDates);
      await loadEvol('share_sector_iagen.csv', DATA.evolGen, DATA.evolDatesGen);
      await loadEvol('share_sector_total_offers.csv', DATA.evolAll, DATA.evolDates);
      buildEvol();

      // Size
      parseCsv(await fetchCsv(CONFIG.dataPath + 'distrib_size.csv')).forEach(r => {
        DATA.sizeLabels.push(r[1]);   // Company_Category (GE/ETI/PME)
        DATA.sizeAi.push(+r[3]);      // share_pct_ai
        DATA.sizeGen.push(+r[2]);     // share_pct_genai
      });
      buildSize();

      // Metiers
      await loadMetier('metier_area_ia.csv', DATA.metierIA, DATA.metierDates);
      await loadMetier('metier_area_data.csv', DATA.metierData, DATA.metierDatesData);
      buildMetier();

      // Skills
      await loadSkills('evolution_ml_library_skills.csv', 'ml_library');
      await loadSkills('evolution_method_skills.csv', 'method_skills');
      await loadSkills('evolution_broad_skills.csv', 'broad_skills');
      buildSkills();

      // Map
      await loadFranceMap();

      // Amenities
      await loadAmenities();
      buildAmenities();

    } catch (err) {
      console.error('Error during dashboard load:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AMENITIES (Conditions de travail)
  // ═══════════════════════════════════════════════════════════════════════════

  let amenitiesChart = null;
  let amenitiesMode = 'share';

  const AMENITY_LABELS = {
    'REMUNERATION_BENEFITS':      'Rémunération & avantages',
    'DIVERSITY':                  'Diversité',
    'WORK_LIFE_BALANCE':          'Équilibre vie pro/perso',
    'LEADERSHIP':                 'Leadership',
    'CULTURE_VALUES':             'Culture & valeurs',
    'PROFESSIONAL_OPPORTUNITIES': 'Opportunités professionnelles'
  };

  const AMENITY_COLORS = [
    '#E46A4E',  // coral       – Rémunération
    '#3B82F6',  // blue        – Diversité
    '#16A34A',  // green       – Équilibre
    '#9333EA',  // purple      – Leadership
    '#F59E0B',  // amber       – Culture
    '#06B6D4',  // cyan        – Opportunités
  ];

  async function loadAmenities() {
    const txt = await fetchCsv(CONFIG.dataPath + 'amenities.csv');
    const rows = Papa.parse(txt, { header: true, skipEmptyLines: true }).data;

    const dateSet = new Set();
    rows.forEach(r => dateSet.add(`${r.year}-${String(r.month).padStart(2, '0')}`));
    DATA.amenitiesDates = Array.from(dateSet).sort();

    DATA.amenitiesData = {};
    rows.forEach(r => {
      const cat = r.class_label;
      if (!DATA.amenitiesData[cat]) DATA.amenitiesData[cat] = {};
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
      DATA.amenitiesData[cat][key] = {
        share: parseFloat(r.share_class_1) * 100,
        total: parseInt(r.n_class_1)
      };
    });
  }

  function buildAmenities() {
    const ctx = document.getElementById('ai-amenitiesChart');
    if (!ctx) return;

    const categories = Object.keys(AMENITY_LABELS);
    const datasets = categories.map((cat, i) => ({
      label: AMENITY_LABELS[cat],
      data: DATA.amenitiesDates.map(d => DATA.amenitiesData[cat]?.[d]?.[amenitiesMode] ?? null),
      borderColor: AMENITY_COLORS[i],
      backgroundColor: AMENITY_COLORS[i] + '18',
      borderWidth: 2.5,
      fill: false,
      tension: 0.3,
      spanGaps: true
    }));

    amenitiesChart = new Chart(ctx, {
      type: 'line',
      data: { labels: DATA.amenitiesDates, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 16,
              maxRotation: 45,
              autoSkip: true
            }
          },
          y: {
            ticks: {
              callback: v => amenitiesMode === 'share'
                ? v.toFixed(1) + ' %'
                : v.toLocaleString('fr-FR')
            }
          }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  window.toggleAmenMode = function() {
    amenitiesMode = amenitiesMode === 'share' ? 'total' : 'share';
    const lbl = document.getElementById('lblAmenMode');
    if (lbl) lbl.textContent = amenitiesMode === 'share' ? 'Part (%)' : 'Total';
    const btn = document.getElementById('btnAmenMode');
    if (btn) btn.classList.toggle('active', amenitiesMode === 'total');

    const categories = Object.keys(AMENITY_LABELS);
    amenitiesChart.data.datasets.forEach((ds, i) => {
      const cat = categories[i];
      ds.data = DATA.amenitiesDates.map(d => DATA.amenitiesData[cat]?.[d]?.[amenitiesMode] ?? null);
    });
    amenitiesChart.options.scales.y.ticks.callback = v => amenitiesMode === 'share'
      ? v.toFixed(1) + ' %'
      : v.toLocaleString('fr-FR');
    amenitiesChart.update();
  };

  window.downloadAmenitiesCSV = function() {
    const lines = ['Date,Catégorie,Part (%),Total'];
    DATA.amenitiesDates.forEach(d => {
      Object.entries(AMENITY_LABELS).forEach(([cat, label]) => {
        const v = DATA.amenitiesData[cat]?.[d];
        if (v) lines.push(`${d},"${label}",${v.share.toFixed(4)},${v.total}`);
      });
    });
    downloadCSV(`conditions_travail_ia_${today()}.csv`, lines.join('\n'));
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
