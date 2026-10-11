import { useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
  /** Accessible name of the dialog. */
  label: string;
  onClose: () => void;
  /** Classes of the dialog panel. */
  className: string;
  children: ReactNode;
}

/** Centered modal with dialog semantics, a focus trap and Escape to close. */
export function ModalFrame({ label, onClose, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={`${className} outline-none`}>
        {children}
      </div>
    </div>
  );
}
