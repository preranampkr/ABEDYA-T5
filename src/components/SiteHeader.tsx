import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from './Brand'
import { Button } from './ui/button'

function SiteHeader() {
  return (
    <header className="site-header">
      <Brand />
      <nav className="site-nav" aria-label="Main navigation">
        <Link to="/roles" className="site-nav-link">Platform</Link>
        <Button asChild className="button button-small button-outline" variant="outline" size="sm">
          <Link to="/roles">Enter platform <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </Button>
      </nav>
    </header>
  )
}

export default SiteHeader