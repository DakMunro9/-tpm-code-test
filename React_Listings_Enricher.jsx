import React, { useCallback, useRef, useState } from "react";
import Papa from "papaparse";
import { Database, FileDown, Play, Trash2, ClipboardCopy } from "lucide-react";
import { z } from "zod";

// --- UI components ---
const Button = ({ children, className = "", ...props }) => (
  <button
    className={`px-4 py-2 rounded-2xl border shadow-sm hover:shadow transition text-sm ${className}`}
    {...props}
  >
    {children}
  </button>
);
const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl border shadow-sm p-4 ${className}`}>{children}</div>
);
const Input = (props) => <input className="w-full rounded-xl border p-2 text-sm" {...props} />;
const Label = ({ children, htmlFor }) => <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">{children}</label>;

// --- Schemas & Types ---
const allowedStatuses = new Set(["for_sale", "pending", "sold"]);
const ListingSchema = z.object({
  apn: z.string(),
  address: z.string(),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip: z.string(),
  price: z.union([z.string(), z.number()]),
  beds: z.union([z.string(), z.number()]).optional().nullable(),
  baths: z.union([z.string(), z.number()]).optional().nullable(),
  sqft: z.union([z.string(), z.number()]),
  status: z.string()
});
const ClimateSchema = z.object({
  apn: z.string(),
  flood_zone: z.string().optional().nullable(),
  avg_rain_inches: z.union([z.string(), z.number()]).optional().nullable()
});

// --- Demo Data ---
const DEMO_LISTINGS_TSV = `apn\taddress\tcity\tstate\tzip\tprice\tbeds\tbaths\tsqft\tstatus\n12-34-567890\t12 Oak St\tOrlando\tFL\t32801\t450000\t3\t2\t1600\tfor_sale\n12-34-567890\t12 Oak St\tOrlando\tFL\t32801\t440000\t3\t2\t1600\tfor_sale\n55-66-777888\t99 Pine Ave\tMiami\tFL\t33101\t800000\t4\t3\t2200\tPending\n99-00-111222\t7 Lake View\tMiami\tFL\t33101\tNaN\t2\t1\t900\tfor_sale\n22-33-444555\t42 Elm Rd\tTampa\tFL\t33602\t520000\t3\t2.5\t1800\tsold\n77-88-999000\t1 Beach Dr\tMiami\tFL\t33101\t1200000\t5\t4\t3500\twithdrawn\n123 Unknown Rd\tOrlando\tFL\t32801\t300000\t2\t1\t900\tfor_sale`;
const DEMO_CLIMATE_CSV = `apn,flood_zone,avg_rain_inches\n1234567890,AE,52.1\n5566777888,X,61.3\n2233444555,VE,49.0`;

// --- Utils ---
const normalizeApn = (apn) => (apn || "").toString().replace(/\D+/g, "");
const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
};
const parseCSV = (text) => Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false, transformHeader: (h) => (h || "").trim().toLowerCase() });

// --- Pipeline ---
function enrichListings(listingsRaw, climateRaw) {
  const listingsParsed = parseCSV(listingsRaw);
  const climateParsed = parseCSV(climateRaw);

  const listingRows = listingsParsed.data.map((r) => ListingSchema.parse(r));
  const climateRows = climateParsed.data.map((r) => ClimateSchema.parse(r));

  const climateIndex = new Map();
  for (const c of climateRows) {
    const napn = normalizeApn(c.apn);
    if (!napn) continue;
    climateIndex.set(napn, {
      flood_zone: c.flood_zone || null,
      avg_rain_inches: c.avg_rain_inches == null || c.avg_rain_inches === "" ? null : num(c.avg_rain_inches)
    });
  }

  const cleaned = [];
  for (const r of listingRows) {
    const napn = normalizeApn(r.apn);
    const status = r.status.toLowerCase();
    const price = num(r.price);
    const sqft = num(r.sqft);

    const row = { ...r, napn, price, sqft, beds: r.beds ? num(r.beds) : null, baths: r.baths ? num(r.baths) : null, status };
    if (!napn || !r.address || !r.zip || !Number.isFinite(price) || !Number.isFinite(sqft)) continue;
    if (!allowedStatuses.has(status)) continue;
    cleaned.push(row);
  }

  const bestByApn = new Map();
  for (const r of cleaned) {
    const existing = bestByApn.get(r.napn);
    if (!existing || r.price < existing.price) bestByApn.set(r.napn, r);
  }

  const enriched = [];
  for (const r of bestByApn.values()) {
    const climate = climateIndex.get(r.napn) || { flood_zone: null, avg_rain_inches: null };
    enriched.push({
      apn: r.apn,
      full_address: `${r.address}, ${r.city}, ${r.state} ${r.zip}`,
      price: r.price,
      beds: r.beds,
      baths: r.baths,
      sqft: r.sqft,
      price_per_sqft: Math.round(r.price / r.sqft),
      status: r.status,
      flood_zone: climate.flood_zone,
      avg_rain_inches: climate.avg_rain_inches
    });
  }

  enriched.sort((a, b) => a.price - b.price);
  return enriched;
}

// --- File helper ---
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Component ---
export default function ListingsEnricher() {
  const [listingsRaw, setListingsRaw] = useState("");
  const [climateRaw, setClimateRaw] = useState("");
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const listingsFileRef = useRef(null);
  const climateFileRef = useRef(null);

  const process = useCallback(() => {
    try {
      const enriched = enrichListings(listingsRaw, climateRaw);
      setResults(enriched);
      setErrors([]);
    } catch (err) {
      setErrors([String(err)]);
    }
  }, [listingsRaw, climateRaw]);

  const handleDownload = () => downloadJSON("listings_enriched.json", results);
  const copyJSON = async () => await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
  const loadDemo = () => { setListingsRaw(DEMO_LISTINGS_TSV); setClimateRaw(DEMO_CLIMATE_CSV); setResults([]); setErrors([]); };
  const clearAll = () => { setListingsRaw(""); setClimateRaw(""); setResults([]); setErrors([]); if (listingsFileRef.current) listingsFileRef.current.value = ""; if (climateFileRef.current) climateFileRef.current.value = ""; };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Listings Enricher (React · Advanced)</h1>
        <div className="flex gap-2">
          <Button onClick={loadDemo} className="bg-black text-white"><Database size={16} className="inline mr-2"/>Load Demo</Button>
          <Button onClick={clearAll}><Trash2 size={16} className="inline mr-2"/>Clear</Button>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <Label>Listings CSV/TSV</Label>
          <Input type="file" accept=".csv,.tsv,.txt" ref={listingsFileRef} onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setListingsRaw(await f.text());
          }} />
          <textarea className="w-full h-40 border rounded-xl p-2 text-xs font-mono mt-2" value={listingsRaw} onChange={(e) => setListingsRaw(e.target.value)} />
        </Card>
        <Card>
          <Label>Climate CSV</Label>
          <Input type="file" accept=".csv,.tsv,.txt" ref={climateFileRef} onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setClimateRaw(await f.text());
          }} />
          <textarea className="w-full h-40 border rounded-xl p-2 text-xs font-mono mt-2" value={climateRaw} onChange={(e) => setClimateRaw(e.target.value)} />
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={process} className="bg-black text-white"><Play size={16} className="inline mr-2"/>Process</Button>
        <Button onClick={handleDownload} disabled={!results.length}><FileDown size={16} className="inline mr-2"/>Download JSON</Button>
        <Button onClick={copyJSON} disabled={!results.length}><ClipboardCopy size={16} className="inline mr-2"/>Copy JSON</Button>
      </div>

      {errors.length > 0 && <Card className="bg-red-50 border-red-200"><pre className="whitespace-pre-wrap text-xs">{errors.join("\n")}</pre></Card>}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Results Preview ({results.length})</h3>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">APN</th>
                <th className="py-2 pr-4">Full Address</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Beds</th>
                <th className="py-2 pr-4">Baths</th>
                <th className="py-2 pr-4">SqFt</th>
                <th className="py-2 pr-4">$/SqFt</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Flood Zone</th>
                <th className="py-2 pr-4">Avg Rain (in)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono">{r.apn}</td>
                  <td className="py-2 pr-4">{r.full_address}</td>
                  <td className="py-2 pr-4">{r.price.toLocaleString()}</td>
                  <td className="py-2 pr-4">{r.beds ?? "—"}</td>
                  <td className="py-2 pr-4">{r.baths ?? "—"}</td>
                  <td className="py-2 pr-4">{r.sqft}</td>
                  <td className="py-2 pr-4">{r.price_per_sqft}</td>
                  <td className="py-2 pr-4 uppercase">{r.status}</td>
                  <td className="py-2 pr-4">{r.flood_zone ?? "—"}</td>
                  <td className="py-2 pr-4">{r.avg_rain_inches ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
