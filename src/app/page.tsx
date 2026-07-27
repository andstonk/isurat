import { WaitlistForm } from "@/components/waitlist-form";

const features = [
  {
    icon: "upload",
    title: "MP4 upload",
    description: "Drop in your edit and get to work. Fast, secure uploads built for large video files.",
    accent: "violet",
  },
  {
    icon: "sparkles",
    title: "Auto subtitle generation",
    description: "Accurate, time-coded captions with speaker detection—ready before your coffee cools.",
    accent: "blue",
  },
  {
    icon: "file",
    title: "SRT, VTT & TXT export",
    description: "Download clean subtitle and transcript files for your editing workflow.",
    accent: "emerald",
  },
  {
    icon: "flame",
    title: "Burn captions into video",
    description: "Render polished, on-brand captions directly into your final video—no extra tools needed.",
    accent: "orange",
  },
  {
    icon: "link",
    title: "Client review links",
    description: "Share a private link, collect timestamped feedback, and keep approvals moving.",
    accent: "pink",
  },
];

const steps = [
  { number: "01", title: "Upload your cut", text: "Drag in an MP4 and let Subframe handle the rest." },
  { number: "02", title: "Refine the transcript", text: "Fix words, timing, speakers, and styles in one focused editor." },
  { number: "03", title: "Deliver with confidence", text: "Export a subtitle file, burn captions, or share a review link." },
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <header className="site-header">
        <nav className="shell nav-inner" aria-label="Main navigation">
          <a href="#top" className="brand" aria-label="Subframe home">
            <LogoMark />
            <span>subframe</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
          </div>
          <a href="/auth" className="nav-cta">Open studio <ArrowUpRight /></a>
        </nav>
      </header>

      <section id="top" className="hero-section">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="shell hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> Built for freelance video editors</div>
          <h1>Generate professional<br />video subtitles <span>in minutes.</span></h1>
          <p className="hero-subtitle">
            Go from final cut to client-ready captions in one seamless workflow.
            Less subtitle work. More time to create.
          </p>
          <div className="hero-actions"><a href="/auth" className="primary-button">Start creating subtitles</a><a href="/dashboard" className="secondary-button">Open dashboard</a></div>
          <div className="trust-row" aria-label="Key benefits">
            <div><CheckCircle /> No credit card</div>
            <div><CheckCircle /> Free early access</div>
            <div><CheckCircle /> Editor-first workflow</div>
          </div>
        </div>

        <div className="shell product-wrap" aria-label="Subframe subtitle editor preview">
          <div className="product-glow" aria-hidden="true" />
          <div className="product-window">
            <div className="window-bar">
              <div className="traffic"><span /><span /><span /></div>
              <div className="project-name"><span className="folder-icon" /> summer-campaign-final.mp4</div>
              <div className="window-status"><span /> Saved</div>
            </div>
            <div className="editor-layout">
              <aside className="editor-sidebar">
                <button className="sidebar-active" aria-label="Transcript"><Icon name="text" /></button>
                <button aria-label="Style"><Icon name="style" /></button>
                <button aria-label="Comments"><Icon name="comment" /><span className="notice">2</span></button>
                <div className="sidebar-spacer" />
                <button aria-label="Settings"><Icon name="settings" /></button>
              </aside>
              <div className="video-panel">
                <div className="video-stage">
                  <div className="scene-sky" />
                  <div className="scene-sun" />
                  <div className="scene-mountain mountain-back" />
                  <div className="scene-mountain mountain-front" />
                  <div className="scene-person"><span className="person-head" /><span className="person-body" /></div>
                  <div className="caption-preview">Create more. <em>Wait less.</em></div>
                  <div className="video-controls">
                    <span className="play-icon">▶</span><span>00:14</span>
                    <div className="scrub"><span /></div><span>01:24</span>
                    <Icon name="volume" /><Icon name="expand" />
                  </div>
                </div>
                <div className="timeline">
                  <div className="timeline-times"><span>00:00</span><span>00:15</span><span>00:30</span><span>00:45</span><span>01:00</span><span>01:15</span></div>
                  <div className="timeline-track">
                    {Array.from({ length: 28 }).map((_, index) => <i key={index} style={{ height: `${12 + ((index * 11) % 26)}px` }} />)}
                    <div className="playhead"><b /></div>
                  </div>
                  <div className="caption-track"><span>Create more. Wait less.</span><span>Your story, perfectly timed.</span><span>Ready to deliver.</span></div>
                </div>
              </div>
              <aside className="transcript-panel">
                <div className="transcript-head"><div><span>TRANSCRIPT</span><strong>English (US)</strong></div><button>•••</button></div>
                <div className="transcript-body">
                  <TranscriptLine time="00:08" text="There’s a better way to bring your ideas to life." />
                  <TranscriptLine active time="00:14" text="Create more. Wait less." />
                  <TranscriptLine time="00:18" text="Your story deserves to be seen—and understood." />
                  <TranscriptLine time="00:24" text="With every word, perfectly timed." />
                </div>
                <button className="export-button"><Icon name="download" /> Export subtitles <span>⌄</span></button>
              </aside>
            </div>
          </div>
          <div className="floating-card accuracy-card"><span className="metric-icon"><Icon name="sparkles" /></span><div><b>98.7%</b><small>Transcript accuracy</small></div></div>
          <div className="floating-card ready-card"><span className="ready-check"><Check /></span><div><b>Captions ready</b><small>Generated in 42 seconds</small></div></div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Compatible editing software">
        <div className="shell proof-inner">
          <p>Built to fit your editing workflow</p>
          <div className="software-list">
            <span><span className="app-icon premiere">Pr</span> Premiere Pro</span>
            <span><span className="app-icon resolve">◉</span> DaVinci Resolve</span>
            <span><span className="app-icon finalcut">▰</span> Final Cut Pro</span>
            <span><span className="app-icon afterfx">Ae</span> After Effects</span>
          </div>
        </div>
      </section>

      <section id="features" className="section features-section">
        <div className="shell">
          <div className="section-heading">
            <span className="section-label">Everything you need</span>
            <h2>From upload to delivery,<br /><span>all in one place.</span></h2>
            <p>Subtitle work shouldn’t slow down your edit. Subframe keeps every step fast, focused, and client-ready.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature, index) => (
              <article className={`feature-card ${index < 2 ? "feature-wide" : ""}`} key={feature.title}>
                <div className={`feature-icon ${feature.accent}`}><Icon name={feature.icon} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                {index === 0 && <div className="mini-ui upload-ui"><div><Icon name="upload" /><span><b>Drop your MP4 here</b><small>Up to 10 GB</small></span></div><span className="upload-chip">Uploading 76%</span><i><b /></i></div>}
                {index === 1 && <div className="mini-ui language-ui"><span><i>EN</i><b>English</b><small>Detected</small></span><span className="waveform">▂▅▃▇▅▆▂▃▆▅▇▃▂▅</span><em><Icon name="sparkles" /> Generating...</em></div>}
                {index === 2 && <div className="format-row"><span>SRT</span><span>VTT</span><span>TXT</span></div>}
                {index === 3 && <div className="burn-preview"><span>YOUR STORY, <b>YOUR STYLE.</b></span></div>}
                {index === 4 && <div className="review-bubbles"><span>JD</span><div><b>Looks perfect!</b><small>at 00:42</small></div><i><Check /></i></div>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="section workflow-section">
        <div className="workflow-orb" aria-hidden="true" />
        <div className="shell workflow-grid">
          <div className="workflow-copy">
            <span className="section-label">A faster workflow</span>
            <h2>Three steps.<br /><span>Zero subtitle chaos.</span></h2>
            <p>Stop bouncing between transcription tools, spreadsheets, and endless review emails.</p>
            <a href="#waitlist" className="text-link">Start saving hours <ArrowUpRight /></a>
          </div>
          <div className="steps-list">
            {steps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
                <CheckCircle />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist" className="section cta-section">
        <div className="shell">
          <div className="cta-card">
            <div className="cta-grid" aria-hidden="true" />
            <div className="cta-light" aria-hidden="true" />
            <div className="cta-content">
              <span className="cta-icon"><LogoMark /></span>
              <h2>Deliver faster.<br /><span>Edit happier.</span></h2>
              <p>Join freelance editors getting early access to a better subtitle workflow.</p>
              <WaitlistForm compact />
              <small>Be first in line. Early members get launch pricing.</small>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <a href="#top" className="brand"><LogoMark /><span>subframe</span></a>
          <p>Professional subtitles, without the busywork.</p>
          <span>© {new Date().getFullYear()} Subframe</span>
        </div>
      </footer>
    </main>
  );
}

function TranscriptLine({ time, text, active = false }: { time: string; text: string; active?: boolean }) {
  return <div className={`transcript-line ${active ? "active" : ""}`}><span>{time}</span><p>{text}</p></div>;
}

function LogoMark() {
  return <svg className="logo-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="3" y="5" width="26" height="22" rx="7" fill="url(#logo-gradient)"/><path d="M10 12.5h12M10 16h8M10 19.5h10" stroke="white" strokeWidth="2" strokeLinecap="round"/><defs><linearGradient id="logo-gradient" x1="5" y1="5" x2="27" y2="29" gradientUnits="userSpaceOnUse"><stop stopColor="#A78BFA"/><stop offset="1" stopColor="#6D28D9"/></linearGradient></defs></svg>;
}

function ArrowUpRight() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function Check() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function CheckCircle() { return <svg className="check-circle" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.5" stroke="currentColor"/><path d="m6.5 10 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    upload: <><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v4h14v-4"/></>,
    sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m5 13 .8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Zm13-2 .6 1.4L20 13l-1.4.6L18 15l-.6-1.4L16 13l1.4-.6L18 11Z"/></>,
    file: <><path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v5h4M10 13h5m-5 4h5"/></>,
    flame: <path d="M12 22c4 0 7-2.7 7-6.6 0-2.6-1.4-5.2-4.2-7.7.1 2-1 3.2-2 3.7.2-3.4-1.5-6.2-4.4-8.4.1 3.6-3.4 5.7-3.4 10.2 0 2.3 1.1 4.2 2.8 5.2-.1-2.2.8-4.2 2.4-5.5-.1 2.7 1.4 3.7 2.4 4.6.8.7 1.1 2 .4 4.3-.3.1-.7.2-1 .2Z"/>,
    link: <><path d="m9.5 14.5-1 1a4 4 0 0 1-5.7-5.7l3-3a4 4 0 0 1 5.7 0"/><path d="m14.5 9.5 1-1a4 4 0 0 1 5.7 5.7l-3 3a4 4 0 0 1-5.7 0M8.5 15.5l7-7"/></>,
    text: <><path d="M5 6h14M8 10h8M6 14h12M9 18h6"/></>,
    style: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m5 12-2 1 9 5 9-5-2-1"/><path d="m5 17-2 1 9 5 9-5-2-1"/></>,
    comment: <path d="M4 5h16v12H9l-5 4V5Z"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2.1 2.1m9.8 9.8L19 19M19 5l-2.1 2.1m-9.8 9.8L5 19"/></>,
    volume: <><path d="M4 10h3l4-4v12l-4-4H4v-4Z"/><path d="M15 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></>,
    expand: <><path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"/></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{paths[name]}</svg>;
}
