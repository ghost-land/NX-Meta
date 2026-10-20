#!/usr/bin/env bun

interface NlibResponse {
  name?: string;
  publisher?: string;
  releaseDate?: string;
  description?: string;
  banner?: string;
  icon?: string;
  screens?: { count?: number; screenshots?: string[] } | string[];
}

interface OwnedEntry {
  "Game Name": string;
  Version: string;
  Size: number;
}

type OwnedCatalog = Record<string, OwnedEntry>;

interface GameMetadata {
  name: string;
  publisher: string;
  releaseDate: string;
  description: string;
  bannerUrl: string;
  iconUrl: string;
  screenshots: string[];
  version: number;
  size: number;
}

const OWNED_URL = "https://data.ghostland.at/nx/owned.json";
const NLIB_FIELDS =
  "name,publisher,releaseDate,description,banner,icon,screens";
const TID_PATTERN = /^[0-9A-Fa-f]{16}$/;
const BATCH_SIZE = 20;

function isValidTid(tid: string): boolean {
  return TID_PATTERN.test(tid);
}

/** nlib covers retail NX titles (prefix 01) only */
function supportsNlib(tid: string): boolean {
  return tid.toUpperCase().startsWith("01");
}

function formatDate(date: string | undefined): string {
  return date ? date.replace(/-/g, "") : "";
}

function parseVersion(version: string | undefined): number {
  if (!version) return 0;
  const parsed = Number.parseInt(version, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractScreenshots(screens: NlibResponse["screens"]): string[] {
  if (!screens) return [];
  if (Array.isArray(screens)) return screens;
  return screens.screenshots ?? [];
}

function fromOwned(owned: OwnedEntry): GameMetadata {
  return {
    name: owned["Game Name"]?.trim() || "",
    publisher: "",
    releaseDate: "",
    description: "",
    bannerUrl: "",
    iconUrl: "",
    screenshots: [],
    version: parseVersion(owned.Version),
    size: typeof owned.Size === "number" ? owned.Size : 0,
  };
}

function isSameMetadata(a: GameMetadata, b: GameMetadata): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function readExisting(tid: string): Promise<GameMetadata | null> {
  const file = Bun.file(`data/${tid}.json`);
  if (!(await file.exists())) return null;
  try {
    return (await file.json()) as GameMetadata;
  } catch {
    return null;
  }
}

async function fetchNlib(tid: string): Promise<NlibResponse | null> {
  const url = `https://api.nlib.cc/nx/${tid}?fields=${NLIB_FIELDS}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`nlib error ${tid}: HTTP ${response.status}`);
      }
      return null;
    }
    return (await response.json()) as NlibResponse;
  } catch (error) {
    console.error(`nlib error ${tid}:`, error);
    return null;
  }
}

async function buildMetadata(
  tid: string,
  owned: OwnedEntry
): Promise<GameMetadata> {
  const base = fromOwned(owned);

  if (!supportsNlib(tid)) {
    return base;
  }

  const nlib = await fetchNlib(tid);
  if (!nlib) {
    return base;
  }

  return {
    name: nlib.name?.trim() || base.name,
    publisher: nlib.publisher || "",
    releaseDate: formatDate(nlib.releaseDate),
    description: nlib.description || "",
    bannerUrl: nlib.banner || "",
    iconUrl: nlib.icon ? `https://api.nlib.cc/nx/${tid}/icon/200` : "",
    screenshots: extractScreenshots(nlib.screens),
    version: base.version,
    size: base.size,
  };
}

type BatchResult = { written: number; unchanged: number; errors: number };

async function processBatch(
  entries: Array<[string, OwnedEntry]>
): Promise<BatchResult> {
  const results = await Promise.all(
    entries.map(async ([tid, owned]) => {
      try {
        const metadata = await buildMetadata(tid, owned);
        if (!metadata.name) {
          console.error(`no name for ${tid}`);
          return "error" as const;
        }

        const existing = await readExisting(tid);
        if (existing && isSameMetadata(existing, metadata)) {
          return "unchanged" as const;
        }

        await Bun.write(`data/${tid}.json`, JSON.stringify(metadata, null, 2));
        return "written" as const;
      } catch (error) {
        console.error(`failed ${tid}:`, error);
        return "error" as const;
      }
    })
  );

  return {
    written: results.filter((r) => r === "written").length,
    unchanged: results.filter((r) => r === "unchanged").length,
    errors: results.filter((r) => r === "error").length,
  };
}

async function main() {
  console.log("Fetching metadata...\n");

  console.log(`Downloading ${OWNED_URL}`);
  let catalog: OwnedCatalog;
  try {
    const response = await fetch(OWNED_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    catalog = (await response.json()) as OwnedCatalog;
  } catch (error) {
    console.error("Failed to download owned.json:", error);
    process.exit(1);
  }

  await Bun.write("data/.gitkeep", "");

  const entries = Object.entries(catalog).filter(([tid]) => {
    if (!isValidTid(tid)) {
      console.warn(`Skipping invalid TID: ${tid}`);
      return false;
    }
    return true;
  });

  const nlibCount = entries.filter(([tid]) => supportsNlib(tid)).length;
  const ownedOnlyCount = entries.length - nlibCount;

  console.log(`Catalog: ${entries.length} titles`);
  console.log(`  nlib refresh: ${nlibCount}`);
  console.log(`  owned-only (non-01): ${ownedOnlyCount}\n`);

  let written = 0;
  let unchanged = 0;
  let errors = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(entries.length / BATCH_SIZE);
    const progress = Math.round(((i + batch.length) / entries.length) * 100);

    console.log(
      `Batch ${batchNum}/${totalBatches} (${batch.length} TIDs) — ${progress}%`
    );

    const result = await processBatch(batch);
    written += result.written;
    unchanged += result.unchanged;
    errors += result.errors;

    console.log(
      `  written=${result.written} unchanged=${result.unchanged} errors=${result.errors}`
    );
  }

  console.log("\nDone");
  console.log(`  written:    ${written}`);
  console.log(`  unchanged:  ${unchanged}`);
  console.log(`  errors:     ${errors}`);
  console.log(`  total:      ${entries.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
