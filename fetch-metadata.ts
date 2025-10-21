#!/usr/bin/env bun

interface NlibResponse {
  name?: string;
  publisher?: string;
  releaseDate?: string;
  intro?: string;
  description?: string;
  banner?: string;
  icon?: string;
  screens?: string[];
}

interface GameMetadata {
  name: string;
  publisher: string;
  releaseDate: string;
  intro: string;
  description: string;
  bannerUrl: string;
  iconUrl: string;
  screenshots: string[];
}

// Format date from "2025-07-11" to "20250711"
function formatDate(date: string | undefined): string {
  if (!date) return "";
  return date.replace(/-/g, "");
}

// Fetch metadata for a TID
async function fetchMetadata(tid: string): Promise<GameMetadata | null> {
  const url = `https://api.nlib.cc/nx/${tid}?fields=name,publisher,releaseDate,intro,description,banner,icon,screens`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ Error for ${tid}: ${response.status}`);
      return null;
    }
    
    const data: NlibResponse = await response.json();
    
    return {
      name: data.name || "",
      publisher: data.publisher || "",
      releaseDate: formatDate(data.releaseDate),
      intro: data.intro || "",
      description: data.description || "",
      bannerUrl: data.banner || "",
      iconUrl: data.icon || "",
      screenshots: data.screens || []
    };
  } catch (error) {
    console.error(`❌ Error fetching ${tid}:`, error);
    return null;
  }
}

// Extract TIDs from working.txt content
function extractTids(content: string): string[] {
  const lines = content.trim().split("\n");
  const tids: string[] = [];
  
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length > 0) {
      const tid = parts[0].trim();
      // Check that TID starts with 01 and ends with 000 (16 hex chars total)
      if (tid.match(/^01[0-9A-F]{11}000$/i)) {
        tids.push(tid);
      }
    }
  }
  
  return tids;
}

// Process a batch of TIDs in parallel
async function processBatch(tids: string[], startIndex: number): Promise<{ success: number; errors: number }> {
  const results = await Promise.all(
    tids.map(async (tid, index) => {
      const globalIndex = startIndex + index;
      const metadata = await fetchMetadata(tid);
      
      if (metadata) {
        const filePath = `data/${tid}.json`;
        await Bun.write(filePath, JSON.stringify(metadata, null, 2));
        return { tid, success: true };
      }
      return { tid, success: false };
    })
  );
  
  const success = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success).length;
  
  return { success, errors };
}

// Main function
async function main() {
  console.log("🚀 Starting metadata fetch...\n");
  
  // 1. Fetch working.txt file
  console.log("📥 Downloading working.txt...");
  const workingTxtUrl = "https://nx-missing.ghostland.at/data/working.txt";
  
  let workingTxtContent: string;
  try {
    const response = await fetch(workingTxtUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    workingTxtContent = await response.text();
  } catch (error) {
    console.error("❌ Failed to fetch working.txt:", error);
    process.exit(1);
  }
  
  // 2. Extract TIDs
  console.log("🔍 Extracting TIDs...");
  const tids = extractTids(workingTxtContent);
  console.log(`✅ ${tids.length} TIDs found\n`);
  
  // 3. Create data/ directory if it doesn't exist
  await Bun.write("data/.gitkeep", "");
  
  // 4. Fetch metadata for each TID in parallel batches
  const BATCH_SIZE = 20; // Process 20 TIDs at a time
  let totalSuccess = 0;
  let totalErrors = 0;
  
  console.log(`⚡ Processing with ${BATCH_SIZE} parallel requests...\n`);
  
  for (let i = 0; i < tids.length; i += BATCH_SIZE) {
    const batch = tids.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(tids.length / BATCH_SIZE);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} - Processing ${batch.length} TIDs...`);
    
    const { success, errors } = await processBatch(batch, i);
    totalSuccess += success;
    totalErrors += errors;
    
    console.log(`   ✅ Success: ${success} | ❌ Errors: ${errors}`);
    console.log(`   📊 Progress: ${i + batch.length}/${tids.length} (${Math.round((i + batch.length) / tids.length * 100)}%)\n`);
  }
  
  console.log("=".repeat(50));
  console.log(`✅ Done!`);
  console.log(`   - Success: ${totalSuccess}`);
  console.log(`   - Errors: ${totalErrors}`);
  console.log(`   - Total: ${tids.length}`);
}

// Run the script
main().catch(console.error);

