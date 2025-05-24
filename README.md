# Solana Place Pixel Art Embedder

This script allows you to embed pixel art on the **Solana Place** canvas, optimized to avoid rate limits by grouping pixels into regions. It processes images, extracts pixel data, and places the pixels on the canvas while minimizing API calls.

## Features

- **Rate-Limit Optimized**: Grouping pixels into regions to reduce the number of API calls.
- **Fast Embed Option**: Skip existing pixel checks to speed up the embedding process (with potential overwriting).
- **Flexible Embedding**: Embed images at specific coordinates (center, corners, or custom positions).
- **Socket Integration**: Uses existing socket connection for real-time pixel placement.

## Prerequisites

- **Solana Place** account: You must be connected to the Solana Place platform to use this script.
- **Web Browser**: The script is designed to be run in a modern web browser.

## Setup Instructions

1. **Initialize the Embedder**:
   To start using the pixel embedder, you first need to initialize it by calling the `initEmbedder()` function.
   
   Open the browser's developer console and run the following:

   ```javascript
   initEmbedder();
   ```

   This initializes the script and prepares it for pixel placement.

2. **Embedding an Image**:
   To embed an image onto the canvas, use the `embedImage()` function.

   You can provide custom parameters for the starting `x` and `y` coordinates as well as the maximum width of the image.

   Example:
   ```javascript
   embedImage(100, 100, 50);  // Embeds the image starting at (100, 100) with a max width of 50px.
   ```

3. **Fast Embedding (No Pixel Check)**:
   If you want to embed an image without checking existing pixels (this can overwrite existing pixels), use `embedImageFast()`.

   Example:
   ```javascript
   embedImageFast(100, 100, 50);  // Fast embedding without pixel checks.
   ```

4. **Embed Image at the Center**:
   To embed an image at the center of the canvas, use the `embedAtCenter()` function.

   Example:
   ```javascript
   embedAtCenter(50);  // Embeds an image with a max width of 50px at the center.
   ```

5. **Embed Image at the Corner**:
   You can also embed an image in any of the four corners of the canvas using `embedAtCorner()`.

   Example (top-left corner):
   ```javascript
   embedAtCorner('top-left', 50);  // Embeds an image with a max width of 50px at the top-left corner.
   ```

## Available Commands

- **`initEmbedder()`**: Initializes the embedder for pixel placement.
- **`embedImage(x, y, size)`**: Embeds an image at the specified coordinates `(x, y)` with a max width of `size`.
- **`embedImageFast(x, y, size)`**: Embeds an image quickly without checking existing pixels.
- **`embedAtCenter(size)`**: Embeds an image at the center of the canvas.
- **`embedAtCorner(corner, size)`**: Embeds an image at one of the four corners (`'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`).

## Monitoring Pixel Placement

- **`showStatus()`**: Returns the current status of the embedder, including the number of pixels placed, skipped, and errors encountered.
- **`stopEmbedding()`**: Stops the pixel placement process if you need to cancel it.

## Additional Features

- **Rate-Limit Handling**: The script groups pixels into 50x50 regions to minimize API calls and avoid exceeding rate limits. You can adjust this grouping behavior in the code if needed.
- **Error Handling**: If the placement fails due to network or rate-limiting issues, the script will retry after a short delay.
- **Socket Integration**: The script leverages a socket connection for real-time pixel placement.

## Troubleshooting

- **Socket Connection Issue**: Ensure that you're connected to the Solana Place platform and the `window.socket` connection is available. If not, the script will notify you.
- **API Rate-Limiting**: The script includes built-in rate-limiting handling by grouping pixels and adding delays between placement attempts. If you hit a rate limit, the script will automatically pause and retry.
  
## License

This project is open-source and available under the MIT License.
