import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pin, Star, Lock, FileText, Trash2, ArchiveRestore, Archive,
  Palette, Copy, MoreVertical, PinOff, StarOff, Unlock, RotateCcw, FolderClosed
} from 'lucide-react';
import Spinner from '../ui/Spinner';

const NOTE_COLORS = [
  { name: 'Blue', value: '#58A6FF' }, { name: 'Green', value: '#3FB950' },
  { name: 'Red', value: '#F85149' }, { name: 'Yellow', value: '#D29922' },
  { name: 'Purple', value: '#BC8CFF' }, { name: 'Orange', value: '#E3B341' },
  { name: 'Pink', value: '#F778BA' }, { name: 'Cyan', value: '#56D364' },
];

export default function NoteList({
  notes = [], folders = [], activeNote, onSelect, loading, activeView,
  onTogglePin, onToggleStar, onToggleLock, onToggleArchive,
  onDelete, onRestore, onColorChange, onMoveToFolder
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [colorPicker, setColorPicker] = useState(null);
  const [folderPicker, setFolderPicker] = useState(null);
  const menuRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
        setColorPicker(null);
        setFolderPicker(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleContextMenu = (e, note) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, note });
    setColorPicker(null);
    setFolderPicker(null);
  };

  if (loading) {
    return (
      <div style={{ width: 320, minWidth: 320, borderRight: '1px solid var(--vault-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <Spinner size={24} />
          <p style={{ color: 'var(--vault-text-disabled)', fontSize: 'var(--text-xs)', marginTop: 12 }}>Decrypting notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 320, minWidth: 320, borderRight: '1px solid var(--vault-border-subtle)', overflowY: 'auto', background: 'var(--vault-bg)', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--vault-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--vault-text-disabled)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 1 }}>
          {activeView === 'trash' ? '🗑️ Trash' : activeView === 'starred' ? '⭐ Starred' : activeView === 'archive' ? '📦 Archive' : '📝 Notes'}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--vault-text-disabled)' }}>{notes.length}</span>
      </div>

      {notes.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--vault-text-disabled)' }}>
          <FileText size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: 'var(--text-sm)' }}>{activeView === 'trash' ? 'Trash is empty' : 'No notes here'}</p>
          <p style={{ fontSize: 'var(--text-xs)' }}>{activeView === 'all' ? 'Click "New Note" to get started' : ''}</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {notes.map((note) => {
            const noteId = note.id || note._id;
            const isActive = activeNote && (activeNote.id === noteId || activeNote._id === noteId);
            return (
              <motion.div
                key={noteId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => onSelect(note)}
                onContextMenu={(e) => handleContextMenu(e, note)}
                className={isActive ? '' : 'note-card-hover'}
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: '1px solid var(--vault-border-subtle)',
                  borderLeft: `3px solid ${note.color || 'transparent'}`,
                  background: isActive ? 'var(--vault-surface)' : 'transparent',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
              >
                {/* Action button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleContextMenu(e, note); }}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--vault-text-disabled)', padding: 2, borderRadius: 4,
                    opacity: isActive ? 1 : 0, transition: 'opacity 0.15s',
                  }}
                  className="note-menu-btn"
                >
                  <MoreVertical size={14} />
                </button>

                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingRight: 20 }}>
                  <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--vault-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.title || 'Untitled'}
                  </span>
                  {note.isPinned && <Pin size={12} style={{ color: 'var(--vault-primary)', flexShrink: 0 }} />}
                  {note.isStarred && <Star size={12} style={{ color: 'var(--vault-gold)', fill: 'var(--vault-gold)', flexShrink: 0 }} />}
                  {note.isLocked && <Lock size={12} style={{ color: 'var(--vault-text-disabled)', flexShrink: 0 }} />}
                </div>

                {/* Preview */}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--vault-text-secondary)', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {note.preview || (typeof note.content === 'string' ? note.content.substring(0, 100) : '') || 'Empty note'}
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--vault-text-disabled)' }}>{getRelativeTime(note.lastEditedAt)}</span>
                  <span className="vault-badge" style={{ fontSize: 10 }}>🔐 AES-256</span>
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {note.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--vault-surface-3)', color: 'var(--vault-text-disabled)' }}>{tag}</span>
                    ))}
                    {note.tags.length > 3 && <span style={{ fontSize: 10, color: 'var(--vault-text-disabled)' }}>+{note.tags.length - 3}</span>}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      {/* ─── Context Menu ─── */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999,
              background: 'var(--vault-surface-elevated)', border: '1px solid var(--vault-border)',
              borderRadius: 8, padding: 4, minWidth: 180,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {contextMenu.note.isTrashed ? (
              <>
                <ContextMenuItem icon={RotateCcw} label="Restore" onClick={() => { onRestore(contextMenu.note.id || contextMenu.note._id); setContextMenu(null); }} />
                <ContextMenuItem icon={Trash2} label="Delete permanently" danger onClick={() => { onDelete(contextMenu.note.id || contextMenu.note._id); setContextMenu(null); }} />
              </>
            ) : (
              <>
                <ContextMenuItem
                  icon={contextMenu.note.isPinned ? PinOff : Pin}
                  label={contextMenu.note.isPinned ? 'Unpin' : 'Pin to top'}
                  onClick={() => { onTogglePin(contextMenu.note.id || contextMenu.note._id); setContextMenu(null); }}
                />
                <ContextMenuItem
                  icon={contextMenu.note.isStarred ? StarOff : Star}
                  label={contextMenu.note.isStarred ? 'Unstar' : 'Star'}
                  onClick={() => { onToggleStar(contextMenu.note.id || contextMenu.note._id); setContextMenu(null); }}
                />
                <ContextMenuItem
                  icon={contextMenu.note.isLocked ? Unlock : Lock}
                  label={contextMenu.note.isLocked ? 'Unlock note' : 'Lock note'}
                  onClick={() => { onToggleLock(contextMenu.note.id || contextMenu.note._id); setContextMenu(null); }}
                />
                <ContextMenuItem
                  icon={Archive}
                  label={contextMenu.note.isArchived ? 'Unarchive' : 'Archive'}
                  onClick={() => { onToggleArchive(contextMenu.note.id || contextMenu.note._id); setContextMenu(null); }}
                />
                
                <ContextMenuItem
                  icon={FolderClosed}
                  label="Move to folder"
                  onClick={() => {
                    setFolderPicker(folderPicker ? null : contextMenu.note.id || contextMenu.note._id);
                    setColorPicker(null);
                  }}
                />
                {folderPicker && (
                  <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                    {contextMenu.note.folderId && (
                      <button
                        onClick={() => { onMoveToFolder(folderPicker, null); setContextMenu(null); setFolderPicker(null); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--vault-text-secondary)', fontSize: 12, textAlign: 'left', cursor: 'pointer', padding: '4px 0' }}
                      >
                        ✕ Remove from folder
                      </button>
                    )}
                    {folders.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--vault-text-disabled)' }}>No folders</span>
                    ) : (
                      folders.map(f => (
                        <button key={f.id || f._id}
                          onClick={() => { onMoveToFolder(folderPicker, f.id || f._id); setContextMenu(null); setFolderPicker(null); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none',
                            color: contextMenu.note.folderId === (f.id || f._id) ? 'var(--vault-primary)' : 'var(--vault-text)',
                            fontSize: 12, textAlign: 'left', cursor: 'pointer', padding: '4px 0',
                          }}
                        >
                          <FolderClosed size={12} color={f.color || 'var(--vault-text-disabled)'} />
                          {f.decryptedName}
                        </button>
                      ))
                    )}
                  </div>
                )}

                <div style={{ height: 1, background: 'var(--vault-border-subtle)', margin: '4px 0' }} />
                <ContextMenuItem
                  icon={Palette}
                  label="Change color"
                  onClick={() => {
                    setColorPicker(colorPicker ? null : contextMenu.note.id || contextMenu.note._id);
                    setFolderPicker(null);
                  }}
                />
                {colorPicker && (
                  <div style={{ display: 'flex', gap: 4, padding: '6px 8px', flexWrap: 'wrap' }}>
                    {NOTE_COLORS.map((c) => (
                      <button key={c.value} onClick={() => { onColorChange(colorPicker, c.value); setContextMenu(null); setColorPicker(null); }}
                        style={{ width: 20, height: 20, borderRadius: '50%', background: c.value, border: 'none', cursor: 'pointer' }}
                        title={c.name}
                      />
                    ))}
                    <button onClick={() => { onColorChange(colorPicker, null); setContextMenu(null); setColorPicker(null); }}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--vault-surface-3)', border: '1px dashed var(--vault-border)', cursor: 'pointer', fontSize: 10, color: 'var(--vault-text-disabled)' }}
                      title="Remove color"
                    >✕</button>
                  </div>
                )}
                <div style={{ height: 1, background: 'var(--vault-border-subtle)', margin: '4px 0' }} />
                <ContextMenuItem
                  icon={Trash2}
                  label="Move to trash"
                  danger
                  onClick={() => { onDelete(contextMenu.note.id || contextMenu.note._id); setContextMenu(null); }}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .note-card-hover:hover { background: var(--vault-surface) !important; transform: translateY(-1px); }
        .note-card-hover:hover .note-menu-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

function ContextMenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', border: 'none', borderRadius: 4, cursor: 'pointer',
        background: 'transparent', textAlign: 'left',
        color: danger ? 'var(--vault-red)' : 'var(--vault-text-secondary)',
        fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vault-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
