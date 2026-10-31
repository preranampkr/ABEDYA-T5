import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand'

function NotFoundPage() {
  return (
    <div className="public-page not-found-page">
      <header className="site-header content-width"><Brand /><Link className="site-nav-link" to="/">Platform overview</Link></header>
      <main className="not-found-content content-width">
        <p className="eyebrow">ROUTE / 404</p>
        <h1>This route is not available.</h1>
        <p>Return to the ABHEDYA overview to continue.</p>
        <Link className="button button-primary" to="/"><ArrowLeft size={15} aria-hidden="true" /> Back to overview</Link>
      </main>
    </div>
  )
}

export default NotFoundPage