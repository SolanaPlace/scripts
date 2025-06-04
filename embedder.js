// Official Solana Place Pixel Art Embedder

class OptimizedPixelEmbedder {
  constructor() {
    this.queue = [];
    this.isPlacing = false;
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.currentCredits = null;
    this.sessionId = null; // Track current session
    
    // SLOWER BUT BULLETPROOF: Increase delays to guarantee safety
    this.baseDelay = 400;  // 2.5 pixels/second (well under 5/sec limit)
    this.universalDelay = 400; // Same for everyone
    this.currentTier = 'Standard';
    this.tierLogged = false; // Track if we've already logged tier info
    
    // ULTRA-SAFE: Even more conservative burst management
    this.burstTracker = [];
    this.burstLimit = 15;        // Much more conservative - only 15 per 10s (vs server's 30)
    this.burstWindow = 10000;    // 10 seconds
    this.burstSafetyBuffer = 2000; // 2 second extra safety buffer
    
    // Request tracking
    this.requestTimes = [];
    this.lastRequestTime = null;
    
    // Get existing socket connection
    this.socket = window.socket || null;
    this.checkConnection();
    
    // Check for existing session on startup
    this.checkForExistingSession();
  }

  // ========================================
  // RESUME/PERSISTENCE FUNCTIONALITY
  // ========================================

  generateSessionId() {
    return 'embed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  saveProgress() {
    if (!this.sessionId) return;
    
    const progressData = {
      sessionId: this.sessionId,
      queue: this.queue,
      pixelsPlaced: this.pixelsPlaced,
      errors: this.errors,
      skipped: this.skipped,
      timestamp: Date.now(),
      isActive: this.isPlacing
    };
    
    try {
      localStorage.setItem('pixelEmbedder_progress', JSON.stringify(progressData));
    } catch (error) {
      console.log('⚠️ Could not save progress:', error.message);
    }
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem('pixelEmbedder_progress');
      if (!saved) return null;
      
      const data = JSON.parse(saved);
      
      // Check if session is recent (within 24 hours)
      const hoursSinceLastSave = (Date.now() - data.timestamp) / (1000 * 60 * 60);
      if (hoursSinceLastSave > 24) {
        this.clearProgress();
        return null;
      }
      
      return data;
    } catch (error) {
      console.log('⚠️ Could not load progress:', error.message);
      return null;
    }
  }

  clearProgress() {
    try {
      localStorage.removeItem('pixelEmbedder_progress');
    } catch (error) {
      console.log('⚠️ Could not clear progress:', error.message);
    }
  }

  checkForExistingSession() {
    const saved = this.loadProgress();
    if (saved && saved.queue && saved.queue.length > 0) {
      console.log('🔄 Found incomplete session from', new Date(saved.timestamp).toLocaleString());
      console.log(`📊 Progress: ${saved.pixelsPlaced} placed, ${saved.queue.length} remaining`);
      console.log('💡 Use resumeEmbedding() to continue, or clearSession() to start fresh');
      return true;
    }
    return false;
  }

  resumeEmbedding() {
    const saved = this.loadProgress();
    if (!saved || !saved.queue || saved.queue.length === 0) {
      console.log('❌ No session to resume');
      return false;
    }

    if (this.isPlacing) {
      console.log('❌ Already placing pixels. Stop current operation first.');
      return false;
    }

    // Restore state
    this.sessionId = saved.sessionId;
    this.queue = saved.queue;
    this.pixelsPlaced = saved.pixelsPlaced;
    this.errors = saved.errors;
    this.skipped = saved.skipped;

    console.log(`🔄 Resuming session: ${saved.pixelsPlaced} completed, ${this.queue.length} remaining`);
    
    const proceed = confirm(
      `Resume Previous Session?\n\n` +
      `Pixels completed: ${saved.pixelsPlaced}\n` +
      `Pixels remaining: ${this.queue.length}\n` +
      `Last active: ${new Date(saved.timestamp).toLocaleString()}\n\n` +
      `Continue embedding?`
    );

    if (proceed) {
      this.isPlacing = true;
      this.processQueue();
      return true;
    } else {
      console.log('❌ Resume cancelled by user');
      return false;
    }
  }

  clearSession() {
    this.clearProgress();
    this.queue = [];
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.sessionId = null;
    this.isPlacing = false;
    console.log('🗑️ Session cleared');
  }

  // ========================================
  // ORIGINAL FUNCTIONALITY (with resume support)
  // ========================================

  getCurrentCredits() {
    try {
      const creditElements = document.querySelectorAll('span.text-sm.font-medium');
      
      for (let element of creditElements) {
        const text = element.textContent.trim();
        if (text.includes('Credits') || text.includes('Credit')) {
          const match = text.match(/(\d+)\s*Credits?/i);
          if (match) {
            this.currentCredits = parseInt(match[1]);
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
            return this.currentCredits;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  async checkCreditsAndConfirm(pixelsNeeded) {
    const currentCredits = this.getCurrentCredits();
    
    if (currentCredits === null) {
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
    
    // Listen for rate limit info (though we use universal rates now)
    this.socket.on('rate_limit_info', (info) => {
      this.handleRateLimitInfo(info);
    });
    
    this.socket.emit('get_rate_limit_status');
    return true;
  }

  handleRateLimitInfo(info) {
    if (info && info.tier) {
      this.currentTier = info.tier;
      // Only log once when tier is first detected
      if (!this.tierLogged) {
        console.log(`🎯 Detected ${info.tier} tier - using ${this.universalDelay}ms delays (150/min)`);
        this.tierLogged = true;
      }
    }
  }

  // BULLETPROOF: Mathematical guarantee no burst limits
  async safeDelay() {
    const now = Date.now();
    
    // Clean old request times
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
    this.burstTracker = this.burstTracker.filter(time => now - time < this.burstWindow);
    
    // MATHEMATICAL SAFETY: Ensure we never exceed burst limits
    if (this.burstTracker.length >= this.burstLimit) {
      // Calculate exact time to wait for oldest request to expire
      const oldestBurst = Math.min(...this.burstTracker);
      const timeToWait = this.burstWindow - (now - oldestBurst) + this.burstSafetyBuffer;
      
      if (timeToWait > 0) {
        console.log(`🛡️ Burst protection: waiting ${Math.ceil(timeToWait/1000)}s`);
        await this.sleep(timeToWait);
        
        // Clean after waiting
        this.burstTracker = this.burstTracker.filter(time => Date.now() - time < this.burstWindow);
      }
    }
    
    // GUARANTEED MINIMUM SPACING: 400ms between requests
    if (this.lastRequestTime) {
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.universalDelay) {
        const waitTime = this.universalDelay - timeSinceLastRequest;
        await this.sleep(waitTime);
      }
    }
    
    // EXTRA SAFETY: Additional random delay to prevent server-side clustering
    const extraSafety = Math.random() * 100 + 50; // 50-150ms extra random delay
    await this.sleep(extraSafety);
    
    this.lastRequestTime = Date.now();
  }

  recordRequest() {
    const now = Date.now();
    this.requestTimes.push(now);
    this.burstTracker.push(now);
    
    // Keep arrays clean
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
    this.burstTracker = this.burstTracker.filter(time => now - time < this.burstWindow);
  }

  async loadImage(file, startX, startY, maxWidth = 100) {
    console.log(`🖼️ Processing image: ${file.name}`);
    console.log(`📍 Target position: (${startX}, ${startY})`);
    console.log(`📏 Max width: ${maxWidth}px`);

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const scale = Math.min(maxWidth / img.width, maxWidth / img.height);
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);
        
        console.log(`📐 Original size: ${img.width}×${img.height}`);
        console.log(`📐 Scaled size: ${width}×${height}`);
        
        canvas.width = width;
        canvas.height = height;
        
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
            
            if (a < 128) continue;
            
            const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
            
            pixels.push({
              x: startX + x,
              y: startY + y,
              color: color
            });
          }
        }
        
        const pixelsPerMinute = Math.floor(60000 / this.universalDelay);
        const estimatedMinutes = Math.ceil(pixels.length / pixelsPerMinute);
        console.log(`🎨 Extracted ${pixels.length} pixels from image`);
        console.log(`⏱️ Time: ${estimatedMinutes} minutes at ${pixelsPerMinute} pixels/min`);
        resolve(pixels);
      };
      
      img.onerror = () => {
        console.error('❌ Failed to load image');
        resolve([]);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  async checkPixelsInRegion(pixels) {
    if (pixels.length === 0) return [];

    const regions = this.groupPixelsIntoRegions(pixels, 50);
    const pixelsToPlace = [];
    
    console.log(`🔍 Checking ${regions.length} regions instead of ${pixels.length} individual pixels...`);

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      console.log(`📊 Checking region ${i + 1}/${regions.length}...`);
      
      try {
        const response = await fetch(`/api/pixels/region/${region.x1}/${region.y1}/${region.x2}/${region.y2}`);
        
        if (response.ok) {
          const data = await response.json();
          const existingPixels = data.pixels || [];
          
          const existingMap = new Map();
          existingPixels.forEach(pixel => {
            existingMap.set(`${pixel.x},${pixel.y}`, pixel.color);
          });
          
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
        
        if (i < regions.length - 1) {
          await this.sleep(200); // Brief pause between region checks
        }
        
      } catch (error) {
        console.log(`⚠️ Error checking region, adding all pixels from region:`, error.message);
        pixelsToPlace.push(...region.pixels);
      }
    }

    console.log(`✅ Check complete: ${pixelsToPlace.length} pixels need placement, ${this.skipped} already correct`);
    return pixelsToPlace;
  }

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
      
      // Fallback socket approach
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

  async embedImage(pixels, checkExisting = true) {
    console.log(`🚀 Starting image embedding...`);
    console.log(`🔍 Check existing pixels: ${checkExisting}`);
    console.log(`⚡ Using universal ${this.universalDelay}ms delays for maximum safety`);

    if (this.isPlacing) {
      console.log('❌ Already placing pixels. Stop current operation first.');
      return;
    }

    if (this.socket) {
      this.socket.emit('get_rate_limit_status');
      await this.sleep(300);
    }

    // Create new session
    this.sessionId = this.generateSessionId();
    this.pixelsPlaced = 0;
    this.errors = 0;
    this.skipped = 0;
    this.burstTracker = [];
    this.lastRequestTime = null;
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
    
    const pixelsPerMinute = Math.floor(60000 / this.universalDelay);
    const estimatedTime = Math.ceil(this.queue.length / pixelsPerMinute);
    
    console.log(`🎯 Starting placement of ${this.queue.length} pixels...`);
    console.log(`⏱️ Estimated time: ${estimatedTime} minutes at 150 pixels/min`);
    console.log(`💾 Progress will be saved automatically`);

    // Save initial progress
    this.saveProgress();

    await this.processQueue();
  }

  async processQueue() {
    const startTime = Date.now();
    
    while (this.queue.length > 0 && this.isPlacing) {
      const pixel = this.queue.shift();
      
      try {
        // SAFE: Apply delay before each pixel placement
        await this.safeDelay();
        
        await this.placePixel(pixel.x, pixel.y, pixel.color);
        this.pixelsPlaced++;
        
        // Save progress every 10 pixels
        if (this.pixelsPlaced % 10 === 0) {
          this.saveProgress();
        }
        
        // Progress every 50 pixels (less spam)
        if (this.pixelsPlaced % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = this.pixelsPlaced / (elapsed / 60);
          const creditsRemaining = this.getCurrentCredits();
          console.log(`🎨 ${this.pixelsPlaced} placed | ${this.queue.length} remaining | ${Math.round(rate)}/min | Credits: ${creditsRemaining || '?'}`);
        }

      } catch (error) {
        this.errors++;
        console.error(`❌ Failed pixel at (${pixel.x}, ${pixel.y}):`, error.message);
        
        // Save progress after error
        this.saveProgress();
        
        // Enhanced error handling
        if (error.message.toLowerCase().includes('burst limit')) {
          console.log('🛑 Burst limit hit - extended cooldown');
          this.burstTracker = [];
          await this.sleep(15000);
        } else if (error.message.toLowerCase().includes('rate') || error.message.toLowerCase().includes('limit')) {
          console.log('⚠️ Rate limit - waiting');
          await this.sleep(10000);
        } else if (error.message.toLowerCase().includes('credit')) {
          console.log('💰 Out of credits - stopping');
          this.isPlacing = false;
          break;
        } else {
          await this.sleep(1000);
        }
      }
    }

    this.isPlacing = false;
    
    // Clear progress if completed successfully
    if (this.queue.length === 0) {
      this.clearProgress();
    } else {
      // Save final state if stopped early
      this.saveProgress();
    }
    
    this.showSummary();
  }

  stop() {
    console.log('🛑 Stopping pixel placement...');
    this.isPlacing = false;
    // Progress will be saved in processQueue
  }

  showSummary() {
    const finalCredits = this.getCurrentCredits();
    console.log('\n🎉 ===== COMPLETE =====');
    console.log(`✅ Pixels placed: ${this.pixelsPlaced}`);
    console.log(`⏭️ Pixels skipped: ${this.skipped}`);
    console.log(`❌ Errors: ${this.errors}`);
    console.log(`💰 Credits remaining: ${finalCredits || 'Unknown'}`);
    
    if (this.queue.length > 0) {
      console.log(`🔄 Pixels remaining: ${this.queue.length}`);
      console.log(`💡 Use resumeEmbedding() to continue later`);
    }
    
    console.log('======================\n');
  }

  getStatus() {
    const burstUsed = this.burstTracker.filter(time => Date.now() - time < this.burstWindow).length;
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
      burstLimit: 15,
      credits: currentCredits,
      delay: this.universalDelay,
      sessionId: this.sessionId,
      hasResumableSession: this.loadProgress() !== null
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================================
// INTERFACE (Enhanced with Resume Functions)
// ========================================

let embedder = null;

function initEmbedder() {
  console.log('🚀 Initializing Pixel Embedder...');
  embedder = new OptimizedPixelEmbedder();
  console.log('✅ Embedder ready! Tuned for high-performance server.');
  
  const credits = embedder.getCurrentCredits();
  if (credits !== null) {
    console.log(`💰 Current credits detected: ${credits}`);
  }
  
  return embedder;
}

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
      
      message += `Will check existing pixels first\n💾 Progress will be saved for resume\nProceed with embedding?`;
      
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
      
      message += `Will NOT check existing pixels\n💾 Progress will be saved for resume\nProceed with fast embedding?`;
      
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

function embedAtCenter(maxWidth = 200) {
  const canvasWidth = 1000;
  const canvasHeight = 1000;
  const centerX = Math.floor((canvasWidth - maxWidth) / 2);
  const centerY = Math.floor((canvasHeight - maxWidth) / 2);
  
  console.log(`🎯 Centering image at (${centerX}, ${centerY}) with max size ${maxWidth}px`);
  embedImage(centerX, centerY, maxWidth);
}

function embedAtCenterFast(maxWidth = 200) {
  const canvasWidth = 1000;
  const canvasHeight = 1000;
  const centerX = Math.floor((canvasWidth - maxWidth) / 2);
  const centerY = Math.floor((canvasHeight - maxWidth) / 2);
  
  console.log(`🎯 FAST centering image at (${centerX}, ${centerY}) with max size ${maxWidth}px`);
  embedImageFast(centerX, centerY, maxWidth);
}

// ========================================
// NEW RESUME FUNCTIONS
// ========================================

function resumeEmbedding() {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }
  
  return embedder.resumeEmbedding();
}

function clearSession() {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }
  
  embedder.clearSession();
}

function checkSession() {
  if (!embedder) {
    console.log('❌ Please run initEmbedder() first');
    return;
  }
  
  const saved = embedder.loadProgress();
  if (saved && saved.queue && saved.queue.length > 0) {
    console.log('📊 Resumable Session Found:');
    console.log(`  • Pixels completed: ${saved.pixelsPlaced}`);
    console.log(`  • Pixels remaining: ${saved.queue.length}`);
    console.log(`  • Errors encountered: ${saved.errors}`);
    console.log(`  • Last active: ${new Date(saved.timestamp).toLocaleString()}`);
    console.log(`  • Session ID: ${saved.sessionId}`);
    console.log('💡 Use resumeEmbedding() to continue');
    return saved;
  } else {
    console.log('❌ No resumable session found');
    return null;
  }
}

// ========================================
// ORIGINAL INTERFACE FUNCTIONS
// ========================================

function showStatus() {
  if (!embedder) {
    console.log('❌ Embedder not initialized');
    return;
  }
  
  const status = embedder.getStatus();
  console.log('📊 Status:', status);
  console.log(`🛡️ Burst: ${status.burstUsed}/15 in last 10s`);
  console.log(`⚡ Delay: ${status.delay}ms (2.5 pixels/sec)`);
  console.log(`💰 Credits: ${status.credits || 'Unknown'}`);
  console.log(`🔄 Has resumable session: ${status.hasResumableSession}`);
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

// Startup message
console.log('🚀 Solana Place Pixel Embedder Ready (with Resume Support)');
console.log('⚡ Speed: 150 pixels/min | 🛡️ Burst-safe: 15/10s | 💾 Auto-save progress');
console.log('');
console.log('📍 USAGE:');
console.log('1. initEmbedder()  - Initialize first');
console.log('2. Choose your location:');
console.log('   • embedAtCenter(200)  - Center of canvas');
console.log('   • embedImage(x, y, size)  - Custom position');
console.log('   • Examples:');
console.log('     - embedImage(100, 100, 150)  - Top-left area');
console.log('     - embedImage(2000, 500, 100)  - Right side');
console.log('     - embedImage(800, 1500, 200)  - Bottom area');
console.log('');
console.log('🔄 RESUME FEATURES:');
console.log('   • resumeEmbedding()  - Continue interrupted session');
console.log('   • checkSession()     - View saved progress');
console.log('   • clearSession()     - Delete saved progress');
console.log('');
console.log('🎯 Canvas size: 1000x1000 pixels');
console.log('✅ Pick your spot and avoid the crowd!');
console.log('💾 Progress automatically saved every 10 pixels');

// Export functions
window.initEmbedder = initEmbedder;
window.embedImage = embedImage;
window.embedImageFast = embedImageFast;
window.embedAtCenter = embedAtCenter;
window.embedAtCenterFast = embedAtCenterFast;
window.showStatus = showStatus;
window.stopEmbedding = stopEmbedding;
window.checkCredits = checkCredits;
window.resumeEmbedding = resumeEmbedding;
window.clearSession = clearSession;
window.checkSession = checkSession;
