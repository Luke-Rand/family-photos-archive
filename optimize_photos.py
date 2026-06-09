import os
import json
import re
import time
from PIL import Image, ImageOps

# Load configuration
PHOTOS_DIR = 'photos'
archive_title = 'Family Photo Archive'

config_path = 'config.json'
if os.path.exists(config_path):
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            PHOTOS_DIR = config.get('photos_dir', 'photos')
            archive_title = config.get('title', 'Family Photo Archive')
    except Exception as e:
        print(f"Warning: Could not parse config.json: {e}")

THUMBNAILS_DIR = os.path.join(PHOTOS_DIR, 'thumbnails')
PREVIEWS_DIR = os.path.join(PHOTOS_DIR, 'previews')

# Ensure directories exist
os.makedirs(THUMBNAILS_DIR, exist_ok=True)
os.makedirs(PREVIEWS_DIR, exist_ok=True)

MONTHS = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
}

def parse_date(date_str):
    """Parses date string into a tuple (year, month_num) for sorting."""
    if not date_str:
        return (9999, 99)  # Sort unknown/undated photos at the end
    
    clean = date_str.strip().lower()
    
    # Match "Month Year" (e.g., "June 1970", "october 1970")
    match = re.match(r'([a-z]+)\s+(\d{4})', clean)
    if match:
        month_name = match.group(1)
        year = int(match.group(2))
        month_num = MONTHS.get(month_name, 0)
        return (year, month_num)
    
    # Match just "Year" (four digits)
    match_year = re.match(r'^(\d{4})$', clean)
    if match_year:
        return (int(match_year.group(1)), 0)
        
    return (9999, 99)

def process_image(filename):
    """Generates optimized thumbnails and previews for a given image, handling rotation."""
    src_path = os.path.join(PHOTOS_DIR, filename)
    thumb_path = os.path.join(THUMBNAILS_DIR, filename)
    preview_path = os.path.join(PREVIEWS_DIR, filename)
    
    thumb_needed = not os.path.exists(thumb_path)
    preview_needed = not os.path.exists(preview_path)
    
    if not (thumb_needed or preview_needed):
        return  # Already processed
        
    try:
        # Open image
        img = Image.open(src_path)
        
        # Transpose image based on EXIF orientation if it exists
        img = ImageOps.exif_transpose(img)
        
        # Convert RGBA to RGB if necessary (e.g. for JPEGs)
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            img = img.convert('RGB')
            
        # Create and save preview (max 1600px width/height)
        if preview_needed:
            preview_img = img.copy()
            preview_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            preview_img.save(preview_path, 'JPEG', quality=85)
            
        # Create and save thumbnail (max 800px width/height)
        if thumb_needed:
            thumb_img = img.copy()
            thumb_img.thumbnail((800, 800), Image.Resampling.LANCZOS)
            thumb_img.save(thumb_path, 'JPEG', quality=85)
            
        print(f"Optimized: {filename}")
    except Exception as e:
        print(f"Error processing {filename}: {e}")

def main():
    print(f"Starting {archive_title} processing script...")
    start_time = time.time()
    
    # Gather all jpeg/jpg files in photos/ (excluding subdirectories)
    image_files = []
    for f in os.listdir(PHOTOS_DIR):
        if os.path.isfile(os.path.join(PHOTOS_DIR, f)) and f.lower().endswith(('.jpg', '.jpeg')):
            image_files.append(f)
            
    print(f"Found {len(image_files)} image files in {PHOTOS_DIR}/.")
    
    gallery_data = []
    
    # Process images and compile metadata
    for i, filename in enumerate(image_files):
        # Generate thumbnails and previews
        process_image(filename)
        
        # Load sidecar metadata if available
        base_name = os.path.splitext(filename)[0]
        json_filename = base_name + '.json'
        json_path = os.path.join(PHOTOS_DIR, json_filename)
        
        metadata = {
            "filename": filename,
            "thumbnail": f"photos/thumbnails/{filename}",
            "preview": f"photos/previews/{filename}",
            "original": f"photos/{filename}",
            "subject": "",
            "date": "",
            "location": "",
            "description": "",
            "tags": [],
            "people": [],
            "custom": {},
            "ai_features": []
        }
        
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as jf:
                    sidecar = json.load(jf)
                    metadata.update({
                        "subject": sidecar.get("subject", "").strip(),
                        "date": sidecar.get("date", "").strip(),
                        "location": sidecar.get("location", "").strip(),
                        "description": sidecar.get("description", "").strip(),
                        "tags": [t.strip().lower() for t in sidecar.get("tags", []) if t.strip()],
                        "people": [p.strip() for p in sidecar.get("people", []) if p.strip()],
                        "custom": sidecar.get("custom", {}),
                        "ai_features": sidecar.get("ai_features", [])
                    })
            except Exception as e:
                print(f"Warning: Failed to parse metadata for {json_filename}: {e}")
        else:
            # Try matching with case-insensitive json name if exact match not found
            # (just in case some are lowercase vs uppercase extensions)
            for f in os.listdir(PHOTOS_DIR):
                if f.lower() == json_filename.lower():
                    try:
                        with open(os.path.join(PHOTOS_DIR, f), 'r', encoding='utf-8') as jf:
                            sidecar = json.load(jf)
                            metadata.update({
                                "subject": sidecar.get("subject", "").strip(),
                                "date": sidecar.get("date", "").strip(),
                                "location": sidecar.get("location", "").strip(),
                                "description": sidecar.get("description", "").strip(),
                                "tags": [t.strip().lower() for t in sidecar.get("tags", []) if t.strip()],
                                "people": [p.strip() for p in sidecar.get("people", []) if p.strip()],
                                "custom": sidecar.get("custom", {}),
                                "ai_features": sidecar.get("ai_features", [])
                            })
                    except Exception as e:
                        pass
                    break
        
        # Parse sortable date key
        sort_year, sort_month = parse_date(metadata["date"])
        metadata["sort_key"] = (sort_year, sort_month, filename.lower())
        
        gallery_data.append(metadata)
        
        if (i + 1) % 50 == 0 or (i + 1) == len(image_files):
            print(f"Loaded metadata for {i + 1}/{len(image_files)} photos...")
            
    # Sort chronologically: date ascending, then filename ascending
    gallery_data.sort(key=lambda x: x["sort_key"])
    
    # Remove sort_key before serializing to clean up file size
    for item in gallery_data:
        del item["sort_key"]
        
    # Write to gallery_data.js in root
    js_content = f"// Automatically generated database of photos\nwindow.GALLERY_DATA = {json.dumps(gallery_data, indent=2, ensure_ascii=False)};\n"
    with open('gallery_data.js', 'w', encoding='utf-8') as fjs:
        fjs.write(js_content)
        
    elapsed = time.time() - start_time
    print(f"Finished processing and metadata generation in {elapsed:.2f} seconds!")
    print(f"Total photos indexed: {len(gallery_data)}")
    print(f"Database saved to gallery_data.js")

if __name__ == "__main__":
    main()
