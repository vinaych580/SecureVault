import { Search, Shield, User } from 'lucide-react';
import { useSyncStore } from '../../store/syncStore';
import { useAuthStore } from '../../store/authStore';

export default function Topbar({ onSearchClick }) {
  const { isOnline, syncStatus, pendingCount } = useSyncStore();
  const user = useAuthStore((s) => s.user);

  return (
    <header style={{
      height: 52, display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12,
      background: 'var(--vault-surface)',
      borderBottom: '1px solid var(--vault-border-subtle)',
    }}>
      {/* Search */}
      <button
        onClick={onSearchClick}
        style={{
          flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 8,
          background: 'var(--vault-bg)', border: '1px solid var(--vault-border)',
          color: 'var(--vault-text-disabled)', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
        }}
      >
        <Search size={14} />
        <span>Search notes...</span>
        <span style={{
          marginLeft: 'auto', fontSize: 'var(--text-xs)',
          padding: '2px 6px', borderRadius: 4,
          background: 'var(--vault-surface-3)', fontFamily: 'var(--font-display)',
        }}>⌘K</span>
      </button>

      <div style={{ flex: 1 }} />

      {/* Sync Status Pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 20,
        background: 'var(--vault-surface-3)',
        fontSize: 'var(--text-xs)', color: 'var(--vault-text-secondary)',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isOnline
            ? (syncStatus === 'syncing' ? 'var(--vault-orange)' : 'var(--vault-green)')
            : 'var(--vault-orange)',
          ...(syncStatus === 'syncing' ? { animation: 'syncPulse 1.5s ease-in-out infinite' } : {}),
        }} />
        <span>
          {!isOnline ? 'Offline' : syncStatus === 'syncing' ? 'Syncing...' : pendingCount > 0 ? `${pendingCount} pending` : 'Synced'}
        </span>
      </div>

      {/* Security Shield */}
      <Shield size={18} style={{ color: 'var(--vault-green)', cursor: 'pointer' }} title="Vault Secured — AES-256-GCM" />

      {/* User Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'var(--vault-primary-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--vault-primary)', fontSize: 'var(--text-xs)', fontWeight: 600,
        cursor: 'pointer',
      }}>
        {user?.name ? user.name.charAt(0).toUpperCase() : <User size={14} />}
      </div>
    </header>
  );
}
