// Solana Place Pixel Art Embedder - Optimized for 100 requests/60s
// Uses existing wallet connection from the UI

class OptimizedPixelEmbedder {
  constructor() {
    this.queue = [];
    this.isPlacing = false;
    this.placementDelay = 650; // 650ms = ~92 requests/60s (leaves buffer for safety)
    this.burstDelay = 100; // Very short delay between rapid placements
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.rateLimitBuffer = 8; // Keep 8 requests as buffer
    this.maxRequestsPerMinute = 100 - this.rateLimitBuffer; // 92 requests/minute safely
    this.requestTimes = []; // Track request timing
    
    // Get existing socket connection from the app
    this.socket = window.socket || null;
    this.checkConnection();
  }

  checkConnection() {
    if (!this.socket) {
      console.log('❌ No socket connection found. Make sure you\'re connected to Solana Place.');
      return false;
    }
    
    console.log('✅ Found existing socket connection');
    console.log(`🚀 Optimized for ${this.maxRequestsPerMinute} pixels/minute (${this.placementDelay}ms delay)`);
    return true;
  }

  // Smart rate limiting - burst fast, then slow down if needed
  async smartDelay() {
    const now = Date.now();
    
    // Clean old request times (older than 60 seconds)
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
    
    // If we're close to rate limit, use longer delay
    if (this.requestTimes.length >= this.maxRequestsPerMinute - 5) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = 60000 - (now - oldestRequest) + 100; // Wait until oldest request is 60s old + buffer
      
      if (waitTime > 0) {
        console.log(`⚠️ Near rate limit, waiting ${Math.ceil(waitTime/1000)}s...`);
        await this.sleep(waitTime);
        return;
      }
    }
    
    // Normal operation - use short delay
    await this.sleep(this.placementDelay);
  }

  // Track request timing
  recordRequest() {
    this.requestTimes.push(Date.now());
  }

  // Load and process image
  async loadImage(file, startX, startY, maxWidth = 100) {
    console.log(`🖼️ Processing image: ${file.name}`);
    console.log(`📍 Target position: (${startX}, ${startY})`);
    console.log(`📏 Max width: ${maxWidth}px`);

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate scaled dimensions
        const scale = Math.min(maxWidth / img.width, maxWidth / img.height);
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);
        
        console.log(`📐 Original size: ${img.width}×${img.height}`);
        console.log(`📐 Scaled size: ${width}×${height}`);
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and get pixel data
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = [];
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const a = imageData.data[i + 3];
            
            // Skip transparent pixels
            if (a < 128) continue;
            
            // Convert to hex color
            const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
            
            pixels.push({
              x: startX + x,
              y: startY + y,
              color: color
            });
          }
        }
        
        console.log(`🎨 Extracted ${pixels.length} pixels from image`);
        console.log(`⏱️ Estimated time: ${Math.ceil(pixels.length / this.maxRequestsPerMinute)} minutes (at ${this.maxRequestsPerMinute} pixels/min)`);
        resolve(pixels);
      };
      
      img.onerror = () => {
        console.error('❌ Failed to load image');
        resolve([]);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  // Optimized pixel checking using region API
  async checkPixelsInRegion(pixels) {
    if (pixels.length === 0) return [];

    // Group pixels by region to minimize API calls
    const regions = this.groupPixelsIntoRegions(pixels, 50);
    const pixelsToPlace = [];
    
    console.log(`🔍 Checking ${regions.length} regions instead of ${pixels.length} individual pixels...`);

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      console.log(`📊 Checking region ${i + 1}/${regions.length}...`);
      
      try {
        // Use region API to get multiple pixels at once
        const response = await fetch(`/api/pixels/region/${region.x1}/${region.y1}/${region.x2}/${region.y2}`);
        
        if (response.ok) {
          const data = await response.json();
          const existingPixels = data.pixels || [];
          
          // Create a map of existing pixels for fast lookup
          const existingMap = new Map();
          existingPixels.forEach(pixel => {
            existingMap.set(`${pixel.x},${pixel.y}`, pixel.color);
          });
          
          // Check which pixels in this region need to be placed
          region.pixels.forEach(pixel => {
            const existing = existingMap.get(`${pixel.x},${pixel.y}`);
            if (!existing || existing !== pixel.color) {
              pixelsToPlace.push(pixel);
            } else {
              this.skipped++;
            }
          });
          
        } else if (response.status === 429) {
          console.log(`⚠️ Rate limited on region check, adding all pixels from region`);
          pixelsToPlace.push(...region.pixels);
          await this.sleep(2000);
        } else {
          console.log(`⚠️ Could not check region, adding all pixels from region`);
          pixelsToPlace.push(...region.pixels);
        }
        
        // Small delay between region checks
        if (i < regions.length - 1) {
          await this.sleep(200);
        }
        
      } catch (error) {
        console.log(`⚠️ Error checking region, adding all pixels from region:`, error.message);
        pixelsToPlace.push(...region.pixels);
      }
    }

    console.log(`✅ Check complete: ${pixelsToPlace.length} pixels need placement, ${this.skipped} already correct`);
    return pixelsToPlace;
  }

  // Group pixels into regions for efficient API calls
  groupPixelsIntoRegions(pixels, regionSize = 50) {
    const regions = [];
    const regionMap = new Map();
    
    pixels.forEach(pixel => {
      const regionX = Math.floor(pixel.x / regionSize) * regionSize;
      const regionY = Math.floor(pixel.y / regionSize) * regionSize;
      const regionKey = `${regionX},${regionY}`;
      
      if (!regionMap.has(regionKey)) {
        regionMap.set(regionKey, {
          x1: regionX,
          y1: regionY,
          x2: Math.min(regionX + regionSize - 1, 999),
          y2: Math.min(regionY + regionSize - 1, 999),
          pixels: []
        });
      }
      
      regionMap.get(regionKey).pixels.push(pixel);
    });
    
    return Array.from(regionMap.values());
  }

  // Use the existing socket to place a pixel
  async placePixel(x, y, color) {
    return new Promise((resolve, reject) => {
      const event = new CustomEvent('placePixelFromScript', {
        detail: { x, y, color }
      });
      
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Pixel placement timeout'));
        }
      }, 5000); // Reduced timeout for faster operation
      
      const successHandler = (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          document.removeEventListener('pixelPlacedSuccess', successHandler);
          document.removeEventListener('pixelPlacedError', errorHandler);
          this.recordRequest(); // Track successful request
          resolve();
        }
      };
      
      const errorHandler = (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          document.removeEventListener('pixelPlacedSuccess', successHandler);
          document.removeEventListener('pixelPlacedError', errorHandler);
          reject(new Error(e.detail?.message || 'Pixel placement failed'));
        }
      };
      
      document.addEventListener('pixelPlacedSuccess', successHandler);
      document.addEventListener('pixelPlacedError', errorHandler);
      
      document.dispatchEvent(event);
      
      // Fallback: try direct socket approach
      setTimeout(() => {
        if (!resolved && window.socket) {
          const onSuccess = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              window.socket.off('pixel_placed', onSuccess);
              window.socket.off('error', onError);
              this.recordRequest(); // Track successful request
              resolve();
            }
          };
          
          const onError = (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              window.socket.off('pixel_placed', onSuccess);
              window.socket.off('error', onError);
              reject(new Error(error.message));
            }
          };
          
          window.socket.once('pixel_placed', onSuccess);
          window.socket.once('error', onError);
          window.socket.emit('place_pixel', { x, y, color });
        }
      }, 100);
    });
  }

  // Embed image with optimized rate limiting
  async embedImage(pixels, checkExisting = true) {
    console.log(`🚀 Starting FAST image embedding...`);
    console.log(`🔍 Check existing pixels: ${checkExisting}`);
    console.log(`⚡ Speed: ~${this.maxRequestsPerMinute} pixels/minute`);

    if (this.isPlacing) {
      console.log('❌ Already placing pixels. Stop current operation first.');
      return;
    }

    this.skipped = 0;
    let finalPixels = pixels;

    if (checkExisting && pixels.length > 10) {
      try {
        finalPixels = await this.checkPixelsInRegion(pixels);
      } catch (error) {
        console.log('⚠️ Error during region check, proceeding with all pixels:', error.message);
        finalPixels = pixels;
      }
    } else if (checkExisting) {
      finalPixels = pixels;
    }

    if (finalPixels.length === 0) {
      console.log('🎉 All pixels already correct! Nothing to do.');
      return;
    }

    this.queue = [...finalPixels];
    this.isPlacing = true;
    
    console.log(`🎯 Starting FAST placement of ${this.queue.length} pixels...`);
    console.log(`⏱️ Estimated time: ${Math.ceil(this.queue.length / this.maxRequestsPerMinute)} minutes`);

    await this.processQueue();
  }

  // Process the pixel queue with smart rate limiting
  async processQueue() {
    const startTime = Date.now();
    
    while (this.queue.length > 0 && this.isPlacing) {
      const pixel = this.queue.shift();
      
      try {
        await this.placePixel(pixel.x, pixel.y, pixel.color);
        this.pixelsPlaced++;
        
        // Show progress every 10 pixels or every 30 seconds
        if (this.pixelsPlaced % 10 === 0 || (Date.now() - startTime) % 30000 < 1000) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = this.pixelsPlaced / (elapsed / 60);
          console.log(`🎨 Pixel placed! (${pixel.x}, ${pixel.y}) Total: ${this.pixelsPlaced}, Queue: ${this.queue.length}, Rate: ${Math.round(rate)}/min`);
        }
        
        // Smart delay based on rate limiting
        if (this.queue.length > 0) {
          await this.smartDelay();
        }

      } catch (error) {
        this.errors++;
        console.error(`❌ Failed to place pixel at (${pixel.x}, ${pixel.y}):`, error.message);
        
        // If it's a rate limit error, wait longer
        if (error.message.includes('rate') || error.message.includes('limit')) {
          console.log('⚠️ Rate limit hit, waiting longer...');
          await this.sleep(5000);
        } else {
          await this.sleep(1000);
        }
      }
    }

    this.isPlacing = false;
    this.showSummary();
  }

  // Stop placement
  stop() {
    console.log('🛑 Stopping pixel placement...');
    this.isPlacing = false;
  }

  // Show completion summary
  showSummary() {
    console.log('\n🎉 ===== PLACEMENT COMPLETE =====');
    console.log(`✅ Pixels placed: ${this.pixelsPlaced}`);
    console.log(`⏭️ Pixels skipped: ${this.skipped}`);
    console.log(`❌ Errors: ${this.errors}`);
    console.log(`📦 Remaining queue: ${this.queue.length}`);
    console.log('================================\n');
  }

  // Get current status
  getStatus() {
    return {
      isPlacing: this.isPlacing,
      queueLength: this.queue.length,
      pixelsPlaced: this.pixelsPlaced,
      errors: this.errors,
      skipped: this.skipped,
      currentRate: this.requestTimes.length,
      maxRate: this.maxRequestsPerMinute
    };
  }

  // Utility sleep function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================================
// SIMPLE INTERFACE
// ========================================

let embedder = null;

// Initialize
function initEmbedder() {
  console.log('🚀 Initializing FAST Pixel Embedder (100 req/60s)...');
  embedder = new OptimizedPixelEmbedder();
  console.log('✅ FAST Embedder ready! (~92 pixels/minute)');
  return embedder;
}

// Embed image from file
function embedImage(startX = 100, startY = 100, maxWidth = 50) {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }

  console.log('📂 Opening file picker...');
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpg,image/jpeg';
  input.style.display = 'none';
  document.body.appendChild(input);
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      document.body.removeChild(input);
      return;
    }

    try {
      console.log(`🖼️ Loading image: ${file.name}`);
      const pixels = await embedder.loadImage(file, startX, startY, maxWidth);
      
      if (pixels.length === 0) {
        console.log('❌ No visible pixels found in image');
        document.body.removeChild(input);
        return;
      }

      console.log(`💰 Will place ${pixels.length} pixels at position (${startX}, ${startY})`);
      
      const proceed = confirm(`FAST EMBED: ${pixels.length} pixels starting at (${startX}, ${startY})?\n\nThis will cost ${pixels.length} credits and take about ${Math.ceil(pixels.length / 92)} minutes.\n\n⚡ Optimized for your 100 req/60s rate limit!`);
      
      if (proceed) {
        await embedder.embedImage(pixels, true);
      } else {
        console.log('❌ Embedding cancelled by user');
      }
      
    } catch (error) {
      console.error('❌ Error processing image:', error.message);
    } finally {
      document.body.removeChild(input);
    }
  };
  
  input.click();
}

// Ultra fast embed without existing pixel check
function embedImageUltraFast(startX = 100, startY = 100, maxWidth = 50) {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }

  console.log('📂 Opening file picker for ULTRA FAST embedding...');
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpg,image/jpeg';
  input.style.display = 'none';
  document.body.appendChild(input);
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      document.body.removeChild(input);
      return;
    }

    try {
      const pixels = await embedder.loadImage(file, startX, startY, maxWidth);
      
      if (pixels.length === 0) {
        console.log('❌ No visible pixels found in image');
        document.body.removeChild(input);
        return;
      }

      const proceed = confirm(`ULTRA FAST: ${pixels.length} pixels at (${startX}, ${startY})?\n\nWill NOT check existing pixels!\nEstimated time: ${Math.ceil(pixels.length / 92)} minutes at ~92 pixels/min`);
      
      if (proceed) {
        await embedder.embedImage(pixels, false);
      }
      
    } catch (error) {
      console.error('❌ Error processing image:', error.message);
    } finally {
      document.body.removeChild(input);
    }
  };
  
  input.click();
}

// Center embedding function optimized for 1000x1000 canvas
function embedAtCenter(maxWidth = 333) {
  const canvasSize = 1000;
  const centerX = Math.floor((canvasSize - maxWidth) / 2);
  const centerY = Math.floor((canvasSize - maxWidth) / 2);
  
  console.log(`🎯 Centering image at (${centerX}, ${centerY}) with max size ${maxWidth}px`);
  embedImage(centerX, centerY, maxWidth);
}

function embedAtCenterFast(maxWidth = 333) {
  const canvasSize = 1000;
  const centerX = Math.floor((canvasSize - maxWidth) / 2);
  const centerY = Math.floor((canvasSize - maxWidth) / 2);
  
  console.log(`🎯 FAST centering image at (${centerX}, ${centerY}) with max size ${maxWidth}px`);
  embedImageUltraFast(centerX, centerY, maxWidth);
}

function showStatus() {
  if (!embedder) {
    console.log('❌ Embedder not initialized');
    return;
  }
  
  const status = embedder.getStatus();
  console.log('📊 Current Status:', status);
  console.log(`⚡ Rate: ${status.currentRate}/${status.maxRate} requests in last 60s`);
  return status;
}

function stopEmbedding() {
  if (embedder) {
    embedder.stop();
  }
}

console.log(`
🚀 ULTRA-FAST SOLANA PLACE PIXEL EMBEDDER 🚀
Optimized for 100 requests/60 seconds rate limit!

⚡ SPEED IMPROVEMENTS:
- 650ms delay between pixels (~92 pixels/minute)
- Smart rate limiting with burst capability
- Real-time rate limit tracking and adjustment
- 9x faster than original 6-second delay!

🎯 COMMANDS:
initEmbedder()                       // Initialize FAST embedder
embedAtCenter(333)                   // Center 1/3 size image (RECOMMENDED)
embedAtCenterFast(333)              // Center without existing pixel check
embedImage(x, y, size)              // Custom position with checking
embedImageUltraFast(x, y, size)     // Custom position no checking

📊 MONITORING:
showStatus()                        // Check progress & rate limiting
stopEmbedding()                     // Stop operation

💡 FOR 1000x1000 CANVAS CENTER:
- embedAtCenter(333) = 1/3 size centered image
- Will place at position (334, 334) automatically
- Estimated time: ~4 minutes for 333x333 image

Ready! Run initEmbedder() then embedAtCenter(333) to start!
`);

// Export functions
window.initEmbedder = initEmbedder;
window.embedImage = embedImage;
window.embedImageUltraFast = embedImageUltraFast;
window.embedAtCenter = embedAtCenter;
window.embedAtCenterFast = embedAtCenterFast;
window.showStatus = showStatus;
window.stopEmbedding = stopEmbedding;
