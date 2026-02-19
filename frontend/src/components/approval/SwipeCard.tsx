import React, { useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';

interface SwipeCardProps {
  onApprove: () => void;
  onDeny: () => void;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD = 100; // px before card flies out
const FLY_DURATION = 300; // ms to wait before calling callback after fly-out

// Workaround: React 19 + react-spring v9 children type incompatibility
// Use explicit type with PropsWithChildren to ensure children pass through
type AnimatedDivProps = React.PropsWithChildren<{
  style?: Record<string, unknown>;
  [key: string]: unknown;
}>;
const AnimatedDiv = animated('div') as unknown as React.FC<AnimatedDivProps>;

/**
 * SwipeCard — wraps any content in a swipeable, spring-animated card.
 *
 * Swipe right  → approve (green tint, card flies right)
 * Swipe left   → deny   (red tint, card flies left)
 * Below threshold → spring back to center
 *
 * touchAction: 'none' prevents scroll conflicts during horizontal swipe.
 */
export function SwipeCard({ onApprove, onDeny, children }: SwipeCardProps) {
  const [{ x, rotate, opacity, tintApprove, tintDeny }, api] = useSpring(() => ({
    x: 0,
    rotate: 0,
    opacity: 1,
    tintApprove: 0,
    tintDeny: 0,
    config: { tension: 280, friction: 28 },
  }));

  const flyOut = useCallback(
    (direction: 'approve' | 'deny') => {
      const targetX = direction === 'approve' ? 600 : -600;
      const targetRotate = direction === 'approve' ? 15 : -15;

      api.start({
        x: targetX,
        rotate: targetRotate,
        opacity: 0,
        tintApprove: 0,
        tintDeny: 0,
        config: { duration: FLY_DURATION },
      });

      setTimeout(() => {
        if (direction === 'approve') onApprove();
        else onDeny();
      }, FLY_DURATION);
    },
    [api, onApprove, onDeny]
  );

  const bind = useDrag(
    ({ active, movement: [mx], last }) => {
      if (active) {
        // Card follows finger with slight rotation
        api.start({
          x: mx,
          rotate: mx / 20,
          opacity: 1,
          tintApprove: mx > 0 ? Math.min(mx / SWIPE_THRESHOLD, 1) : 0,
          tintDeny: mx < 0 ? Math.min(-mx / SWIPE_THRESHOLD, 1) : 0,
          immediate: true,
        });
      }

      if (last) {
        if (mx > SWIPE_THRESHOLD) {
          // Flew far enough right → approve
          flyOut('approve');
        } else if (mx < -SWIPE_THRESHOLD) {
          // Flew far enough left → deny
          flyOut('deny');
        } else {
          // Below threshold → spring back to center
          api.start({
            x: 0,
            rotate: 0,
            opacity: 1,
            tintApprove: 0,
            tintDeny: 0,
          });
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
    }
  );

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Approve tint overlay */}
      <AnimatedDiv
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          background: 'rgba(34, 197, 94, 0.15)',
          border: '2px solid rgba(34, 197, 94, 0.5)',
          opacity: tintApprove,
          pointerEvents: 'none',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0 1.5rem',
        }}
      >
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'rgb(34, 197, 94)', letterSpacing: '0.05em' }}>
          APPROVE
        </span>
      </AnimatedDiv>

      {/* Deny tint overlay */}
      <AnimatedDiv
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid rgba(239, 68, 68, 0.5)',
          opacity: tintDeny,
          pointerEvents: 'none',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 1.5rem',
        }}
      >
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'rgb(239, 68, 68)', letterSpacing: '0.05em' }}>
          DENY
        </span>
      </AnimatedDiv>

      {/* The draggable card */}
      <AnimatedDiv
        {...bind()}
        style={{
          x,
          rotate,
          opacity,
          touchAction: 'none',
          cursor: 'grab',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {children}
      </AnimatedDiv>
    </div>
  );
}
