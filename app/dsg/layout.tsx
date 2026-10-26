import type { ReactNode } from 'react';

// Workspace and review routes share the application shell in the root layout.
export default function DsgLayout({ children }: { children: ReactNode }) {
  return children;
}
