import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Star, Archive, Trash2, FolderClosed, Settings,
  ChevronRight, Plus, Shield, HardDrive, Check, X
} from 'lucide-react';

const navItems = [
  { key: 'all', label: 'All Notes', icon: FileText, filter: {} },
  { key: 'starred', label: 'Starred', icon: Star, filter: { starred: true } },
  { key: 'archive', label: 'Archive', icon: Archive, filter: { archived: true } },
  { key: 'trash', label: 'Trash', icon: Trash2, filter: { trashed: true } },
];

export default function Sidebar({ folders = [], activeView = 'all', onViewChange, onNewNote, onCreateFolder }) {
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const submitNewFolder = (e) => {
    e?.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder?.(newFolderName.trim());
    setNewFolderName('');
    setIsCreatingFolder(false);
    setFoldersExpanded(true);
  };

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100%',
      background: 'var(--vault-surface)',
      borderRight: '1px solid var(--vault-border-subtle)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
      userSelect: 'none',
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shield size={20} style={{ color: 'var(--vault-primary)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--vault-text)' }}>
          SecureVault
        </span>
      </div>

      {/* New Note */}
      <div style={{ padding: '0 12px 12px' }}>
        <button
          onClick={onNewNote}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--vault-primary)', color: '#000',
            fontWeight: 600, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)',
          }}
        >
          <Plus size={16} /> New Note
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ padding: '0 8px', flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key, item.filter)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: isActive ? 'var(--vault-hover)' : 'transparent',
                color: isActive ? 'var(--vault-text)' : 'var(--vault-text-secondary)',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)',
                marginBottom: 2, textAlign: 'left',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}

        <div style={{ height: 1, background: 'var(--vault-border-subtle)', margin: '8px 12px' }} />

        {/* Folders section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
          <button
            onClick={() => setFoldersExpanded(!foldersExpanded)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--vault-text-disabled)',
              fontSize: 'var(--text-xs)', fontFamily: 'var(--font-display)',
              textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left',
            }}
          >
            <ChevronRight size={12} style={{ transform: foldersExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
            Folders
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsCreatingFolder(true); setFoldersExpanded(true); }}
            style={{
              background: 'transparent', border: 'none', color: 'var(--vault-text-disabled)',
              cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex',
            }}
            title="New Folder"
          >
            <Plus size={14} />
          </button>
        </div>

        <AnimatePresence>
          {isCreatingFolder && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={submitNewFolder}
              style={{ padding: '4px 12px 4px 28px', display: 'flex', gap: 4 }}
            >
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }
                }}
                onBlur={() => {
                  if (!newFolderName.trim()) setIsCreatingFolder(false);
                }}
                placeholder="Folder name..."
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--vault-border-subtle)',
                  borderRadius: 4, color: 'var(--vault-text)', padding: '4px 8px', fontSize: 'var(--text-xs)',
                  outline: 'none'
                }}
              />
            </motion.form>
          )}

          {foldersExpanded && folders.map((folder) => (
            <motion.button
              key={folder.id || folder._id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onClick={() => onViewChange('folder', { folderId: folder._id || folder.id })}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px 6px 28px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--vault-text-secondary)',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', textAlign: 'left',
              }}
            >
              <FolderClosed size={14} style={{ color: folder.color || 'var(--vault-text-disabled)' }} />
              {folder.decryptedName || 'Encrypted'}
            </motion.button>
          ))}
        </AnimatePresence>
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--vault-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 8,
        color: 'var(--vault-text-disabled)', fontSize: 'var(--text-xs)',
      }}>
        <HardDrive size={12} />
        <span>Encrypted Storage</span>
      </div>

      <button
        onClick={() => onViewChange('settings')}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'var(--vault-text-secondary)',
          fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', textAlign: 'left',
          borderTop: '1px solid var(--vault-border-subtle)',
        }}
      >
        <Settings size={16} />
        Settings
      </button>
    </aside>
  );
}
