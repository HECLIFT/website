/**
 * Productivity Tracker - ECharts Integration
 * Interactive visualization for GDP per capita, Labor Productivity, and PGF
 */

(function() {
  'use strict';

  // Detect base path for subdirectory hosting
  const getBasePath = () => {
    const path = window.location.pathname;
    const match = path.match(/^(.*?)\/innovation-data\/productivite/);
    return match ? match[1] : '';
  };

  const BASE_PATH = getBasePath();

  // Configuration
  const CONFIG = {
    indicators: {
      gdp_per_capita: {
        label: 'PIB par habitant',
        unit: '$ (PPA 2017)',
        format: v => v.toLocaleString('fr-FR'),
        waveKey: 'wave_gdp'
      },
      labor_productivity: {
        label: 'Productivité horaire',
        unit: '$/heure',
        format: v => v.toFixed(1),
        waveKey: 'wave_lp'
      },
      pgf: {
        label: 'Productivité globale des facteurs',
        unit: '',
        format: v => v.toFixed(2),
        waveKey: 'wave_pgf'
      }
    },
    colors: [
      '#0E2A47', '#5F84E8', '#5B6B2F', '#E46A4E', '#3E66D2',
      '#0A1E33', '#435220', '#C4523A', '#7B68EE', '#20B2AA',
      '#FF6347', '#4682B4', '#32CD32', '#DA70D6', '#FFD700',
      '#8B4513', '#00CED1', '#FF69B4', '#2E8B57', '#DC143C',
      '#9370DB', '#F4A460', '#00FA9A', '#CD853F'
    ],
    defaultCountries: ['FRA', 'DEU', 'USA', 'EA']
  };

  let mainChart = null;
  let wavesChart = null;
  let rawData = [];
  let wavesData = [];
  let countriesData = {};
  let selectedCountries = [...CONFIG.defaultCountries];
  let currentIndicator = 'gdp_per_capita';
  let useLogScale = false;

  /**
   * Parse CSV data
   */
  function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => {
        const val = values[idx];
        row[h.trim()] = (val === '' || val === undefined) ? null : (isNaN(val) ? val : parseFloat(val));
      });
      data.push(row);
    }
    return data;
  }

  /**
   * Load data files
   */
  async function loadData() {
    try {
      const [csvResponse, wavesResponse, jsonResponse] = await Promise.all([
        fetch(BASE_PATH + '/data/innovation-data/productivite/productivity.csv'),
        fetch(BASE_PATH + '/data/innovation-data/productivite/waves.csv'),
        fetch(BASE_PATH + '/data/innovation-data/productivite/countries.json')
      ]);

      if (!csvResponse.ok || !jsonResponse.ok || !wavesResponse.ok) {
        throw new Error('Failed to load data files');
      }

      const csvText = await csvResponse.text();
      rawData = parseCSV(csvText);

      const wavesText = await wavesResponse.text();
      wavesData = parseCSV(wavesText);

      countriesData = await jsonResponse.json();

      return true;
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Impossible de charger les données. Veuillez rafraîchir la page.');
      return false;
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    const container = document.getElementById('tracker-chart');
    if (container) {
      container.innerHTML = `<div class="tracker-error">${message}</div>`;
    }
  }

  /**
   * Get data for a specific country and indicator
   */
  function getCountryData(countryCode, indicator) {
    return rawData
      .filter(d => d.country === countryCode && d[indicator] != null)
      .sort((a, b) => a.year - b.year)
      .map(d => [d.year, d[indicator]]);
  }

  /**
   * Get waves data for a specific country
   */
  function getWavesData(countryCode, waveKey) {
    return wavesData
      .filter(d => d.country === countryCode && d[waveKey] != null)
      .sort((a, b) => a.year - b.year)
      .map(d => [d.year, d[waveKey] * 100]); // Convert to percentage
  }

  /**
   * Build ECharts series for main chart
   */
  function buildMainSeries() {
    return selectedCountries.map((code, idx) => {
      const country = countriesData[code];
      const data = getCountryData(code, currentIndicator);

      return {
        name: country ? `${country.flag} ${country.name}` : code,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5 },
        emphasis: {
          focus: 'series',
          lineStyle: { width: 4 }
        },
        data: data,
        itemStyle: {
          color: CONFIG.colors[idx % CONFIG.colors.length]
        }
      };
    });
  }

  /**
   * Build ECharts series for waves chart
   */
  function buildWavesSeries() {
    const waveKey = CONFIG.indicators[currentIndicator].waveKey;

    return selectedCountries.map((code, idx) => {
      const country = countriesData[code];
      const data = getWavesData(code, waveKey);

      return {
        name: country ? `${country.flag} ${country.name}` : code,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        emphasis: {
          focus: 'series',
          lineStyle: { width: 3 }
        },
        data: data,
        itemStyle: {
          color: CONFIG.colors[idx % CONFIG.colors.length]
        }
      };
    });
  }

  /**
   * Get year range from data
   */
  function getYearRange() {
    const years = rawData.map(d => d.year);
    return {
      min: Math.min(...years),
      max: Math.max(...years)
    };
  }

  /**
   * Update main chart
   */
  function updateMainChart() {
    if (!mainChart) return;

    const indicator = CONFIG.indicators[currentIndicator];
    const yearRange = getYearRange();

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: indicator.label + (useLogScale ? ' (échelle log)' : ''),
        left: 'center',
        top: 5,
        textStyle: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 18,
          fontWeight: 600,
          color: '#0E2A47'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#D5DDE8',
        borderWidth: 1,
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          color: '#0E1320'
        },
        formatter: function(params) {
          let html = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach(p => {
            if (p.value && p.value[1] != null) {
              const val = indicator.format(p.value[1]);
              html += `<span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:50%;margin-right:5px;"></span>`;
              html += `${p.seriesName}: <strong>${val}</strong>${indicator.unit ? ' ' + indicator.unit : ''}<br/>`;
            }
          });
          return html;
        }
      },
      legend: {
        bottom: 10,
        type: 'scroll',
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 11
        }
      },
      grid: {
        left: 80,
        right: 30,
        top: 50,
        bottom: 70
      },
      xAxis: {
        type: 'value',
        min: yearRange.min,
        max: yearRange.max,
        axisLabel: {
          formatter: v => v.toString(),
          fontFamily: "'Merriweather', Georgia, serif"
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      yAxis: {
        type: useLogScale ? 'log' : 'value',
        name: indicator.unit || indicator.label,
        nameLocation: 'middle',
        nameGap: 60,
        nameRotate: 90,
        axisLabel: {
          formatter: v => useLogScale ? v.toLocaleString('fr-FR') : indicator.format(v),
          fontFamily: "'Merriweather', Georgia, serif"
        },
        nameTextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontWeight: 600,
          fontSize: 12
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      toolbox: {
        right: 10,
        top: 5,
        feature: {
          saveAsImage: {
            title: 'PNG',
            pixelRatio: 2
          }
        }
      },
      series: buildMainSeries()
    };

    mainChart.setOption(option, true);
  }

  /**
   * Update waves chart
   */
  function updateWavesChart() {
    if (!wavesChart) return;

    const indicator = CONFIG.indicators[currentIndicator];

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: 'Vagues de croissance (tendance HP, λ=500)',
        left: 'center',
        top: 5,
        textStyle: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 18,
          fontWeight: 600,
          color: '#0E2A47'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#D5DDE8',
        borderWidth: 1,
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          color: '#0E1320'
        },
        formatter: function(params) {
          let html = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach(p => {
            if (p.value && p.value[1] != null) {
              html += `<span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:50%;margin-right:5px;"></span>`;
              html += `${p.seriesName}: <strong>${p.value[1].toFixed(2)}%</strong><br/>`;
            }
          });
          return html;
        }
      },
      legend: {
        bottom: 10,
        type: 'scroll',
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 11
        }
      },
      grid: {
        left: 60,
        right: 30,
        top: 50,
        bottom: 70
      },
      xAxis: {
        type: 'value',
        min: 1890,
        max: 2022,
        axisLabel: {
          formatter: v => v.toString(),
          fontFamily: "'Merriweather', Georgia, serif"
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Taux de croissance (%)',
        nameLocation: 'middle',
        nameGap: 45,
        nameRotate: 90,
        axisLabel: {
          formatter: v => v.toFixed(1) + '%',
          fontFamily: "'Merriweather', Georgia, serif"
        },
        nameTextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontWeight: 600,
          fontSize: 12
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      toolbox: {
        right: 10,
        top: 5,
        feature: {
          saveAsImage: {
            title: 'PNG',
            pixelRatio: 2
          }
        }
      },
      series: buildWavesSeries()
    };

    wavesChart.setOption(option, true);
  }

  /**
   * Update both charts
   */
  function updateCharts() {
    updateMainChart();
    updateWavesChart();
  }

  /**
   * Initialize country selector chips
   */
  function initCountrySelector() {
    const container = document.getElementById('country-selector');
    if (!container) return;

    container.innerHTML = '';

    // Sort countries: EA first, then alphabetically by name
    const sortedEntries = Object.entries(countriesData).sort((a, b) => {
      if (a[0] === 'EA') return -1;
      if (b[0] === 'EA') return 1;
      return a[1].name.localeCompare(b[1].name, 'fr');
    });

    sortedEntries.forEach(([code, data]) => {
      const chip = document.createElement('button');
      chip.className = 'country-chip' + (selectedCountries.includes(code) ? ' active' : '');
      chip.dataset.code = code;
      chip.innerHTML = `${data.flag} ${data.name}`;

      chip.addEventListener('click', () => {
        if (selectedCountries.includes(code)) {
          if (selectedCountries.length > 1) {
            selectedCountries = selectedCountries.filter(c => c !== code);
            chip.classList.remove('active');
          }
        } else {
          selectedCountries.push(code);
          chip.classList.add('active');
        }
        updateCharts();
      });

      container.appendChild(chip);
    });
  }

  /**
   * Initialize indicator dropdown
   */
  function initIndicatorDropdown() {
    const select = document.getElementById('indicator-select');
    if (!select) return;

    select.innerHTML = '';

    Object.entries(CONFIG.indicators).forEach(([key, data]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = data.label;
      if (key === currentIndicator) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      currentIndicator = e.target.value;
      updateCharts();
    });
  }

  /**
   * Initialize log scale toggle
   */
  function initLogToggle() {
    const toggle = document.getElementById('log-toggle');
    if (!toggle) return;

    toggle.addEventListener('change', (e) => {
      useLogScale = e.target.checked;
      updateMainChart();
    });
  }

  /**
   * Download CSV
   */
  function downloadCSV() {
    const indicator = CONFIG.indicators[currentIndicator];
    const headers = ['Pays', 'Année', indicator.label];
    const rows = [];

    selectedCountries.forEach(code => {
      const country = countriesData[code];
      const data = getCountryData(code, currentIndicator);
      data.forEach(([year, value]) => {
        rows.push([country ? country.name : code, year, value]);
      });
    });

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `productivite_${currentIndicator}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Reset selection
   */
  function resetSelection() {
    selectedCountries = [...CONFIG.defaultCountries];
    useLogScale = false;

    const toggle = document.getElementById('log-toggle');
    if (toggle) toggle.checked = false;

    // Update chips
    document.querySelectorAll('.country-chip').forEach(chip => {
      chip.classList.toggle('active', selectedCountries.includes(chip.dataset.code));
    });

    updateCharts();
  }

  /**
   * Initialize the tracker
   */
  async function init() {
    const mainChartContainer = document.getElementById('tracker-chart');
    const wavesChartContainer = document.getElementById('waves-chart');

    if (!mainChartContainer) {
      console.error('Main chart container not found');
      return;
    }

    // Show loading
    mainChartContainer.innerHTML = '<div class="tracker-loading">Chargement des données...</div>';
    if (wavesChartContainer) {
      wavesChartContainer.innerHTML = '<div class="tracker-loading">Chargement...</div>';
    }

    // Load data
    const success = await loadData();
    if (!success) return;

    // Initialize ECharts
    mainChartContainer.innerHTML = '';
    mainChart = echarts.init(mainChartContainer, null, { renderer: 'canvas' });

    if (wavesChartContainer) {
      wavesChartContainer.innerHTML = '';
      wavesChart = echarts.init(wavesChartContainer, null, { renderer: 'canvas' });
    }

    // Initialize controls
    initIndicatorDropdown();
    initCountrySelector();
    initLogToggle();

    // Setup buttons
    const downloadBtn = document.getElementById('btn-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadCSV);
    }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetSelection);
    }

    // Initial render
    updateCharts();

    // Handle resize
    window.addEventListener('resize', () => {
      if (mainChart) mainChart.resize();
      if (wavesChart) wavesChart.resize();
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
