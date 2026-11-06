import { ArrowRight, HandHeart, LifeBuoy } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'

function RoleSelectionPage() {
  return (
    <div className="public-page">
      <header className="site-header content-width role-header">
        <Brand />
        <Link className="site-nav-link" to="/">Back to overview</Link>
      </header>
      <main className="role-page content-width">
        <PageHeader
          eyebrow="PLATFORM ACCESS / SELECT A ROLE"
          title="Choose your perspective."
          description="ABHEDYA provides focused tools for people affected by flooding and those helping coordinate a response."
        />
        <div className="role-grid">
          <section className="role-card" aria-labelledby="victim-role-title">
            <div className="role-card-topline"><span>01</span><span>COMMUNITY ACCESS</span></div>
            <div className="role-icon"><LifeBuoy size={23} aria-hidden="true" /></div>
            <h2 id="victim-role-title">Victim</h2>
            <p>For people affected by flooding who need information, assistance and recovery support.</p>
            <div className="role-card-actions">
              <Button asChild className="button button-primary"><Link to="/victim/login">Continue as Victim <ArrowRight size={15} aria-hidden="true" /></Link></Button>
              <Link className="text-action" to="/victim/signup">Create a profile</Link>
            </div>
          </section>

          <section className="role-card role-card-helper" aria-labelledby="helper-role-title">
            <div className="role-card-topline"><span>02</span><span>RESPONSE ACCESS</span></div>
            <div className="role-icon"><HandHeart size={23} aria-hidden="true" /></div>
            <h2 id="helper-role-title">Helper</h2>
            <p>For volunteers and authorised coordinators who help monitor incidents and coordinate response efforts.</p>
            <div className="role-card-actions">
              <Button asChild className="button button-primary"><Link to="/helper/login">Continue as Helper <ArrowRight size={15} aria-hidden="true" /></Link></Button>
              <Link className="text-action" to="/helper/signup">Create a profile</Link>
            </div>
          </section>
        </div>
        <p className="prototype-note">Helper workspace access is granted only after administrator approval.</p>
      </main>
    </div>
  )
}

export default RoleSelectionPage