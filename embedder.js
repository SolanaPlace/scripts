// Solana Place Pixel Art Embedder - Rate-Limit Optimized Version
// Uses existing wallet connection from the UI

class OptimizedPixelEmbedder {
  constructor() {
    this.queue = [];
    this.isPlacing = false;
    this.placementDelay = 6000; // 6 seconds between pixels
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.existingPixelsCache = new Map();
    
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
    return true;
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
        resolve(pixels);
      };
      
      img.onerror = () => {
        console.error('❌ Failed to load image');
        resolve([]);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  // Get existing canvas data from memory (avoid API calls)
  getExistingCanvasData() {
    // Try to get canvas data from the React app's state
    try {
      // The canvas data should be available in the global window scope
      // from the SocketContext or we can get it from the rendered canvas
      const canvasElement = document.querySelector('canvas');
      if (!canvasElement) {
        console.log('🔍 Canvas element not found, will skip existing pixel check');
        return [];
      }

      // Get existing pixels from the socket context if available
      if (window.socket && window.socket._callbacks && window.socket._callbacks.$canvas_data) {
        console.log('📊 Found canvas data in socket callbacks');
      }

      // Fallback: we'll just proceed without checking existing pixels to avoid rate limits
      console.log('⚠️ Skipping existing pixel check to avoid rate limits');
      return [];
      
    } catch (error) {
      console.log('⚠️ Could not access existing canvas data, proceeding without check');
      return [];
    }
  }

  // Optimized pixel checking using region API instead of individual pixels
  async checkPixelsInRegion(pixels) {
    if (pixels.length === 0) return [];

    // Group pixels by region to minimize API calls
    const regions = this.groupPixelsIntoRegions(pixels, 50); // 50x50 regions
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
          // Add delay to avoid further rate limiting
          await this.sleep(2000);
        } else {
          console.log(`⚠️ Could not check region, adding all pixels from region`);
          pixelsToPlace.push(...region.pixels);
        }
        
        // Small delay between region checks to avoid rate limiting
        if (i < regions.length - 1) {
          await this.sleep(500);
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
      }, 10000);
      
      const successHandler = (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          document.removeEventListener('pixelPlacedSuccess', successHandler);
          document.removeEventListener('pixelPlacedError', errorHandler);
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
          console.log('🔄 Trying direct socket approach...');
          
          const onSuccess = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              window.socket.off('pixel_placed', onSuccess);
              window.socket.off('error', onError);
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

  // Embed image with optimized checking
  async embedImage(pixels, checkExisting = true) {
    console.log(`🚀 Starting image embedding...`);
    console.log(`🔍 Check existing pixels: ${checkExisting}`);

    if (this.isPlacing) {
      console.log('❌ Already placing pixels. Stop current operation first.');
      return;
    }

    // Reset counters
    this.skipped = 0;

    let finalPixels = pixels;

    // Use optimized region-based checking instead of individual pixel checks
    if (checkExisting && pixels.length > 10) {
      try {
        finalPixels = await this.checkPixelsInRegion(pixels);
      } catch (error) {
        console.log('⚠️ Error during region check, proceeding with all pixels:', error.message);
        finalPixels = pixels;
      }
    } else if (checkExisting) {
      console.log('🔍 Small image, skipping optimization...');
      // For small images, just proceed without checking to avoid rate limits
      finalPixels = pixels;
    }

    if (finalPixels.length === 0) {
      console.log('🎉 All pixels already correct! Nothing to do.');
      return;
    }

    this.queue = [...finalPixels];
    this.isPlacing = true;
    
    console.log(`🎯 Starting placement of ${this.queue.length} pixels...`);
    console.log(`⏱️ Estimated time: ${Math.ceil(this.queue.length * this.placementDelay / 1000 / 60)} minutes`);

    await this.processQueue();
  }

  // Process the pixel queue
  async processQueue() {
    while (this.queue.length > 0 && this.isPlacing) {
      const pixel = this.queue.shift();
      
      try {
        await this.placePixel(pixel.x, pixel.y, pixel.color);
        this.pixelsPlaced++;
        console.log(`🎨 Pixel placed! (${pixel.x}, ${pixel.y}) Total: ${this.pixelsPlaced}, Queue: ${this.queue.length}`);
        
        // Wait for rate limit
        if (this.queue.length > 0) {
          console.log(`⏳ Waiting ${this.placementDelay/1000}s before next pixel...`);
          await this.sleep(this.placementDelay);
        }

      } catch (error) {
        this.errors++;
        console.error(`❌ Failed to place pixel at (${pixel.x}, ${pixel.y}):`, error.message);
        await this.sleep(1000);
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
      skipped: this.skipped
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
  console.log('🚀 Initializing Optimized Pixel Embedder...');
  embedder = new OptimizedPixelEmbedder();
  console.log('✅ Embedder ready! (Rate-limit optimized)');
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
      
      const proceed = confirm(`Embed ${pixels.length} pixels starting at (${startX}, ${startY})?\n\nThis will cost ${pixels.length} credits and take about ${Math.ceil(pixels.length * 6 / 60)} minutes.\n\nNote: Existing pixel check is optimized to avoid rate limits.`);
      
      if (proceed) {
        await embedder.embedImage(pixels, true); // Always check existing but use optimized method
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

// Quick embed without existing pixel check (fastest)
function embedImageFast(startX = 100, startY = 100, maxWidth = 50) {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }

  console.log('📂 Opening file picker for FAST embedding (no existing pixel check)...');
  
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

      const proceed = confirm(`FAST EMBED: ${pixels.length} pixels at (${startX}, ${startY})?\n\nWill NOT check existing pixels - may overwrite!\nThis will cost ${pixels.length} credits.`);
      
      if (proceed) {
        await embedder.embedImage(pixels, false); // Skip existing pixel check
      }
      
    } catch (error) {
      console.error('❌ Error processing image:', error.message);
    } finally {
      document.body.removeChild(input);
    }
  };
  
  input.click();
}

// Other functions remain the same
function showStatus() {
  if (!embedder) {
    console.log('❌ Embedder not initialized');
    return;
  }
  
  const status = embedder.getStatus();
  console.log('📊 Current Status:', status);
  return status;
}

function stopEmbedding() {
  if (embedder) {
    embedder.stop();
  }
}

function embedAtCenter(maxWidth = 50) {
  const centerX = 500 - Math.floor(maxWidth / 2);
  const centerY = 500 - Math.floor(maxWidth / 2);
  embedImage(centerX, centerY, maxWidth);
}

function embedAtCorner(corner = 'top-left', maxWidth = 50) {
  let x, y;
  switch (corner) {
    case 'top-left': x = 10; y = 10; break;
    case 'top-right': x = 990 - maxWidth; y = 10; break;
    case 'bottom-left': x = 10; y = 990 - maxWidth; break;
    case 'bottom-right': x = 990 - maxWidth; y = 990 - maxWidth; break;
    default: x = 10; y = 10;
  }
  embedImage(x, y, maxWidth);
}

console.log(`
🚀 OPTIMIZED SOLANA PLACE PIXEL EMBEDDER 🚀

✅ RATE-LIMIT FIXES:
- Uses region API instead of individual pixel checks
- Groups pixels into 50x50 regions for efficient checking
- Includes embedImageFast() for no-check embedding

🎯 COMMANDS:
initEmbedder()                       // Initialize
embedImage(x, y, size)              // Smart embed with optimized checking  
embedImageFast(x, y, size)          // Fast embed (no existing pixel check)
embedAtCenter(size)                 // Center position
embedAtCorner('top-left', size)     // Corner positions

📊 MONITORING:
showStatus()                        // Check progress
stopEmbedding()                     // Stop operation

💡 RATE-LIMIT TIPS:
- Use embedImageFast() if you don't care about overwriting
- Script automatically handles rate limits with delays
- Region checking is much more efficient than individual pixels

Ready! Run initEmbedder() to start.
`);

// Export functions
window.initEmbedder = initEmbedder;
window.embedImage = embedImage;
window.embedImageFast = embedImageFast;
window.embedAtCenter = embedAtCenter;
window.embedAtCorner = embedAtCorner;
window.showStatus = showStatus;
window.stopEmbedding = stopEmbedding;
