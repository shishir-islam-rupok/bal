import { useEffect, useRef, useState, type ReactNode } from 'react'
import { convertFile, FORMAT_OPTIONS, type OutputFormat, validateImageFile } from './lib/converter'
import './App.css'

type QueueFile = {
  id: string
  file: File
  status: 'ready' | 'converting' | 'done' | 'error'
  resultUrl?: string
  error?: string
}

type View = 'converter' | 'about' | 'privacy' | 'terms' | 'contact'

const MAX_FILES = 20

function App() {
  const [view, setView] = useState<View>('converter')
  const [files, setFiles] = useState<QueueFile[]>([])
  const [format, setFormat] = useState<OutputFormat>('png')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<QueueFile[]>([])

  filesRef.current = files
  useEffect(() => () => filesRef.current.forEach((item) => item.resultUrl && URL.revokeObjectURL(item.resultUrl)), [])

  function addFiles(selectedFiles: FileList | File[]) {
    const incoming = Array.from(selectedFiles).slice(0, MAX_FILES - files.length)
    const newItems = incoming.map((file) => {
      const error = validateImageFile(file)
      return {
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      status: error ? 'error' as const : 'ready' as const,
      error: error ?? undefined,
      }
    })
    setFiles((current) => [...current, ...newItems])
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl)
      return current.filter((entry) => entry.id !== id)
    })
  }

  function clearFiles() {
    files.forEach((item) => item.resultUrl && URL.revokeObjectURL(item.resultUrl))
    setFiles([])
  }

  async function convertAll() {
    const pendingFiles = files.filter((item) => item.status === 'ready')
    setFiles((current) => current.map((item) => item.status === 'ready' ? { ...item, status: 'converting', error: undefined } : item))
    for (const item of pendingFiles) {
      try {
        const blob = await convertFile(item.file, format)
        const resultUrl = URL.createObjectURL(blob)
        setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'done', resultUrl } : entry))
      } catch (error) {
        setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'error', error: error instanceof Error ? error.message : 'Conversion failed.' } : entry))
      }
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setView('converter')}><span className="brand-mark">↗</span> file<span>shift</span></button>
        <nav aria-label="Main navigation">
          <button className={view === 'converter' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setView('converter')}>Image converter</button>
          <button className={view === 'about' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setView('about')}>How it works</button>
        </nav>
        <span className="local-pill"><i /> runs locally</span>
      </header>

      <main>
        {view === 'converter' && <>
          <section className="intro">
            <p className="eyebrow">FILE TOOLS / 01</p>
            <h1>Make your files<br /><em>move better.</em></h1>
            <p className="lede">Simple, private tools for the everyday file shuffle.<br />No uploads. No accounts. No clutter.</p>
          </section>

          <section className="workspace" aria-label="Image converter">
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
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => event.target.files && addFiles(event.target.files)} />
              <span className="upload-icon">↑</span>
              <strong>Drop images here</strong>
              <span>or <u>browse your files</u></span>
              <small>JPG, PNG, or WEBP · up to 20 MB each</small>
            </div>

            <div className="control-row">
              <label htmlFor="format">Convert to</label>
              <select id="format" value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}>
                {Object.entries(FORMAT_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
              </select>
              <span className="queue-count">{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'No files selected'}</span>
              <button className="primary-button" type="button" onClick={convertAll} disabled={!files.some((item) => item.status === 'ready')}><span>✦</span> {files.some((item) => item.status === 'converting') ? 'Converting…' : `Convert ${files.filter((item) => item.status === 'ready').length || ''} file${files.filter((item) => item.status === 'ready').length === 1 ? '' : 's'}`}</button>
              {files.length > 0 && <button className="text-button" type="button" onClick={clearFiles}>Clear all</button>}
            </div>

            {files.length > 0 && <div className="file-list" aria-live="polite">
              {files.map((item) => <div className="file-row" key={item.id}>
                <div className="file-type">{item.file.type.split('/')[1]?.toUpperCase() || 'FILE'}</div>
                <div className="file-meta"><strong>{item.file.name}</strong><span>{formatBytes(item.file.size)} {item.error && <b>{item.error}</b>}</span></div>
                <span className={`status ${item.status}`}>{item.status === 'converting' ? 'Converting…' : item.status === 'done' ? 'Ready' : item.status === 'error' ? 'Needs attention' : 'Waiting'}</span>
                {item.resultUrl ? <a className="download" href={item.resultUrl} download={`${item.file.name.replace(/\.[^.]+$/, '')}.${FORMAT_OPTIONS[format].extension}`}>Download ↓</a> : <button className="remove" type="button" onClick={() => removeFile(item.id)} aria-label={`Remove ${item.file.name}`}>×</button>}
              </div>)}
            </div>}
          </section>
          <p className="privacy-note"><span>♢</span> Your files never leave your browser. They are processed locally and cleared when you leave.</p>
        </>}

        {view === 'about' && <section className="content-view about-view"><p className="eyebrow">A SMALL TOOLBOX</p><h1>Useful tools,<br /><em>without the noise.</em></h1><div className="info-grid"><article><span>01</span><h2>Private by default</h2><p>Image conversion happens inside your browser. The files you choose are never sent to a server or stored by us.</p></article><article><span>02</span><h2>Focused on the task</h2><p>File Shift is built for quick, everyday jobs: convert an image, download the result, and move on with your day.</p></article><article><span>03</span><h2>Built to stay simple</h2><p>We focus on dependable, single-purpose tools with clear limits and no unnecessary account or upload requirements.</p></article></div></section>}
          {view === 'privacy' && <PolicyPage eyebrow="PRIVACY POLICY" title={<>Your files stay<br /><em>with you.</em></>}><p>File Shift is designed to process image conversions locally in your web browser. Images selected for conversion are not uploaded to or stored on our servers by this application.</p><h2>Information we collect</h2><p>The app does not require an account and does not ask for your name, email address, or image files. Our hosting provider may process basic technical request data such as an IP address, browser type, and request time to deliver the website and protect it from abuse.</p><h2>Cookies and advertising</h2><p>We may use essential storage or cookies for site operation. If advertising is added, Google and its partners may use cookies to provide and measure ads, subject to the choices and disclosures shown on the live site. We will update this policy before enabling advertising.</p><h2>Changes</h2><p>We may update this policy when the product changes. The current version will always be published on this page.</p></PolicyPage>}
          {view === 'terms' && <PolicyPage eyebrow="TERMS OF USE" title={<>Use the tools<br /><em>responsibly.</em></>}><p>By using File Shift, you agree to use the service lawfully and respectfully. You are responsible for the files you choose and for ensuring you have the right to convert them.</p><h2>Service availability</h2><p>Image conversion is provided as-is and may change, be interrupted, or be unavailable. Conversion results should be checked before use in important work.</p><h2>Acceptable use</h2><p>Do not use the service to distribute malware, infringe rights, evade security controls, or interfere with the website. We may restrict abusive use.</p></PolicyPage>}
          {view === 'contact' && <PolicyPage eyebrow="CONTACT / SUPPORT" title={<>Need a hand?<br /><em>Write to us.</em></>}><p>Found a conversion issue, accessibility problem, or broken link? Contact the File Shift team and include the browser, input format, output format, and a short description of what happened.</p><p className="contact-email"><a href="mailto:support@fileshift.example">support@fileshift.example</a></p><p>Do not email sensitive images or private documents. The converter is designed so your files can remain on your device.</p></PolicyPage>}
      </main>
        <footer><span>© 2026 file<span>shift</span></span><span>Private tools for everyday work</span><span><button type="button" onClick={() => setView('privacy')}>Privacy</button><button type="button" onClick={() => setView('terms')}>Terms</button><button type="button" onClick={() => setView('contact')}>Contact</button></span></footer>
    </div>
  )
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function PolicyPage({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return <section className="content-view policy-view"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><div className="policy-copy">{children}</div></section>
}

export default App
