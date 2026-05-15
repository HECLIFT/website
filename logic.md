# Breakthrough Tracker - Pipeline Logic

This document describes the data pipeline and architecture of the **Innovation de rupture** tracker, from raw data to the interactive dashboard.

## Overview

The tracker analyzes **4.5 million EPO patent abstracts** (1983-2024) to identify breakthrough patents using text embedding similarity (KPST methodology). It produces interactive charts showing breakthrough patent production per country, per NUTS2 region, and per technology field.

**Source code**: `novelty/Dario-Antonin_Novelty/`
**Website output**: `website_oift/data/innovation-data/breakthrough/`
**Dashboard page**: `website_oift/innovation-data/breakthrough/index.qmd`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                  │
├──────────────────┬──────────────────┬──────────────────┬────────────┤
│ BigQuery/PATSTAT │ REGPAT (OECD)    │ World Bank API   │ Eurostat   │
│ (EPO abstracts + │ (inventor        │ (population)     │ (NUTS2     │
│  CPC codes)      │  locations)      │                  │  GeoJSON)  │
└────────┬─────────┴────────┬─────────┴────────┬─────────┴──────┬─────┘
         │                  │                  │                │
         ▼                  ▼                  ▼                │
┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│ epo_abstracts  │ │ REGPAT/        │ │ world_bank_    │       │
│ .csv           │ │ *_Inv_reg.txt  │ │ population.csv │       │
│ (data/raw/)    │ │ (data/raw/)    │ │ (data/raw/)    │       │
└────────┬───────┘ └────────┬───────┘ └────────┬───────┘       │
         │                  │                  │                │
    ┌────▼────┐             │                  │                │
    │ Embed   │             │                  │                │
    │ (SBERT) │             │                  │                │
    └────┬────┘             │                  │                │
         │                  │                  │                │
    ┌────▼────┐             │                  │                │
    │Novelty  │             │                  │                │
    │(KPST)   │             │                  │                │
    └────┬────┘             │                  │                │
         │                  │                  │                │
         ▼                  ▼                  ▼                │
┌─────────────────────────────────────────────────────┐         │
│          build_dashboard_data.py                     │         │
│  (merge, aggregate, compute per-capita)              │         │
└────────────────────────┬────────────────────────────┘         │
                         │                                      │
                         ▼                                      ▼
              ┌─────────────────────┐              ┌─────────────────┐
              │ data/processed/     │              │ Manual download  │
              │ dashboard/          │              │ from Eurostat    │
              │  ├ timeseries.csv   │              │ GISCO            │
              │  ├ sectors_data.csv │              └────────┬────────┘
              │  ├ tech_timeseries  │                       │
              │  ├ regions_data.csv │                       │
              │  ├ europe_map.csv   │                       │
              │  ├ summary.json     │                       │
              │  ├ countries.json   │                       │
              │  └ sectors.json     │                       │
              └─────────┬───────────┘                       │
                        │                                   │
                   Manual copy                              │
                        │                                   │
                        ▼                                   ▼
              ┌──────────────────────────────────────────────────────┐
              │ website_oift/data/innovation-data/breakthrough/      │
              │  ├ timeseries.csv                                    │
              │  ├ sectors_data.csv                                  │
              │  ├ tech_timeseries.csv                               │
              │  ├ regions_data.csv                                  │
              │  ├ europe_map.csv                                    │
              │  ├ summary.json                                      │
              │  ├ countries.json                                    │
              │  ├ sectors.json                                      │
              │  ├ europe.geojson    ← static, rarely changes        │
              │  └ nuts2.geojson     ← static, rarely changes        │
              └──────────────────────────────────────────────────────┘
```

---

## Pipeline Steps

### Step 1: Fetch abstracts from BigQuery

**Script**: `scripts/fetch_bigquery.py`
**Input**: Google BigQuery (PATSTAT tables)
**Output**: `data/raw/epo_abstracts.csv` (columns: `publication_number`, `abstract`, `filing_date`)

Fetches EPO patent abstracts incrementally (only new patents not already embedded). Triggered automatically by `build_dashboard_data.py` when >10,000 new abstracts are detected.

### Step 2: Generate embeddings

**Script**: `EPO_Embed_Abstract.py`
**Model**: [PatentSBERTa_V2](https://huggingface.co/AAUBS/PatentSBERTa_V2) (Sentence-BERT pre-trained on patent text)
**Input**: `data/raw/epo_abstracts.csv`
**Output**: `data/processed/epo_embeddings.parquet`

Each patent abstract is encoded into a dense vector. Processing is incremental: only patents not already in the output file are embedded.

### Step 3: Compute novelty scores

**Script**: `Novelty.py` (with `--force-recompute`)
**Input**: `data/processed/epo_embeddings.parquet`
**Output**: `data/processed/novelty_kpst.parquet`

For each patent, computes:
- `backward_sum`: sum of cosine similarities to all patents filed in the **previous 5 years**
- `forward_sum`: sum of cosine similarities to all patents filed in the **next 5 years**

**Important**: When new patents are added, ALL scores must be recomputed from scratch because `forward_sum` for historical patents changes when new future patents are added. The `--force-recompute` flag ensures this.

### Step 4: Fetch CPC codes

**Script**: `scripts/fetch_cpc.py` + `scripts/merge_cpc.py`
**Input**: BigQuery (CPC classification tables)
**Output**: `data/intermediate/cpc_with_weights.parquet`

Fetches CPC (Cooperative Patent Classification) codes for each patent. Each patent can have multiple CPC codes; weights are computed proportionally.

### Step 5: Merge REGPAT data

**Script**: `scripts/merge_regpat.py`
**Input**: `data/raw/REGPAT/*_Inv_reg.txt` (manually downloaded from OECD)
**Output**: `data/intermediate/regpat_country_weights.parquet`

Assigns each patent to countries based on inventor location. Multi-country patents get fractional weights (1/N per inventor).

### Step 6: Fetch population data

**Script**: `scripts/fetch_population.py`
**Input**: World Bank API (indicator SP.POP.TOTL)
**Output**: `data/raw/population/world_bank_population.csv`

**NOT called automatically** by the main pipeline. Must be run separately:
```bash
python scripts/fetch_population.py
```
Since population changes slowly, this only needs updating once per year.

### Step 7: Build dashboard data

**Script**: `scripts/build_dashboard_data.py` (step 8 internally)
**Input**: All intermediate files from steps 1-6
**Output**: `data/processed/dashboard/` (8 files)

This step:
1. Loads novelty scores, CPC codes, REGPAT weights, and population
2. Computes breakthrough flags (top/bottom 1% per year):
   - `nouveaute_breakthrough`: bottom 1% of `backward_sum` (most novel)
   - `rupture_breakthrough`: top 1% of `importance` (= `forward_sum / backward_sum`)
3. Merges patent-level data with country and CPC classification
4. Aggregates by year × country, computes per-million-inhabitants rates
5. Aggregates by CPC section (stacked area chart)
6. Computes novelty index by tech field (4 CPC subclasses: G06N, C12N, A61K, H01L)
7. Aggregates by NUTS2 region (from raw REGPAT inventor file)
8. Generates Europe map data (per-million by 5-year period)

### Step 8: Copy to website

**Manual step**. Copy all files from `data/processed/dashboard/` to:
```
website_oift/data/innovation-data/breakthrough/
```

The GeoJSON files (`europe.geojson`, `nuts2.geojson`) are static and don't need updating unless country/region boundaries change.

---

## Update Procedure

To update the tracker with new PATSTAT data:

### Prerequisites (manual, infrequent)

1. **REGPAT update**: Download the latest REGPAT inventor file from [OECD](https://www.oecd.org/sti/inno/intellectual-property-statistics-and-analysis.htm). Place in `data/raw/REGPAT/`. Delete the cached parquet files in `data/intermediate/` (`regpat_country_weights.parquet` and `regpat_nuts2_weights.parquet`) to force recomputation.

2. **Population update** (once per year):
   ```bash
   python scripts/fetch_population.py
   ```

### Main pipeline (automated)

3. **Run the full pipeline**:
   ```bash
   python scripts/build_dashboard_data.py
   ```
   This automatically:
   - Checks BigQuery for new patent abstracts
   - Fetches new abstracts if >10,000 new (or use `--force-fetch`)
   - Generates embeddings for new abstracts (incremental)
   - **Recomputes ALL novelty scores from scratch** (mandatory: forward_sum changes when new patents are added)
   - Fetches/merges CPC codes
   - Merges REGPAT country weights
   - Builds all dashboard CSV/JSON files

4. **Copy output to website**:
   ```bash
   cp data/processed/dashboard/* ../../website_oift/data/innovation-data/breakthrough/
   ```

5. **Rebuild the website** (Quarto):
   ```bash
   cd ../../website_oift && quarto render innovation-data/breakthrough/index.qmd
   ```

### Quick rebuild (no new patent data)

If you only need to change dashboard aggregation logic (thresholds, countries, etc.):
```bash
python scripts/build_dashboard_data.py --skip-upstream
```

---

## Frontend Architecture

### Files

| File | Role |
|------|------|
| `innovation-data/breakthrough/index.qmd` | Page structure (Quarto markdown + HTML) |
| `assets/js/breakthrough-tracker.js` | All chart logic (ECharts) |
| `assets/css/breakthrough-tracker.css` | Styles (LIFT design system) |

### Charts

1. **Time series** (stacked area): Share of breakthrough patents by country over time. User selects indicator (Nouveauté/Rupture) and countries.
2. **Tech fields** (multi-line): Novelty index for 4 CPC subclasses (G06N, C12N, A61K, H01L) relative to global average.
3. **Country comparison** (horizontal bar): Average breakthrough per million by country for selected period.
4. **Region comparison** (horizontal bar): Top 10 NUTS2 regions by breakthrough count.
5. **Europe map** (choropleth): Breakthrough per million by country (2015-2024, novelty only). Click to drill down to NUTS2 regions.

### Data flow (frontend)

```
Page load → fetch 8 data files (CSV/JSON/GeoJSON)
         → parse CSV, update KPIs
         → render all charts
         → attach event handlers (indicator, country, period selects)
```

### Indicators

| Indicator | Score | Threshold | Available years |
|-----------|-------|-----------|-----------------|
| Nouveauté | `backward_sum` | Bottom 1% | All (1983-2024) |
| Rupture | `forward_sum / backward_sum` | Top 1% | Up to max_year - 5 (2019) |

---

## Key Design Decisions

1. **Sum-based scores** (not average): Following KPST methodology. This means scores are sensitive to the volume of patents in the comparison window. High-volume fields (automotive, mechanical) tend to have higher forward_sum.

2. **Annual thresholds**: The 1% cutoff is computed within each filing year to account for changing patent volumes and embedding distributions over time.

3. **Fractional counting**: Multi-country patents are split proportionally by number of inventors. A patent with 2 French and 1 German inventor counts as 2/3 for France and 1/3 for Germany.

4. **Force recompute**: When new patents are added, all `forward_sum` values change (a 2015 patent's similarity to 2016-2020 patents may change if new 2016-2020 patents are added). The pipeline always recomputes from scratch.

5. **Influence removed from UI**: The standalone `forward_sum` measure was removed because it's confounded with technology field size (high-volume fields like automotive dominate). The ratio (Rupture = forward/backward) partially corrects for this.

---

## File Formats

### timeseries.csv
```
year, country, nouveaute_count, influence_count, rupture_count, total_patents,
nouveaute_share, influence_share, rupture_share, population,
nouveaute_per_million, influence_per_million, rupture_per_million
```

### tech_timeseries.csv
```
technology, year, novelty_index
```
Where `novelty_index = (global_mean_backward - field_mean_backward) / global_mean_backward`

### regions_data.csv
```
nuts2_code, period, nouveaute_count, influence_count, rupture_count, total_patents, region_name
```
Periods: `1980-1989`, `1990-1999`, ..., `2020-2029`, `all`

### europe_map.csv
```
country, period, nouveaute_per_million, influence_per_million, rupture_per_million
```
Periods: 5-year windows + `all`

### summary.json
```json
{
  "total_patents": 4529513,
  "countries_count": 37,
  "sectors_count": 8,
  "year_min": 1983,
  "year_max": 2024,
  "influence_max_year": 2019,
  "breakthrough_percentile": 99
}
```

---

## Dependencies

### Python (pipeline)
- `pandas`, `numpy`, `polars` (data processing)
- `sentence-transformers` (PatentSBERTa_V2 model)
- `pyarrow` (parquet I/O)
- `google-cloud-bigquery` (PATSTAT access)
- `requests` (World Bank API)
- `pyyaml` (config)

### Frontend
- [ECharts 5.5.0](https://echarts.apache.org/) (CDN)
- No other dependencies (vanilla JS)

### Data access
- Google Cloud project with BigQuery access to PATSTAT tables
- OECD REGPAT data (manual download, updated ~annually)
- World Bank API (public, no auth needed)
