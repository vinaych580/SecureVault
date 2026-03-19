import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'var(--vault-green)',
  error: 'var(--vault-red)',
  warning: 'var(--vault-orange)',
  info: 'var(--vault-primary)',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type] || Info;
          return (
            <motion.div
              key={toast.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 8,
                background: 'var(--vault-surface-elevated)',
                border: `1px solid var(--vault-border)`,
                color: 'var(--vault-text)',
                fontSize: 'var(--text-sm)',
                maxWidth: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <Icon size={18} style={{ color: colorMap[toast.type], flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-text-disabled)', padding: 0 }}>
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
