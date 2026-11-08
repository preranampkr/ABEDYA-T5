import { Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BrandProps {
  className?: string
}

function Brand({ className = '' }: BrandProps) {
  return (
    <Link className={`brand ${className}`.trim()} to="/" aria-label="ABHEDYA home">
      <span className="brand-mark" aria-hidden="true">
        <Shield size={20} strokeWidth={1.8} />
      </span>
      <span className="brand-copy">
        <span className="brand-name">ABHEDYA</span>
        <span className="brand-native" lang="hi">अभेद्य</span>
      </span>
    </Link>
  )
}

export default Brand