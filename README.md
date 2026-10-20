# NX-Meta

Builds a Tinfoil-compatible title database (`index.tfl`) from owned NX titles and public metadata.

## Pipeline

1. Download the owned catalog from `https://data.ghostland.at/nx/owned.json`
2. Enrich each title with [nlib](https://api.nlib.cc) metadata (name, publisher, release date, description, banner, icon, screenshots)
3. Fall back to owned catalog fields (`Game Name`, `Version`, `Size`) when nlib has no entry
4. Aggregate `data/*.json` into `index.json`
5. Encrypt `index.json` into `index.tfl`

Non-`01` title IDs (e.g. `05…`) skip nlib and use owned data only.

## Requirements

- [Bun](https://bun.sh)
- Python 3.12+
- `pip install -r requirements.txt`

## Usage

```bash
./build.sh
```

This refreshes metadata, rebuilds `index.json`, and produces `index.tfl`.

### Individual steps

```bash
bun fetch-metadata.ts                              # refresh all titles (writes only when changed)
bun fetch-single-metadata.ts 0100000000010000      # single TID
python3 indexer.py                                 # data/ -> index.json
python3 encrypt.py --zstd -k public.key -i index.json -o index.tfl
```

## Automation

A GitHub Action runs the full pipeline once per day (03:00 UTC) and on demand via **Actions → Daily metadata build**.

Changed files under `data/`, plus `index.json` and `index.tfl`, are committed back to `main`.

## Output layout

| Path | Description |
|------|-------------|
| `data/{TID}.json` | Per-title metadata |
| `index.json` | Aggregated title database |
| `index.tfl` | Encrypted Tinfoil index |
| `public.key` | RSA public key used for encryption |

## License

[Unlicense](LICENSE) — public domain. Use it for anything.
