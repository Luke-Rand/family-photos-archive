const http = require('http');
const fs = require('fs');
const path = require('path');

// Load configuration
let PORT = 8080;
let PHOTOS_DIR = path.join(__dirname, 'photos');
let archiveTitle = 'Family Photo Archive';
let sitePassword = process.env.SITE_PASSWORD || '';

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
    if (config.password) sitePassword = config.password;
  } catch (err) {
    console.error("Warning: Could not parse config.json:", err.message);
  }
}

// Session store for simple authentication
const sessions = new Set();

// Helper to parse cookies
function parseCookies(request) {
  const list = {};
  const rc = request.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

// Self-contained login page
const LOGIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Family Photo Archive</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #FAF9F6;
      --card-bg: #FFFFFF;
      --text-main: #2D2A2A;
      --text-muted: #6E6A6A;
      --accent-terracotta: #D36B57;
      --accent-terracotta-hover: #C25A46;
      --border-light: #EAE8E3;
      --radius-md: 16px;
      --shadow-lg: 0 16px 48px rgba(45, 42, 42, 0.16);
      --font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background: linear-gradient(135deg, #F4F1EA 0%, #FAF9F6 50%, #ECE7DF 100%);
      color: var(--text-main);
      font-family: var(--font-family);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    
    .login-container {
      width: 100%;
      max-width: 420px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: 40px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      gap: 24px;
      text-align: center;
      position: relative;
    }

    .login-container::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: var(--radius-md);
      border: 8px solid rgba(255, 255, 255, 0.5);
      pointer-events: none;
    }
    
    .logo-badge {
      align-self: center;
      background-color: rgba(211, 107, 87, 0.1);
      color: var(--accent-terracotta);
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 6px 16px;
      border-radius: 100px;
      width: fit-content;
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.2;
      background: linear-gradient(135deg, var(--text-main) 30%, var(--accent-terracotta));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: left;
    }
    
    label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    input {
      width: 100%;
      padding: 14px 16px;
      border: 1.5px solid var(--border-light);
      border-radius: 8px;
      font-family: var(--font-family);
      font-size: 1rem;
      background-color: rgba(250, 249, 246, 0.8);
      color: var(--text-main);
      transition: all 0.3s ease;
    }
    
    input:focus {
      outline: none;
      border-color: var(--accent-terracotta);
      background-color: #FFFFFF;
      box-shadow: 0 0 0 4px rgba(211, 107, 87, 0.15);
    }
    
    button {
      width: 100%;
      background-color: var(--accent-terracotta);
      color: #FFFFFF;
      border: none;
      padding: 14px 20px;
      border-radius: 8px;
      font-family: var(--font-family);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(211, 107, 87, 0.2);
    }
    
    button:hover {
      background-color: var(--accent-terracotta-hover);
      box-shadow: 0 6px 16px rgba(211, 107, 87, 0.35);
      transform: translateY(-1px);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    .error-msg {
      color: #D32F2F;
      font-size: 0.85rem;
      font-weight: 500;
      display: none;
      text-align: center;
      background: rgba(211, 47, 47, 0.05);
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid rgba(211, 47, 47, 0.1);
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo-badge">Archive Locked</div>
    <h1 id="archive-title">Family Photo Archive</h1>
    <p>This archive is password protected. Please enter the password below to access the memories.</p>
    
    <div class="error-msg" id="error-msg">Incorrect password. Please try again.</div>
    
    <form id="login-form" onsubmit="handleLogin(event)">
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Enter password" required autofocus>
      </div>
      <button type="submit" style="margin-top: 12px;">Unlock Archive</button>
    </form>
  </div>

  <script>
    fetch('config.json')
      .then(res => res.json())
      .then(config => {
        if (config.title) {
          document.getElementById('archive-title').textContent = config.title;
          document.title = 'Login - ' + config.title;
        }
      })
      .catch(err => console.log('Could not load config.json title.'));

    async function handleLogin(e) {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const errorMsg = document.getElementById('error-msg');
      errorMsg.style.display = 'none';
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password })
        });
        
        if (response.ok) {
          window.location.reload();
        } else {
          const data = await response.json().catch(() => ({}));
          errorMsg.textContent = data.error || 'Incorrect password. Please try again.';
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = 'Server connection error. Please try again.';
        errorMsg.style.display = 'block';
      }
    }
  </script>
</body>
</html>`;

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
  const isProtected = sitePassword && sitePassword.trim() !== '';
  const cookies = parseCookies(req);
  const isAuthenticated = !isProtected || sessions.has(cookies['session_token']);

  // Handle Login POST
  if (req.method === 'POST' && req.url === '/api/login') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { password } = payload;
        if (isProtected && password === sitePassword) {
          const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
          sessions.add(token);
          res.writeHead(200, {
            'Set-Cookie': `session_token=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`,
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Incorrect password. Please try again." }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Invalid request payload" }));
      }
    });
    return;
  }

  // Handle Logout POST
  if (req.method === 'POST' && req.url === '/api/logout') {
    const token = cookies['session_token'];
    if (token) {
      sessions.delete(token);
    }
    res.writeHead(200, {
      'Set-Cookie': 'session_token=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax',
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  const decodedUrl = req.url.split('?')[0];
  let checkUrl = decodedUrl.startsWith('/') ? decodedUrl.substring(1) : decodedUrl;
  try {
    checkUrl = decodeURIComponent(checkUrl);
  } catch (e) {}

  // Intercept config.json to strip password and add protection status flag
  if (checkUrl === 'config.json') {
    const filePath = path.join(__dirname, 'config.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          title: archiveTitle,
          password_protected: isProtected
        }));
        return;
      }
      try {
        const configObj = JSON.parse(data);
        delete configObj.password;
        configObj.password_protected = isProtected;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(configObj));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          title: archiveTitle,
          password_protected: isProtected
        }));
      }
    });
    return;
  }

  // Authentication gate
  if (!isAuthenticated) {
    // Determine if it's a request for an HTML page or root navigation
    const isHtmlRequest = decodedUrl === '/' || 
                          decodedUrl.endsWith('/') || 
                          decodedUrl.endsWith('.html') || 
                          decodedUrl.endsWith('.htm') || 
                          !decodedUrl.includes('.'); // path without extensions like /gallery
    if (isHtmlRequest) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(LOGIN_PAGE_HTML);
    } else {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('401 Unauthorized');
    }
    return;
  }

  // If authenticated (or not protected), proceed with standard request routing
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
