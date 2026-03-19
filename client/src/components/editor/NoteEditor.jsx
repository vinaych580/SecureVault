import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { motion } from 'framer-motion';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, CheckSquare,
  Heading1, Heading2, Heading3, Quote, Minus, Lock
} from 'lucide-react';
import { encryptNote } from '../../services/encryptionService';
import { saveNote } from '../../services/offlineDB';

export default function NoteEditor({ note, vaultKey, onUpdate }) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimer = useRef(null);
  const noteRef = useRef(note);
  const titleRef = useRef(title);

  // Keep refs in sync so autoSave always sees latest values
  useEffect(() => { noteRef.current = note; }, [note]);
  useEffect(() => { titleRef.current = title; }, [title]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
    },
    onUpdate: ({ editor }) => {
      // Debounced auto-save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => autoSave(editor), 3000);
    },
  });

  // Sync note content when activeNote changes
  useEffect(() => {
    if (!note) return;
    setTitle(note.title || '');
    if (editor) {
      const content = note.content || '';
      const currentContent = editor.getJSON();
      // Only update if content actually differs to avoid cursor jump
      try {
        if (typeof content === 'object') {
          editor.commands.setContent(content, false);
        } else if (content) {
          editor.commands.setContent(content, false);
        }
      } catch { editor.commands.setContent('', false); }
    }
  }, [note?.id, note?._id]);

  const autoSave = useCallback(async (editorInstance) => {
    const currentNote = noteRef.current;
    const currentTitle = titleRef.current;
    if (!currentNote || !vaultKey) return;
    setIsSaving(true);
    try {
      const contentJson = editorInstance.getJSON();
      const plainText = editorInstance.getText();
      const updated = {
        ...currentNote,
        title: currentTitle,
        content: JSON.stringify(contentJson),
        preview: plainText.substring(0, 100),
        version: (currentNote.version || 1) + 1,
        lastEditedAt: new Date().toISOString(),
      };
      const encrypted = await encryptNote(vaultKey, updated);
      await saveNote({ ...encrypted, _id: currentNote.id || currentNote._id, syncStatus: 'pending_update' });
      setLastSaved(new Date());
      if (onUpdate) onUpdate({ ...currentNote, title: currentTitle, content: contentJson, preview: updated.preview, lastEditedAt: updated.lastEditedAt });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
    setIsSaving(false);
  }, [vaultKey, onUpdate]);

  if (!note) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'var(--vault-text-disabled)', background: 'var(--vault-bg)',
      }}>
        <Lock size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
        <p style={{ fontSize: 'var(--text-md)' }}>Select a note or create a new one</p>
        <p style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>All notes are encrypted with AES-256-GCM</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--vault-bg)', overflow: 'hidden' }}>
      {/* Title */}
      <div style={{ padding: '16px 24px 0' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (saveTimer.current) clearTimeout(saveTimer.current); if (editor) autoSave(editor); }}
          placeholder="Untitled"
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--vault-text)',
            fontFamily: 'var(--font-body)', padding: 0,
          }}
        />
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '8px 24px',
        borderBottom: '1px solid var(--vault-border-subtle)',
        flexWrap: 'wrap',
      }}>
        <ToolbarBtn icon={Bold} active={editor?.isActive('bold')} action={() => editor?.chain().focus().toggleBold().run()} />
        <ToolbarBtn icon={Italic} active={editor?.isActive('italic')} action={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolbarBtn icon={Strikethrough} active={editor?.isActive('strike')} action={() => editor?.chain().focus().toggleStrike().run()} />
        <ToolbarBtn icon={Code} active={editor?.isActive('code')} action={() => editor?.chain().focus().toggleCode().run()} />
        <div style={{ width: 1, height: 18, background: 'var(--vault-border)', margin: '0 4px' }} />
        <ToolbarBtn icon={Heading1} active={editor?.isActive('heading', { level: 1 })} action={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolbarBtn icon={Heading2} active={editor?.isActive('heading', { level: 2 })} action={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarBtn icon={Heading3} active={editor?.isActive('heading', { level: 3 })} action={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
        <div style={{ width: 1, height: 18, background: 'var(--vault-border)', margin: '0 4px' }} />
        <ToolbarBtn icon={List} active={editor?.isActive('bulletList')} action={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolbarBtn icon={ListOrdered} active={editor?.isActive('orderedList')} action={() => editor?.chain().focus().toggleOrderedList().run()} />
        <ToolbarBtn icon={CheckSquare} active={editor?.isActive('taskList')} action={() => editor?.chain().focus().toggleTaskList().run()} />
        <ToolbarBtn icon={Quote} active={editor?.isActive('blockquote')} action={() => editor?.chain().focus().toggleBlockquote().run()} />
        <ToolbarBtn icon={Minus} action={() => editor?.chain().focus().setHorizontalRule().run()} />
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 24px', borderTop: '1px solid var(--vault-border-subtle)',
        fontSize: 'var(--text-xs)', color: 'var(--vault-text-disabled)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isSaving ? (
            <span className="sync-pulse" style={{ color: 'var(--vault-orange)' }}>Encrypting...</span>
          ) : lastSaved ? (
            <motion.span
              key={lastSaved.getTime()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: 'var(--vault-green)' }}
            >
              ✓ Saved & Encrypted
            </motion.span>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{editor?.storage.characterCount?.words?.() || getWordCount(editor)} words</span>
          <span className="vault-badge vault-badge-accent" style={{ fontSize: 10 }}>🔐 AES-256-GCM</span>
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ icon: Icon, active, action }) {
  return (
    <button
      onClick={action}
      style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, border: 'none', cursor: 'pointer',
        background: active ? 'var(--vault-hover)' : 'transparent',
        color: active ? 'var(--vault-text)' : 'var(--vault-text-secondary)',
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <Icon size={15} />
    </button>
  );
}

function getWordCount(editor) {
  if (!editor) return 0;
  const text = editor.getText();
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
