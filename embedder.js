// Solana Place Pixel Art Embedder

class SimplePixelEmbedder {
  constructor() {
    this.queue = [];
    this.isPlacing = false;
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.currentCredits = null;
    
    // Smart rate limiting based on tier with burst control
    this.baseDelay = 800; // Default conservative delay
    this.tierDelays = {
      'Admin': 600,     // 100 pixels/minute (respects burst limit)
      'Mega': 600,      // 100 pixels/minute  
      'Ultra': 750,     // 80 pixels/minute
      'Premium': 1000,  // 60 pixels/minute
      'Basic': 1500,    // 40 pixels/minute
      'Free': 2500      // 24 pixels/minute
    };
    this.currentTier = 'unknown';
    
    // Burst control - respect 20 pixels per 10 seconds server limit
    this.burstTracker = [];
    this.maxBurstPixels = 18;
    this.requestTimes = [];
    
    // Get existing socket connection from the app
    this.socket = window.socket || null;
    this.checkConnection();
  }

  // Get current credits from HTML display
  getCurrentCredits() {
    try {
      // Look for the credits display element
      const creditElements = document.querySelectorAll('span.text-sm.font-medium');
      
      for (let element of creditElements) {
        const text = element.textContent.trim();
        if (text.includes('Credits') || text.includes('Credit')) {
          // Extract number from text like "100 Credits"
          const match = text.match(/(\d+)\s*Credits?/i);
          if (match) {
            this.currentCredits = parseInt(match[1]);
            console.log(`💰 Current credits: ${this.currentCredits}`);
            return this.currentCredits;
          }
        }
      }
      
      const allElements = document.querySelectorAll('*');
      for (let element of allElements) {
        const text = element.textContent.trim();
        if (text.match(/^\d+\s+Credits?$/i)) {
          const match = text.match(/(\d+)/);
          if (match) {
            this.currentCredits = parseInt(match[1]);
            console.log(`💰 Current credits: ${this.currentCredits}`);
            return this.currentCredits;
          }
        }
      }
      
      console.log('⚠️ Could not find credits display in HTML');
      return null;
    } catch (error) {
      console.log('⚠️ Error reading credits from HTML:', error.message);
      return null;
    }
  }

  // Check if user has enough credits and confirm if not
  async checkCreditsAndConfirm(pixelsNeeded) {
    const currentCredits = this.getCurrentCredits();
    
    if (currentCredits === null) {
      console.log('⚠️ Could not determine current credits from page');
      const proceed = confirm(
        `Could not determine your current credits.\n\n` +
        `This operation will use ${pixelsNeeded} credits.\n\n` +
        `Do you want to proceed anyway?`
      );
      return proceed;
    }
    
    if (currentCredits >= pixelsNeeded) {
      console.log(`✅ Sufficient credits: ${currentCredits} available, ${pixelsNeeded} needed`);
      return true;
    } else {
      console.log(`⚠️ Insufficient credits: ${currentCredits} available, ${pixelsNeeded} needed`);
      const deficit = pixelsNeeded - currentCredits;
      
      const proceed = confirm(
        `💰 INSUFFICIENT CREDITS WARNING!\n\n` +
        `Current credits: ${currentCredits}\n` +
        `Pixels needed: ${pixelsNeeded}\n` +
        `Deficit: ${deficit} credits\n\n` +
        `⚠️ You may run out of credits partway through!\n\n` +
        `Do you want to proceed anyway?`
      );
      
      return proceed;
    }
  }

  checkConnection() {
    if (!this.socket) {
      console.log('❌ No socket connection found. Make sure you\'re connected to Solana Place.');
      return false;
    }
    
    console.log('✅ Found existing socket connection');
    console.log('🛡️ Will detect your tier and optimize delays automatically');
    
    // Listen for rate limit info to optimize delays
    this.socket.on('rate_limit_info', (info) => {
      this.handleRateLimitInfo(info);
    });
    
    // Get initial rate limit status
    this.socket.emit('get_rate_limit_status');
    
    return true;
  }

  // Handle server rate limit feedback
  handleRateLimitInfo(info) {
    if (info && info.tier) {
      this.currentTier = info.tier;
      
      // Use tier-specific delay if available
      if (this.tierDelays[info.tier]) {
        this.baseDelay = this.tierDelays[info.tier];
        console.log(`🎯 Detected ${info.tier} tier - using ${this.baseDelay}ms delays`);
        
        const pixelsPerMinute = Math.floor(60000 / this.baseDelay);
        console.log(`⚡ Optimized speed: ~${pixelsPerMinute} pixels/minute (respects 20/10s burst limit)`);
      }
      
      // Show rate limit info
      if (info.maxPixels) {
        console.log(`📊 Rate limit: ${info.remaining || 0}/${info.maxPixels} remaining`);
      }
    }
  }

  // Smart delay with burst limit protection
  async smartDelay() {
    const now = Date.now();
    
    // Clean old request times (older than 60 seconds)
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
    
    // Clean burst tracker (older than 10 seconds)
    this.burstTracker = this.burstTracker.filter(time => now - time < 10000);
    
    // Check if we're approaching burst limit
    if (this.burstTracker.length >= this.maxBurstPixels) {
      // Wait until oldest burst request is 10+ seconds old
      const oldestBurst = Math.min(...this.burstTracker);
      const waitTime = 10000 - (now - oldestBurst) + 200; // Extra 200ms buffer
      
      if (waitTime > 0) {
        console.log(`🛑 Burst limit protection: waiting ${Math.ceil(waitTime/1000)}s...`);
        await this.sleep(waitTime);
        
        // Clean burst tracker after waiting
        this.burstTracker = this.burstTracker.filter(time => Date.now() - time < 10000);
      }
    }
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 100; // 0-100ms jitter
    const delay = this.baseDelay + jitter;
    
    await this.sleep(delay);
  }

  // Track request timing including burst tracking
  recordRequest() {
    const now = Date.now();
    this.requestTimes.push(now);
    this.burstTracker.push(now);
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
        
        const pixelsPerMinute = Math.floor(60000 / this.baseDelay);
        const estimatedMinutes = Math.ceil(pixels.length / pixelsPerMinute);
        console.log(`🎨 Extracted ${pixels.length} pixels from image`);
        console.log(`⏱️ Estimated time: ${estimatedMinutes} minutes at ~${pixelsPerMinute} pixels/min (${this.currentTier} tier)`);
        resolve(pixels);
      };
      
      img.onerror = () => {
        console.error('❌ Failed to load image');
        resolve([]);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  // Pixel checking using region API
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
          await this.sleep(3000); // Longer wait for rate limits
        } else {
          console.log(`⚠️ Could not check region, adding all pixels from region`);
          pixelsToPlace.push(...region.pixels);
        }
        
        // Delay between region checks
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

  // Group pixels into regions
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
          x2: Math.min(regionX + regionSize - 1, 2999),
          y2: Math.min(regionY + regionSize - 1, 1999),
          pixels: []
        });
      }
      
      regionMap.get(regionKey).pixels.push(pixel);
    });
    
    return Array.from(regionMap.values());
  }

  // Place pixel using existing socket
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
      }, 8000);
      
      const successHandler = (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          document.removeEventListener('pixelPlacedSuccess', successHandler);
          document.removeEventListener('pixelPlacedError', errorHandler);
          this.recordRequest();
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
              window.socket.off('pixel_placed_success', onSuccess);
              window.socket.off('pixel_placement_failed', onError);
              this.recordRequest();
              resolve();
            }
          };
          
          const onError = (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              window.socket.off('pixel_placed_success', onSuccess);
              window.socket.off('pixel_placement_failed', onError);
              reject(new Error(error.error || error.message || 'Pixel placement failed'));
            }
          };
          
          window.socket.once('pixel_placed_success', onSuccess);
          window.socket.once('pixel_placement_failed', onError);
          window.socket.emit('place_pixel', { x, y, color });
        }
      }, 200);
    });
  }

  // Main embedding function
  async embedImage(pixels, checkExisting = true) {
    console.log(`🚀 Starting image embedding...`);
    console.log(`🔍 Check existing pixels: ${checkExisting}`);
    console.log(`🎯 Using ${this.baseDelay}ms delays for ${this.currentTier} tier`);

    if (this.isPlacing) {
      console.log('❌ Already placing pixels. Stop current operation first.');
      return;
    }

    // Get fresh rate limit info before starting
    if (this.socket) {
      this.socket.emit('get_rate_limit_status');
      await this.sleep(300);
    }

    // Reset counters
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    let finalPixels = pixels;

    if (checkExisting && pixels.length > 10) {
      try {
        finalPixels = await this.checkPixelsInRegion(pixels);
        console.log(`💰 Final pixels needed: ${finalPixels.length} (after filtering existing)`);
      } catch (error) {
        console.log('⚠️ Error during region check, proceeding with all pixels:', error.message);
        finalPixels = pixels;
      }
    }

    if (finalPixels.length === 0) {
      console.log('🎉 All pixels already correct! Nothing to do.');
      return;
    }

    this.queue = [...finalPixels];
    this.isPlacing = true;
    
    const pixelsPerMinute = Math.floor(60000 / this.baseDelay);
    const estimatedTime = Math.ceil(this.queue.length / pixelsPerMinute);
    
    console.log(`🎯 Starting placement of ${this.queue.length} pixels...`);
    console.log(`⏱️ Estimated time: ${estimatedTime} minutes at ~${pixelsPerMinute} pixels/min`);

    await this.processQueue();
  }

  // Process queue
  async processQueue() {
    const startTime = Date.now();
    
    while (this.queue.length > 0 && this.isPlacing) {
      const pixel = this.queue.shift();
      
      try {
        await this.placePixel(pixel.x, pixel.y, pixel.color);
        this.pixelsPlaced++;
        
        // Show progress every 10 pixels
        if (this.pixelsPlaced % 10 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = this.pixelsPlaced / (elapsed / 60);
          const creditsRemaining = this.getCurrentCredits();
          console.log(`🎨 Progress: ${this.pixelsPlaced} placed | Queue: ${this.queue.length} | Rate: ${Math.round(rate)}/min | Credits: ${creditsRemaining || 'Unknown'}`);
        }
        
        if (this.queue.length > 0) {
          await this.smartDelay();
        }

      } catch (error) {
        this.errors++;
        console.error(`❌ Failed to place pixel at (${pixel.x}, ${pixel.y}):`, error.message);
        
        // Error types
        if (error.message.toLowerCase().includes('burst limit')) {
          console.log('🛑 Burst limit hit - entering extended cooldown');
          // Clear burst tracker and wait longer
          this.burstTracker = [];
          await this.sleep(15000); // 15 second cooldown
        } else if (error.message.toLowerCase().includes('rate') || error.message.toLowerCase().includes('limit')) {
          console.log('⚠️ Rate limit hit - waiting 10 seconds');
          await this.sleep(10000);
        } else if (error.message.toLowerCase().includes('credit')) {
          console.log('💰 Out of credits - stopping');
          this.isPlacing = false;
          break;
        } else {
          // Generic error - short pause
          await this.sleep(2000);
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
    const finalCredits = this.getCurrentCredits();
    console.log('\n🎉 ===== PLACEMENT COMPLETE =====');
    console.log(`✅ Pixels placed: ${this.pixelsPlaced}`);
    console.log(`⏭️ Pixels skipped: ${this.skipped}`);
    console.log(`❌ Errors: ${this.errors}`);
    console.log(`📦 Remaining queue: ${this.queue.length}`);
    console.log(`💰 Credits remaining: ${finalCredits || 'Unknown'}`);
    console.log('================================\n');
  }

  // Get current status
  getStatus() {
    const burstUsed = this.burstTracker.filter(time => Date.now() - time < 10000).length;
    const currentCredits = this.getCurrentCredits();
    
    return {
      isPlacing: this.isPlacing,
      queueLength: this.queue.length,
      pixelsPlaced: this.pixelsPlaced,
      errors: this.errors,
      skipped: this.skipped,
      currentRate: this.requestTimes.length,
      tier: this.currentTier,
      burstUsed: burstUsed,
      burstLimit: this.maxBurstPixels,
      credits: currentCredits
    };
  }

  // Utility sleep function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================================
// SIMPLE INTERFACE WITH CREDIT CHECKING
// ========================================

let embedder = null;

// Initialize
function initEmbedder() {
  console.log('🚀 Initializing Credit-Aware Pixel Embedder...');
  embedder = new SimplePixelEmbedder();
  console.log('✅ Embedder ready! Will check credits and auto-detect your tier.');
  
  // Show current credits on init
  const credits = embedder.getCurrentCredits();
  if (credits !== null) {
    console.log(`💰 Current credits detected: ${credits}`);
  }
  
  return embedder;
}

// Embed image from file with credit check in single popup
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

      // Get current credits and build confirmation message
      const currentCredits = embedder.getCurrentCredits();
      let message = `EMBED: ${pixels.length} pixels starting at (${startX}, ${startY})\n\n`;
      
      if (currentCredits !== null) {
        message += `Current credits: ${currentCredits}\n`;
        if (currentCredits < pixels.length) {
          const deficit = pixels.length - currentCredits;
          message += `⚠️ INSUFFICIENT CREDITS!\n`;
          message += `Deficit: ${deficit} credits\n`;
          message += `You may run out partway through!\n\n`;
        }
      } else {
        message += `Could not detect current credits\n\n`;
      }
      
      message += `Will check existing pixels first\nProceed with embedding?`;
      
      const proceed = confirm(message);
      
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

// Fast embed with credit check
function embedImageFast(startX = 100, startY = 100, maxWidth = 50) {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }

  console.log('📂 Opening file picker for FAST embedding...');
  
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

      // Get current credits and build confirmation message
      const currentCredits = embedder.getCurrentCredits();
      let message = `FAST EMBED: ${pixels.length} pixels at (${startX}, ${startY})\n\n`;
      
      if (currentCredits !== null) {
        message += `Current credits: ${currentCredits}\n`;
        if (currentCredits < pixels.length) {
          const deficit = pixels.length - currentCredits;
          message += `⚠️ INSUFFICIENT CREDITS!\n`;
          message += `Deficit: ${deficit} credits\n`;
          message += `You may run out partway through!\n\n`;
        }
      } else {
        message += `Could not detect current credits\n\n`;
      }
      
      message += `Will NOT check existing pixels\nProceed with fast embedding?`;
      
      const proceed = confirm(message);
      
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

// Center embedding function
function embedAtCenter(maxWidth = 200) {
  const canvasWidth = 3000;
  const canvasHeight = 2000;
  const centerX = Math.floor((canvasWidth - maxWidth) / 2);
  const centerY = Math.floor((canvasHeight - maxWidth) / 2);
  
  console.log(`🎯 Centering image at (${centerX}, ${centerY}) with max size ${maxWidth}px`);
  embedImage(centerX, centerY, maxWidth);
}

function embedAtCenterFast(maxWidth = 200) {
  const canvasWidth = 3000;
  const canvasHeight = 2000;
  const centerX = Math.floor((canvasWidth - maxWidth) / 2);
  const centerY = Math.floor((canvasHeight - maxWidth) / 2);
  
  console.log(`🎯 FAST centering image at (${centerX}, ${centerY}) with max size ${maxWidth}px`);
  embedImageFast(centerX, centerY, maxWidth);
}

function showStatus() {
  if (!embedder) {
    console.log('❌ Embedder not initialized');
    return;
  }
  
  const status = embedder.getStatus();
  console.log('📊 Current Status:', status);
  console.log(`🛑 Burst: ${status.burstUsed}/${status.burstLimit} in last 10s`);
  console.log(`💰 Credits: ${status.credits || 'Unknown'}`);
  return status;
}

function stopEmbedding() {
  if (embedder) {
    embedder.stop();
  }
}

function checkCredits() {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }
  
  const credits = embedder.getCurrentCredits();
  if (credits !== null) {
    console.log(`💰 Current credits: ${credits}`);
  } else {
    console.log('❌ Could not detect credits from page');
  }
  return credits;
}

// Simple startup message
console.log('🚀 CREDIT-AWARE SOLANA PLACE PIXEL EMBEDDER 🚀');
console.log('💰 Automatically checks credits before embedding');
console.log('🛑 Respects 20 pixels per 10 seconds burst limit');
console.log('🎯 Auto-detects your tier for optimal safe speed');
console.log('✅ Ready! Run initEmbedder() then embedAtCenter(200) to start!');

// Export functions
window.initEmbedder = initEmbedder;
window.embedImage = embedImage;
window.embedImageFast = embedImageFast;
window.embedAtCenter = embedAtCenter;
window.embedAtCenterFast = embedAtCenterFast;
window.showStatus = showStatus;
window.stopEmbedding = stopEmbedding;
window.checkCredits = checkCredits;
