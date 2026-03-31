import { PDFDocument } from 'pdf-lib'
import * as fs from 'fs'

type ImageFormat = 'jpeg' | 'png' | 'unknown'

function detectImageFormat(buffer: Buffer): ImageFormat {
  if (buffer.length < 4) return 'unknown'

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg'
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png'
  }

  return 'unknown'
}

export async function createPDF(
  images: Buffer[],
  outputPath: string,
): Promise<void> {
  const pdfDoc = await PDFDocument.create()
  let embedded = 0

  for (let i = 0; i < images.length; i++) {
    const buffer = images[i]
    const format = detectImageFormat(buffer)

    try {
      let image

      if (format === 'jpeg') {
        image = await pdfDoc.embedJpg(buffer)
      } else if (format === 'png') {
        image = await pdfDoc.embedPng(buffer)
      } else {
        // Fallback: try JPEG then PNG
        try {
          image = await pdfDoc.embedJpg(buffer)
        } catch {
          image = await pdfDoc.embedPng(buffer)
        }
      }

      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      })

      embedded++
    } catch (err) {
      console.warn(`  Could not embed image ${i + 1}: ${err}`)
    }
  }

  console.log(`Embedded ${embedded}/${images.length} images into PDF.`)

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(outputPath, pdfBytes)
}
