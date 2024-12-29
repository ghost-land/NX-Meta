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
                
                # Prepare the entry dynamically based on available fields
                entry = {"id": tid}
                if "title" in content:
                    entry["name"] = content["title"]
                if "region" in content:
                    entry["region"] = content["region"]
                if "description" in content:
                    entry["description"] = content["description"]

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
                # Merge or add new entries
                if tid not in index_data["titledb"]:
                    index_data["titledb"][tid] = entry
                else:
                    # Update existing entry with missing fields
                    for key, value in entry.items():
                        if key not in index_data["titledb"][tid]:
                            index_data["titledb"][tid][key] = value
        except json.JSONDecodeError:
            print("Invalid JSON in retrorom-titles.json, skipping its content.")

# Write the aggregated data to index.json
with open(output_file, "w", encoding="utf-8") as output:
    json.dump(index_data, output, ensure_ascii=False, indent=4)

print(f"Index file created: {output_file}")
