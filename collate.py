import os

SRC_DIR = 'src'
OUTPUT_FILE = 'collated.txt'

def collate():
    if not os.path.exists(SRC_DIR):
        print(f"Error: Directory '{SRC_DIR}' does not exist.")
        return

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        # Walk through the src directory
        for root, _, files in os.walk(SRC_DIR):
            for file in sorted(files):
                file_path = os.path.join(root, file)
                print(f"Adding {file_path}...")
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        outfile.write(f"\n\n--- {file_path} ---\n\n")
                        outfile.write(infile.read())
                except Exception as e:
                    print(f"Could not read {file_path}: {e}")
                    
    print(f"\nSuccessfully collated files into {OUTPUT_FILE}")

if __name__ == '__main__':
    collate()
