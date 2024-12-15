import os
import json

# Define the path to the data directory
data_dir = "data"
output_file = "index.json"

# Initialize the main dictionary
index_data = {
    "success": "NX META UP",
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
                title_name = content.get("title", "Unknown Title")
                region = content.get("region", "Unknown Region")
                description = content.get("description", "No description available")
                # Add the entry to the index data
                index_data["titledb"][tid] = {
                    "id": tid,
                    "name": title_name,
                    "region": region,
                    "description": description
                }
            except json.JSONDecodeError:
                print(f"Skipping invalid JSON file: {file_name}")

# Write the aggregated data to index.json
with open(output_file, "w", encoding="utf-8") as output:
    json.dump(index_data, output, ensure_ascii=False, indent=4)

print(f"Index file created: {output_file}")
