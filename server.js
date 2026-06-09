const http = require('http');
const fs = require('fs');
const path = require('path');

// Load configuration
let PORT = 8080;
let PHOTOS_DIR = path.join(__dirname, 'photos');
let archiveTitle = 'Family Photo Archive';

const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.port) PORT = parseInt(config.port, 10);
    if (config.photos_dir) {
      PHOTOS_DIR = path.isAbsolute(config.photos_dir) 
        ? config.photos_dir 
        : path.join(__dirname, config.photos_dir);
    }
    if (config.title) archiveTitle = config.title;
  } catch (err) {
    console.error("Warning: Could not parse config.json:", err.message);
  }
}

// Helper to determine content type
function getContentType(filePath) {
  const extname = path.extname(filePath).toLowerCase();
  switch (extname) {
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js': return 'application/javascript';
    case '.json': return 'application/json';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    default: return 'application/octet-stream';
  }
}

// Helper to regenerate gallery_data.js from existing JSON files on disk
function regenerateGalleryData() {
  try {
    const files = fs.readdirSync(PHOTOS_DIR);
    const imageFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
    
    const galleryData = [];
    
    // Month mapping
    const months = {
      'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
      'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
    };
    
    function parseDate(dateStr) {
      if (!dateStr) return [9999, 99];
      const clean = dateStr.trim().toLowerCase();
      // Match "Month Year"
      const match = clean.match(/^([a-z]+)\s+(\d{4})$/);
      if (match) {
        return [parseInt(match[2]), months[match[1]] || 0];
      }
      // Match "Year"
      const matchYear = clean.match(/^(\d{4})$/);
      if (matchYear) {
        return [parseInt(matchYear[1]), 0];
      }
      return [9999, 99];
    }
    
    imageFiles.forEach(filename => {
      const baseName = path.basename(filename, path.extname(filename));
      const jsonFilename = baseName + '.json';
      
      // Look for sidecar
      let sidecarPath = path.join(PHOTOS_DIR, jsonFilename);
      // Case-insensitive fallback
      if (!fs.existsSync(sidecarPath)) {
        const matching = files.find(f => f.toLowerCase() === jsonFilename.toLowerCase());
        if (matching) {
          sidecarPath = path.join(PHOTOS_DIR, matching);
        }
      }
      
      const metadata = {
        filename: filename,
        thumbnail: `photos/thumbnails/${filename}`,
        preview: `photos/previews/${filename}`,
        original: `photos/${filename}`,
        subject: "",
        date: "",
        location: "",
        description: "",
        tags: [],
        people: [],
        custom: {},
        ai_features: []
      };
      
      if (fs.existsSync(sidecarPath)) {
        try {
          const content = fs.readFileSync(sidecarPath, 'utf8');
          const sidecar = JSON.parse(content);
          Object.assign(metadata, {
            subject: (sidecar.subject || "").trim(),
            date: (sidecar.date || "").trim(),
            location: (sidecar.location || "").trim(),
            description: (sidecar.description || "").trim(),
            tags: (sidecar.tags || []).map(t => t.trim().toLowerCase()).filter(Boolean),
            people: (sidecar.people || []).map(p => p.trim()).filter(Boolean),
            custom: sidecar.custom || {},
            ai_features: sidecar.ai_features || []
          });
        } catch (e) {
          console.error(`Error reading metadata for ${jsonFilename}:`, e);
        }
      }
      
      const [year, month] = parseDate(metadata.date);
      metadata.sort_key = [year, month, filename.toLowerCase()];
      galleryData.push(metadata);
    });
    
    // Sort
    galleryData.sort((a, b) => {
      const ka = a.sort_key;
      const kb = b.sort_key;
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] - kb[1];
      return ka[2].localeCompare(kb[2]);
    });
    
    // Remove sort key
    galleryData.forEach(item => {
      delete item.sort_key;
    });
    
    // Write gallery_data.js
    const jsContent = `// Automatically generated database of photos\nwindow.GALLERY_DATA = ${JSON.stringify(galleryData, null, 2)};\n`;
    fs.writeFileSync(path.join(__dirname, 'gallery_data.js'), jsContent, 'utf8');
    console.log("Regenerated gallery_data.js successfully.");
    return galleryData;
  } catch (err) {
    console.error("Failed to regenerate gallery data:", err);
    throw err;
  }
}

// Server handler
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/update-metadata') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { filename, subject, date, location, description, tags, people } = payload;
        
        if (!filename) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Filename is required" }));
          return;
        }
        
        const baseName = path.basename(filename, path.extname(filename));
        const jsonFilename = baseName + '.json';
        const sidecarPath = path.join(PHOTOS_DIR, jsonFilename);
        
        let sidecarData = {};
        if (fs.existsSync(sidecarPath)) {
          try {
            sidecarData = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
          } catch (e) {
            console.warn(`Error parsing existing sidecar ${jsonFilename}, overwriting.`);
          }
        }
        
        // Update fields
        sidecarData.subject = subject !== undefined ? subject : (sidecarData.subject || "");
        sidecarData.date = date !== undefined ? date : (sidecarData.date || "");
        sidecarData.location = location !== undefined ? location : (sidecarData.location || "");
        sidecarData.description = description !== undefined ? description : (sidecarData.description || "");
        sidecarData.tags = tags !== undefined ? tags : (sidecarData.tags || []);
        sidecarData.people = people !== undefined ? people : (sidecarData.people || []);
        sidecarData.annotated_at = new Date().toISOString();
        if (!sidecarData.custom) sidecarData.custom = {};
        if (!sidecarData.ai_features) sidecarData.ai_features = [];
        
        // Write sidecar JSON
        fs.writeFileSync(sidecarPath, JSON.stringify(sidecarData, null, 4), 'utf8');
        console.log(`Updated sidecar for ${filename}:`, sidecarData);
        
        // Regenerate the database gallery_data.js
        const updatedDb = regenerateGalleryData();
        
        // Send success response with updated photo data
        const updatedPhoto = updatedDb.find(p => p.filename === filename);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, photo: updatedPhoto }));
      } catch (err) {
        console.error("API error:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  // Static files handling
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  // Decodes percentage-encoded URLs (e.g. spaces as %20)
  try {
    filePath = decodeURIComponent(filePath);
  } catch (e) {
    // Ignore URL decoding errors
  }
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    
    // Check if this is a request for an original photo (in photos/ but not in thumbnails/ or previews/)
    const decodedUrl = req.url.startsWith('/') ? req.url.substring(1) : req.url;
    let checkUrl = decodedUrl;
    try {
      checkUrl = decodeURIComponent(decodedUrl);
    } catch (e) {}
    
    const isOriginalPhoto = checkUrl.startsWith('photos/') && 
                            !checkUrl.startsWith('photos/thumbnails/') && 
                            !checkUrl.startsWith('photos/previews/');
                            
    const headers = { 
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-cache' // disable caching to make edits visual immediately
    };
    
    if (isOriginalPhoto) {
      const filename = path.basename(filePath);
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }
    
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`${archiveTitle} Server running at http://localhost:${PORT}`);
  console.log("Serving static files and API endpoint for writing annotations.");
});
