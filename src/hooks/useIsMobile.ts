import { useEffect, useState } from 'react';

function computeIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const touchPrimary =
    window.matchMedia('(pointer: coarse)').matches
    && window.matchMedia('(hover: none)').matches;
  return narrow || touchPrimary;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(computeIsMobile);

  useEffect(() => {
    const mqs = [
      window.matchMedia('(max-width: 768px)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(hover: none)'),
    ];
    const sync = () => setIsMobile(computeIsMobile());
    mqs.forEach((mq) => mq.addEventListener('change', sync));
    window.addEventListener('resize', sync);
    sync();
    return () => {
      mqs.forEach((mq) => mq.removeEventListener('change', sync));
      window.removeEventListener('resize', sync);
    };
  }, []);

  return isMobile;
}
