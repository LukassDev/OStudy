import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      receivedChange = true;
      if (active) setReducedMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !receivedChange) setReducedMotion(value);
    }).catch(() => {});
    return () => { active = false; listener.remove(); };
  }, []);
  return reducedMotion;
}
