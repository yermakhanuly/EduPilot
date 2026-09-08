import { Link } from 'react-router-dom'
export function LandingPage() {
  return (
    <div className="app-shell">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <header className="hero landing">
        <div className="hero-top landing-top">
          <p className="eyebrow">Your AI-powered study companion</p>
          <h1>EduPilot</h1>
          <p className="lede">Plan your week, focus deeply, and make progress that feels rewarding.</p>
          <div className="cta-row">
            <Link to="/app/plan" className="primary">Plan tasks</Link>
            <Link to="/app/strict" className="ghost">Study smarter</Link>
            <Link to="/signup" className="primary">Get started</Link>
          </div>
          <p className="discover-features">Discover features <span aria-hidden="true">⌄</span></p>
        </div>
      </header>
      <section className="landing-features">
        <p className="eyebrow">Everything you need to learn better</p>
        <h2>Supercharge your learning</h2>
        <div className="feature-grid">
          <article><span>✦</span><h3>Smart task management</h3><p>Organize assignments by priority and never miss a deadline.</p></article>
          <article><span>◈</span><h3>AI study assistant</h3><p>Get helpful nudges and recommendations whenever you need them.</p></article>
          <article><span>◉</span><h3>Progress that motivates</h3><p>Earn XP, build streaks, and celebrate every focused session.</p></article>
        </div>
      </section>
    </div>
  )
}
