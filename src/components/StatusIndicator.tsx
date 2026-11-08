type StatusTone = 'neutral' | 'warning' | 'critical' | 'ready'
import { Badge } from './ui/badge'

interface StatusIndicatorProps {
  tone?: StatusTone
  children: string
}

function StatusIndicator({ tone = 'neutral', children }: StatusIndicatorProps) {
  return (
    <Badge variant="outline" className={`status-indicator status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </Badge>
  )
}

export default StatusIndicator