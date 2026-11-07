import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Flashlight,
  HeartPulse,
  Home,
  Radio,
  Shield,
  Users,
  Volume2,
  Waves,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/button'

type ThreatType = 'flood' | 'collapse' | 'medical' | 'trapped'
type ElevationType = 'trapped_roof' | 'rescued_safe'

interface SosBeaconProps {
  onTriggerSos: (threat: ThreatType, elevation: ElevationType) => Promise<void>
  isBroadcasting?: boolean
  broadcastId?: string | null
  onCancelBroadcast?: () => void
}

export default function SosBeacon({
  onTriggerSos,
  isBroadcasting = false,
  broadcastId = null,
  onCancelBroadcast,
}: SosBeaconProps) {
  const [selectedThreat, setSelectedThreat] = useState<ThreatType>('flood')
  const [elevationStatus, setElevationStatus] = useState<ElevationType>('trapped_roof')
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [isWhistleOn, setIsWhistleOn] = useState(false)
  const [isStrobeOn, setIsStrobeOn] = useState(false)
  const [localBeaconActive, setLocalBeaconActive] = useState(false)
  const beaconActive = isBroadcasting || localBeaconActive

  const holdIntervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const strobeIntervalRef = useRef<number | null>(null)

  const requiredHoldTimeMs = 3000
  const radius = 46
  const circumference = 2 * Math.PI * radius

  // Cleanup Web Audio and strobe on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      if (strobeIntervalRef.current) clearInterval(strobeIntervalRef.current)
      document.body.style.filter = 'none'
      if (oscRef.current) {
        try {
          oscRef.current.stop()
        } catch {
          // ignore
        }
      }
      if (audioCtxRef.current) {
        try {
          void audioCtxRef.current.close()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const startHolding = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.cancelable) {
      e.preventDefault()
    }
    if (beaconActive) return

    setIsHolding(true)
    startTimeRef.current = Date.now()

    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(elapsed / requiredHoldTimeMs, 1)
      setHoldProgress(progress)

      if (elapsed >= requiredHoldTimeMs) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
        setIsHolding(false)
        setHoldProgress(1)
        setLocalBeaconActive(true)

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 500])
        }

        void onTriggerSos(selectedThreat, elevationStatus)
      }
    }, 40)
  }

  const cancelHolding = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    setIsHolding(false)
    setHoldProgress(0)
  }

  const toggleWhistle = () => {
    if (isWhistleOn) {
      if (oscRef.current) {
        try {
          oscRef.current.stop()
        } catch {
          // ignore
        }
        oscRef.current = null
      }
      setIsWhistleOn(false)
    } else {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioContextClass()
        audioCtxRef.current = ctx
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(2800, ctx.currentTime) // High-pitch acoustic rescue tone
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        oscRef.current = osc
        setIsWhistleOn(true)
      } catch {
        setIsWhistleOn(false)
      }
    }
  }

  const toggleStrobe = () => {
    if (isStrobeOn) {
      if (strobeIntervalRef.current) clearInterval(strobeIntervalRef.current)
      document.body.style.filter = 'none'
      setIsStrobeOn(false)
    } else {
      setIsStrobeOn(true)
      strobeIntervalRef.current = window.setInterval(() => {
        document.body.style.filter = document.body.style.filter === 'invert(1)' ? 'none' : 'invert(1)'
      }, 120)
    }
  }

  const handleCancelBeacon = () => {
    setLocalBeaconActive(false)
    setHoldProgress(0)
    onCancelBroadcast?.()
  }

  const strokeDashoffset = circumference - holdProgress * circumference

  return (
    <div className="sos-beacon-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Live Telemetry Status Strip */}
      <div
        className="sos-telemetry-strip"
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--tactical)',
                display: 'inline-block',
                boxShadow: '0 0 8px var(--tactical)',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--paper)', fontWeight: 700, letterSpacing: '0.05em' }}>
              LORA MESH: RELAY #04 (UDUPI-COASTAL)
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(245, 189, 88, 0.15)',
              color: 'var(--accent-amber)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}
          >
            <Radio size={12} aria-hidden="true" />
            <span>FALLBACK ACTIVE</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', paddingTop: '4px' }}>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', display: 'block' }}>COORDINATES</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--paper)', fontWeight: 600 }}>13.3408° N, 74.7421° E</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', display: 'block' }}>ACCURACY</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)', fontWeight: 600 }}>±1.8m (RTK-FIX)</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--sage)', display: 'block' }}>PWR / ECO</span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-sky)', fontWeight: 600 }}>84% • 18H EST</span>
          </div>
        </div>
      </div>

      {/* Primary Distress Hero Button with Radial Holding Logic */}
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(180deg, rgba(147, 0, 10, 0.25) 0%, rgba(4, 17, 10, 0.9) 100%)',
          border: '1px solid rgba(255, 180, 171, 0.3)',
          borderRadius: '16px',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Monospace Operational Protocol Marker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', zIndex: 1 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--accent-coral)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(147, 0, 10, 0.35)',
              fontWeight: 700,
            }}
          >
            PROTOCOL: ALPHA-RED-DISPATCH
          </span>
        </div>

        {/* Hold Trigger Circular Button */}
        <div
          role="button"
          tabIndex={0}
          onMouseDown={startHolding}
          onMouseUp={cancelHolding}
          onMouseLeave={cancelHolding}
          onTouchStart={startHolding}
          onTouchEnd={cancelHolding}
          onTouchCancel={cancelHolding}
          style={{
            position: 'relative',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            cursor: beaconActive ? 'default' : 'pointer',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isHolding ? 'scale(0.96)' : 'scale(1)',
            transition: 'transform 0.15s ease',
            boxShadow: '0 0 30px rgba(255, 75, 75, 0.35)',
          }}
        >
          {/* Animated SVG Ring Progress */}
          <svg
            viewBox="0 0 100 100"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#690005" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#ffb4ab"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.05s linear' }}
            />
          </svg>

          {/* Inner Core */}
          <div
            style={{
              width: '136px',
              height: '136px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #b3261e 0%, #93000a 80%, #690005 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: 'inset 0 2px 8px rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0,0,0,0.6)',
            }}
          >
            <AlertTriangle size={34} aria-hidden="true" style={{ marginBottom: '2px', color: '#ffdad6' }} />
            <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.08em', lineHeight: 1 }}>SOS</span>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 800, letterSpacing: '0.12em', color: '#ffb4ab', marginTop: '2px' }}>
              DISTRESS
            </span>
          </div>
        </div>

        {/* Action Prompt */}
        <div style={{ marginTop: '16px', textAlign: 'center', zIndex: 1 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 700,
              color: isHolding ? 'var(--accent-coral)' : 'var(--paper)',
            }}
          >
            {beaconActive ? 'DISTRESS SIGNAL BROADCASTING' : isHolding ? 'TRANSMITTING BEACON… HOLD!' : 'HOLD 3 SEC FOR RESCUE BEACON'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--sage)' }}>
            Tactical mesh broadcast transmits zero-data GPS packet
          </p>
        </div>

        {/* SOS Active Banner */}
        {beaconActive && (
          <div
            style={{
              marginTop: '16px',
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#93000a',
              border: '1px solid #ffb4ab',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} aria-hidden="true" style={{ color: '#ffb4ab' }} />
              <div>
                <strong style={{ fontSize: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  BEACON ACTIVE: SAR UNIT EN ROUTE
                </strong>
                {broadcastId && <span style={{ fontSize: '10px', color: '#ffdad6' }}>Incident #{broadcastId}</span>}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancelBeacon}
              style={{
                backgroundColor: '#ffffff',
                color: '#93000a',
                border: 'none',
                fontWeight: 700,
                fontSize: '11px',
                height: '28px',
                padding: '0 10px',
              }}
            >
              <X size={12} aria-hidden="true" /> CANCEL
            </Button>
          </div>
        )}
      </div>

      {/* Hazard Quick-Classification Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 700, color: 'var(--sage)', letterSpacing: '0.08em' }}>
            SELECT PRIMARY THREAT (TAP TO TAG)
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--tactical)' }}>1 ACTIVE</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSelectedThreat('flood')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'flood' ? 'rgba(131, 185, 107, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'flood' ? '1px solid var(--tactical)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(0, 166, 224, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Waves size={18} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Flash Flood</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Water Level Rising</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedThreat('collapse')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'collapse' ? 'rgba(245, 189, 88, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'collapse' ? '1px solid var(--accent-amber)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(245, 189, 88, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={18} style={{ color: 'var(--accent-amber)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Structural Fail</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Collapse Risk</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedThreat('medical')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'medical' ? 'rgba(255, 180, 171, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'medical' ? '1px solid var(--accent-coral)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(147, 0, 10, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HeartPulse size={18} style={{ color: 'var(--accent-coral)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Medical / CPR</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Critical Trauma</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedThreat('trapped')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: selectedThreat === 'trapped' ? 'rgba(123, 208, 255, 0.2)' : 'var(--panel)',
              border: selectedThreat === 'trapped' ? '1px solid var(--accent-sky)' : '1px solid var(--border)',
              color: 'var(--paper)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(0, 166, 224, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={18} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Elderly / Child</span>
              <span style={{ fontSize: '10px', color: 'var(--sage)' }}>Trapped Indoors</span>
            </div>
          </button>
        </div>
      </div>

      {/* Real-time Location Elevation & Status Segmented Toggle */}
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 700, color: 'var(--sage)' }}>
            CITIZEN STATUS &amp; VERTICAL ELEVATION
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>BAROMETER +6.2M</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setElevationStatus('trapped_roof')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: elevationStatus === 'trapped_roof' ? 'rgba(147, 0, 10, 0.4)' : 'transparent',
              color: elevationStatus === 'trapped_roof' ? '#ffdad6' : 'var(--sage)',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Home size={14} style={{ color: 'var(--accent-coral)' }} aria-hidden="true" />
            <span>Trapped: Roof (L+2)</span>
          </button>

          <button
            type="button"
            onClick={() => setElevationStatus('rescued_safe')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              background: elevationStatus === 'rescued_safe' ? 'var(--tactical)' : 'transparent',
              color: elevationStatus === 'rescued_safe' ? '#0d3900' : 'var(--sage)',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>I am Rescued / Safe</span>
          </button>
        </div>
      </div>

      {/* Audio-Visual Field Beacon Tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={toggleWhistle}
          style={{
            background: isWhistleOn ? 'rgba(123, 208, 255, 0.25)' : 'var(--panel)',
            border: isWhistleOn ? '1px solid var(--accent-sky)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '76px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Volume2 size={20} style={{ color: 'var(--accent-sky)' }} aria-hidden="true" />
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: isWhistleOn ? 'var(--accent-sky)' : 'rgba(0,0,0,0.3)',
                color: isWhistleOn ? '#00354a' : 'var(--sage)',
              }}
            >
              {isWhistleOn ? 'ACTIVE' : 'OFF'}
            </span>
          </div>
          <div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 700, color: 'var(--paper)' }}>110dB Audio Siren</p>
            <p style={{ margin: 0, fontSize: '10px', color: 'var(--sage)' }}>High-pitch acoustic ping</p>
          </div>
        </button>

        <button
          type="button"
          onClick={toggleStrobe}
          style={{
            background: isStrobeOn ? 'rgba(245, 189, 88, 0.25)' : 'var(--panel)',
            border: isStrobeOn ? '1px solid var(--accent-amber)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '76px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Flashlight size={20} style={{ color: 'var(--accent-amber)' }} aria-hidden="true" />
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: isStrobeOn ? 'var(--accent-amber)' : 'rgba(0,0,0,0.3)',
                color: isStrobeOn ? '#271900' : 'var(--sage)',
              }}
            >
              {isStrobeOn ? 'STROBE ON' : 'STANDBY'}
            </span>
          </div>
          <div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 700, color: 'var(--paper)' }}>Night SAR Strobe</p>
            <p style={{ margin: 0, fontSize: '10px', color: 'var(--sage)' }}>Screen high-lux pulse</p>
          </div>
        </button>
      </div>

      {/* Offline Survival Protocol Card */}
      <div
        style={{
          background: 'var(--forest)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(131, 185, 107, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Shield size={18} style={{ color: 'var(--tactical)' }} aria-hidden="true" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--paper)' }}>Offline Survival Protocol</span>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', color: 'var(--paper)' }}>
              SECTOR 04 (UDUPI)
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--sage)', lineHeight: 1.5 }}>
            Keep phone dry inside plastic. <strong style={{ color: 'var(--paper)' }}>Do not attempt wading through water exceeding 15cm</strong>. SAR Boat Patrol NDRF-02 deployed 400m south downriver.
          </p>
        </div>
      </div>
    </div>
  )
}
