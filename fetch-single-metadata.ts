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

function isValidTid(tid: string): boolean {
  return TID_PATTERN.test(tid);
}

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

async function loadOwnedEntry(tid: string): Promise<OwnedEntry | null> {
  try {
    const response = await fetch(OWNED_URL);
    if (!response.ok) return null;
    const catalog = (await response.json()) as OwnedCatalog;
    return catalog[tid] ?? catalog[tid.toUpperCase()] ?? null;
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
  owned: OwnedEntry | null
): Promise<GameMetadata | null> {
  const ownedName = owned?.["Game Name"]?.trim() || "";
  const version = parseVersion(owned?.Version);
  const size = typeof owned?.Size === "number" ? owned.Size : 0;

  const base: GameMetadata = {
    name: ownedName,
    publisher: "",
    releaseDate: "",
    description: "",
    bannerUrl: "",
    iconUrl: "",
    screenshots: [],
    version,
    size,
  };

  if (!supportsNlib(tid)) {
    return base.name ? base : null;
  }

  const nlib = await fetchNlib(tid);
  const name = nlib?.name?.trim() || ownedName;
  if (!name) {
    return null;
  }

  return {
    name,
    publisher: nlib?.publisher || "",
    releaseDate: formatDate(nlib?.releaseDate),
    description: nlib?.description || "",
    bannerUrl: nlib?.banner || "",
    iconUrl: nlib?.icon ? `https://api.nlib.cc/nx/${tid}/icon/200` : "",
    screenshots: extractScreenshots(nlib?.screens),
    version,
    size,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let tid: string;

  if (args.length > 0) {
    tid = args[0].toUpperCase().trim();
  } else {
    const input = prompt("TID:");
    if (!input) {
      console.error("No TID provided.");
      process.exit(1);
    }
    tid = input.toUpperCase().trim();
  }

  if (!isValidTid(tid)) {
    console.error(`Invalid TID: ${tid}`);
    console.error("Expected 16 hexadecimal characters.");
    process.exit(1);
  }

  console.log(`TID: ${tid}`);
  if (!supportsNlib(tid)) {
    console.log("Non-01 TID: owned.json only (nlib skipped)");
  }

  const owned = await loadOwnedEntry(tid);
  if (owned) {
    console.log(
      `owned: "${owned["Game Name"]}" v${owned.Version} size=${owned.Size}`
    );
  } else {
    console.log("owned: not found");
  }

  const metadata = await buildMetadata(tid, owned);
  if (!metadata) {
    console.error(`Unable to build metadata for ${tid}`);
    process.exit(1);
  }

  await Bun.write("data/.gitkeep", "");
  const filePath = `data/${tid}.json`;
  await Bun.write(filePath, JSON.stringify(metadata, null, 2));

  console.log(`Wrote ${filePath}`);
  console.log(`  name:      ${metadata.name}`);
  console.log(`  publisher: ${metadata.publisher}`);
  console.log(`  release:   ${metadata.releaseDate}`);
  console.log(`  version:   ${metadata.version}`);
  console.log(`  size:      ${metadata.size}`);
  console.log(`  screens:   ${metadata.screenshots.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
