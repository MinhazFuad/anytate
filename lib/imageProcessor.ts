export async function processImageClientSide(
  imageBlob: Blob,
  maxDim: number,
  jpegQuality: number
): Promise<{ blob: Blob; url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(imageBlob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      let { width, height } = img

      // Scale down if necessary
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        return reject(new Error('Canvas 2D context not supported'))
      }

      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (scaledBlob) => {
          URL.revokeObjectURL(url) // Clean up raw blob url
          if (!scaledBlob) {
            return reject(new Error('Failed to create blob from canvas'))
          }
          resolve({
            blob: scaledBlob,
            url: URL.createObjectURL(scaledBlob),
            width,
            height
          })
        },
        'image/jpeg',
        jpegQuality / 100 // quality 0.0 - 1.0
      )
    }

    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for processing'))
    }

    img.src = url
  })
}
