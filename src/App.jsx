import React, { useState } from 'react'
import DifferentialGrowthBg from './DifferentialGrowthBg.jsx'

function ExpandableSection({ title, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section className="body-section">
      <details
        className="expandable"
        open={isOpen}
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
      >
        <summary className="expandable__trigger">
          <h2>{title}</h2>
          <span className="expandable__icon" aria-hidden="true"></span>
        </summary>
        <div className="expandable__content">
          {children}
        </div>
      </details>
    </section>
  )
}

export default function App() {
  return (
    <>
      <DifferentialGrowthBg />
      <div className="film-grain" />

      <div className="page-root landing-mode">
        <div className="scroll-container">
          <div className="columns-container">
            <main className="main-column">
              <div className="main-column-inner">
                <header className="hero-header">
                  <h1 className="hero-name">Alejandro Acelas</h1>
                  <p className="hero-subtitle">or just alejo <span className="pronunciation">(/ah-leh-ho/)</span> if we're friends</p>
                </header>

                <ExpandableSection title="About" defaultOpen>
                  <p>
                    AI <a href="https://wow.pjh.is/consulting" target="_blank" rel="noopener noreferrer">enthusiast</a>.
                    Not sure if the future will be good, but very excited to push so we can make it.
                  </p>
                  <p>
                    Blog writer. Very into the{' '}
                    <a href="https://utilitarianism.net/" target="_blank" rel="noopener noreferrer">intensest form</a> of{' '}
                    <a href="https://docs.google.com/document/d/1SUPH6K6J67J5pgT_d0H82219RA5brg6lfaoBLtkXSi4/edit" target="_blank" rel="noopener noreferrer">care</a>.
                  </p>
                  <p>
                    Ambitious. Revolted by the weakness of my flesh, and actively enlisting friends to find a form worth pressing it into.
                  </p>
                </ExpandableSection>

                <ExpandableSection title="Work">
                  <ul className="experience-list">
                    <li>
                      <strong>AI uplift</strong> &mdash; Upcoming <span className="date-range">Jun 2026&ndash;present</span>
                      <br />Figure out how to get EA to AI aggressively.
                    </li>
                    <li>
                      <strong>Co-founder</strong> &mdash; Cliver <span className="date-range">Feb 2025&ndash;present</span>
                      <br />Researched who should not get DNA and how we could spot them. Tried to automate the spotting process.
                    </li>
                    <li>
                      <strong>Writing contractor</strong> &mdash; 80,000 Hours <span className="date-range">Sep 2025&ndash;present</span>
                      <br />Fact-checked and drafted footnotes for Ben's book. Could have used AI more.
                    </li>
                    <li>
                      <strong>Program consultant</strong> &mdash; LEEP <span className="date-range">May&ndash;Sep 2025</span>
                      <br />Figure out who's selling paint in Colombia and how much. Used LLMs because I'm lazy.
                    </li>
                    <li>
                      <strong>Communications contractor</strong> &mdash; FAR AI
                      <br />Created social media for AI Safety talks. Used LLMs much.
                    </li>
                    <li>
                      <strong>Head teacher</strong> &mdash; ML4Good <span className="date-range">Feb 2025&ndash;Aug 2025</span>
                      <br />Loved my students. Taught them some ML, but mostly tried teaching them conviction.
                    </li>
                    <li>
                      <strong>AI policy officer</strong> &mdash; Observatorio de Riesgos Catastr&oacute;ficos Globales <span className="date-range">May&ndash;Oct 2024</span>
                      <br />Scoured evals literature to improve the EU AI Act's Code of Practice.
                      <div className="experience-note">+ a one-month curiosity-driven detour on biorisk</div>
                    </li>
                    <li>
                      <strong>Research fellow</strong> &mdash; Swiss Existential Risk Initiative / Independent <span className="date-range">Jun&ndash;Aug 2023</span>
                      <br />Tried to fully grok small Transformers trained to add and count and similar.
                    </li>
                    <li>
                      <strong>Co-founder</strong> &mdash; Effective Altruism Uniandes <span className="date-range">Jun 2021&ndash;Feb 2023</span>
                      <br />Had many 1-on-1s. Some of them went really well.
                    </li>
                  </ul>
                </ExpandableSection>

                <ExpandableSection title="Writing">
                  <p>
                    I have <a href="http://myea.blog" target="_blank" rel="noopener noreferrer">my EA blog</a>!
                  </p>
                  <p>
                    Hope I can add a wiki with everything I've done auto-generated from my Drive.{' '}
                    <a href="mailto:alejoacelas@gmail.com">Email me</a> if you really want to see it now.
                  </p>
                  <p>
                    Maybe there's also some of my stuff on the{' '}
                    <a href="https://forum.effectivealtruism.org/users/alejoacelas" target="_blank" rel="noopener noreferrer">EA Forum</a>.
                  </p>
                </ExpandableSection>

                <ExpandableSection title="Contact">
                  <p className="contact-links">
                    <a href="mailto:alejoacelas@gmail.com">alejoacelas@gmail.com</a>
                    {' '}&middot;{' '}
                    <a href="https://linkedin.com/in/alejandro-acelas" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    {' '}&middot;{' '}
                    <a href="https://calendly.com/alejoacelas" target="_blank" rel="noopener noreferrer">Calendly</a>
                    {' '}&middot;{' '}
                    <a href="https://github.com/AlejoAcelas" target="_blank" rel="noopener noreferrer">GitHub</a>
                  </p>
                </ExpandableSection>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  )
}
