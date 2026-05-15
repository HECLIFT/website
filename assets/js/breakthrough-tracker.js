/**
 * Breakthrough Tracker - ECharts Integration
 * Interactive visualization for patent novelty and breakthrough scores
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Detect base path for subdirectory hosting
  const getBasePath = () => {
    const path = window.location.pathname;
    const match = path.match(/^(.*?)\/innovation-data\/breakthrough/);
    return match ? match[1] : '';
  };

  const BASE_PATH = getBasePath();

  const CONFIG = {
    dataPath: BASE_PATH + '/data/innovation-data/breakthrough/',

    // Indicators: breakthrough patents per million population
    indicators: {
      nouveaute: {
        label: 'Nouveauté',
        brevetLabel: 'fortement nouveaux',
        column: 'nouveaute_per_million',
        countColumn: 'nouveaute_count',
        shareColumn: 'nouveaute_share',
        unit: 'par million hab.',
        format: v => v.toFixed(1),
        description: 'Brevets fortement nouveaux (top 1%) par million d\'habitants',
        isForwardLooking: false
      },
      rupture: {
        label: 'Rupture',
        brevetLabel: 'de rupture',
        column: 'rupture_per_million',
        countColumn: 'rupture_count',
        shareColumn: 'rupture_share',
        unit: 'par million hab.',
        format: v => v.toFixed(1),
        description: 'Brevets de rupture (top 1%) par million d\'habitants',
        isForwardLooking: true
      }
    },

    // LIFT design system colors
    colors: [
      '#0E2A47', // navy
      '#5F84E8', // cornflower
      '#5B6B2F', // olive
      '#E46A4E', // coral
      '#3E66D2', // cornflower-700
      '#0A1E33', // navy-700
      '#435220', // olive-700
      '#C4523A', // accent-700
      '#7B68EE', // medium slate blue
      '#20B2AA', // light sea green
      '#FF6347', // tomato
      '#4682B4', // steel blue
      '#32CD32', // lime green
      '#DA70D6', // orchid
      '#FFD700', // gold
      '#8B4513', // saddle brown
      '#00CED1', // dark turquoise
      '#FF69B4', // hot pink
      '#2E8B57', // sea green
      '#DC143C', // crimson
      '#9370DB', // medium purple
      '#F4A460', // sandy brown
      '#00FA9A'  // medium spring green
    ],

    // Default European countries to display
    defaultCountries: ['FR', 'DE', 'GB', 'IT', 'ES'],

    // Minimum population to include a country (1 million)
    minPopulation: 1_000_000
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let timeseriesChart = null;
  let countryChart = null;
  let techChart = null;
  let regionChart = null;
  let mapChart = null;

  let timeseriesData = [];  // Breakthrough patents per capita by year × country
  let sectorsDataRaw = [];  // Sector data (counts and shares)
  let techTimeseriesData = [];  // Technology field time series
  let regionsData = [];     // NUTS2 region data
  let europeMapData = [];   // Europe map data
  let countriesData = {};   // Country metadata (names, flags)
  let sectorsData = {};     // Sector metadata (names, including tech fields)
  let summaryData = {};     // Summary statistics

  let selectedCountries = [...CONFIG.defaultCountries];
  let validCountries = new Set();  // Countries meeting population threshold
  let currentIndicator = 'nouveaute';  // Default to backward-looking measure
  let currentSectorMetric = 'count';   // 'count' or 'share' for sector display
  let countryIndicator = 'nouveaute';  // Separate indicator for country comparison
  let countryPeriod = 'all';  // 'all' or 'startYear-endYear' for country comparison
  let regionIndicator = 'nouveaute';  // Indicator for region chart
  let regionPeriod = 'all';  // Period for region chart
  let nuts2GeoJson = null;             // NUTS2 GeoJSON (loaded on first drill-down)
  let mapDrillCountry = null;          // null = Europe view, ISO code = drill-down

  // ISO country code to NUTS prefix (for countries where they differ)
  const ISO_TO_NUTS = { 'GB': 'UK', 'GR': 'EL' };
  const NUTS_TO_ISO = { 'UK': 'GB', 'EL': 'GR' };


  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse CSV data
   */
  function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];

    // Parse a CSV line handling quoted fields (commas inside quotes)
    function splitCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = splitCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = splitCSVLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        const val = values[idx] || '';
        row[h] = isNaN(val) || val === '' ? val : parseFloat(val);
      });
      data.push(row);
    }
    return data;
  }

  /**
   * Format numbers for display
   */
  function formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return '--';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString('fr-FR');
  }

  /**
   * Show error message in a container
   */
  function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `<div class="bt-error">${message}</div>`;
    }
  }

  /**
   * Show loading state in a container
   */
  function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '<div class="bt-loading">Chargement des données...</div>';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load all data files
   */
  async function loadData() {
    try {
      const [
        timeseriesResponse,
        sectorsDataResponse,
        techResponse,
        regionsResponse,
        europeMapResponse,
        countriesResponse,
        sectorsMetaResponse,
        summaryResponse
      ] = await Promise.all([
        fetch(CONFIG.dataPath + 'timeseries.csv'),
        fetch(CONFIG.dataPath + 'sectors_data.csv'),
        fetch(CONFIG.dataPath + 'tech_timeseries.csv'),
        fetch(CONFIG.dataPath + 'regions_data.csv'),
        fetch(CONFIG.dataPath + 'europe_map.csv'),
        fetch(CONFIG.dataPath + 'countries.json'),
        fetch(CONFIG.dataPath + 'sectors.json'),
        fetch(CONFIG.dataPath + 'summary.json')
      ]);

      // Check responses
      if (!timeseriesResponse.ok) {
        throw new Error('Fichier timeseries.csv introuvable');
      }

      // Parse time series data
      const csvText = await timeseriesResponse.text();
      timeseriesData = parseCSV(csvText);

      // Parse sector data
      if (sectorsDataResponse.ok) {
        const sectorsCsvText = await sectorsDataResponse.text();
        sectorsDataRaw = parseCSV(sectorsCsvText);
      }

      // Parse tech timeseries data
      if (techResponse.ok) {
        const techCsvText = await techResponse.text();
        techTimeseriesData = parseCSV(techCsvText);
      }

      // Parse regions data
      if (regionsResponse.ok) {
        const regionsCsvText = await regionsResponse.text();
        regionsData = parseCSV(regionsCsvText);
      }

      // Parse europe map data
      if (europeMapResponse.ok) {
        const mapCsvText = await europeMapResponse.text();
        europeMapData = parseCSV(mapCsvText);
      }

      if (countriesResponse.ok) {
        countriesData = await countriesResponse.json();
      }

      if (sectorsMetaResponse.ok) {
        sectorsData = await sectorsMetaResponse.json();
      }

      if (summaryResponse.ok) {
        summaryData = await summaryResponse.json();
      }

      return true;
    } catch (error) {
      console.error('Error loading data:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KPI UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update KPI cards with summary data
   */
  function updateKPIs() {
    // Total patents
    const totalPatents = summaryData.total_patents || timeseriesData.length;
    document.getElementById('kpi-total-patents').textContent = formatNumber(totalPatents);

    // Countries count
    const countries = summaryData.countries_count || Object.keys(countriesData).length;
    document.getElementById('kpi-countries').textContent = formatNumber(countries);

    // Regions count (unique NUTS2 codes in regions data)
    const regionCodes = new Set(regionsData.map(d => d.nuts2_code).filter(Boolean));
    document.getElementById('kpi-regions').textContent = formatNumber(regionCodes.size);

    // Period
    if (summaryData.year_min && summaryData.year_max) {
      document.getElementById('kpi-period').textContent =
        `${summaryData.year_min}-${summaryData.year_max}`;
    } else if (timeseriesData.length > 0) {
      const years = timeseriesData.map(d => d.year).filter(y => y);
      if (years.length > 0) {
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        document.getElementById('kpi-period').textContent = `${minYear}-${maxYear}`;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get time series share data for a country
   * Returns object mapping year -> share value
   */
  function getTimeSeriesShareData(countryCode) {
    const indicator = CONFIG.indicators[currentIndicator];
    const shareCol = indicator.shareColumn;

    const result = {};
    timeseriesData
      .filter(d => d.country === countryCode)
      .forEach(d => {
        const val = d[shareCol];
        if (val === '' || val === null || isNaN(val)) return;
        result[parseInt(d.year)] = val;
      });
    return result;
  }

  /**
   * Get time series per-capita data for a country (used by country comparison)
   * Returns array of [year, value] pairs
   */
  function getTimeSeriesData(countryCode) {
    const indicator = CONFIG.indicators[currentIndicator];
    const column = indicator.column;

    // Get data for this country
    return timeseriesData
      .filter(d => d.country === countryCode)
      .map(d => {
        const val = d[column];
        // Skip NaN/null values (truncated for forward-looking measures)
        if (val === '' || val === null || isNaN(val)) return null;
        return [parseInt(d.year), val];
      })
      .filter(d => d !== null)
      .sort((a, b) => a[0] - b[0]);
  }

  /**
   * Get country comparison data (average for most recent valid period)
   * For forward-looking measures, uses influence_max_year as max
   */
  function getCountryComparisonData() {
    const indicator = CONFIG.indicators[countryIndicator];
    const column = indicator.column;

    // Determine max year based on indicator type
    let maxYear = summaryData.year_max || 2024;
    if (indicator.isForwardLooking && summaryData.influence_max_year) {
      maxYear = summaryData.influence_max_year;
    }

    // Parse period selection
    let yearFilter;
    if (countryPeriod === 'all') {
      yearFilter = y => y <= maxYear;
    } else {
      const [startYear, endYear] = countryPeriod.split('-').map(Number);
      const cappedEnd = Math.min(endYear, maxYear);
      yearFilter = y => y >= startYear && y <= cappedEnd;
    }

    // Aggregate by country for selected period (only valid countries)
    const countryAgg = {};
    timeseriesData
      .filter(d => yearFilter(d.year) && validCountries.has(d.country))
      .forEach(d => {
        const val = d[column];
        if (val === '' || val === null || isNaN(val)) return;

        if (!countryAgg[d.country]) {
          countryAgg[d.country] = { sum: 0, count: 0 };
        }
        countryAgg[d.country].sum += val;
        countryAgg[d.country].count += 1;
      });

    // Convert to array and sort
    return Object.entries(countryAgg)
      .map(([code, data]) => ({
        code,
        name: countriesData[code]?.name || code,
        flag: countriesData[code]?.flag || '',
        value: data.count > 0 ? data.sum / data.count : 0
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Get sector time series data for stacked area chart.
   * Returns { years: [...], sectors: [{code, name, data: [...]}] }
   */
  function getSectorTimeSeriesData() {
    const indicator = CONFIG.indicators[currentIndicator];
    const shareCol = indicator.shareColumn;

    // Determine year range (same logic as country chart)
    const yearRange = getYearRange();

    // Build year list
    const years = [];
    for (let y = yearRange.min; y <= yearRange.max; y++) {
      years.push(y);
    }

    // Get unique sectors (exclude unclassified)
    const sectorCodes = [...new Set(sectorsDataRaw.map(d => d.sector).filter(s => s && s !== 'X'))].sort();

    // Build share data per sector per year
    const sectors = sectorCodes.map(code => {
      const shareByYear = {};
      sectorsDataRaw
        .filter(d => d.sector === code)
        .forEach(d => {
          const val = d[shareCol];
          if (val !== '' && val !== null && !isNaN(val)) {
            shareByYear[parseInt(d.year)] = val;
          }
        });

      return {
        code,
        name: sectorsData[code]?.name || `Section ${code}`,
        data: years.map(y => (shareByYear[y] || 0) * 100)
      };
    });

    return { years, sectors };
  }

  /**
   * Get year range from data
   * For forward-looking indicators, max year is truncated
   */
  function getYearRange() {
    const indicator = CONFIG.indicators[currentIndicator];
    const years = timeseriesData.map(d => d.year).filter(y => y);
    if (years.length === 0) return { min: 2000, max: 2023 };

    let maxYear = Math.max(...years);
    if (indicator.isForwardLooking && summaryData.influence_max_year) {
      maxYear = summaryData.influence_max_year;
    }

    return {
      min: Math.min(...years),
      max: maxYear
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build time series chart
   * Stacked area chart showing each country's share of breakthrough patents.
   * Non-selected countries are grouped into "Autres pays".
   */
  function buildTimeSeriesChart() {
    const indicator = CONFIG.indicators[currentIndicator];
    const yearRange = getYearRange();

    // Get all years in range as category labels
    const years = [];
    for (let y = yearRange.min; y <= yearRange.max; y++) {
      years.push(y);
    }

    // Get share data for each selected country
    const countryShares = selectedCountries.map(code => ({
      code,
      data: getTimeSeriesShareData(code)
    }));

    // Compute "Autres pays" as 1 - sum(selected) for each year
    const otherValues = years.map(y => {
      let selectedSum = 0;
      countryShares.forEach(cs => {
        selectedSum += (cs.data[y] || 0);
      });
      return Math.max(0, (1 - selectedSum) * 100);
    });

    // Build series: "Autres pays" first (bottom of stack), then selected countries
    const series = [];

    // "Autres pays" at the bottom
    series.push({
      name: 'Autres pays',
      type: 'line',
      stack: 'total',
      areaStyle: { opacity: 0.5 },
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 0.5, color: '#C0C8D4' },
      emphasis: { focus: 'series' },
      data: otherValues,
      itemStyle: { color: '#D5DDE8' }
    });

    // Selected countries stacked on top
    selectedCountries.forEach((code, idx) => {
      const country = countriesData[code];
      const shareData = countryShares[idx].data;

      series.push({
        name: country ? `${country.flag} ${country.name}` : code,
        type: 'line',
        stack: 'total',
        areaStyle: { opacity: 0.85 },
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1 },
        emphasis: { focus: 'series' },
        data: years.map(y => (shareData[y] || 0) * 100),
        itemStyle: { color: CONFIG.colors[idx % CONFIG.colors.length] }
      });
    });

    // Subtitle with truncation note for forward-looking measures
    let subtitle = `${yearRange.min} - ${yearRange.max}`;
    if (indicator.isForwardLooking) {
      subtitle += ' (données tronquées après cette date)';
    }

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: `Brevets ${indicator.brevetLabel} (top 1%)`,
        subtext: subtitle,
        left: 'center',
        textStyle: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 18,
          fontWeight: 600,
          color: '#0E2A47'
        },
        subtextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 12,
          color: '#55657D'
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
          if (!params || params.length === 0) return '';
          const yearIdx = params[0].dataIndex;
          let html = `<strong>${years[yearIdx]}</strong><br/>`;
          // Show in reverse order (top of stack first)
          for (let i = params.length - 1; i >= 0; i--) {
            const p = params[i];
            const val = p.value;
            if (val === null || val === undefined || val === 0) continue;
            const pct = val.toFixed(1);
            html += `<span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;margin-right:5px;"></span>` +
              `${p.seriesName}: <strong>${pct}%</strong><br/>`;
          }
          return html;
        }
      },
      legend: {
        bottom: 60,
        type: 'scroll',
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 11
        }
      },
      grid: {
        left: 60,
        right: 40,
        top: 80,
        bottom: 130
      },
      xAxis: {
        type: 'category',
        data: years.map(String),
        name: 'Année',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          fontFamily: "'Merriweather', Georgia, serif",
          interval: 4
        },
        nameTextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontWeight: 600
        },
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        name: 'Part des brevets (%)',
        nameLocation: 'middle',
        nameGap: 45,
        min: 0,
        max: 100,
        axisLabel: {
          formatter: v => v + '%',
          fontFamily: "'Merriweather', Georgia, serif"
        },
        nameTextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontWeight: 600
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 20,
          height: 25,
          brushSelect: false,
          borderColor: '#D5DDE8',
          fillerColor: 'rgba(95, 132, 232, 0.15)',
          handleStyle: { color: '#5F84E8' },
          moveHandleSize: 10,
          showDetail: true,
          textStyle: { fontFamily: "'Merriweather', Georgia, serif" }
        },
        {
          type: 'inside',
          xAxisIndex: 0,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
          moveOnMouseMove: true
        }
      ],
      series: series
    };

    timeseriesChart.setOption(option, true);
  }

  /**
   * Build country comparison chart (horizontal bar with scroll)
   * Shows breakthrough patents per million by country (recent years average)
   */
  function buildCountryChart() {
    const indicator = CONFIG.indicators[countryIndicator];
    const data = getCountryComparisonData();

    // Resize chart height to fit all countries
    const barHeight = 25;
    const minHeight = 350;
    const neededHeight = Math.max(minHeight, data.length * barHeight + 120);
    const container = document.getElementById('country-chart');
    if (container) {
      container.style.height = neededHeight + 'px';
      countryChart.resize();
    }

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: `${indicator.label} — ${countryPeriod === 'all' ? 'toutes les années' : countryPeriod}`,
        left: 'center',
        textStyle: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 14,
          fontWeight: 600,
          color: '#0E2A47'
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
          color: '#0E1320'
        },
        formatter: function(params) {
          const p = params[0];
          return `${p.name}<br/>Brevets ${indicator.brevetLabel}: <strong>${indicator.format(p.value)}</strong> ${indicator.unit}`;
        }
      },
      grid: {
        left: 110,
        right: 40,
        top: 50,
        bottom: 55
      },
      xAxis: {
        type: 'value',
        name: indicator.unit,
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          formatter: v => indicator.format(v),
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10
        },
        nameTextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      yAxis: {
        type: 'category',
        data: data.map(d => `${d.flag} ${d.name}`).reverse(),
        axisLabel: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10,
          width: 100,
          overflow: 'truncate'
        },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        data: data.map(d => d.value).reverse(),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#5F84E8' },
            { offset: 1, color: '#0E2A47' }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        barWidth: '60%'
      }]
    };

    countryChart.setOption(option, true);
  }

  // Technology field colors
  const TECH_COLORS = {
    'G06N': '#5F84E8',  // cornflower — IA
    'C12N': '#5B6B2F',  // olive — Biotech
    'A61K': '#E46A4E',  // coral — Pharma
    'H01L': '#0E2A47',  // navy — Semiconducteurs
  };

  /**
   * Build technology fields chart (multi-line)
   * Shows novelty breakthrough rate over time for specific technology fields
   */
  function buildTechChart() {
    if (!techTimeseriesData || techTimeseriesData.length === 0) {
      return;
    }

    // Get unique technologies
    const techs = [...new Set(techTimeseriesData.map(d => d.technology))].sort();

    // Get year range
    const years = [...new Set(techTimeseriesData.map(d => parseInt(d.year)))].sort((a, b) => a - b);

    // Build series (one line per technology)
    const series = techs.map(tech => {
      const techData = techTimeseriesData.filter(d => d.technology === tech);
      const dataByYear = {};
      techData.forEach(d => { dataByYear[parseInt(d.year)] = d.novelty_index * 100; });

      const label = sectorsData[tech]?.name || tech;
      return {
        name: label,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2.5 },
        emphasis: { focus: 'series', lineStyle: { width: 4 } },
        data: years.map(y => dataByYear[y] !== undefined ? dataByYear[y] : null),
        itemStyle: { color: TECH_COLORS[tech] || '#999' },
        connectNulls: true
      };
    });

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: 'Indice de nouveaute par domaine technologique',
        subtext: 'Ecart relatif a la moyenne (positif = plus nouveau que la moyenne)',
        left: 'center',
        textStyle: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 14,
          fontWeight: 600,
          color: '#0E2A47'
        },
        subtextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 11,
          color: '#55657D'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#D5DDE8',
        borderWidth: 1,
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          color: '#0E1320',
          fontSize: 11
        },
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          const yearIdx = params[0].dataIndex;
          let html = `<strong>${years[yearIdx]}</strong><br/>`;
          const sorted = [...params].sort((a, b) => (b.value || 0) - (a.value || 0));
          sorted.forEach(p => {
            if (p.value === null || p.value === undefined) return;
            const sign = p.value >= 0 ? '+' : '';
            html += `<span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:50%;margin-right:5px;"></span>` +
              `${p.seriesName}: <strong>${sign}${p.value.toFixed(1)}%</strong><br/>`;
          });
          return html;
        }
      },
      legend: {
        bottom: 10,
        textStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 11
        }
      },
      grid: {
        left: 60,
        right: 30,
        top: 75,
        bottom: 60
      },
      xAxis: {
        type: 'category',
        data: years.map(String),
        boundaryGap: false,
        axisLabel: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10,
          interval: 4
        }
      },
      yAxis: {
        type: 'value',
        name: 'Indice de nouveaute (%)',
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: {
          formatter: v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%',
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10
        },
        nameTextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontWeight: 600,
          fontSize: 11
        },
        splitLine: {
          lineStyle: { color: '#E6EBF2' }
        }
      },
      series: series
    };

    techChart.setOption(option, true);
  }

  /**
   * Build NUTS2 region chart (horizontal bar, top 10)
   * Shows breakthrough patent counts by European region
   */
  function buildRegionChart() {
    if (!regionsData || regionsData.length === 0) {
      return;
    }

    const indicator = CONFIG.indicators[regionIndicator];
    const countCol = regionIndicator === 'nouveaute' ? 'nouveaute_count' : 'rupture_count';

    // NUTS country prefix to flag emoji
    const NUTS_TO_FLAG = {
      'AT': '\u{1F1E6}\u{1F1F9}', 'BE': '\u{1F1E7}\u{1F1EA}', 'BG': '\u{1F1E7}\u{1F1EC}',
      'CH': '\u{1F1E8}\u{1F1ED}', 'CY': '\u{1F1E8}\u{1F1FE}', 'CZ': '\u{1F1E8}\u{1F1FF}',
      'DE': '\u{1F1E9}\u{1F1EA}', 'DK': '\u{1F1E9}\u{1F1F0}', 'EE': '\u{1F1EA}\u{1F1EA}',
      'EL': '\u{1F1EC}\u{1F1F7}', 'ES': '\u{1F1EA}\u{1F1F8}', 'FI': '\u{1F1EB}\u{1F1EE}',
      'FR': '\u{1F1EB}\u{1F1F7}', 'HR': '\u{1F1ED}\u{1F1F7}', 'HU': '\u{1F1ED}\u{1F1FA}',
      'IE': '\u{1F1EE}\u{1F1EA}', 'IS': '\u{1F1EE}\u{1F1F8}', 'IT': '\u{1F1EE}\u{1F1F9}',
      'LI': '\u{1F1F1}\u{1F1EE}', 'LT': '\u{1F1F1}\u{1F1F9}', 'LU': '\u{1F1F1}\u{1F1FA}',
      'LV': '\u{1F1F1}\u{1F1FB}', 'NL': '\u{1F1F3}\u{1F1F1}', 'NO': '\u{1F1F3}\u{1F1F4}',
      'PL': '\u{1F1F5}\u{1F1F1}', 'PT': '\u{1F1F5}\u{1F1F9}', 'RO': '\u{1F1F7}\u{1F1F4}',
      'SE': '\u{1F1F8}\u{1F1EA}', 'SI': '\u{1F1F8}\u{1F1EE}', 'SK': '\u{1F1F8}\u{1F1F0}',
      'UK': '\u{1F1EC}\u{1F1E7}'
    };

    // Filter by selected period
    const filteredData = regionsData.filter(d => (d.period || 'all') === regionPeriod);

    // Sort by selected indicator count descending and take top 10
    const sorted = [...filteredData]
      .sort((a, b) => (b[countCol] || 0) - (a[countCol] || 0))
      .slice(0, 10);

    // Build labels with flag
    const labels = sorted.map(d => {
      const code = d.nuts2_code || '';
      const countryPrefix = code.substring(0, 2);
      const flag = NUTS_TO_FLAG[countryPrefix] || '';
      const name = d.region_name || code;
      return flag ? `${flag} ${name}` : name;
    }).reverse();

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: `Top 10 régions — ${indicator.label}`,
        subtext: regionPeriod === 'all' ? 'Toutes les années' : regionPeriod,
        left: 'center',
        textStyle: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 14,
          fontWeight: 600,
          color: '#0E2A47'
        },
        subtextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 11,
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
          color: '#0E1320'
        },
        formatter: function(params) {
          const p = params[0];
          const region = sorted[sorted.length - 1 - p.dataIndex];
          const code = region.nuts2_code || '';
          const countryPrefix = code.substring(0, 2);
          const flag = NUTS_TO_FLAG[countryPrefix] || '';
          return `${flag} <strong>${region.region_name}</strong> (${code})<br/>` +
            `Brevets ${indicator.brevetLabel}: <strong>${Math.round(p.value).toLocaleString('fr-FR')}</strong>`;
        }
      },
      grid: {
        left: 180,
        right: 40,
        top: 50,
        bottom: 30
      },
      xAxis: {
        type: 'value',
        name: 'Nombre de brevets',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10,
          formatter: v => v >= 1000 ? (v/1000).toFixed(0) + 'k' : v
        },
        nameTextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 10
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
          fontSize: 10,
          width: 160,
          overflow: 'truncate'
        },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        data: sorted.map(d => Math.round(d[countCol] || 0)).reverse(),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#5B6B2F' },
            { offset: 1, color: '#0E2A47' }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        barWidth: '60%'
      }]
    };

    regionChart.setOption(option, true);
  }

  // Map ISO country codes to GeoJSON NAME property values
  const COUNTRY_TO_MAPNAME = {
    'AT': 'Austria', 'BE': 'Belgium', 'BG': 'Bulgaria', 'HR': 'Croatia',
    'CY': 'Cyprus', 'CZ': 'Czech Republic', 'DK': 'Denmark', 'EE': 'Estonia',
    'FI': 'Finland', 'FR': 'France', 'DE': 'Germany', 'GR': 'Greece',
    'HU': 'Hungary', 'IE': 'Ireland', 'IT': 'Italy', 'LV': 'Latvia',
    'LT': 'Lithuania', 'LU': 'Luxembourg', 'MT': 'Malta', 'NL': 'Netherlands',
    'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania', 'SK': 'Slovakia',
    'SI': 'Slovenia', 'ES': 'Spain', 'SE': 'Sweden', 'GB': 'United Kingdom',
    'NO': 'Norway', 'CH': 'Switzerland', 'IS': 'Iceland', 'LI': 'Liechtenstein',
    'AL': 'Albania', 'BA': 'Bosnia and Herzegovina', 'ME': 'Montenegro',
    'MK': 'The former Yugoslav Republic of Macedonia', 'RS': 'Serbia',
    'UA': 'Ukraine', 'BY': 'Belarus', 'MD': 'Republic of Moldova'
  };

  // Reverse lookup: GeoJSON name → ISO code
  const MAPNAME_TO_COUNTRY = Object.fromEntries(
    Object.entries(COUNTRY_TO_MAPNAME).map(([k, v]) => [v, k])
  );

  /**
   * Load NUTS2 GeoJSON (fetched once, cached)
   */
  async function loadNuts2GeoJson() {
    if (nuts2GeoJson) return nuts2GeoJson;
    try {
      const resp = await fetch(CONFIG.dataPath + 'nuts2.geojson');
      if (resp.ok) {
        nuts2GeoJson = await resp.json();
        return nuts2GeoJson;
      }
    } catch (e) {
      console.warn('Failed to load NUTS2 GeoJSON:', e);
    }
    return null;
  }

  /**
   * Show/hide the map back button
   */
  function updateMapBackButton(show) {
    const container = document.getElementById('map-chart');
    if (!container) return;
    let btn = container.querySelector('.bt-map-back');
    if (show) {
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'bt-map-back';
        btn.innerHTML = '\u2190 Europe';
        btn.style.cssText = 'position:absolute;top:10px;left:10px;z-index:10;' +
          'padding:6px 14px;border:1px solid #D5DDE8;border-radius:4px;' +
          'background:#fff;cursor:pointer;font-family:inherit;font-size:12px;' +
          'color:#0E2A47;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
        btn.addEventListener('click', () => {
          mapDrillCountry = null;
          updateMapBackButton(false);
          buildMapChart();
        });
        container.style.position = 'relative';
        container.appendChild(btn);
      }
    } else if (btn) {
      btn.remove();
    }
  }

  /**
   * Build Europe map chart (choropleth) with drill-down to NUTS2
   */
  async function buildMapChart() {
    if (!mapChart) return;

    // Map always shows novelty (backward-looking) for the last 10 years
    const mapIndicator = CONFIG.indicators['nouveaute'];
    const mapColumn = 'nouveaute_per_million';
    const mapCountCol = 'nouveaute_count';

    // --- NUTS2 DRILL-DOWN VIEW ---
    if (mapDrillCountry) {
      const geo = await loadNuts2GeoJson();
      if (!geo) { mapDrillCountry = null; return; }

      const nutsPrefix = ISO_TO_NUTS[mapDrillCountry] || mapDrillCountry;
      const countryName = COUNTRY_TO_MAPNAME[mapDrillCountry] || mapDrillCountry;
      const mapId = 'nuts2_' + nutsPrefix;

      // Register country-specific NUTS2 map if not already done
      if (!echarts.getMap(mapId)) {
        const countryFeatures = geo.features.filter(f => f.properties.cntr === nutsPrefix);
        if (countryFeatures.length === 0) {
          mapDrillCountry = null;
          updateMapBackButton(false);
          buildMapChart();
          return;
        }
        echarts.registerMap(mapId, { type: 'FeatureCollection', features: countryFeatures });
      }

      // Get NUTS2 data for this country (use 'all' period for map drill-down)
      const countryRegions = regionsData.filter(d => {
        const code = d.nuts2_code || '';
        return code.substring(0, 2) === nutsPrefix && (d.period || 'all') === 'all';
      });

      // Build lookup from NUTS2 code to region name
      const nuts2Names = {};
      countryRegions.forEach(d => { nuts2Names[d.nuts2_code] = d.region_name || d.nuts2_code; });

      // Use NUTS2 code as name to match GeoJSON 'id' property
      const mapData = countryRegions.map(d => ({
        name: d.nuts2_code,
        value: d[mapCountCol] || 0
      }));

      const values = mapData.map(d => d.value).filter(v => v > 0);
      const maxVal = values.length > 0 ? Math.max(...values) : 1;

      const option = {
        backgroundColor: 'transparent',
        title: {
          text: `${countryName} — Brevets fortement nouveaux par region (NUTS2)`,
          subtext: 'Nombre de brevets (top 1%, 2015-2024)',
          left: 'center',
          textStyle: {
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 14, fontWeight: 600, color: '#0E2A47'
          },
          subtextStyle: {
            fontFamily: "'Merriweather', Georgia, serif",
            fontSize: 11, color: '#55657D'
          }
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#D5DDE8', borderWidth: 1,
          textStyle: { fontFamily: "'Merriweather', Georgia, serif", color: '#0E1320' },
          formatter: function(params) {
            const displayName = nuts2Names[params.name] || params.name;
            const val = params.value || 0;
            return `<strong>${displayName}</strong> (${params.name})<br/>Brevets fortement nouveaux: <strong>${Math.round(val).toLocaleString('fr-FR')}</strong>`;
          }
        },
        visualMap: {
          min: 0, max: maxVal,
          left: 'left', top: 'bottom',
          text: ['Eleve', 'Faible'],
          textStyle: { fontFamily: "'Merriweather', Georgia, serif", fontSize: 10 },
          inRange: { color: ['#E6EBF2', '#5F84E8', '#0E2A47'] },
          calculable: true
        },
        series: [{
          type: 'map',
          map: mapId,
          nameProperty: 'id',
          roam: false,
          label: { show: false },
          emphasis: {
            label: {
              show: true, fontSize: 11, fontWeight: 'bold',
              formatter: function(params) { return nuts2Names[params.name] || params.name; }
            },
            itemStyle: { areaColor: '#E46A4E' }
          },
          itemStyle: {
            borderColor: '#fff', borderWidth: 1,
            areaColor: '#F5F7FA'
          },
          data: mapData
        }]
      };

      mapChart.setOption(option, true);
      updateMapBackButton(true);
      return;
    }

    // --- EUROPE VIEW ---
    if (!europeMapData || europeMapData.length === 0) return;

    // Load Europe GeoJSON if not already loaded
    if (!echarts.getMap('europe')) {
      try {
        const geoResponse = await fetch(CONFIG.dataPath + 'europe.geojson');
        if (geoResponse.ok) {
          const geoJson = await geoResponse.json();
          echarts.registerMap('europe', geoJson);
        } else {
          console.warn('Could not load Europe GeoJSON');
          return;
        }
      } catch (e) {
        console.warn('Failed to load Europe GeoJSON:', e);
        return;
      }
    }

    // Use last 10 years (2015-2024): average the 5-year periods within that range
    const matchingPeriods = europeMapData
      .map(d => d.period)
      .filter(p => {
        if (p === 'all') return false;
        const [ps] = p.split('-').map(Number);
        return ps >= 2015 && ps <= 2024;
      });
    const uniquePeriods = [...new Set(matchingPeriods)];

    let dataForPeriod;
    if (uniquePeriods.length > 0) {
      const periodData = europeMapData.filter(d => uniquePeriods.includes(d.period));
      const byCountry = {};
      periodData.forEach(d => {
        if (!byCountry[d.country]) byCountry[d.country] = { sum: 0, count: 0 };
        const val = d[mapColumn];
        if (val && !isNaN(val)) {
          byCountry[d.country].sum += val;
          byCountry[d.country].count += 1;
        }
      });
      dataForPeriod = Object.entries(byCountry).map(([country, agg]) => ({
        country,
        value: agg.count > 0 ? agg.sum / agg.count : 0
      }));
    } else {
      dataForPeriod = europeMapData.filter(d => d.period === 'all').map(d => ({
        country: d.country,
        value: d[mapColumn] || 0
      }));
    }

    const mapData = dataForPeriod.map(d => ({
      name: COUNTRY_TO_MAPNAME[d.country] || d.country,
      value: d.value || 0
    }));

    const values = mapData.map(d => d.value).filter(v => v > 0);
    const maxVal = values.length > 0 ? Math.max(...values) : 1;

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: 'Brevets fortement nouveaux par pays (par million hab.)',
        subtext: '2015-2024 — Cliquez sur un pays pour voir les régions',
        left: 'center',
        textStyle: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 14, fontWeight: 600, color: '#0E2A47'
        },
        subtextStyle: {
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 11, color: '#55657D'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#D5DDE8', borderWidth: 1,
        textStyle: { fontFamily: "'Merriweather', Georgia, serif", color: '#0E1320' },
        formatter: function(params) {
          const val = params.value || 0;
          return `<strong>${params.name}</strong><br/>Brevets fortement nouveaux: ${val.toFixed(1)} ${mapIndicator.unit}`;
        }
      },
      visualMap: {
        min: 0, max: maxVal,
        left: 'left', top: 'bottom',
        text: ['Eleve', 'Faible'],
        textStyle: { fontFamily: "'Merriweather', Georgia, serif", fontSize: 10 },
        inRange: { color: ['#E6EBF2', '#5F84E8', '#0E2A47'] },
        calculable: true
      },
      series: [{
        type: 'map',
        map: 'europe',
        nameProperty: 'NAME',
        roam: false,
        zoom: 1.2,
        center: [15, 54],
        emphasis: {
          label: { show: true, fontSize: 10 },
          itemStyle: { areaColor: '#E46A4E' }
        },
        itemStyle: {
          borderColor: '#fff', borderWidth: 0.5,
          areaColor: '#F5F7FA'
        },
        data: mapData
      }]
    };

    mapChart.setOption(option, true);
    updateMapBackButton(false);

    // Click handler for drill-down
    mapChart.off('click');
    mapChart.on('click', (params) => {
      if (params.componentType === 'series') {
        const isoCode = MAPNAME_TO_COUNTRY[params.name];
        if (isoCode) {
          mapDrillCountry = isoCode;
          buildMapChart();
        }
      }
    });
  }

  /**
   * Update all charts
   */
  function updateCharts() {
    if (timeseriesChart) buildTimeSeriesChart();
    if (techChart) buildTechChart();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize country selector chips
   */
  function initCountrySelector() {
    const container = document.getElementById('country-selector');
    if (!container) return;

    container.innerHTML = '';

    // Get unique countries from data, filtered by population
    let countryList = Object.entries(countriesData).filter(([code]) => validCountries.has(code));
    if (countryList.length === 0) {
      const uniqueCountries = [...new Set(timeseriesData.map(d => d.country).filter(c => c && validCountries.has(c)))];
      countryList = uniqueCountries.map(code => [code, { name: code, flag: '' }]);
    }

    // Sort by name
    countryList.sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));

    countryList.forEach(([code, data]) => {
      const chip = document.createElement('button');
      chip.className = 'bt-country-chip' + (selectedCountries.includes(code) ? ' active' : '');
      chip.dataset.code = code;
      chip.innerHTML = data.flag ? `${data.flag} ${data.name}` : data.name;

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
   * Download CSV of current selection (shares)
   */
  function downloadCSV() {
    const indicator = CONFIG.indicators[currentIndicator];
    const headers = ['Pays', 'Année', indicator.label + ' (part %)', indicator.label + ' (par million)'];
    const rows = [];

    selectedCountries.forEach(code => {
      const country = countriesData[code];
      timeseriesData
        .filter(d => d.country === code)
        .forEach(d => {
          const share = d[indicator.shareColumn];
          const perMillion = d[indicator.column];
          if (share !== '' && share !== null && !isNaN(share)) {
            rows.push([
              country ? country.name : code,
              d.year,
              (share * 100).toFixed(2),
              (perMillion !== '' && perMillion !== null && !isNaN(perMillion)) ? perMillion.toFixed(2) : ''
            ]);
          }
        });
    });

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(v => `"${v}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `breakthrough_${currentIndicator}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Download CSV of country comparison data
   */
  function downloadCountryCSV() {
    const indicator = CONFIG.indicators[countryIndicator];
    const data = getCountryComparisonData();
    const headers = ['Pays', 'Code ISO', indicator.label + ' (par million hab.)'];
    let csv = headers.join(',') + '\n';
    data.forEach(d => {
      csv += `"${d.name}","${d.code}","${d.value.toFixed(2)}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `breakthrough_pays_${countryIndicator}_${countryPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Download CSV of region data (top regions)
   */
  function downloadRegionCSV() {
    const indicator = CONFIG.indicators[regionIndicator];
    const countCol = regionIndicator === 'nouveaute' ? 'nouveaute_count' : 'rupture_count';
    const filteredData = regionsData.filter(d => (d.period || 'all') === regionPeriod);
    const sorted = [...filteredData].sort((a, b) => (b[countCol] || 0) - (a[countCol] || 0));

    const headers = ['Region', 'Code NUTS2', 'Nouveaute (nb)', 'Rupture (nb)', 'Total brevets'];
    let csv = headers.join(',') + '\n';
    sorted.forEach(d => {
      csv += `"${d.region_name || d.nuts2_code}","${d.nuts2_code}","${d.nouveaute_count || 0}","${d.rupture_count || 0}","${d.total_patents || 0}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `breakthrough_regions_${regionIndicator}_${regionPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Download CSV of technology novelty index data
   */
  function downloadTechCSV() {
    if (!techTimeseriesData || techTimeseriesData.length === 0) return;
    const headers = ['Domaine technologique', 'Code CPC', 'Annee', 'Indice de nouveaute'];
    let csv = headers.join(',') + '\n';
    techTimeseriesData.forEach(d => {
      const label = sectorsData[d.technology]?.name || d.technology;
      csv += `"${label}","${d.technology}","${d.year}","${(d.novelty_index * 100).toFixed(2)}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `breakthrough_tech_nouveaute_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Reset country selection to defaults
   */
  function resetSelection() {
    selectedCountries = [...CONFIG.defaultCountries];

    // Update chip states
    document.querySelectorAll('.bt-country-chip').forEach(chip => {
      if (selectedCountries.includes(chip.dataset.code)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    // Reset zoom on time series
    if (timeseriesChart) {
      timeseriesChart.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100
      });
    }

    updateCharts();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize the tracker
   */
  async function init() {
    // Show loading states
    showLoading('timeseries-chart');
    showLoading('country-chart');
    showLoading('tech-chart');
    showLoading('region-chart');
    showLoading('map-chart');

    // Load data
    const success = await loadData();

    if (!success) {
      showError('timeseries-chart', 'Impossible de charger les données. Veuillez rafraîchir la page.');
      showError('country-chart', 'Données non disponibles');
      showError('tech-chart', 'Données non disponibles');
      showError('region-chart', 'Données non disponibles');
      showError('map-chart', 'Données non disponibles');
      return;
    }

    // All countries in the data are valid (pre-filtered by Python pipeline)
    // For country comparison, additionally filter by population if available
    const countriesInData = new Set(timeseriesData.map(d => d.country).filter(Boolean));
    countriesInData.forEach(code => validCountries.add(code));

    // If population data exists, restrict country comparison to large countries
    const countryMaxPop = {};
    timeseriesData.forEach(d => {
      if (d.country && d.population) {
        if (!countryMaxPop[d.country] || d.population > countryMaxPop[d.country]) {
          countryMaxPop[d.country] = d.population;
        }
      }
    });
    if (Object.keys(countryMaxPop).length > 0) {
      // Override validCountries with population-filtered set
      validCountries.clear();
      Object.entries(countryMaxPop).forEach(([code, pop]) => {
        if (pop >= CONFIG.minPopulation) {
          validCountries.add(code);
        }
      });
    }

    // Filter selected countries to only valid ones
    selectedCountries = selectedCountries.filter(c => validCountries.has(c));
    if (selectedCountries.length === 0) {
      selectedCountries = [...CONFIG.defaultCountries].filter(c => validCountries.has(c));
    }

    // Update KPIs
    updateKPIs();

    // Initialize charts
    const timeseriesContainer = document.getElementById('timeseries-chart');
    const countryContainer = document.getElementById('country-chart');
    const techContainer = document.getElementById('tech-chart');
    const regionContainer = document.getElementById('region-chart');
    const mapContainer = document.getElementById('map-chart');

    if (timeseriesContainer) {
      timeseriesContainer.innerHTML = '';
      timeseriesChart = echarts.init(timeseriesContainer, null, { renderer: 'canvas' });
    }

    if (countryContainer) {
      countryContainer.innerHTML = '';
      countryChart = echarts.init(countryContainer, null, { renderer: 'canvas' });
    }

    if (techContainer) {
      techContainer.innerHTML = '';
      techChart = echarts.init(techContainer, null, { renderer: 'canvas' });
    }

    if (regionContainer) {
      regionContainer.innerHTML = '';
      regionChart = echarts.init(regionContainer, null, { renderer: 'canvas' });
    }

    if (mapContainer) {
      mapContainer.innerHTML = '';
      mapChart = echarts.init(mapContainer, null, { renderer: 'canvas' });
    }

    // Initialize controls
    initIndicatorDropdown();
    initCountrySelector();

    // Setup country comparison controls
    const countryIndicatorSelect = document.getElementById('country-indicator-select');
    if (countryIndicatorSelect) {
      countryIndicatorSelect.addEventListener('change', (e) => {
        countryIndicator = e.target.value;
        if (countryChart) buildCountryChart();
      });
    }

    const periodSelect = document.getElementById('country-period-select');
    if (periodSelect) {
      // Populate with 10-year sub-periods based on data range
      const years = timeseriesData.map(d => d.year).filter(y => y);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);

      periodSelect.innerHTML = '';
      // Add "all" option
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = 'Toutes les années';
      periodSelect.appendChild(allOpt);

      // Generate 10-year periods
      const periodStart = Math.floor(minYear / 10) * 10;
      for (let start = periodStart; start < maxYear; start += 10) {
        const end = Math.min(start + 9, maxYear);
        const opt = document.createElement('option');
        opt.value = `${start}-${end}`;
        opt.textContent = `${start}-${end}`;
        periodSelect.appendChild(opt);
      }

      periodSelect.addEventListener('change', (e) => {
        countryPeriod = e.target.value;
        if (countryChart) buildCountryChart();
      });
    }

    // Setup region comparison controls
    const regionIndicatorSelect = document.getElementById('region-indicator-select');
    if (regionIndicatorSelect) {
      regionIndicatorSelect.addEventListener('change', (e) => {
        regionIndicator = e.target.value;
        if (regionChart) buildRegionChart();
      });
    }

    const regionPeriodSelect = document.getElementById('region-period-select');
    if (regionPeriodSelect) {
      // Populate with periods from regions data
      const regionPeriods = [...new Set(regionsData.map(d => d.period).filter(p => p && p !== 'all'))].sort();
      regionPeriodSelect.innerHTML = '';
      const allOpt2 = document.createElement('option');
      allOpt2.value = 'all';
      allOpt2.textContent = 'Toutes les années';
      regionPeriodSelect.appendChild(allOpt2);
      regionPeriods.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        regionPeriodSelect.appendChild(opt);
      });

      regionPeriodSelect.addEventListener('change', (e) => {
        regionPeriod = e.target.value;
        if (regionChart) buildRegionChart();
      });
    }

    // Setup buttons
    const downloadBtn = document.getElementById('btn-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadCSV);
    }

    const downloadCountryBtn = document.getElementById('btn-download-country');
    if (downloadCountryBtn) {
      downloadCountryBtn.addEventListener('click', downloadCountryCSV);
    }

    const downloadRegionBtn = document.getElementById('btn-download-region');
    if (downloadRegionBtn) {
      downloadRegionBtn.addEventListener('click', downloadRegionCSV);
    }

    const downloadTechBtn = document.getElementById('btn-download-tech');
    if (downloadTechBtn) {
      downloadTechBtn.addEventListener('click', downloadTechCSV);
    }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetSelection);
    }

    // Initial render
    updateCharts();
    if (countryChart) buildCountryChart();
    if (regionChart) buildRegionChart();
    if (mapChart) buildMapChart();

    // Handle resize
    window.addEventListener('resize', () => {
      if (timeseriesChart) timeseriesChart.resize();
      if (countryChart) countryChart.resize();
      if (techChart) techChart.resize();
      if (regionChart) regionChart.resize();
      if (mapChart) mapChart.resize();
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
