import * as fs from 'fs'
import * as path from 'path'
import { getBrowserInstance, scrapeComic } from './scraper'
import { createPDF } from './pdf'
import { BrowserContext } from 'puppeteer-core'

const OUTPUT_DIR = 'outputs'

/**
 * Extracts the comic name from a URL like:
 *   https://readcomiconline.li/Comic/PK-Paperinik-New-Adventures/Issue-0-1?id=196762
 * Returns: PK-Paperinik-New-Adventures-Issue-0-1
 */
function extractComicName(url: string): string {
  const { pathname } = new URL(url)
  const match = pathname.match(/\/Comic\/(.+)/)
  if (!match) {
    throw new Error(`Cannot extract comic name from URL: ${url}`)
  }
  // Replace path separators with dashes to produce a valid filename
  return match[1].replace(/\//g, '-')
}

async function processUrl(context: BrowserContext, url: string): Promise<void> {
  const comicName = extractComicName(url)
  const outputPath = path.join(OUTPUT_DIR, `Comic-${comicName}.pdf`)

  console.log('='.repeat(60))
  console.log(`Comic : ${comicName}`)
  console.log(`Output: ${outputPath}`)
  console.log('='.repeat(60))

  const images = await scrapeComic(context, url)

  if (images.length === 0) {
    console.warn('No images downloaded — skipping PDF generation.')
    return
  }

  console.log(`Generating PDF with ${images.length} pages...`)
  await createPDF(images, outputPath)
  console.log(`PDF saved: ${outputPath}\n`)
}

async function main(): Promise<void> {
  const inputFile = process.argv[2] ?? 'inputs.json'

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`)
    process.exit(1)
  }

  let urls: string[]
  try {
    urls = JSON.parse(fs.readFileSync(inputFile, 'utf-8'))
  } catch (err) {
    console.error(`Failed to parse ${inputFile}:`, err)
    process.exit(1)
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    console.error('The input file must contain a non-empty JSON array of URLs.')
    process.exit(1)
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log(`Processing ${urls.length} comic(s)...\n`)

  const context = await getBrowserInstance()

  for (const url of urls) {
    try {
      await processUrl(context, url)
    } catch (err) {
      console.error(`Error processing ${url}:`, err)
    }
  }

  await context.browser().close()

  console.log('Done.')
}

main()
