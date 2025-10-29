#!/usr/bin/env bun

interface NlibResponse {
  name?: string;
  publisher?: string;
  releaseDate?: string;
  intro?: string;
  description?: string;
  banner?: string;
  icon?: string;
  screens?: {
    count?: number;
    screenshots?: string[];
  } | string[];
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

// Validate TID format
function isValidTid(tid: string): boolean {
  // TID should be 16 hex characters, starting with 01 and ending with 000
  return /^01[0-9A-F]{11}000$/i.test(tid);
}

// Fetch metadata for a TID
async function fetchMetadata(tid: string): Promise<GameMetadata | null> {
  const url = `https://api.nlib.cc/nx/${tid}?fields=name,publisher,releaseDate,intro,description,banner,icon,screens`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ Erreur pour ${tid}: ${response.status}`);
      return null;
    }
    
    const data: NlibResponse = await response.json();
    
    // Use custom icon URL with /200 size when icon is available
    const iconUrl = data.icon ? `https://api.nlib.cc/nx/${tid}/icon/200` : "";
    
    // Extract screenshots array from the API response
    let screenshots: string[] = [];
    if (data.screens) {
      if (Array.isArray(data.screens)) {
        screenshots = data.screens;
      } else if (data.screens.screenshots) {
        screenshots = data.screens.screenshots;
      }
    }
    
    return {
      name: data.name || "",
      publisher: data.publisher || "",
      releaseDate: formatDate(data.releaseDate),
      intro: data.intro || "",
      description: data.description || "",
      bannerUrl: data.banner || "",
      iconUrl: iconUrl,
      screenshots: screenshots
    };
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération de ${tid}:`, error);
    return null;
  }
}

// Main function
async function main() {
  console.log("🎮 Récupération de métadonnées pour un TID spécifique\n");
  
  // Get TID from command line arguments
  const args = process.argv.slice(2);
  let tid: string;
  
  if (args.length > 0) {
    tid = args[0].toUpperCase().trim();
  } else {
    // Prompt for TID if not provided
    console.log("Entrez le TID (ex: 0100152014DFA000):");
    const input = prompt("TID:");
    if (!input) {
      console.error("❌ Aucun TID fourni.");
      process.exit(1);
    }
    tid = input.toUpperCase().trim();
  }
  
  // Validate TID format
  if (!isValidTid(tid)) {
    console.error(`❌ Format de TID invalide: ${tid}`);
    console.error("   Le TID doit être 16 caractères hexadécimaux, commençant par 01 et se terminant par 000.");
    console.error("   Exemple: 0100152014DFA000");
    process.exit(1);
  }
  
  console.log(`\n🔍 Recherche des métadonnées pour: ${tid}`);
  
  // Fetch metadata
  const metadata = await fetchMetadata(tid);
  
  if (!metadata) {
    console.error(`\n❌ Impossible de récupérer les métadonnées pour ${tid}`);
    process.exit(1);
  }
  
  // Create data/ directory if it doesn't exist
  await Bun.write("data/.gitkeep", "");
  
  // Save to file
  const filePath = `data/${tid}.json`;
  await Bun.write(filePath, JSON.stringify(metadata, null, 2));
  
  console.log(`\n✅ Métadonnées récupérées avec succès!`);
  console.log(`\n📋 Informations:`);
  console.log(`   - Nom: ${metadata.name}`);
  console.log(`   - Éditeur: ${metadata.publisher}`);
  console.log(`   - Date de sortie: ${metadata.releaseDate}`);
  console.log(`   - Fichier: ${filePath}`);
  
  if (metadata.screenshots.length > 0) {
    console.log(`   - Captures d'écran: ${metadata.screenshots.length}`);
  }
  
  console.log("\n🎉 Terminé!");
}

// Run the script
main().catch(console.error);

