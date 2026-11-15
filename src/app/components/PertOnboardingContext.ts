import { createContext } from 'react';

// A workspace PERT save can refresh the outer reminder without changing module permissions.
export const PertOnboardingContext = createContext<(() => Promise<void>) | null>(null);
