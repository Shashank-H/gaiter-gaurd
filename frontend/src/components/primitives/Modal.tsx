import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Modal primitive — dialog overlay using native <dialog> element.
 * Renders via React portal for correct stacking context.
 * Closes on backdrop click and Escape key.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (clickedOutside) onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      style={{
        background: '#111',
        border: '1px solid #222',
        borderRadius: 8,
        color: '#ededed',
        padding: 0,
        maxWidth: '90vw',
        width: 480,
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
      }}
    >
      <div
        style={{ padding: '1.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #222',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
            <button
              data-variant="ghost"
              onClick={onClose}
              aria-label="Close modal"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>,
    document.body
  );
}
