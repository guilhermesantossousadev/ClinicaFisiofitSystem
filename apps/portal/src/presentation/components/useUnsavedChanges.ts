import { useRef } from 'react';
import { confirmAction } from './Decisions';

export function useUnsavedChanges(onClose: () => void, busy = false) {
  const dirty = useRef(false);
  const pending = useRef(false);
  async function requestClose() {
    if (busy || pending.current) return;
    pending.current = true;
    try {
      if (dirty.current && !await confirmAction('Descartar as alterações ainda não salvas?', { title: 'Descartar alterações?', confirmLabel: 'Descartar alterações', destructive: true })) return;
      dirty.current = false;
      onClose();
    } finally { pending.current = false; }
  }
  return { requestClose, markDirty: () => { dirty.current = true; }, reset: () => { dirty.current = false; } };
}
