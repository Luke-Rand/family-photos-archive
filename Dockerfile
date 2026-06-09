# Use official Node.js LTS (slim variant for a smaller image size)
FROM node:20-slim

# Set environment to production
ENV NODE_ENV=production

# Install system dependencies:
# - python3: to run the image optimizer script
# - python3-pillow: Debian's precompiled Pillow package, avoiding slow compilation times
# - python-is-python3: creates a symlink from `python` to `python3` so the `npm run optimize` command works out-of-the-box
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pillow \
    python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy package descriptors first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies (ignores devDependencies)
RUN npm ci --omit=dev

# Copy all application source code
COPY . .

# Expose port 8080 (the default port configured in server.js and config.json)
EXPOSE 8080

# The startup command runs the photo optimization script first (generating missing thumbnails/previews
# and compiling the gallery database `gallery_data.js`), then starts the Node.js server.
CMD ["sh", "-c", "python3 optimize_photos.py && node server.js"]
