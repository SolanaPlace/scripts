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

The Solana Place canvas is **3000 pixels wide** by **2000 pixels tall**. Think of it like a giant grid:

```
(0,0) ────────────────────────────────────── (3000,0)
  │                                              │
  │               TOP AREA                       │
  │          (good for headers)                  │
  │                                              │
  │    LEFT        CENTER         RIGHT          │
  │   AREA         AREA           AREA           │
  │ (less busy)   (crowded!)    (less busy)     │
  │                                              │
  │              BOTTOM AREA                     │
  │           (good for signatures)              │
  │                                              │
(0,2000) ──────────────────────────────── (3000,2000)
```

### 📍 Good Locations to Try:

| Location | Coordinates | Why It's Good |
|----------|-------------|---------------|
| **Top Left** | `(100, 100, 200)` | Less crowded, visible |
| **Top Right** | `(2200, 100, 200)` | Less crowded, visible |
| **Left Side** | `(200, 800, 150)` | Moderate traffic |
| **Right Side** | `(2000, 800, 150)` | Moderate traffic |
| **Bottom Left** | `(300, 1600, 180)` | Good for signatures |
| **Bottom Right** | `(2000, 1600, 180)` | Good for signatures |
| **Center** | `(1400, 900, 200)` | ⚠️ Very crowded! |

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
embedImage(100, 100, 200)    

// AGGRESSIVE TAKEOVER (costs more credits but dominates area)
embedImageFast(2200, 100, 150)   
```

#### 🏠 **Center (Warning: Crowded!)**
```javascript
embedAtCenter(200)  // Places at (1400, 900) - expect conflicts!
```

---

## 📏 Choosing the Right Size

The `size` parameter is the **maximum width/height** of your image in pixels:

- **50-100px**: Small icons, logos, signatures
- **100-200px**: Medium artwork, detailed images  
- **200-300px**: Large artwork (takes longer, uses more credits)

**💡 Tip:** Start small (100px) to test, then go bigger if you like the result!

---

## 🎨 Step-by-Step Example

Let's place a 150px image in the top-right area:

1. **Initialize:**
   ```javascript
   initEmbedder()
   ```
   *You'll see: "✅ Embedder ready! Tuned for high-performance server."*

2. **Choose location:**
   ```javascript
   embedImage(2200, 100, 150)
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

**Example:** A 100x100 image = up to 10,000 credits (but usually much less after duplicate detection)

---

## 🔍 How Duplicate Detection Works

Before placing pixels, the script checks if they're already the right color:

```
🔍 Checking 4 regions instead of 8,432 individual pixels...
📊 Checking region 1/4...
📊 Checking region 2/4...
✅ Check complete: 3,247 pixels need placement, 5,185 already correct
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
🎨 50 placed | 3,197 remaining | 72/min | Credits: 6,050
🎨 100 placed | 3,147 remaining | 74/min | Credits: 6,000
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
2. **📏 Start small:** Test with 100px before going bigger  
3. **⏰ Off-peak hours:** Less competition during non-US hours
4. **💰 Credit management:** Check your balance with `checkCredits()`
5. **🛑 Emergency stop:** Use `stopEmbedding()` if needed
6. **🔐 Security:** Only use the official embedder - never modified versions
7. **⚙️ Don't modify:** The timing is professionally optimized - changes cause rate limits

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
embedImage(100, 100, 150)    // Top-left 
embedImage(2200, 100, 150)   // Top-right  
embedImage(200, 1600, 150)   // Bottom-left

// 🔥 CANVAS WAR MODE (overwrites everything):
embedImageFast(100, 100, 150)    // CLAIM top-left territory!
embedImageFast(2200, 100, 150)   // ATTACK top-right!
embedAtCenterFast(150)           // BATTLE for center!

// 3. USEFUL COMMANDS:
showStatus()      // Check progress
stopEmbedding()   // Cancel if needed
checkCredits()    // See credit balance
```

---

## 📝 License

This project is open-source and available under the MIT License.

**Happy pixel art creating! 🎨**
