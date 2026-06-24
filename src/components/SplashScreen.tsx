import { useEffect, useState } from 'react';

type Phase = 'hold' | 'expand' | 'exit' | 'done';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('hold');

  useEffect(() => {
    // hold: circle fades in at small size (0 → 350ms)
    // expand: circle blows up to fill screen (350ms → 1050ms)
    // exit: overlay fades out, app visible beneath (1050ms → 1400ms)
    const t1 = setTimeout(() => setPhase('expand'), 350);
    const t2 = setTimeout(() => setPhase('exit'), 1050);
    const t3 = setTimeout(() => {
      setPhase('done');
      onDone();
    }, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  if (phase === 'done') return null;

  return (
    <div
      className="splash-overlay"
      style={{
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 0.45s ease' : 'none',
      }}
    >
      <div
        className="splash-circle"
        style={{
          transform: phase === 'hold'
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -50%) scale(80)',
          opacity: phase === 'hold' ? 0 : 1,
          transition: phase === 'hold'
            ? 'opacity 0.35s ease'
            : 'transform 0.72s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
        }}
      />
    </div>
  );
}
