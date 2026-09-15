import './App.css'

function App() {
  return (
    <main className="portrait-page">
      <div className="background-glow glow-red" aria-hidden="true" />
      <div className="background-glow glow-green" aria-hidden="true" />
      <div className="background-glow glow-teal" aria-hidden="true" />
      <div className="portrait-stage" aria-label="Portrait reference composition">
        <img
          className="portrait-photo"
          src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80"
          alt="Portrait of a man in a light shirt"
        />
      </div>
    </main>
  )
}

export default App
