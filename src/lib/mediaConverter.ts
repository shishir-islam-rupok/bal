import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export const MEDIA_FORMAT_OPTIONS = {
  mp3: {
    label: 'MP3 audio',
    extension: 'mp3',
    mime: 'audio/mpeg',
  },
  wav: {
    label: 'WAV audio',
    extension: 'wav',
    mime: 'audio/wav',
  },
  mp4: {
    label: 'MP4 video',
    extension: 'mp4',
    mime: 'video/mp4',
  },
  webm: {
    label: 'WEBM video',
    extension: 'webm',
    mime: 'video/webm',
  },
} as const

export type MediaOutputFormat = keyof typeof MEDIA_FORMAT_OPTIONS

const MEDIA_INPUT_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',

  'video/mp4',
  'video/webm',
  'video/x-matroska',
  'video/quicktime',
  'video/x-msvideo',
])

const MEDIA_EXTENSIONS =
  /\.(mp3|wav|ogg|m4a|mp4|webm|mkv|mov|avi)$/i

const MAX_MEDIA_SIZE = 100 * 1024 * 1024

export function validateMediaFile(file: File): string | null {
  if (!file) {
    return 'Please choose a media file.'
  }

  if (file.size === 0) {
    return 'This file is empty.'
  }

  if (file.size > MAX_MEDIA_SIZE) {
    return 'Media files must be smaller than 100 MB.'
  }

  const validMime = MEDIA_INPUT_TYPES.has(file.type)
  const validExtension = MEDIA_EXTENSIONS.test(file.name)

  if (!validMime && !validExtension) {
    return 'Choose an MP3, WAV, OGG, M4A, MP4, WEBM, MKV, MOV, or AVI file.'
  }

  return null
}

let ffmpegPromise: Promise<FFmpeg> | null = null
let lastFFmpegMessage = ''

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg()

      ffmpeg.on('log', ({ message }) => {
        lastFFmpegMessage = message
      })

      try {
        const coreURL = await toBlobURL(
          '/ffmpeg/ffmpeg-core.js',
          'text/javascript',
        )

        const wasmURL = await toBlobURL(
          '/ffmpeg/ffmpeg-core.wasm',
          'application/wasm',
        )

        await ffmpeg.load({
          coreURL,
          wasmURL,
        })

        return ffmpeg
      } catch (error) {
        ffmpegPromise = null

        throw new Error(
          `Failed to load FFmpeg: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    })()
  }

  return ffmpegPromise
}

function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) {
    return true
  }

  return /\.(mp3|wav|ogg|m4a)$/i.test(file.name)
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) {
    return true
  }

  return /\.(mp4|webm|mkv|mov|avi)$/i.test(file.name)
}

function getOutputArguments(
  inputFile: File,
  targetFormat: MediaOutputFormat,
): string[] {
  const audioInput = isAudioFile(inputFile)
  const videoInput = isVideoFile(inputFile)

  switch (targetFormat) {
    case 'mp3':
      return [
        '-vn',
        '-c:a',
        'libmp3lame',
        '-q:a',
        '2',
      ]

    case 'wav':
      return [
        '-vn',
        '-c:a',
        'pcm_s16le',
      ]

    case 'webm':
      if (audioInput && !videoInput) {
        return [
          '-vn',
          '-c:a',
          'libopus',
          '-b:a',
          '128k',
        ]
      }

      return [
        '-c:v',
        'libvpx-vp9',
        '-c:a',
        'libopus',
        '-b:a',
        '128k',
      ]

    case 'mp4':
      if (audioInput && !videoInput) {
        throw new Error(
          'Audio files cannot be converted directly to MP4 video. Please choose WEBM, MP3, or WAV.',
        )
      }

      return [
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
      ]

    default:
      throw new Error(`Unsupported output format: ${targetFormat}`)
  }
}

export async function convertMediaFile(
  file: File,
  targetFormat: MediaOutputFormat,
): Promise<Blob> {
  const validationError = validateMediaFile(file)

  if (validationError) {
    throw new Error(validationError)
  }

  const ffmpeg = await getFFmpeg()

  const safeInputName = file.name.replace(
    /[^a-z0-9._-]/gi,
    '_',
  )

  const inputName = `input-${Date.now()}-${safeInputName}`

  const outputExtension =
    MEDIA_FORMAT_OPTIONS[targetFormat].extension

  const outputName = `output-${Date.now()}.${outputExtension}`

  lastFFmpegMessage = ''

  try {
    await ffmpeg.writeFile(
      inputName,
      await fetchFile(file),
    )

    const outputArguments = getOutputArguments(
      file,
      targetFormat,
    )

    const exitCode = await ffmpeg.exec([
      '-y',
      '-i',
      inputName,
      ...outputArguments,
      outputName,
    ])

    if (exitCode !== 0) {
      throw new Error(
        lastFFmpegMessage ||
          'This media file could not be converted.',
      )
    }

    const data = await ffmpeg.readFile(outputName)

    if (typeof data === 'string') {
      throw new Error('FFmpeg returned invalid output data.')
    }

    const outputData = new Uint8Array(data)

    return new Blob(
      [outputData],
      {
        type: MEDIA_FORMAT_OPTIONS[targetFormat].mime,
      },
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Media conversion failed.'

    throw new Error(message)
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => undefined)
    await ffmpeg.deleteFile(outputName).catch(() => undefined)
  }
}