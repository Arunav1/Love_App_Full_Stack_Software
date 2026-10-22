import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export function useEscape(onEscape, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => e.key === 'Escape' && onEscape();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape, active]);
}

export default function Modal({ open, onClose, children, width }) {
  useEscape(onClose, open);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            style={width ? { width: `min(${width}px, 100%)` } : undefined}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          >
            <button className="btn small icon close" onClick={onClose} aria-label="Close"><X size={18} /></button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Confirm({ open, title, text, confirmLabel = 'Yes', danger, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} width={420}>
      <h2>{title}</h2>
      <p className="sub">{text}</p>
      <div className="actions">
        <button className="btn" onClick={onClose}>Never mind</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
