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
  const [format, setFormat] = useState<OutputFormat>('jpg')
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

  function goToSection(sectionId: string) {
    setView('converter')
    window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => { setView('converter'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><img className="brand-logo" src="/logo.svg" alt="File Shift" /></button>
        <nav aria-label="Main navigation">
          <button className={view === 'converter' && mode === 'image' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => { clearFiles(); setMode('image'); setView('converter') }}>Image converter</button>
          <button className={view === 'converter' && mode === 'media' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => { clearFiles(); setMode('media'); setView('converter') }}>Audio &amp; video</button>
          <button className={view === 'about' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setView('about')}>How it works</button>
          <button className="nav-link" type="button" onClick={() => goToSection('format-guide')}>Format guide</button>
          <button className="nav-link" type="button" onClick={() => goToSection('faq')}>FAQ</button>
        </nav>
        <span className="local-pill"><i /> runs locally</span>
      </header>

      <main>
        {view === 'converter' && (
          <>
            <section className="converter-hero">
              <div className="intro">
                <div className="tool-switcher" role="group" aria-label="Choose converter type"><button className={mode === 'image' ? 'selected' : ''} type="button" onClick={() => { clearFiles(); setMode('image') }}>Images</button><button className={mode === 'media' ? 'selected' : ''} type="button" onClick={() => { clearFiles(); setMode('media') }}>Audio &amp; video</button></div>
                <p className="eyebrow">{mode === 'image' ? 'IMAGE CONVERTER' : 'AUDIO & VIDEO CONVERTER'} <span className="eyebrow-number">01</span></p>
                <h1>{mode === 'image' ? <>Convert images<br /><em>without uploading.</em></> : <>Convert media<br /><em>in your browser.</em></>}</h1>
                <p className="lede">{mode === 'image' ? 'Turn common image files into the format you need. Fast, private, and completely in your browser.' : 'Convert MP4, MKV, MOV, MP3, WAV, and more locally with FFmpeg WebAssembly.'}</p>
                {mode === 'image' ? <><div className="format-chips" aria-label="Choose output format">{Object.entries(FORMAT_OPTIONS).map(([value, option], index) => <Fragment key={value}>{index > 0 && <i>·</i>}<button className={format === value ? 'selected' : ''} type="button" onClick={() => setFormat(value as OutputFormat)}>{option.extension.toUpperCase()}</button></Fragment>)}</div><p className="format-note">Inputs: JPG, JPEG, PNG, WEBP, GIF, BMP, and AVIF</p></> : <div className="format-chips" aria-label="Choose output format">{Object.entries(MEDIA_FORMAT_OPTIONS).map(([value, option]) => <button key={value} className={mediaFormat === value ? 'selected' : ''} type="button" onClick={() => setMediaFormat(value as MediaOutputFormat)}>{option.extension.toUpperCase()}</button>)}</div>}
                <div className="steps"><div><b>1</b><span>Choose {mode === 'image' ? 'images' : 'media'}</span></div><div><b>2</b><span>{mode === 'image' ? 'Pick a format' : 'Trim a clip'}</span></div><div><b>3</b><span>Download</span></div></div>
              </div>

              <div className="hero-visual" aria-label="Product preview collage">
                <div className="collage-panel main-panel">
                  <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=85" alt="Laptop displaying a browser-based digital workflow" />
                  <div className="panel-overlay">
                    <span>Premium output</span>
                    <strong>Batch convert</strong>
                    <small>Clean files in seconds</small>
                  </div>
                </div>
                <div className="mini-panel">
                  <div className="mini-thumb">
                    <img src="https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=85" alt="Designer working with digital image files" />
                  </div>
                  <div className="mini-copy">
                    <span>WEB READY</span>
                    <strong>JPG / PNG / WEBP</strong>
                  </div>
                </div>
                <div className="metric-chip">
                  <strong>4.9/5</strong>
                  <span>user workflow score</span>
                </div>
              </div>
            </section>

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

            <p className="privacy-note"><span>♢</span> Your files never leave your browser. They are processed locally and cleared when you leave.</p>

            {mode === 'image' && (
              <>
                <section className="visual-showcase" aria-label="Popular image conversion examples">
                  <div className="showcase-header">
                    <p className="eyebrow">USEFUL EXAMPLES</p>
                    <h2>Quick wins for <em>everyday visual work.</em></h2>
                  </div>
                  <div className="showcase-grid">
                    <article className="showcase-card product-card feature-large">
                      <img src="https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=85" alt="Digital image editing workspace for preparing web files" />
                      <div className="card-copy">
                        <span>WEB READY</span>
                        <strong>PNG to JPG</strong>
                        <small>Faster uploads and smaller downloads</small>
                      </div>
                    </article>
                    <article className="showcase-card product-card">
                      <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85" alt="Laptop and organized digital work files" />
                      <div className="card-copy">
                        <span>SHOPPING</span>
                        <strong>Product images</strong>
                      </div>
                    </article>
                    <article className="showcase-card product-card">
                      <img src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=900&q=85" alt="Laptop showing secure online work" />
                      <div className="card-copy">
                        <span>GRAPHICS</span>
                        <strong>Transparent PNG</strong>
                      </div>
                    </article>
                    <article className="showcase-card product-card">
                      <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=85" alt="Developer preparing digital files for delivery" />
                      <div className="card-copy">
                        <span>BATCH</span>
                        <strong>Convert in one click</strong>
                      </div>
                    </article>
                  </div>
                </section>

                <section className="content-section image-story">
                  <div className="story-header">
                    <p className="eyebrow">WHY PEOPLE USE IT</p>
                    <h2>Less waiting, <em>more doing.</em></h2>
                  </div>
                  <div className="story-grid">
                    <article>
                      <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85" alt="Organized digital workflow on a laptop" />
                      <h3>Batch-ready</h3>
                      <p>Pick several files and convert them in one pass.</p>
                    </article>
                    <article>
                      <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85" alt="Browser-based creative workflow on a laptop" />
                      <h3>Built for speed</h3>
                      <p>Simple workflow, direct downloads, no signup needed.</p>
                    </article>
                    <article>
                      <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85" alt="Team working together on digital content" />
                      <h3>Privacy-first</h3>
                      <p>Everything runs locally in your browser.</p>
                    </article>
                  </div>
                </section>
              </>
            )}

            {mode === 'media' && (
              <>
                <section className="visual-showcase media-showcase" aria-label="Media conversion examples">
                  <div className="showcase-header">
                    <p className="eyebrow">MEDIA WORKFLOW</p>
                    <h2>Trim, export, and <em>share faster.</em></h2>
                  </div>
                  <div className="showcase-grid media-grid">
                    <article className="showcase-card feature-large">
                      <img src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=85" alt="Audio editing desk with studio equipment" />
                      <div className="card-copy">
                        <span>AUDIO</span>
                        <strong>MP3 export</strong>
                        <small>Clean, portable audio ready to share</small>
                      </div>
                    </article>
                    <article className="showcase-card">
                      <img src="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=900&q=85" alt="Video production camera and editing workflow" />
                      <div className="card-copy">
                        <span>VIDEO</span>
                        <strong>Clip export</strong>
                      </div>
                    </article>
                    <article className="showcase-card">
                      <img src="https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=900&q=85" alt="Audio production and sound editing equipment" />
                      <div className="card-copy">
                        <span>EDIT</span>
                        <strong>Trim in browser</strong>
                      </div>
                    </article>
                    <article className="showcase-card">
                      <img src="https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=900&q=85" alt="Content creation setup ready for media export" />
                      <div className="card-copy">
                        <span>READY</span>
                        <strong>Quick delivery</strong>
                      </div>
                    </article>
                  </div>
                </section>
              </>
            )}

            <section className="content-section value-section" id="format-guide">
              <div className="section-heading">
                <p className="eyebrow">PRACTICAL GUIDE</p>
                <h2>Choose the right <em>format for the job.</em></h2>
              </div>
              <div className="format-guide">
                <article><span className="format-badge">JPG</span><h3>Best for photos</h3><p>Use JPG for photographs, product images, and smaller web downloads. It creates compact files with broad compatibility.</p></article>
                <article><span className="format-badge">PNG</span><h3>Best for transparency</h3><p>Use PNG for logos, screenshots, illustrations, and graphics that need crisp edges or a transparent background.</p></article>
                <article><span className="format-badge">WEBP</span><h3>Best for modern websites</h3><p>Use WEBP when you want a smaller image for the web while keeping strong visual quality and transparency support.</p></article>
              </div>
            </section>

            <section className="why-section value-section">
              <div className="section-heading">
                <p className="eyebrow">WHY FILE SHIFT</p>
                <h2>A useful tool should be <em>clear and predictable.</em></h2>
              </div>
              <div className="benefit-grid">
                <div><strong>Local processing</strong><p>Your selected files are processed in the browser. They are not uploaded to a conversion server.</p></div>
                <div><strong>Batch workflow</strong><p>Add up to 20 supported files, choose one output format, and download the results together.</p></div>
                <div><strong>No account required</strong><p>There is no sign-up wall, subscription, or unnecessary profile to create before using the tool.</p></div>
              </div>
            </section>

            <section className="faq-section value-section" id="faq">
              <div className="section-heading">
                <p className="eyebrow">COMMON QUESTIONS</p>
                <h2>Before you <em>convert.</em></h2>
              </div>
              <div className="faq-list">
                <details><summary>Are my files uploaded?</summary><p>No. Image conversion happens in your browser. Audio and video conversion also runs locally through FFmpeg WebAssembly after the processing library loads.</p></details>
                <details><summary>Which image formats can I use?</summary><p>You can use JPG, JPEG, PNG, WEBP, GIF, BMP, and AVIF files up to 20 MB each. The output choices are JPG, PNG, WEBP, and AVIF.</p></details>
                <details><summary>Can I convert more than one file?</summary><p>Yes. Add up to 20 supported files to the queue, choose an output format, then use Convert all to process the batch.</p></details>
                <details><summary>What happens after I leave the page?</summary><p>Temporary previews and generated object URLs are cleared when the page is unloaded. Downloaded files remain wherever your browser saved them.</p></details>
              </div>
            </section>
          </>
        )}

        {view === 'about' && <section className="content-view about-view"><p className="eyebrow">A SMALL TOOLBOX</p><h1>Useful tools,<br /><em>without the noise.</em></h1><div className="info-grid"><article><span>01</span><h2>Private by default</h2><p>Image conversion happens inside your browser. The files you choose are never sent to a server or stored by us.</p></article><article><span>02</span><h2>Focused on the task</h2><p>File Shift is built for quick, everyday jobs: convert an image, download the result, and move on with your day.</p></article><article><span>03</span><h2>Built to stay simple</h2><p>We focus on dependable, single-purpose tools with clear limits and no unnecessary account or upload requirements.</p></article></div></section>}
        {view === 'privacy' && <PolicyPage eyebrow="PRIVACY POLICY" title={<>Your files stay<br /><em>with you.</em></>}><p>File Shift is designed to process image conversions locally in your web browser. Images selected for conversion are not uploaded to or stored on our servers by this application.</p><h2>Information we collect</h2><p>The app does not require an account and does not ask for your name, email address, or image files. Our hosting provider may process basic technical request data such as an IP address, browser type, and request time to deliver the website and protect it from abuse.</p><h2>Cookies and advertising</h2><p>We may use essential storage or cookies for site operation. If advertising is added, Google and its partners may use cookies to provide and measure ads, subject to the choices and disclosures shown on the live site. We will update this policy before enabling advertising.</p><h2>Changes</h2><p>We may update this policy when the product changes. The current version will always be published on this page.</p></PolicyPage>}
        {view === 'terms' && <PolicyPage eyebrow="TERMS OF USE" title={<>Use the tools<br /><em>responsibly.</em></>}><p>By using File Shift, you agree to use the service lawfully and respectfully. You are responsible for the files you choose and for ensuring you have the right to convert them.</p><h2>Service availability</h2><p>Image conversion is provided as-is and may change, be interrupted, or be unavailable. Conversion results should be checked before use in important work.</p><h2>Acceptable use</h2><p>Do not use the service to distribute malware, infringe rights, evade security controls, or interfere with the website. We may restrict abusive use.</p></PolicyPage>}
        {view === 'contact' && <PolicyPage eyebrow="CONTACT / SUPPORT" title={<>Need a hand?<br /><em>Write to us.</em></>}><p>Found a conversion issue, accessibility problem, or broken link? Contact the File Shift team and include the browser, input format, output format, and a short description of what happened.</p><p className="contact-email"><a href="mailto:support@fileshift.example">support@fileshift.example</a></p><p>Do not email sensitive images or private documents. The converter is designed so your files can remain on your device.</p></PolicyPage>}
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand"><button className="brand" type="button" onClick={() => { setView('converter'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><img className="brand-logo" src="/logo.svg" alt="File Shift" /></button><p>Simple, private tools for everyday file work.</p><small>Images are processed in your browser.</small></div>
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
