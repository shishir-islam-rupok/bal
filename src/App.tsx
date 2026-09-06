import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { convertFile, FORMAT_OPTIONS, type OutputFormat, validateImageFile } from './lib/converter'
import { convertMediaFile, isAudioFile, isVideoFile, MEDIA_FORMAT_OPTIONS, type MediaOutputFormat, type MediaTrim, validateMediaFile } from './lib/mediaConverter'
import './App.css'

type QueueFile = {
  id: string
  file: File
  previewUrl: string
  status: 'ready' | 'converting' | 'done' | 'error'
  resultUrl?: string
  error?: string
}

type View = 'converter' | 'about' | 'privacy' | 'terms' | 'contact'
type ToolMode = 'image' | 'media'

const MAX_FILES = 20

function App() {
  const [view, setView] = useState<View>('converter')
  const [files, setFiles] = useState<QueueFile[]>([])
  const [format, setFormat] = useState<OutputFormat>('png')
  const [mediaFormat, setMediaFormat] = useState<MediaOutputFormat>('mp3')
  const [trimStart, setTrimStart] = useState('0')
  const [trimEnd, setTrimEnd] = useState('')
  const [mediaDuration, setMediaDuration] = useState(0)
  const [mode, setMode] = useState<ToolMode>('image')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<QueueFile[]>([])

  filesRef.current = files
  useEffect(() => () => filesRef.current.forEach((item) => {
    URL.revokeObjectURL(item.previewUrl)
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl)
  }), [])

  function addFiles(selectedFiles: FileList | File[]) {
    const incoming = Array.from(selectedFiles).slice(0, MAX_FILES - files.length)
    const newItems = incoming.map((file) => {
      const error = mode === 'image' ? validateImageFile(file) : validateMediaFile(file)
      return {
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: error ? 'error' as const : 'ready' as const,
        error: error ?? undefined,
      }
    })
    setFiles((current) => [...current, ...newItems])
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl)
      return current.filter((entry) => entry.id !== id)
    })
  }

  function clearFiles() {
    files.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl)
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl)
    })
    setFiles([])
  }

  async function convertAll() {
    const pendingFiles = files.filter((item) => item.status === 'ready')
    setFiles((current) => current.map((item) => item.status === 'ready' ? { ...item, status: 'converting', error: undefined } : item))
    for (const item of pendingFiles) {
      try {
        const requestedStart = Number(trimStart)
        const requestedEnd = trimEnd ? Number(trimEnd) : undefined
        const safeStart = Number.isFinite(requestedStart) ? Math.max(0, requestedStart) : 0
        const safeEnd = requestedEnd === undefined || !Number.isFinite(requestedEnd) ? undefined : Math.max(safeStart + 0.1, requestedEnd)
        const trim = mode === 'media' && (safeStart > 0 || safeEnd !== undefined) ? { startSeconds: safeStart, endSeconds: safeEnd } satisfies MediaTrim : undefined
        const blob = mode === 'image' ? await convertFile(item.file, format) : await convertMediaFile(item.file, mediaFormat, trim)
        const resultUrl = URL.createObjectURL(blob)
        setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'done', resultUrl } : entry))
      } catch (error) {
        setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'error', error: getErrorMessage(error) } : entry))
      }
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setView('converter')}><span className="brand-mark">↗</span> file<span>shift</span></button>
        <nav aria-label="Main navigation">
          <button className={view === 'converter' && mode === 'image' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => { clearFiles(); setMode('image'); setView('converter') }}>Image converter</button>
          <button className={view === 'converter' && mode === 'media' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => { clearFiles(); setMode('media'); setView('converter') }}>Audio &amp; video</button>
          <button className={view === 'about' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setView('about')}>How it works</button>
        </nav>
        <span className="local-pill"><i /> runs locally</span>
      </header>

      <main>
        {view === 'converter' && <>
          <section className="converter-hero">
            <div className="intro">
              <div className="tool-switcher" role="group" aria-label="Choose converter type"><button className={mode === 'image' ? 'selected' : ''} type="button" onClick={() => { clearFiles(); setMode('image') }}>Images</button><button className={mode === 'media' ? 'selected' : ''} type="button" onClick={() => { clearFiles(); setMode('media') }}>Audio & video</button></div>
              <p className="eyebrow">{mode === 'image' ? 'IMAGE CONVERTER' : 'AUDIO & VIDEO CONVERTER'} <span className="eyebrow-number">01</span></p>
              <h1>{mode === 'image' ? <>Convert images<br /><em>without uploading.</em></> : <>Convert media<br /><em>in your browser.</em></>}</h1>
              <p className="lede">{mode === 'image' ? 'Turn common image files into the format you need. Fast, private, and completely in your browser.' : 'Convert MP4, MKV, MOV, MP3, WAV, and more locally with FFmpeg WebAssembly.'}</p>
              {mode === 'image' ? <><div className="format-chips" aria-label="Choose output format">{Object.entries(FORMAT_OPTIONS).map(([value, option], index) => <Fragment key={value}>{index > 0 && <i>·</i>}<button className={format === value ? 'selected' : ''} type="button" onClick={() => setFormat(value as OutputFormat)}>{option.extension.toUpperCase()}</button></Fragment>)}</div><p className="format-note">Inputs: JPG, JPEG, PNG, WEBP, GIF, BMP, and AVIF</p></> : <div className="format-chips" aria-label="Choose output format">{Object.entries(MEDIA_FORMAT_OPTIONS).map(([value, option]) => <button key={value} className={mediaFormat === value ? 'selected' : ''} type="button" onClick={() => setMediaFormat(value as MediaOutputFormat)}>{option.extension.toUpperCase()}</button>)}</div>}
              <div className="steps"><div><b>1</b><span>Choose {mode === 'image' ? 'images' : 'media'}</span></div><div><b>2</b><span>{mode === 'image' ? 'Pick a format' : 'Trim a clip'}</span></div><div><b>3</b><span>Download</span></div></div>
            </div>

            <section className="workspace" aria-label={mode === 'image' ? 'Image converter' : 'Audio and video converter'}>
              <div className="workspace-heading"><div><strong>Start converting</strong><span>Files stay on your device</span></div><span className="secure-mark">LOCAL</span></div>
              <div
                className={isDragging ? 'dropzone dragging' : 'dropzone'}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files) }}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
                role="button"
                tabIndex={0}
              >
                <input ref={inputRef} type="file" accept={mode === 'image' ? 'image/*' : 'audio/*,video/*,.mkv,.avi,.mov,.m4a'} multiple onChange={(event) => event.target.files && addFiles(event.target.files)} />
                <span className="upload-icon">↑</span>
                <strong>Drop {mode === 'image' ? 'images' : 'audio or video files'} here</strong>
                <span>or <u>choose files</u> from your device</span>
                <small>{mode === 'image' ? 'JPG, PNG, WEBP, GIF, BMP, or AVIF · up to 20 files · 20 MB each' : 'MP4, MKV, MOV, MP3, WAV, OGG, or M4A · up to 20 files · 100 MB each'}</small>
              </div>

              <div className="control-row">
                <label htmlFor="format">Convert to</label>
                <select id="format" value={mode === 'image' ? format : mediaFormat} onChange={(event) => mode === 'image' ? setFormat(event.target.value as OutputFormat) : setMediaFormat(event.target.value as MediaOutputFormat)}>
                  {Object.entries(mode === 'image' ? FORMAT_OPTIONS : MEDIA_FORMAT_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                </select>
                <span className="queue-count">{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected · batch ready` : 'Select multiple files to begin'}</span>
                <button className="primary-button" type="button" onClick={convertAll} disabled={!files.some((item) => item.status === 'ready')}><span>✦</span> {files.some((item) => item.status === 'converting') ? 'Converting batch…' : `Convert all ${files.filter((item) => item.status === 'ready').length || ''} file${files.filter((item) => item.status === 'ready').length === 1 ? '' : 's'}`}</button>
                {files.length > 0 && <button className="text-button" type="button" onClick={clearFiles}>Clear all</button>}
              </div>

              {mode === 'media' && <div className="trim-editor"><div className="trim-editor-heading"><div><strong>Trim clip</strong><span>Drag the handles or enter exact times</span></div><span className="edit-badge">NON-DESTRUCTIVE</span></div><div className="timeline"><div className="timeline-grid">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><div className="trim-selection" style={{ left: `${mediaDuration ? (Number(trimStart || 0) / mediaDuration) * 100 : 7}%`, right: `${mediaDuration && trimEnd ? Math.max(0, 100 - (Number(trimEnd) / mediaDuration) * 100) : 18}%` }}><b /> <span /> <b /></div>{mediaDuration > 0 && <><input className="timeline-range timeline-start" aria-label="Trim start handle" type="range" min="0" max={mediaDuration} step="0.1" value={Number(trimStart || 0)} onChange={(event) => setTrimStart(event.target.value)} /><input className="timeline-range timeline-end" aria-label="Trim end handle" type="range" min="0" max={mediaDuration} step="0.1" value={Number(trimEnd || mediaDuration)} onChange={(event) => setTrimEnd(event.target.value)} /></>}</div><div className="trim-controls"><div><label htmlFor="trim-start">IN / start</label><input id="trim-start" type="number" min="0" max={mediaDuration || undefined} step="0.1" value={trimStart} onChange={(event) => setTrimStart(event.target.value)} /></div><span>→</span><div><label htmlFor="trim-end">OUT / end</label><input id="trim-end" type="number" min="0" max={mediaDuration || undefined} step="0.1" placeholder="Full length" value={trimEnd} onChange={(event) => setTrimEnd(event.target.value)} /></div><span className="trim-summary">{trimEnd ? `${Math.max(0, Number(trimEnd) - Number(trimStart || 0)).toFixed(1)}s selected` : 'Full clip selected'}{mediaDuration ? ` / ${mediaDuration.toFixed(1)}s` : ''}</span><button className="text-button" type="button" onClick={() => { setTrimStart('0'); setTrimEnd('') }}>Reset</button></div></div>}

              {files.length > 0 && <div className="file-list" aria-live="polite">
                {files.map((item) => <div className="file-row" key={item.id}>
                  {mode === 'image' ? <div className="file-preview"><img src={item.previewUrl} alt="" /></div> : <div className="media-preview">{isAudioFile(item.file) ? <audio controls preload="metadata" src={item.previewUrl} onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration)} aria-label={`Preview ${item.file.name}`} /> : isVideoFile(item.file) ? <video controls preload="metadata" src={item.previewUrl} onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration)} aria-label={`Preview ${item.file.name}`} /> : <span>MEDIA</span>}</div>}
                  <div className="file-meta"><strong>{item.file.name}</strong><span>{formatBytes(item.file.size)} {item.error && <b>{item.error}</b>}</span></div>
                  <span className={`status ${item.status}`}>{item.status === 'converting' ? 'Converting…' : item.status === 'done' ? 'Converted' : item.status === 'error' ? 'Needs attention' : 'Waiting'}</span>
                  {item.resultUrl ? <a className="download" href={item.resultUrl} download={`${item.file.name.replace(/\.[^.]+$/, '')}.${mode === 'image' ? FORMAT_OPTIONS[format].extension : MEDIA_FORMAT_OPTIONS[mediaFormat].extension}`}>Download ↓</a> : <button className="remove" type="button" onClick={() => removeFile(item.id)} aria-label={`Remove ${item.file.name}`}>×</button>}
                </div>)}
              </div>}
            </section>
          </section>
          <p className="privacy-note"><span>♢</span> Your files never leave your browser. They are processed locally and cleared when you leave.</p>
          {mode === 'image' && <><section className="content-section converter-guide">
            <div className="section-heading"><p className="eyebrow">IMAGE CONVERSION, EXPLAINED</p><h2>Everything you need<br /><em>to choose the right format.</em></h2></div>
            <div className="format-guide">
              <article><span className="format-badge">JPG</span><h3>Best for photographs</h3><p>Small file sizes and broad compatibility make JPG a practical choice for photos, documents, and everyday sharing.</p></article>
              <article><span className="format-badge">PNG</span><h3>Best for transparency</h3><p>Use PNG when you need crisp graphics, screenshots, logos, or an image with a transparent background.</p></article>
              <article><span className="format-badge">WEBP</span><h3>Best for the web</h3><p>WEBP keeps good visual quality in a compact file, making it useful for faster-loading websites and online stores.</p></article>
            </div>
          </section>
            <section className="content-section why-section"><p className="eyebrow">WHY FILE SHIFT</p><div className="benefit-grid"><article><strong>Private processing</strong><p>Images are rendered by your browser. There is no upload queue and no account to create.</p></article><article><strong>Simple batch work</strong><p>Select up to 20 supported images at once, choose one output format, and download each result.</p></article><article><strong>Clear limits</strong><p>JPG, PNG, WEBP, GIF, BMP, and AVIF inputs are supported up to 20 MB each.</p></article></div></section>
            <section className="content-section faq-section"><p className="eyebrow">COMMON QUESTIONS</p><h2>Before you convert.</h2><div className="faq-list"><details><summary>Are my images uploaded?</summary><p>No. Conversion happens locally in your browser. File Shift does not send selected images to a conversion server.</p></details><details><summary>Which image types can I convert?</summary><p>You can use JPG/JPEG, PNG, WEBP, GIF, BMP, and AVIF files and convert them to JPG, PNG, or WEBP.</p></details><details><summary>How many images can I convert?</summary><p>You can select up to 20 images in one batch. Each file must be 20 MB or smaller.</p></details><details><summary>Why can a JPG have a white background?</summary><p>JPG does not support transparency. Transparent areas are placed on a white background when converting to JPG.</p></details></div></section></>}
          {mode === 'media' && <><section className="content-section converter-guide"><div className="section-heading"><p className="eyebrow">AUDIO &amp; VIDEO, EXPLAINED</p><h2>Convert and cut<br /><em>your media locally.</em></h2></div><div className="format-guide"><article><span className="format-badge">MP3</span><h3>Compact audio</h3><p>MP3 is a practical choice for music, voice recordings, and sharing audio with almost any device.</p></article><article><span className="format-badge">WAV</span><h3>Uncompressed audio</h3><p>Choose WAV when you need a larger, uncompressed file for editing, production, or archival work.</p></article><article><span className="format-badge">MP4</span><h3>Everyday video</h3><p>MP4 works well for compatible video exports. WEBM is also available for web-focused playback.</p></article></div></section><section className="content-section why-section"><p className="eyebrow">MEDIA WORKFLOW</p><div className="benefit-grid"><article><strong>Preview before export</strong><p>Play audio and video directly in the queue before choosing an output format.</p></article><article><strong>Drag to cut</strong><p>Set IN and OUT points on the timeline or enter exact seconds for a precise clip.</p></article><article><strong>Local FFmpeg engine</strong><p>Media processing runs in your browser. Larger files may take longer while the local engine works.</p></article></div></section><section className="content-section faq-section"><p className="eyebrow">MEDIA QUESTIONS</p><h2>Before you export.</h2><div className="faq-list"><details><summary>Does the converter upload my media?</summary><p>No. The FFmpeg engine runs locally in your browser and the selected files stay on your device.</p></details><details><summary>Can I convert M4A to MP3?</summary><p>Yes. Add an M4A file, choose MP3, optionally set a trim range, and convert the batch.</p></details><details><summary>Can I cut a media file?</summary><p>Yes. Load the file preview, drag the timeline handles, or enter start and end seconds before exporting.</p></details><details><summary>Why might a large file take time?</summary><p>Browser-based media conversion uses your device processor and downloads the FFmpeg engine the first time it is needed.</p></details></div></section></>}
        </>}

        {view === 'about' && <section className="content-view about-view"><p className="eyebrow">A SMALL TOOLBOX</p><h1>Useful tools,<br /><em>without the noise.</em></h1><div className="info-grid"><article><span>01</span><h2>Private by default</h2><p>Image conversion happens inside your browser. The files you choose are never sent to a server or stored by us.</p></article><article><span>02</span><h2>Focused on the task</h2><p>File Shift is built for quick, everyday jobs: convert an image, download the result, and move on with your day.</p></article><article><span>03</span><h2>Built to stay simple</h2><p>We focus on dependable, single-purpose tools with clear limits and no unnecessary account or upload requirements.</p></article></div></section>}
        {view === 'privacy' && <PolicyPage eyebrow="PRIVACY POLICY" title={<>Your files stay<br /><em>with you.</em></>}><p>File Shift is designed to process image conversions locally in your web browser. Images selected for conversion are not uploaded to or stored on our servers by this application.</p><h2>Information we collect</h2><p>The app does not require an account and does not ask for your name, email address, or image files. Our hosting provider may process basic technical request data such as an IP address, browser type, and request time to deliver the website and protect it from abuse.</p><h2>Cookies and advertising</h2><p>We may use essential storage or cookies for site operation. If advertising is added, Google and its partners may use cookies to provide and measure ads, subject to the choices and disclosures shown on the live site. We will update this policy before enabling advertising.</p><h2>Changes</h2><p>We may update this policy when the product changes. The current version will always be published on this page.</p></PolicyPage>}
        {view === 'terms' && <PolicyPage eyebrow="TERMS OF USE" title={<>Use the tools<br /><em>responsibly.</em></>}><p>By using File Shift, you agree to use the service lawfully and respectfully. You are responsible for the files you choose and for ensuring you have the right to convert them.</p><h2>Service availability</h2><p>Image conversion is provided as-is and may change, be interrupted, or be unavailable. Conversion results should be checked before use in important work.</p><h2>Acceptable use</h2><p>Do not use the service to distribute malware, infringe rights, evade security controls, or interfere with the website. We may restrict abusive use.</p></PolicyPage>}
        {view === 'contact' && <PolicyPage eyebrow="CONTACT / SUPPORT" title={<>Need a hand?<br /><em>Write to us.</em></>}><p>Found a conversion issue, accessibility problem, or broken link? Contact the File Shift team and include the browser, input format, output format, and a short description of what happened.</p><p className="contact-email"><a href="mailto:support@fileshift.example">support@fileshift.example</a></p><p>Do not email sensitive images or private documents. The converter is designed so your files can remain on your device.</p></PolicyPage>}
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand"><button className="brand" type="button" onClick={() => setView('converter')}><span className="brand-mark">↗</span> file<span>shift</span></button><p>Simple, private tools for everyday file work.</p><small>Images are processed in your browser.</small></div>
          <div className="footer-column"><strong>Tools</strong><button type="button" onClick={() => setView('converter')}>Image converter</button><button type="button" onClick={() => setView('about')}>How it works</button></div>
          <div className="footer-column"><strong>Information</strong><a href="/about.html">About File Shift</a><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of use</a><a href="/contact.html">Contact support</a></div>
        </div>
        <div className="footer-bottom"><span>© 2026 file<span>shift</span></span><span>JPG · PNG · WEBP</span><span>Made for simpler file work</span></div>
      </footer>
    </div>
  )
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Conversion failed. Please try another file or format.'
}

function PolicyPage({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return <section className="content-view policy-view"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><div className="policy-copy">{children}</div></section>
}

export default App
