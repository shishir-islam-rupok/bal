export const FORMAT_OPTIONS = {
    jpg: { label: 'JPG', mime: 'image/jpeg', extension: 'jpg' },
    png: { label: 'PNG', mime: 'image/png', extension: 'png' },
    webp: { label: 'WEBP', mime: 'image/webp', extension: 'webp' },
} as const

export type OutputFormat = keyof typeof FORMAT_OPTIONS

const INPUT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/avif',
])
const MAX_FILE_SIZE = 20 * 1024 * 1024

export function validateImageFile(file: File): string | null {
    if (!file.size) return 'This file is empty.'
    if (!INPUT_TYPES.has(file.type)) return 'Choose a JPG, PNG, WEBP, GIF, BMP, or AVIF image.'
    if (file.size > MAX_FILE_SIZE) return 'Images must be smaller than 20 MB.'
    return null
}

export async function convertFile(file: File, targetFormat: OutputFormat): Promise<Blob> {
    const validationError = validateImageFile(file)
    if (validationError) throw new Error(validationError)

    const image = await loadImage(file)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create a conversion canvas.')

    if (targetFormat === 'jpg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0)

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('This image could not be converted.'))),
            FORMAT_OPTIONS[targetFormat].mime,
            targetFormat === 'jpg' || targetFormat === 'webp' ? 0.92 : undefined,
        )
    })
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const image = new Image()
        image.onload = () => {
            URL.revokeObjectURL(url)
            resolve(image)
        }
        image.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('This image could not be read.'))
        }
        image.src = url
    })
}
