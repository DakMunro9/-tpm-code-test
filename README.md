# -tpm-code-test

# Listings Enricher — Technical Documentation

## Overview

This project is a React-based tool that ingests **two CSV files**:

* `listings.csv`: contains real estate listings with APNs formatted with dashes.
* `climate.csv`: contains climate information with APNs as digits only.

The app normalizes, filters, deduplicates, and enriches the listings with climate data. Results can be previewed in the UI or exported as `listings_enriched.json`.

---

## Data Processing Pipeline

### 1. Normalize APNs

* Strip all non-digit characters from `apn` values in both files.
* This ensures consistent keys for joining datasets.

### 2. Filter Listings

* Keep only listings where `status` ∈ {`for_sale`, `pending`, `sold`}.
* Discard rows missing essential fields: `apn`, `address`, `zip`, `price`, `sqft`.
* Convert numeric fields (`price`, `sqft`, `beds`, `baths`) into numbers, discarding invalid values.

### 3. Deduplicate by APN

* If multiple listings share the same normalized APN, keep the one with the lowest price.
* This prevents inflated duplicates from skewing results.

### 4. Enrich with Climate Data

* Left-join `listings` with `climate` on normalized APN.
* Add `flood_zone` and `avg_rain_inches` fields.
* If no climate data exists for an APN, values are set to `null`.

### 5. Derived Fields

* `price_per_sqft = round(price / sqft)`.
* `full_address = "{address}, {city}, {state} {zip}"`.

### 6. Sort Output

* Sort all results by `price` ascending.

### 7. Export

* Final dataset can be previewed in the UI.
* Users can export the data as `listings_enriched.json` or copy JSON to the clipboard.

---

## Technology Stack

* **React**: Component-based UI framework.
* **Papaparse**: CSV parsing library.
* **Zod**: Schema validation for listings and climate rows.
* **Lucide-react**: Icons for UI elements.
* **Tailwind CSS (utility classes)**: Styling.

---

## User Interface Features

* **File Uploads**: Select or paste `listings.csv` and `climate.csv`.
* **Load Demo Data**: Quickly load example CSVs for testing.
* **Process Button**: Runs the pipeline and displays enriched results.
* **Download JSON**: Saves results as `listings_enriched.json`.
* **Copy JSON**: Copies the enriched JSON payload to the clipboard.
* **Results Preview**: Interactive table of enriched listings.

---

## Example Output

```json
{
  "apn": "12-34-567890",
  "full_address": "12 Oak St, Orlando, FL 32801",
  "price": 440000,
  "beds": 3,
  "baths": 2,
  "sqft": 1600,
  "price_per_sqft": 275,
  "status": "for_sale",
  "flood_zone": "AE",
  "avg_rain_inches": 52.1
}
```

---

# README

## Listings Enricher

React app that cleans, deduplicates, and enriches real estate listings with climate data.

### Features

* Normalize APNs across datasets.
* Filter invalid or irrelevant listings.
* Deduplicate by APN, keeping lowest-priced listing.
* Join with climate data on APN.
* Derive price per square foot and full address.
* Preview enriched results.
* Export results to `listings_enriched.json` or copy JSON.

### Installation

```bash
git clone <repo-url>
cd listings-enricher
npm install
npm start
```

### Usage

1. Run `npm start` and open the app in your browser.
2. Upload `listings.csv` and `climate.csv`.
3. Click **Process**.
4. Preview results in the table.
5. Download JSON or copy it to clipboard.

### Example CSVs

* **Listings**: `apn, address, city, state, zip, price, beds, baths, sqft, status`
* **Climate**: `apn, flood_zone, avg_rain_inches`

### Exported JSON

Each listing is enriched with climate data and derived fields.
