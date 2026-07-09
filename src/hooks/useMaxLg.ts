import { useEffect, useState } from 'react';

const QUERY = '(max-width: 1023px)';

export function useMaxLg(): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return matches;
}
