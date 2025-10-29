import os
import json

# Define the paths
data_dir = "data"
retro_file = "./data_retro/retrorom-titles.json"
output_file = "index.json"

# Initialize the main dictionary
index_data = {
    "titledb": {}
}

# Iterate through each file in the data directory
for file_name in os.listdir(data_dir):
    if file_name.endswith(".json"):
        file_path = os.path.join(data_dir, file_name)
        # Read and parse the JSON file
        with open(file_path, "r", encoding="utf-8") as file:
            try:
                content = json.load(file)
                tid = file_name.split(".")[0]

                # Prepare the entry with the ID
                entry = {"id": tid}

                # Merge all fields from content into entry
                for key, value in content.items():
                    # Limit screenshots to first 4
                    if key == "screenshots" and isinstance(value, list):
                        entry[key] = value[:4]
                    else:
                        entry[key] = value

                # Add the entry to the index data
                index_data["titledb"][tid] = entry
            except json.JSONDecodeError:
                print(f"Skipping invalid JSON file: {file_name}")

# Add content from retrorom-titles.json
if os.path.exists(retro_file):
    with open(retro_file, "r", encoding="utf-8") as retro:
        try:
            retro_data = json.load(retro)
            for tid, entry in retro_data.items():
                if tid not in index_data["titledb"]:
                    # Limit screenshots to first 4 for new entries
                    if "screenshots" in entry and isinstance(entry["screenshots"], list):
                        entry["screenshots"] = entry["screenshots"][:4]
                    index_data["titledb"][tid] = entry
                else:
                    for key, value in entry.items():
                        if key not in index_data["titledb"][tid]:
                            # Limit screenshots to first 4
                            if key == "screenshots" and isinstance(value, list):
                                index_data["titledb"][tid][key] = value[:4]
                            else:
                                index_data["titledb"][tid][key] = value
        except json.JSONDecodeError:
            print("Invalid JSON in retrorom-titles.json, skipping its content.")

# Sort entries by release date (most recent first)
sorted_entries = sorted(
    index_data["titledb"].items(),
    key=lambda x: x[1].get("releaseDate", "00000000"),
    reverse=True
)

# Rebuild the titledb with sorted entries
index_data["titledb"] = {tid: entry for tid, entry in sorted_entries}

# Write the aggregated data to index.json
with open(output_file, "w", encoding="utf-8") as output:
    json.dump(index_data, output, ensure_ascii=False, indent=4)

print(f"Index file created: {output_file}")
