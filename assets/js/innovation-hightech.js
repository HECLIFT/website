(function () {
  'use strict';

  // --- Base path detection ---
  function getBasePath() {
    var match = window.location.pathname.match(/^(.*?)\/innovation-data\/innovation-hightech/);
    return match ? match[1] : '';
  }

  var BASE_PATH = getBasePath();
  var DATA_PATH = BASE_PATH + '/data/innovation-data/innovation-hightech/';

  // --- Entity display order ---
  var EU_MODE_ENTITIES = ['EU', 'US', 'CN', 'JP', 'RoW_EU'];
  var EUR_MODE_ENTITIES = ['EUR', 'US', 'CN', 'JP', 'RoW_EUR'];

  // --- Sector emojis ---
  var SECTOR_EMOJIS = {};

  // --- State ---
  var rawData = [];
  var summaryData = null;
  var entitiesData = null;
  var currentSector = null;
  var currentMode = 'EU'; // 'EU' or 'EUR'
  var shareChart = null;
  var countChart = null;
  var hiddenEntities = {};

  // --- Utility functions ---
  function parseCSV(text) {
    var lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    var headers = lines[0].split(',');
    var data = [];
    for (var i = 1; i < lines.length; i++) {
      var values = lines[i].split(',');
      if (values.length !== headers.length) continue;
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j].trim()] = values[j].trim();
      }
      data.push(row);
    }
    return data;
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return Math.round(n).toString();
  }

  function formatNumberFull(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function getDisplayName(entityCode) {
    if (!entitiesData) return entityCode;
    var code = entityCode.replace('_EU', '').replace('_EUR', '');
    if (code === 'RoW') return entitiesData.RoW ? entitiesData.RoW.name : 'Reste du monde';
    return entitiesData[code] ? entitiesData[code].name : entityCode;
  }

  function getEntityColor(entityCode) {
    if (!entitiesData) return '#888888';
    var code = entityCode.replace('_EU', '').replace('_EUR', '');
    if (code === 'RoW') return entitiesData.RoW ? entitiesData.RoW.color : '#888888';
    return entitiesData[code] ? entitiesData[code].color : '#888888';
  }

  function getDisplayEntity(entityCode) {
    // Normalize RoW_EU / RoW_EUR to just RoW for display
    if (entityCode.startsWith('RoW')) return 'RoW';
    return entityCode;
  }

  function showError(msg) {
    var containers = document.querySelectorAll('.iht-chart');
    containers.forEach(function (el) {
      el.innerHTML = '<div class="iht-error">' + msg + '</div>';
    });
  }

  // --- Data loading ---
  async function loadData() {
    try {
      var responses = await Promise.all([
        fetch(DATA_PATH + 'timeseries.csv'),
        fetch(DATA_PATH + 'summary.json'),
        fetch(DATA_PATH + 'entities.json')
      ]);

      if (!responses[0].ok || !responses[1].ok || !responses[2].ok) {
        showError('Erreur de chargement des données.');
        return false;
      }

      var csvText = await responses[0].text();
      rawData = parseCSV(csvText);

      summaryData = await responses[1].json();
      entitiesData = await responses[2].json();

      return true;
    } catch (e) {
      showError('Erreur de chargement : ' + e.message);
      return false;
    }
  }

  // --- Data filtering ---
  function getFilteredData(sector, mode) {
    var entities = mode === 'EUR' ? EUR_MODE_ENTITIES : EU_MODE_ENTITIES;
    var filtered = rawData.filter(function (row) {
      return row.sector === sector && entities.indexOf(row.entity) >= 0;
    });

    // Sort by year
    filtered.sort(function (a, b) {
      return parseInt(a.year) - parseInt(b.year);
    });

    return filtered;
  }

  function getYears(data) {
    var years = [];
    var seen = {};
    data.forEach(function (row) {
      var y = parseInt(row.year);
      if (!seen[y]) {
        years.push(y);
        seen[y] = true;
      }
    });
    years.sort(function (a, b) { return a - b; });
    return years;
  }

  function getEntitiesForMode(mode) {
    return mode === 'EUR' ? EUR_MODE_ENTITIES : EU_MODE_ENTITIES;
  }

  // --- Chart building ---
  function buildShareChart(sector) {
    var container = document.getElementById('iht-chart-share');
    if (!container) return;

    if (!shareChart) {
      shareChart = echarts.init(container);
      window.addEventListener('resize', function () { shareChart.resize(); });
    }

    var data = getFilteredData(sector, currentMode);
    var years = getYears(data);
    var entities = getEntitiesForMode(currentMode);

    var series = entities.map(function (entity) {
      var displayEntity = getDisplayEntity(entity);
      var isHidden = hiddenEntities[displayEntity];
      var seriesData = years.map(function (year) {
        var row = data.find(function (r) {
          return parseInt(r.year) === year && r.entity === entity;
        });
        return row ? parseFloat(row.share) * 100 : 0;
      });

      return {
        name: getDisplayName(entity),
        type: 'line',
        stack: 'total',
        areaStyle: { opacity: 0.85 },
        emphasis: { focus: 'series' },
        itemStyle: { color: getEntityColor(entity) },
        lineStyle: { width: 1 },
        symbol: 'none',
        data: isHidden ? years.map(function () { return 0; }) : seriesData
      };
    });

    var option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: function (params) {
          var year = params[0].axisValue;
          var lines = ['<strong>' + year + '</strong>'];
          params.forEach(function (p) {
            if (p.value > 0) {
              var entity = entities[p.seriesIndex];
              var row = data.find(function (r) {
                return parseInt(r.year) === parseInt(year) && r.entity === entity;
              });
              var count = row ? formatNumberFull(parseFloat(row.fractional_patents)) : '—';
              lines.push(
                '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
                p.color + ';margin-right:6px;"></span>' +
                p.seriesName + ' : ' + p.value.toFixed(1) + '% (' + count + ' brevets)'
              );
            }
          });
          return lines.join('<br>');
        }
      },
      legend: {
        bottom: 0,
        type: 'scroll',
        textStyle: { fontFamily: 'Merriweather, Georgia, serif', fontSize: 12 },
        selectedMode: 'multiple'
      },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: { fontFamily: 'Merriweather, Georgia, serif' }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          fontFamily: 'Merriweather, Georgia, serif'
        }
      },
      series: series
    };

    shareChart.setOption(option, true);
    shareChart.resize();
  }

  function buildCountChart(sector) {
    var container = document.getElementById('iht-chart-count');
    if (!container) return;

    if (!countChart) {
      countChart = echarts.init(container);
      window.addEventListener('resize', function () { countChart.resize(); });
    }

    var data = getFilteredData(sector, currentMode);
    var years = getYears(data);
    var entities = getEntitiesForMode(currentMode);

    // Sum all entities per year to get total
    var totalData = years.map(function (year) {
      var total = 0;
      entities.forEach(function (entity) {
        var row = data.find(function (r) {
          return parseInt(r.year) === year && r.entity === entity;
        });
        if (row) total += parseFloat(row.fractional_patents);
      });
      return Math.round(total * 100) / 100;
    });

    var option = {
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var year = params[0].axisValue;
          return '<strong>' + year + '</strong><br>Total : ' + formatNumberFull(params[0].value) + ' brevets';
        }
      },
      grid: { left: 70, right: 20, top: 30, bottom: 30 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: { fontFamily: 'Merriweather, Georgia, serif' }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: function (val) { return formatNumber(val); },
          fontFamily: 'Merriweather, Georgia, serif'
        }
      },
      series: [{
        name: 'Total',
        type: 'line',
        itemStyle: { color: '#003399' },
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2.5 },
        symbol: 'none',
        data: totalData
      }]
    };

    countChart.setOption(option, true);
    countChart.resize();
  }

  // --- KPI updates ---
  function updateKPIs() {
    if (!summaryData) return;

    var totalPatents = 0;
    var sectors = summaryData.sectors || {};
    Object.keys(sectors).forEach(function (key) {
      totalPatents += sectors[key].total_patents || 0;
    });

    var el = document.getElementById('iht-kpi-total');
    if (el) el.textContent = formatNumber(totalPatents);

    el = document.getElementById('iht-kpi-sectors');
    if (el) el.textContent = summaryData.sector_order ? summaryData.sector_order.length : 0;

    el = document.getElementById('iht-kpi-period');
    if (el) el.textContent = (summaryData.year_min || '?') + ' – ' + (summaryData.year_max || '?');

    // Find leader for current sector in latest year
    updateLeaderKPI();
  }

  function updateLeaderKPI() {
    var el = document.getElementById('iht-kpi-leader');
    if (!el || !currentSector) return;

    var data = getFilteredData(currentSector, currentMode);
    if (data.length === 0) { el.textContent = '—'; return; }

    var years = getYears(data);
    var latestYear = years[years.length - 1];
    var latestData = data.filter(function (r) { return parseInt(r.year) === latestYear; });

    var leader = null;
    var maxPatents = 0;
    latestData.forEach(function (row) {
      var val = parseFloat(row.fractional_patents);
      if (val > maxPatents) {
        maxPatents = val;
        leader = row.entity;
      }
    });

    el.textContent = leader ? getDisplayName(leader) : '—';
  }

  // --- Tab building ---
  function buildTabs() {
    var container = document.getElementById('iht-tabs');
    if (!container || !summaryData || !summaryData.sector_order) return;

    container.innerHTML = '';
    summaryData.sector_order.forEach(function (sectorKey) {
      var sector = summaryData.sectors[sectorKey];
      if (!sector) return;

      var btn = document.createElement('button');
      btn.className = 'iht-tab';
      var emoji = SECTOR_EMOJIS[sectorKey] || '';
      btn.textContent = (emoji ? emoji + ' ' : '') + sector.label_fr;
      btn.dataset.sector = sectorKey;

      btn.addEventListener('click', function () {
        switchSector(sectorKey);
      });

      container.appendChild(btn);
    });

    // Set first sector as active
    if (summaryData.sector_order.length > 0) {
      currentSector = summaryData.sector_order[0];
      updateActiveTab();
    }
  }

  function updateActiveTab() {
    var tabs = document.querySelectorAll('.iht-tab');
    tabs.forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.sector === currentSector);
    });

    // Update section title
    var titleEl = document.getElementById('iht-section-title');
    if (titleEl && summaryData && summaryData.sectors[currentSector]) {
      titleEl.textContent = summaryData.sectors[currentSector].label_fr;
    }
  }

  // --- Interactions ---
  function switchSector(sector) {
    currentSector = sector;
    updateActiveTab();
    rebuild();
  }

  function switchMode(mode) {
    currentMode = mode;
    updateToggleUI();
    rebuild();
  }

  function updateToggleUI() {
    var toggle = document.getElementById('iht-toggle');
    var labelEU = document.getElementById('iht-label-eu');
    var labelEUR = document.getElementById('iht-label-eur');

    if (toggle) {
      toggle.classList.toggle('active', currentMode === 'EUR');
    }
    if (labelEU) {
      labelEU.classList.toggle('active', currentMode === 'EU');
      labelEU.classList.toggle('inactive', currentMode !== 'EU');
    }
    if (labelEUR) {
      labelEUR.classList.toggle('active', currentMode === 'EUR');
      labelEUR.classList.toggle('inactive', currentMode !== 'EUR');
    }
  }

  function rebuild() {
    buildShareChart(currentSector);
    buildCountChart(currentSector);
    updateLeaderKPI();
  }

  // --- CSV download ---
  function downloadCSV(chartType) {
    if (!currentSector) return;

    var data = getFilteredData(currentSector, currentMode);
    var sectorLabel = summaryData.sectors[currentSector] ? summaryData.sectors[currentSector].label_en : currentSector;

    var csvLines = ['year,entity,fractional_patents,share'];
    data.forEach(function (row) {
      csvLines.push(
        row.year + ',' +
        getDisplayEntity(row.entity) + ',' +
        row.fractional_patents + ',' +
        row.share
      );
    });

    var blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'innovation-hightech_' + currentSector + '_' + chartType + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Event handlers ---
  function attachEvents() {
    // Toggle
    var toggle = document.getElementById('iht-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        switchMode(currentMode === 'EU' ? 'EUR' : 'EU');
      });
    }

    var labelEU = document.getElementById('iht-label-eu');
    if (labelEU) {
      labelEU.addEventListener('click', function () { switchMode('EU'); });
    }

    var labelEUR = document.getElementById('iht-label-eur');
    if (labelEUR) {
      labelEUR.addEventListener('click', function () { switchMode('EUR'); });
    }

    // Download buttons
    var dlShare = document.getElementById('iht-dl-share');
    if (dlShare) {
      dlShare.addEventListener('click', function () { downloadCSV('share'); });
    }

    var dlCount = document.getElementById('iht-dl-count');
    if (dlCount) {
      dlCount.addEventListener('click', function () { downloadCSV('count'); });
    }
  }

  // --- Initialization ---
  async function initialize() {
    var loaded = await loadData();
    if (!loaded) return;

    buildTabs();
    updateKPIs();
    updateToggleUI();
    attachEvents();
    rebuild();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
