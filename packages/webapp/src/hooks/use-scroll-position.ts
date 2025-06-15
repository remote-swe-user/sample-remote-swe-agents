import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrollPosition() {
  const [isBottom, setIsBottom] = useState(false);
  const rafRef = useRef<number>(0);

  const handleScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const windowScroll = document.documentElement.scrollTop;
      const scrolled = height > 0 ? windowScroll / height : 0;

      const newIsBottom = scrolled > 0.95;
      setIsBottom((prev) => (prev !== newIsBottom ? newIsBottom : prev));
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleScroll]);

  return { isBottom };
}
