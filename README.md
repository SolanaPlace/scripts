# 🚀 Solana Place Pixel Art Embedder

**Turn any image into pixel art on the Solana Place canvas!** This script automatically places your images pixel-by-pixel while respecting all rate limits and avoiding conflicts with other users.

## 🔐 SECURITY & OFFICIAL STATUS

**⚠️ THIS IS THE OFFICIAL EMBEDDER** - Only use this version from the official Solana Place team.

### 🚨 Important Security Warnings:

- **❌ DO NOT USE** unofficial versions, forks, or modified copies
- **❌ DO NOT MODIFY** this code - it's optimized to prevent rate limiting
- **❌ BEWARE** of malicious versions that may steal your wallet/credits
- **✅ ONLY USE** the official version provided by Solana Place

**Why this matters:** Modified versions may:
- Get your account rate-limited or banned
- Steal your wallet private keys
- Drain your credits without placing pixels
- Contain malware or tracking code

**✅ Official sources only:** Get this script directly from Solana Place official channels.

## ✨ Features

- **🔐 Official & Secure** - Verified safe by Solana Place team
- **✅ Never hits rate limits** - Professionally optimized timing
- **🎯 Smart positioning** - Choose exactly where your art goes  
- **💰 Credit checking** - Warns you before running out of credits
- **🔍 Duplicate detection** - Skips pixels that are already correct
- **⚡ Optimized speed** - 150 pixels/minute placement rate

---

## 🎯 Understanding the Canvas

The Solana Place canvas is **1000 pixels wide** by **1000 pixels tall**. Think of it like a grid:

```
(0,0) ─────────────────────── (1000,0)
  │                              │
  │         TOP AREA             │
  │      (good for headers)      │
  │                              │
  │  LEFT    CENTER    RIGHT     │
  │  AREA     AREA     AREA      │
  │(quieter)(crowded!)(quieter)  │
  │                              │
  │       BOTTOM AREA            │
  │    (good for signatures)     │
  │                              │
(0,1000) ─────────────────── (1000,1000)
```

### 📍 Good Locations to Try:

| Location | Coordinates | Why It's Good |
|----------|-------------|---------------|
| **Top Left** | `(50, 50, 100)` | Less crowded, visible |
| **Top Right** | `(750, 50, 100)` | Less crowded, visible |
| **Left Side** | `(100, 400, 80)` | Moderate traffic |
| **Right Side** | `(700, 400, 80)` | Moderate traffic |
| **Bottom Left** | `(100, 750, 100)` | Good for signatures |
| **Bottom Right** | `(700, 750, 100)` | Good for signatures |
| **Center** | `(400, 400, 120)` | ⚠️ Very crowded! |

---

## 🚀 Quick Start Guide

### Open Chrome/Firefox Console - Paste the embedder.js code

### Step 1: Initialize
```javascript
initEmbedder()
```
*This sets up the script and detects your account tier*

### Step 2: Choose Your Location
Pick one of these commands based on where you want your image:

#### 🎯 **For New Areas (Credit Saving)**
```javascript
embedImage(x, y, size)  // Skips pixels that are already correct
```

#### 🔥 **For Canvas Wars (Territory Claims)**  
```javascript
embedImageFast(x, y, size)  // Overwrites EVERYTHING - claim your territory!
```

**Examples:**
```javascript
// Peaceful placement (saves credits)
embedImage(50, 50, 100)    

// AGGRESSIVE TAKEOVER (costs more credits but dominates area)
embedImageFast(750, 50, 80)   
```

#### 🏠 **Center (Warning: Crowded!)**
```javascript
embedAtCenter(120)  // Places at (400, 400) - expect conflicts!
```

---

## 📏 Choosing the Right Size

The `size` parameter is the **maximum width/height** of your image in pixels:

- **30-60px**: Small icons, logos, signatures
- **60-120px**: Medium artwork, detailed images  
- **120-200px**: Large artwork (takes longer, uses more credits)

**💡 Tip:** Start small (60px) to test, then go bigger if you like the result!

---

## 🎨 Step-by-Step Example

Let's place a 100px image in the top-right area:

1. **Initialize:**
   ```javascript
   initEmbedder()
   ```
   *You'll see: "✅ Embedder ready! Tuned for high-performance server."*

2. **Choose location:**
   ```javascript
   embedImage(750, 50, 100)
   ```
   *A file picker will open*

3. **Select your image** (PNG, JPG, JPEG)

4. **Confirm** when prompted about credits

5. **Wait** as it places pixels automatically!

---

## 🛠️ All Available Commands

### Core Functions
- `initEmbedder()` - **Always run this first!**
- `embedImage(x, y, size)` - Place image, skip pixels that are already correct (saves credits)
- `embedAtCenter(size)` - Place at canvas center (crowded!)

### 🔥 Canvas War Mode (Overwrites Everything!)
- `embedImageFast(x, y, size)` - **AGGRESSIVE MODE:** Places ALL pixels, overwrites existing art
- `embedAtCenterFast(size)` - Fast mode at center (expect battles!)

**💡 Canvas War Tip:** Use Fast mode to claim territory and overwrite enemy pixels!

### Monitoring & Control
- `showStatus()` - Check progress and current settings
- `stopEmbedding()` - Cancel current placement
- `checkCredits()` - See your current credit balance

---

## 💰 Credit Usage

**Each pixel costs 1 credit.** The script will:
- ✅ Show you the total cost before starting
- ✅ Warn you if you don't have enough credits
- ✅ Skip pixels that are already the correct color (saves credits!)

**Example:** A 60x60 image = up to 3,600 credits (but usually much less after duplicate detection)

---

## 🔍 How Duplicate Detection Works

Before placing pixels, the script checks if they're already the right color:

```
🔍 Checking 2 regions instead of 3,247 individual pixels...
📊 Checking region 1/2...
📊 Checking region 2/2...
✅ Check complete: 1,832 pixels need placement, 1,415 already correct
```

This **saves you credits** and **avoids conflicts** with existing art!

---

## ⚡ Performance & Safety

- **Speed:** 150 pixels per minute (2.5 per second)
- **Burst Protection:** Never exceeds 15 pixels per 10 seconds  
- **Rate Limits:** Mathematically impossible to hit
- **Progress Updates:** Every 50 pixels placed

**Example output:**
```
🎨 50 placed | 1,782 remaining | 148/min | Credits: 4,250
🎨 100 placed | 1,732 remaining | 151/min | Credits: 4,200
```

---

## 🚨 Troubleshooting

### "No socket connection found"
- **Solution:** Make sure you're logged into Solana Place first
- Refresh the page and try again

### "Could not detect credits"  
- **Solution:** The script will still work, just watch your credit balance manually

### "Burst limit reached" (shouldn't happen!)
- **Solution:** The script will automatically wait and retry
- This indicates a rare timing issue
- **⚠️ DO NOT modify the delays** - this will cause rate limiting

### Image won't load
- **Solution:** Use PNG, JPG, or JPEG files only
- Make sure the file isn't corrupted

### Rate limiting or account issues
- **Check:** Are you using the official version?
- **Check:** Did someone modify the timing code?
- **Solution:** Re-download the official script

---

## 🎯 Pro Tips

1. **🔍 Scout first:** Look at the canvas to find empty areas
2. **📏 Start small:** Test with 60px before going bigger  
3. **⏰ Off-peak hours:** Less competition during non-US hours
4. **💰 Credit management:** Check your balance with `checkCredits()`
5. **🛑 Emergency stop:** Use `stopEmbedding()` if needed
6. **🔐 Security:** Only use the official embedder - never modified versions
7. **⚙️ Don't modify:** The timing is professionally optimized - changes cause rate limits
8. **🎯 Strategic placement:** Corners and edges are less contested than center
9. **🔄 Check existing art:** Use normal mode to avoid overwriting good art

---

## ⚠️ Final Security Reminder

**This embedder's timing has been professionally optimized** to work with Solana Place's rate limiting system. The delays, burst limits, and safety margins have been carefully calculated.

**DO NOT:**
- ❌ Change delay values
- ❌ Modify burst limits  
- ❌ Remove safety buffers
- ❌ Use unofficial versions
- ❌ Trust "faster" versions from other sources

**Modifications WILL result in:**
- 🚫 Rate limiting
- 🚫 Account restrictions  
- 🚫 Possible security vulnerabilities
- 🚫 Credit loss without pixel placement

---

## 📋 Quick Reference Card

```javascript
// 1. ALWAYS START HERE
initEmbedder()

// 2. CHOOSE YOUR MODE:

// PEACEFUL MODE (saves credits):
embedImage(50, 50, 80)       // Top-left 
embedImage(750, 50, 80)      // Top-right  
embedImage(100, 750, 80)     // Bottom-left
embedImage(700, 750, 80)     // Bottom-right

// 🔥 CANVAS WAR MODE (overwrites everything):
embedImageFast(50, 50, 80)      // CLAIM top-left territory!
embedImageFast(750, 50, 80)     // ATTACK top-right!
embedAtCenterFast(100)          // BATTLE for center!

// 3. USEFUL COMMANDS:
showStatus()      // Check progress
stopEmbedding()   // Cancel if needed
checkCredits()    // See credit balance
```

---

## 🎨 Popular Starting Spots

**For beginners (less crowded):**
```javascript
embedImage(50, 50, 60)      // Top-left corner
embedImage(50, 800, 60)     // Bottom-left corner  
embedImage(800, 50, 60)     // Top-right corner
```

**For medium projects:**
```javascript
embedImage(200, 200, 100)   // Left side
embedImage(600, 200, 100)   // Right side
embedImage(300, 700, 100)   // Bottom area
```

**For large projects (expect competition):**
```javascript
embedAtCenter(150)          // Dead center (chaos!)
embedImage(300, 300, 200)   // Large central area
```

---

## 📝 License

This project is open-source and available under the MIT License.

**Happy pixel art creating on the 1000x1000 canvas! 🎨**
