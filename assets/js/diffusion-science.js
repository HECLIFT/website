// =============================================================================
// Diffusion IA (science) — données chargées depuis les CSV
// data/ai-trackers/diffusion-science/*.csv  (éditer le CSV = mettre à jour le tracker)
// =============================================================================

function getBasePath() {
  const m = window.location.pathname.match(/^(.*?)\/ai-trackers\/diffusion-science/);
  return m ? m[1] : '';
}
const CONFIG = { dataPath: getBasePath() + '/data/ai-trackers/diffusion-science/' };

// --- CSV parser (quote-aware) + reconstruction de D / ipcShareData ----------
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}
function records(text) {
  const r = parseCSV(text); const h = r[0];
  return r.slice(1).map(row => Object.fromEntries(h.map((k, i) => [k, row[i]])));
}
const N = v => Number(v);

function buildData(F) {
  const D = {};
  D.patents_by_year = records(F['brevets_by_year.csv']).map(r => ({
    year:N(r.annee), total:N(r.brevets_total), ai_total:N(r.brevets_ia),
    ai_observed:N(r.ia_observes), ai_predicted:N(r.ia_predits), ai_share:N(r.part_ia_pct) }));
  D.ctry_data = records(F['pays.csv']).map(r => ({
    code:r.code_pays, ai:N(r.brevets_ia_pondere), total:N(r.brevets_total_pondere),
    share:N(r.part_ia_pct), name:r.pays }));
  D.ipc4_data = records(F['ipc4.csv']).map(r => ({
    ipc4:r.ipc4, ai:N(r.brevets_ia), total:N(r.brevets_total), share:N(r.part_ia_pct), label:r.domaine }));
  D.pubs_by_year = records(F['publications.csv']).map(r => ({
    year:N(r.annee), mapped:N(r.publications_mappees), cited:N(r.publications_citees) }));
  D.topics_data = records(F['topics.csv']).map(r => ({ topic:r.topic, count:N(r.count) }));

  const ser = records(F['ipc4_series.csv']);
  const years = []; const series = {};
  ser.forEach(r => { const y = N(r.annee); if (!years.includes(y)) years.push(y);
    (series[r.ipc4] = series[r.ipc4] || []).push(N(r.brevets_ia)); });
  D.ipc4_years = years; D.ipc4_series = series;

  D.ipc4_top8 = D.ipc4_data.slice(0, 8).map(r => r.ipc4);
  D.ipc4_top8_no_g06 = D.ipc4_data.filter(r => !r.ipc4.startsWith('G06')).slice(0, 8).map(r => r.ipc4);

  const sh = records(F['ipc4_share_series.csv']);
  const ipcShareData = {};
  sh.forEach(r => { (ipcShareData[r.ipc4] = ipcShareData[r.ipc4] || []).push(N(r.part_pct)); });
  return { D, ipcShareData };
}

// Données (peuplées par init())
let D = null;
let ipcShareData = null;

function show(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  setTimeout(() => {
    const section = document.getElementById(id);
    section.querySelectorAll('[id^="ch-"]').forEach(el => {
      if (el._fullLayout) Plotly.Plots.resize(el);
    });
    window.dispatchEvent(new Event('resize'));
  }, 50);
}

// Palette unifiée
const P = {
  blue:   '#104e8b',  // bleu marine — barres principales
  amber:  '#c4622d',  // ambre rouille — lignes de part/ratio
  teal:   '#1a7a6a',  // vert-bleu — pays, publications
  blue2:  '#6ea8d4',  // bleu clair — barres secondaires (prédits)
  gray:   '#94a3b8',  // gris acier — séries neutres
  multi:  ['#104e8b','#c4622d','#1a7a6a','#7a4f9c','#3a8ec1','#d4904a','#2b6e50','#9b5068'],
};
function h2r(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

const L0 = (extra) => Object.assign({
  margin: {l:55,r:20,t:20,b:50},
  paper_bgcolor:'#fff', plot_bgcolor:'#fff',
  font: {family:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', size:12, color:'#374151'},
  xaxis: {showgrid:false, zeroline:false},
  yaxis: {showgrid:true, gridcolor:'#f3f4f6', zeroline:false},
  legend: {orientation:'h', y:-0.18, x:0.5, xanchor:'center'},
}, extra || {});

const cfg = {responsive:true, displayModeBar:false};

// Technologie — libellés / couleurs
const ipcColors = P.multi;
const ipcWords = {
  "G06F": "Traitement electronique de donnees", "G06N": "Informatique cognitive et IA",
  "G10L": "Traitement de la parole", "G06T": "Traitement image et video",
  "G06V": "Reconnaissance visuelle", "G06K": "Reconnaissance de formes",
  "H04L": "Transmission de donnees", "G06Q": "Gestion et commerce",
  "A61B": "Instruments medicaux", "G05B": "Systemes de controle",
  "H04N": "Transmission image", "G01N": "Analyse chimique",
  "G16H": "Informatique medicale", "H04M": "Telephonie"
};

let excludeG06 = false;

function renderIpcCharts() {
  const ipcLabelMap = Object.fromEntries(D.ipc4_data.map(r => [r.ipc4, r.label]));
  const isG06 = ipc => ipc.startsWith('G06');
  const iD = excludeG06 ? D.ipc4_data.filter(r => !isG06(r.ipc4)) : D.ipc4_data;
  const top8 = excludeG06 ? D.ipc4_top8_no_g06 : D.ipc4_top8;
  const colorMap = Object.fromEntries(top8.map((ipc,i) => [ipc, ipcColors[i]]));

  Plotly.react('ch-ipc-combo', [
    {x:iD.map(r=>r.label), y:iD.map(r=>r.ai), type:'bar', name:'Brevets IA', marker:{color:P.blue,opacity:0.85}, yaxis:'y', hovertemplate:'<b>%{x}</b><br>Brevets IA : %{y}<extra></extra>'},
    {x:iD.map(r=>r.label), y:iD.map(r=>r.share), type:'scatter', mode:'markers+lines', name:'% IA dans groupe', marker:{color:P.amber,size:8}, line:{color:P.amber,width:1.5,dash:'dot'}, yaxis:'y2', hovertemplate:'%{x}: <b>%{y:.1f}%</b> du groupe<extra></extra>'}
  ], L0({margin:{l:55,r:70,t:20,b:160},
    yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Brevets IA'},
    yaxis2:{title:'% IA dans le groupe',overlaying:'y',side:'right',showgrid:false,ticksuffix:'%'},
    xaxis:{showgrid:false,zeroline:false,tickangle:-45},
    legend:{y:-0.28}}), cfg);

  Plotly.react('ch-ipc-time',
    top8.map(ipc => ({
      x:D.ipc4_years, y:D.ipc4_series[ipc], type:'scatter', mode:'lines',
      name: ipcLabelMap[ipc] || ipc,
      line:{color:colorMap[ipc]||'#888',width:2},
      hovertemplate:(ipcLabelMap[ipc]||ipc) + ' %{x}: <b>%{y}</b><extra></extra>'
    })),
    L0({yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Brevets IA'},
        legend:{orientation:'h', y:-0.22, x:0.5, xanchor:'center', font:{size:10}}}), cfg
  );

  // Normalise shares for filtered set
  const shareTraces = top8.map(ipc => {
    let yVals;
    if (excludeG06) {
      yVals = D.ipc4_years.map((_,yi) => {
        const tot = top8.reduce((s,k) => s + (D.ipc4_series[k][yi]||0), 0);
        return tot > 0 ? (D.ipc4_series[ipc][yi]||0) / tot * 100 : 0;
      });
    } else {
      yVals = ipcShareData[ipc];
    }
    return {
      x: D.ipc4_years, y: yVals, type:'scatter', mode:'lines', stackgroup:'one',
      name: ipcWords[ipc] || ipc,
      line:{color:colorMap[ipc]||'#888',width:0.5},
      fillcolor:h2r(colorMap[ipc]||'#888888',0.72),
      hovertemplate:(ipcWords[ipc]||ipc)+' %{x}: <b>%{y:.1f}%</b><extra></extra>'
    };
  });
  Plotly.react('ch-ipc-share-time', shareTraces,
    L0({
      yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'% des brevets IA',ticksuffix:'%',range:[0,105]},
      legend:{orientation:'h',y:-0.25,x:0.5,xanchor:'center',font:{size:10}},
      margin:{l:65,r:20,t:20,b:80}
    }), cfg
  );
}

window.toggleG06 = function(btn) {
  excludeG06 = !excludeG06;
  btn.textContent = excludeG06 ? '+ Inclure G06*' : '− Exclure G06*';
  btn.classList.toggle('ds-btn-active', excludeG06);
  renderIpcCharts();
};

// =============================================================================
// Rendu (appelé après chargement des CSV)
// =============================================================================
function renderAll() {
  const PY = D.patents_by_year;
  const years = PY.map(r => r.year);
  const aiTot = PY.map(r => r.ai_total);
  const aiObs = PY.map(r => r.ai_observed);
  const aiPred = PY.map(r => r.ai_predicted);
  const share = PY.map(r => r.ai_share);
  const total = PY.map(r => r.total);

  // KPIs
  const lastYear = PY[PY.length-2];
  const totalAI = PY.reduce((a,r) => a+r.ai_total, 0);
  document.getElementById('kpi-row').innerHTML = `
    <div class="kpi"><div class="val">${totalAI.toLocaleString('fr-FR')}</div><div class="lbl">Brevets IA<br>1990–2024</div></div>
    <div class="kpi"><div class="val">${lastYear.ai_total.toLocaleString('fr-FR')}</div><div class="lbl">Brevets IA<br>${lastYear.year}</div><div class="sub">${lastYear.ai_share.toFixed(2)}% du corpus</div></div>
    <div class="kpi"><div class="val">${D.ctry_data[0].name}</div><div class="lbl">1er pays (inventeurs)<br>pondéré REGPAT</div><div class="sub">${Math.round(D.ctry_data[0].ai).toLocaleString('fr-FR')} brevets IA</div></div>
    <div class="kpi"><div class="val">Informatique cognitive / IA</div><div class="lbl">IPC4 le plus IA<br>par intensité</div><div class="sub">24,8% du groupe</div></div>
    <div class="kpi"><div class="val">${D.pubs_by_year.reduce((a,r)=>a+r.mapped,0).toLocaleString('fr-FR')}</div><div class="lbl">Publications IA<br>mappées (cumulé)</div></div>
  `;

  // Vue d'ensemble
  Plotly.newPlot('ch-overview-patents', [
    {x:years, y:aiTot, type:'bar', name:'Brevets IA', marker:{color:P.blue,opacity:0.88}, hovertemplate:'%{x}: <b>%{y}</b><extra></extra>'}
  ], L0({yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Brevets IA'}}), cfg);

  Plotly.newPlot('ch-overview-share', [
    {x:years, y:share, type:'scatter', mode:'lines+markers', line:{color:P.amber,width:2.5}, marker:{size:4, color:P.amber}, hovertemplate:'%{x}: <b>%{y:.3f}%</b><extra></extra>'}
  ], L0({yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'% brevets IA',ticksuffix:'%'}}), cfg);

  const top10c = D.ctry_data.slice(0,10);
  Plotly.newPlot('ch-overview-ctry', [
    {y:top10c.map(r=>r.name).reverse(), x:top10c.map(r=>r.ai).reverse(), type:'bar', orientation:'h', marker:{color:P.teal,opacity:0.88}, hovertemplate:'<b>%{y}</b>: %{x:.0f}<extra></extra>'}
  ], L0({margin:{l:120,r:20,t:20,b:50}, xaxis:{title:'Brevets IA pondérés',showgrid:true,gridcolor:'#f3f4f6',zeroline:false}, yaxis:{showgrid:false}}), cfg);

  const top10i = D.ipc4_data.slice(0,10);
  Plotly.newPlot('ch-overview-ipc', [
    {y:top10i.map(r=>r.label).reverse(), x:top10i.map(r=>r.ai).reverse(), type:'bar', orientation:'h', marker:{color:P.blue,opacity:0.88}, hovertemplate:'<b>%{y}</b>: %{x} brevets IA (%{customdata:.1f}%)<extra></extra>', customdata:top10i.map(r=>r.share).reverse()}
  ], L0({margin:{l:175,r:20,t:20,b:50}, xaxis:{title:'Brevets IA',showgrid:true,gridcolor:'#f3f4f6',zeroline:false}, yaxis:{showgrid:false, tickfont:{size:10}}}), cfg);

  // Brevets
  Plotly.newPlot('ch-patents-stacked', [
    {x:years, y:aiObs, type:'bar', name:'Observés (NPL→OpenAlex)', marker:{color:P.blue}, hovertemplate:'%{x}: <b>%{y}</b> observés<extra></extra>'},
    {x:years, y:aiPred.map((v,i)=>Math.max(0,v-aiObs[i])), type:'bar', name:'Prédits ML uniquement', marker:{color:P.blue2}, hovertemplate:'%{x}: <b>%{y}</b> prédits<extra></extra>'}
  ], L0({barmode:'stack', yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Brevets IA'}}), cfg);

  Plotly.newPlot('ch-patents-share', [
    {x:years, y:share, type:'scatter', mode:'lines', fill:'tozeroy', fillcolor:h2r(P.amber,0.1), line:{color:P.amber,width:2.5}, hovertemplate:'%{x}: <b>%{y:.3f}%</b><extra></extra>'}
  ], L0({showlegend:false, margin:{l:55,r:20,t:20,b:30}, yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'%',ticksuffix:'%'}}), cfg);

  Plotly.newPlot('ch-patents-total', [
    {x:years, y:total, type:'scatter', mode:'lines', name:'Total brevets EP', line:{color:P.gray,width:1.5}, fill:'tozeroy', fillcolor:h2r(P.gray,0.1), hovertemplate:'%{x}: <b>%{y}</b> brevets<extra></extra>'},
    {x:years, y:aiTot, type:'scatter', mode:'lines', name:'Brevets IA', line:{color:P.blue,width:2.5}, hovertemplate:'%{x}: <b>%{y}</b> IA<extra></extra>'}
  ], L0({margin:{l:55,r:20,t:20,b:30}, legend:{orientation:'h', y:1, yanchor:'bottom', x:0.5, xanchor:'center', font:{size:11}}, yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Nombre de brevets'}}), cfg);

  // Géographie
  const cd = D.ctry_data;
  Plotly.newPlot('ch-geo-bar', [
    {y:cd.map(r=>r.name).reverse(), x:cd.map(r=>r.ai).reverse(), type:'bar', orientation:'h',
      marker:{
        color:cd.map(r=>r.share).reverse(),
        colorscale:[[0,'#e4f0f9'],[0.5,'#4a8fc1'],[1,'#0d3a6b']],
        showscale:true,
        colorbar:{title:'% IA',ticksuffix:'%',len:0.6,thickness:12}
      },
      hovertemplate:'<b>%{y}</b><br>Brevets IA : %{x:.1f}<br>Share IA : %{customdata:.2f}%<extra></extra>',
      customdata:cd.map(r=>r.share).reverse()}
  ], L0({margin:{l:130,r:80,t:10,b:50}, xaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Brevets IA pondérés (REGPAT)'}, yaxis:{showgrid:false}}), cfg);

  Plotly.newPlot('ch-geo-scatter', [
    {x:cd.map(r=>r.total), y:cd.map(r=>r.share), mode:'markers+text', type:'scatter',
      text:cd.map(r=>r.code), textposition:'top center', textfont:{size:10},
      marker:{size:cd.map(r=>Math.sqrt(r.ai)*3.5+6), color:P.blue, opacity:0.72, line:{color:'white',width:1}},
      customdata:cd.map(r=>r.ai),
      hovertemplate:'<b>%{text}</b><br>Brevets IA : %{customdata:.1f}<br>Total : %{x:.0f} · Share IA : %{y:.2f}%<extra></extra>'}
  ], L0({margin:{l:55,r:20,t:20,b:50}, xaxis:{showgrid:false,zeroline:false,title:'Brevets totaux pondérés (log)',type:'log'}, yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Share IA (%)',ticksuffix:'%'}}), cfg);

  // Technologie
  renderIpcCharts();

  // Publications
  const PB = D.pubs_by_year;
  Plotly.newPlot('ch-pubs-year', [
    {x:PB.map(r=>r.year), y:PB.map(r=>r.mapped), type:'bar', name:'Mappées (primary topic IA)', marker:{color:P.teal,opacity:0.85}, hovertemplate:'%{x}: <b>%{y}</b> mappées<extra></extra>'},
    {x:PB.map(r=>r.year), y:PB.map(r=>r.cited), type:'scatter', mode:'lines', name:'Citées (corpus OpenAlex)', line:{color:P.gray,width:1.5,dash:'dash'}, yaxis:'y2', hovertemplate:'%{x}: <b>%{y}</b> citées<extra></extra>'}
  ], L0({margin:{l:55,r:70,t:20,b:50},
    yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Publications mappées'},
    yaxis2:{title:'Publications citées',overlaying:'y',side:'right',showgrid:false}}), cfg);

  const TD = D.topics_data.slice().reverse();
  Plotly.newPlot('ch-topics', [
    {y:TD.map(r=>r.topic), x:TD.map(r=>r.count), type:'bar', orientation:'h',
      marker:{color:TD.map((r,i)=>h2r(P.blue, 0.30+(i/(TD.length-1))*0.62))},
      hovertemplate:'<b>%{y}</b><br>%{x} publications<extra></extra>'}
  ], L0({margin:{l:260,r:20,t:10,b:50}, xaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Publications IA (cumulé)'}, yaxis:{showgrid:false}}), cfg);
}

// =============================================================================
// CSV Downloads
// =============================================================================
function _dlCSV(filename, rows) {
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function _today() { return new Date().toISOString().slice(0,10); }

window.downloadPatentsCSV = function() {
  const rows = [['annee','brevets_total','brevets_ia','ia_observes','ia_predits','part_ia_pct']];
  D.patents_by_year.forEach(r => rows.push([r.year, r.total, r.ai_total, r.ai_observed, r.ai_predicted, r.ai_share]));
  _dlCSV(`lift_diffusion_science_brevets_${_today()}.csv`, rows);
};
window.downloadCtryCSV = function() {
  const rows = [['code_pays','pays','brevets_ia_pondere','brevets_total_pondere','part_ia_pct']];
  D.ctry_data.forEach(r => rows.push([r.code, r.name, r.ai, r.total, r.share]));
  _dlCSV(`lift_diffusion_science_pays_${_today()}.csv`, rows);
};
window.downloadIPC4CSV = function() {
  const rows = [['ipc4','domaine','brevets_ia','brevets_total','part_ia_pct']];
  D.ipc4_data.forEach(r => rows.push([r.ipc4, `"${r.label}"`, r.ai, r.total, r.share]));
  _dlCSV(`lift_diffusion_science_ipc4_${_today()}.csv`, rows);
};
window.downloadPubsCSV = function() {
  const rows = [['annee','publications_mappees','publications_citees']];
  D.pubs_by_year.forEach(r => rows.push([r.year, r.mapped, r.cited]));
  _dlCSV(`lift_diffusion_science_publications_${_today()}.csv`, rows);
};
window.downloadTopicsCSV = function() {
  const rows = [['topic','count']];
  D.topics_data.forEach(r => rows.push([`"${r.topic}"`, r.count]));
  _dlCSV(`lift_diffusion_science_topics_${_today()}.csv`, rows);
};

// =============================================================================
// Init — charge les CSV puis rend
// =============================================================================
async function init() {
  const files = ['brevets_by_year.csv','pays.csv','ipc4.csv','publications.csv',
                 'topics.csv','ipc4_series.csv','ipc4_share_series.csv'];
  try {
    const F = {};
    await Promise.all(files.map(async f => {
      const resp = await fetch(CONFIG.dataPath + f);
      if (!resp.ok) throw new Error(`${f}: HTTP ${resp.status}`);
      F[f] = await resp.text();
    }));
    const built = buildData(F);
    D = built.D;
    ipcShareData = built.ipcShareData;
    renderAll();
  } catch (e) {
    console.error('[diffusion-science] échec du chargement des données :', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
