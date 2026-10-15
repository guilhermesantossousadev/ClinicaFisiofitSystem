import { type ReactNode } from 'react';
import { useDialogFocus } from '@fisiofit/design-system/react';
/** Reuses the V2.1 modal focus stack, including nested confirmations and return focus. */
export function OccurrenceDetailsPanel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useDialogFocus(true, onClose);
  return <div className="occurrence-panel-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className="occurrence-details-panel" role="dialog" aria-modal="true" aria-labelledby="occurrence-details-title" tabIndex={-1}>{children}</section></div>;
}
