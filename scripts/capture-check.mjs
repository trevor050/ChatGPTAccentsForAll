// Sanity checks for screenshots before they are written into the repo.
//
// Headless Chromium can hand back a capture whose size is right but whose content
// is a smaller surface repeated (tiled) across it; a README image was committed like
// that once. So a capture must (1) be exactly the popup's rendered size times the
// device scale factor and (2) not repeat itself: no horizontal or vertical shift of
// the image lines up its non-background pixels with themselves.

/**
 * @param {import("playwright").BrowserContext} ctx  any context; a blank page is used to decode the PNG
 * @param {Buffer} png
 * @param {{ width: number, height: number, scale: number, name: string }} expected  CSS size and scale
 * @returns {Promise<void>} throws with a description when the capture is wrong
 */
export async function assertCapture(ctx, png, { width, height, scale, name }) {
  const page = await ctx.newPage();
  try {
    const result = await page.evaluate(async (dataUrl) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
      const g = canvas.getContext("2d");
      g.drawImage(img, 0, 0);
      const { data } = g.getImageData(0, 0, img.width, img.height);
      const W = img.width, H = img.height;
      const px = (x, y) => { const i = (y * W + x) * 4; return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; };
      const bg = px(1, H - 2);
      // Sample a grid of "ink" pixels (anything that is not the background).
      const ink = [];
      for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (Math.abs(px(x, y) - bg) > 0 && px(x, y) !== bg) ink.push([x, y]);
      // Best self-match for a shift of at least a fifth of the image, in each direction.
      const score = (dx, dy) => {
        let n = 0, same = 0;
        for (const [x, y] of ink) {
          const x2 = x + dx, y2 = y + dy;
          if (x2 >= W || y2 >= H) continue;
          n++;
          if (px(x, y) === px(x2, y2)) same++;
        }
        return n > 200 ? same / n : 0;
      };
      let worst = { s: 0, dx: 0, dy: 0 };
      for (let dy = Math.floor(H / 5); dy < H * 0.85; dy += 2) { const s = score(0, dy); if (s > worst.s) worst = { s, dx: 0, dy }; }
      for (let dx = Math.floor(W / 5); dx < W * 0.85; dx += 2) { const s = score(dx, 0); if (s > worst.s) worst = { s, dx, dy: 0 }; }
      return { W, H, worst, ink: ink.length };
    }, `data:image/png;base64,${png.toString("base64")}`);
    const want = { w: Math.round(width * scale), h: Math.round(height * scale) };
    if (result.W !== want.w || result.H !== want.h) {
      throw new Error(`${name}: capture is ${result.W}x${result.H}, the popup renders at ${want.w}x${want.h}`);
    }
    if (result.worst.s > 0.9) {
      throw new Error(`${name}: capture repeats itself (${Math.round(result.worst.s * 100)}% of pixels match at a shift of ${result.worst.dx},${result.worst.dy}); the surface was tiled`);
    }
    return result;
  } finally {
    await page.close();
  }
}
