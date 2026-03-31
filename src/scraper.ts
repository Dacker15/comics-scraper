import puppeteer, { Page } from "puppeteer-core";

const STABILITY_ATTEMPTS = 10;
const SCROLL_STEP_PX = 500;
const SCROLL_INTERVAL_MS = 2_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getChildrenCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const div = document.getElementById("divImage");
    return div ? div.children.length : 0;
  });
}

async function getPageHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.body.scrollHeight);
}

async function scrollBy(page: Page, pixels: number): Promise<void> {
  await page.evaluate((px: number) => {
    window.scrollBy(0, px);
  }, pixels);
}

/**
 * Scrolls the page by SCROLL_STEP_PX every SCROLL_INTERVAL_MS.
 * Once both the page height AND the #divImage children count remain
 * unchanged for STABILITY_ATTEMPTS consecutive scrolls, loading is
 * considered complete.
 */
async function waitForAllImages(page: Page): Promise<void> {
  let stableCount = 0;
  let previousCount = -1;
  let previousHeight = -1;

  console.log(
    "Waiting for all images to load (scrolling 100px every 2s until stable)...",
  );

  while (stableCount < STABILITY_ATTEMPTS) {
    await scrollBy(page, SCROLL_STEP_PX);
    await delay(SCROLL_INTERVAL_MS);

    const currentCount = await getChildrenCount(page);
    const currentHeight = await getPageHeight(page);

    if (currentCount === previousCount && currentHeight === previousHeight) {
      stableCount++;
      console.log(
        `  [${new Date().toLocaleTimeString()}] Children: ${currentCount}, Height: ${currentHeight}px — stable ${stableCount}/${STABILITY_ATTEMPTS}`,
      );
    } else {
      stableCount = 0;
      previousCount = currentCount;
      previousHeight = currentHeight;
      console.log(
        `  [${new Date().toLocaleTimeString()}] Children: ${currentCount}, Height: ${currentHeight}px — changed, resetting counter`,
      );
    }
  }

  console.log(`All images loaded: ${previousCount} pages found.`);
}

async function getImageUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const div = document.getElementById("divImage");
    if (!div) return [];
    return Array.from(div.querySelectorAll("img")).map(
      (img) => (img as HTMLImageElement).src,
    );
  });
}

/**
 * Downloads a single image using the browser's fetch (preserving cookies/session).
 * Returns the image as a Buffer, or null if the download fails.
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error(`Errore durante il download di ${url}:`, error);
    return null;
  }
}

export async function scrapeComic(url: string): Promise<Buffer[]> {
  const browser = await puppeteer.connect({
    protocol: "webDriverBiDi",
    browserWSEndpoint: "ws://127.0.0.1:9222/session",
  });

  try {
    const context = browser.defaultBrowserContext();
    const page = await context.newPage({
      type: "tab",
      background: false,
    });

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });

    console.log("Waiting for #divImage to appear...");
    await page.waitForSelector("#divImage", { timeout: 30_000 });

    await waitForAllImages(page);

    console.log("Collecting image URLs...");
    const imageUrls = await getImageUrls(page);
    console.log(`Found ${imageUrls.length} images.`);

    if (imageUrls.length === 0) {
      console.warn("No images found inside #divImage > p > img");
      return [];
    }

    const images: Buffer[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      process.stdout.write(
        `  Downloading image ${i + 1}/${imageUrls.length}...\r`,
      );
      const buffer = await downloadImage(imageUrls[i]);
      if (buffer) {
        images.push(buffer);
      } else {
        console.warn(`\n  Failed to download: ${imageUrls[i]}`);
      }
    }
    process.stdout.write("\n");

    return images;
  } finally {
    await browser.close();
  }
}
