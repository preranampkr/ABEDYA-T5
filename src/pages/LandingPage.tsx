import { ArrowRight, ArrowUpRight, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmergencyRequestForm from '../components/EmergencyRequestForm'
import SiteHeader from '../components/SiteHeader'
import { Button } from '../components/ui/button'

function LandingPage() {
  return (
    <div className="public-page landing-page">
      <SiteHeader />
      <main>
        <section className="landing-hero content-width">
          <div className="landing-copy">
            <p className="eyebrow"><span className="eyebrow-rule" /> FLOOD DISASTER INTELLIGENCE</p>
            <p className="landing-tagline">Before. During. Beyond.</p>
            <h1>Clarity through every phase of a flood.</h1>
            <p className="landing-intro">
              ABHEDYA brings people seeking help and response helpers into one coordinated platform for preparedness, incident reporting and recovery.
            </p>
            <div className="landing-actions">
              <Button asChild className="button button-primary">
                <Link to="/roles">Continue to platform <ArrowRight size={16} aria-hidden="true" /></Link>
              </Button>
              <Button asChild className="button button-quiet" variant="secondary">
                <Link to="/victim/dashboard">Development access <ArrowUpRight size={15} aria-hidden="true" /></Link>
              </Button>
              <a className="button button-quiet" href="#emergency">
                Open emergency SOS <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          <aside className="response-framework" aria-label="ABHEDYA response framework">
            <div className="framework-heading">
              <span className="framework-icon"><Waves size={18} aria-hidden="true" /></span>
              <span>RESPONSE FRAMEWORK</span>
              <span className="framework-index">01 — 03</span>
            </div>
            <div className="framework-row">
              <span className="framework-step">01</span>
              <div><h2>Before</h2><p>Preparedness &amp; awareness</p></div>
              <span className="framework-line" />
            </div>
            <div className="framework-row">
              <span className="framework-step">02</span>
              <div><h2>During</h2><p>Reporting &amp; coordination</p></div>
              <span className="framework-line" />
            </div>
            <div className="framework-row">
              <span className="framework-step">03</span>
              <div><h2>Beyond</h2><p>Relief &amp; recovery</p></div>
              <span className="framework-line" />
            </div>
            <p className="framework-footnote">A platform foundation · No live feeds connected</p>
          </aside>
        </section>

        <div className="section-divider content-width"><span>IMMEDIATE ASSISTANCE</span><span>01 / 02</span></div>

        <div className="content-width landing-sos-wrap">
          <EmergencyRequestForm />
          <aside className="sos-side-note">
            <span className="side-note-number">01</span>
            <h2>Need help now?</h2>
            <p>Share the type of emergency and a location. This prototype lets you test the request flow only.</p>
            <p className="side-note-caution">For a real emergency, contact your local emergency services directly.</p>
          </aside>
        </div>

        <section className="landing-next content-width">
          <div>
            <p className="eyebrow">A SHARED RESPONSE SPACE</p>
            <h2>One platform. Two perspectives.</h2>
          </div>
          <p>Choose the Victim or Helper experience to explore the application foundation.</p>
          <Link className="text-action next-link" to="/roles">Select a role <ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      </main>
      <footer className="site-footer content-width">
        <span>ABHEDYA <span lang="hi">अभेद्य</span></span>
        <span>Frontend prototype · No operational services connected</span>
      </footer>
    </div>
  )
}

export default LandingPage