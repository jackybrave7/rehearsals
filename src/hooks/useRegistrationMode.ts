import { useEffect, useState } from 'react';
import { fetchAuthConfig } from '../api/auth';
import type { RegistrationMode } from '../types/admin';

export function useRegistrationMode(): RegistrationMode {
  const [mode, setMode] = useState<RegistrationMode>('normal');

  useEffect(() => {
    let cancelled = false;
    void fetchAuthConfig()
      .then((config) => {
        if (!cancelled) setMode(config.registrationMode);
      })
      .catch(() => {
        if (!cancelled) setMode('normal');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return mode;
}
