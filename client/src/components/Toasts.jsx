import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';

export default function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.kind}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            layout
          >
            <span>{t.text}</span>
            {t.action && (
              <button onClick={() => { t.action.onClick(); t.dismiss(); }}>{t.action.label}</button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
