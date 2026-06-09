# Family Photo Archive

A beautifully curated, interactive web photo gallery designed to showcase chronological family photos scanned and digitized from 35mm slides or digital archives. The gallery supports tagging people, locations, descriptions, custom tags, and editing metadata directly from the browser.

---

## Features

- **Decade/Era Filtering**: Filter slides dynamically using custom eras.
- **Search**: Interactive search by subject, descriptions, tags, people present, or location.
- **Interactive Lightbox**: Inspect high-resolution slides with retro mount aesthetics (displaying dynamic slide labels).
- **In-Browser Annotations**: Edit descriptions, titles, dates, locations, tags, and people directly from the image viewer (which updates JSON sidecar files on the fly).
- **Automated Processing**: Python automation script to resize high-resolution images, auto-transpose rotations, and compile sidecar metadata into a fast in-memory database.

---

## Setup & Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v16+)
- [Python 3](https://www.python.org/) with [Pillow](https://python-pillow.org/) installed:
  ```bash
  pip install Pillow
  ```

---

## Installation

1. Clone or download this repository.
2. Install local server dependencies:
   ```bash
   npm install
   ```

---

## Configuration

You can customize the archive for your family by modifying `config.json` in the root directory. If you are starting fresh, copy `config.example.json` to `config.json` and fill in your details:

```json
{
  "title": "Our Family Photo Archive",
  "subtitle": "A collection of memories and scanned photographs.",
  "description": "A beautifully curated web photo gallery for our family archive.",
  "slide_label": "FAMILY ARCHIVE",
  "port": 8080,
  "photos_dir": "photos",
  "eras": [
    {
      "id": "1980s",
      "label": "1980s",
      "start_year": 1980,
      "end_year": 1989
    },
    {
      "id": "1990s",
      "label": "1990s",
      "start_year": 1990,
      "end_year": 1999
    }
  ]
}
```

### Config Options
- `title`: The main name of your archive shown in the header and tab title.
- `subtitle`: Subtext description displayed under the heading.
- `description`: The meta-description tag for the webpage (for search engines).
- `slide_label`: The branding text written on the bottom border of the white slide mounts in the photo viewer.
- `port`: The port that the local web server binds to (default: `8080`).
- `photos_dir`: The directory containing raw photos and sidecar JSON metadata.
- `eras`: An array of custom decade or date filters, defining their range boundaries (`start_year` to `end_year`).

---

## Running the Application

### 1. Place Your Raw Photos
Drop your JPEG image files (e.g. `IMG_0001.jpg`, `IMG_0002.jpg`) into the configured `photos_dir` (default is `photos`).

### 2. Run the Image Optimizer
Run the Python script to optimize raw images (producing smaller preview and thumbnail copies for the web) and compile metadata sidecars into the main gallery database:
```bash
npm run optimize
```
*(This is equivalent to running `python optimize_photos.py`)*

### 3. Launch the Server
Start the local server to serve static assets and enable metadata updates:
```bash
npm run dev
```
*(This is equivalent to running `node server.js`)*

Open your browser and navigate to `http://localhost:8080` (or your configured port) to view and search the gallery!

---

## Running with Docker

You can package and run this application inside a Docker container. The container will automatically run the image optimizer on startup before launching the server.

### Using Docker Compose (Recommended)

1. Make sure you have a `config.json` in the project root. (You can copy `config.example.json` to `config.json`).
2. Start the container in the background:
   ```bash
   docker compose up -d
   ```
3. Open your browser and navigate to `http://localhost:8080`.

Your local `photos` directory and `config.json` are mounted as volumes so that any metadata changes or added images persist on your host machine.

### Using Docker Commands Directly

If you prefer building and running manually:

1. Build the image:
   ```bash
   docker build -t family-photos-archive .
   ```

2. Run the container:
   ```bash
   docker run -d \
     --name family-photos-archive \
     -p 8080:8080 \
     -v "$(pwd)/photos:/app/photos" \
     -v "$(pwd)/config.json:/app/config.json" \
     family-photos-archive
   ```

### GitHub Actions CI/CD

This repository contains a GitHub Actions workflow configuration (found in `.github/workflows/docker-build.yml`) that automatically builds and pushes a multi-architecture (`linux/amd64` and `linux/arm64`) Docker image to GitHub Container Registry (GHCR) when pushes are made to `main`/`master` or when version tags are pushed.

---

## Metadata Structure (Sidecars)

Each photo in your archive can have an optional sidecar `.json` file containing metadata. For example, `IMG_0001.jpg` can have a sidecar file named `IMG_0001.json` structured as follows:

```json
{
  "subject": "Baby in Rocking Chair",
  "date": "June 1970",
  "location": "Boston, MA",
  "description": "A picture of Robert sitting in the living room chair.",
  "tags": ["portrait", "indoor"],
  "people": ["Robert Littlefield"]
}
```
If you edit photo information using the **Edit Annotations** button inside the gallery's photo viewer, these sidecar JSON files will be updated automatically, and the database will be regenerated instantly.
