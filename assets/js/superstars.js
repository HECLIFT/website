// Acteurs clés — tracker Diffusion de l'IA (science)
// Données : data/ai-trackers/diffusion-science/superstars.json
// (généré par src/20_build_site_science_tracker.py dans openalex_project).
// Tout le code est dans une fonction pour ne pas entrer en conflit avec
// diffusion-science.js, chargé sur la même page.

function showSS(id, btn) {
  document.querySelectorAll('.ss-main .section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ss-nav .nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

(function () {
  const DATA_URL = (function () {
    const p = window.location.pathname;
    const i = p.indexOf('/ai-trackers/');
    return (i >= 0 ? p.slice(0, i) : '') + '/data/ai-trackers/diffusion-science/superstars.json';
  })();

  const P_SS = {
    blue:  '#104e8b',
    blue2: '#6ea8d4',
    teal:  '#1a7a6a',
    multi: ['#104e8b','#c4622d','#1a7a6a','#7a4f9c','#3a8ec1','#d4904a','#2b6e50','#9b5068','#5a6e85','#8c9c40','#5b4a9c','#c94864','#3d7a6a','#7a5a28','#4a6ca8'],
  };
  const cfg = {responsive:true, displayModeBar:false};
  const L = (extra) => Object.assign({
    margin:{l:200,r:40,t:10,b:40},
    paper_bgcolor:'#fff', plot_bgcolor:'#fff',
    font:{family:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',size:12,color:'#374151'},
    xaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false},
    yaxis:{showgrid:false,zeroline:false,automargin:true},
  }, extra||{});
  const fr = (n) => Number(n).toLocaleString('fr-FR');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function render(SD) {
    const top = SD.applicants.slice(0, 25);
    const inv = SD.inventors.slice(0, 25);

    document.getElementById('ss-kpis').innerHTML = `
      <div class="ss-kpi"><div class="val">${esc(top[0].name)}</div><div class="lbl">N°1 déposant<br>${fr(top[0].patents)} brevets IA</div></div>
      <div class="ss-kpi"><div class="val">${esc(inv[0].name.split(',')[0])}</div><div class="lbl">N°1 inventeur<br>${fr(inv[0].patents)} brevets IA</div></div>
      <div class="ss-kpi"><div class="val">${fr(SD.meta.observed_ai_patents)}</div><div class="lbl">Brevets IA avec<br>publication identifiée</div></div>
      <div class="ss-kpi"><div class="val">${fr(SD.meta.observed_ai_papers)}</div><div class="lbl">Publications IA<br>citées (observées)</div></div>
    `;

    Plotly.newPlot('ch-applicants', [
      {x:top.map(d=>d.equiv).reverse(), y:top.map(d=>d.name).reverse(), type:'bar', orientation:'h', name:'Brevets IA (équivalent fractionné)',
       marker:{color:P_SS.blue,opacity:.88},
       hovertemplate:'<b>%{y}</b><br>Équiv. fractionné : %{x}<extra></extra>'},
      {x:top.map(d=>d.patents).reverse(), y:top.map(d=>d.name).reverse(), type:'bar', orientation:'h', name:'Brevets IA (total brut)',
       marker:{color:P_SS.blue2,opacity:.7},
       hovertemplate:'<b>%{y}</b><br>Total brevets : %{x}<extra></extra>'}
    ], L({barmode:'overlay', legend:{orientation:'h',y:-0.08,x:0.5,xanchor:'center'},
         xaxis:{title:'Nombre de brevets IA',showgrid:true,gridcolor:'#f3f4f6',zeroline:false}}), cfg);

    Plotly.newPlot('ch-inventors', [
      {x:inv.map(d=>d.equiv).reverse(), y:inv.map(d=>d.name).reverse(), type:'bar', orientation:'h', name:'Brevets IA (équivalent fractionné)',
       marker:{color:P_SS.teal,opacity:.88},
       customdata:inv.map(d=>d.patents).reverse(),
       hovertemplate:'<b>%{y}</b><br>Équiv. fractionné : %{x}<br>Brevets : %{customdata}<extra></extra>'}
    ], L({margin:{l:220,r:40,t:10,b:40},
         xaxis:{title:'Brevets IA (pondéré)',showgrid:true,gridcolor:'#f3f4f6',zeroline:false}}), cfg);

    const paperRows = SD.papers.slice(0, 25).map((p, i) => `
      <tr>
        <td class="rank">${i+1}</td>
        <td class="name"><a href="${esc(p.openalex)}" target="_blank" rel="noopener">${esc(p.title)}</a><br><span style="font-size:11px;color:#9ca3af">${p.year ?? ''} · ${esc(p.topic)}</span></td>
        <td class="num" style="text-align:right">${p.citing_patents}</td>
        <td class="num" style="text-align:right">${p.applicants}</td>
        <td class="num" style="text-align:right">${p.cited_by == null ? '–' : fr(p.cited_by)}</td>
      </tr>`).join('');
    document.getElementById('papers-table').innerHTML = `
      <table class="ss-table">
        <thead><tr>
          <th class="rank">#</th>
          <th>Publication</th>
          <th style="text-align:right">Brevets<br>citants</th>
          <th style="text-align:right">Déposants<br>distincts</th>
          <th style="text-align:right">Citations<br>OpenAlex</th>
        </tr></thead>
        <tbody>${paperRows}</tbody>
      </table>`;

    const timeTraces = SD.time_series.map((d, i) => ({
      x: d.years, y: d.equiv, type: 'scatter', mode: 'lines+markers', name: d.name,
      line: {color: P_SS.multi[i % P_SS.multi.length], width: 2},
      marker: {size: 4},
      hovertemplate: `<b>${esc(d.name)}</b><br>%{x} : %{y:.1f} brevets IA<extra></extra>`
    }));
    Plotly.newPlot('ch-timeseries', timeTraces, Object.assign({
      margin:{l:55,r:20,t:10,b:50},
      paper_bgcolor:'#fff', plot_bgcolor:'#fff',
      font:{family:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',size:12,color:'#374151'},
      xaxis:{showgrid:false,zeroline:false,title:'Année'},
      yaxis:{showgrid:true,gridcolor:'#f3f4f6',zeroline:false,title:'Brevets IA (équiv. fractionné)'},
      legend:{orientation:'v',x:1.02,y:1,xanchor:'left'},
      hovermode:'x unified'
    }), cfg);
  }

  async function init() {
    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`superstars.json: HTTP ${resp.status}`);
      render(await resp.json());
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
