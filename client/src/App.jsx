import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Shield, Eye, EyeOff, AlertCircle, UserPlus, Wifi, WifiOff } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import NoteList from './components/notes/NoteList';
import NoteEditor from './components/editor/NoteEditor';
import ToastContainer from './components/ui/ToastContainer';
import { useAuthStore } from './store/authStore';
import { useNotesStore } from './store/notesStore';
import { useSyncStore } from './store/syncStore';
import { createVaultVerifier, decryptNote, deriveKey, encryptNote, encryptField, decryptField, generateObjectId, verifyVaultVerifier } from './services/encryptionService';
import { deleteNote as deleteNoteDB, getAllNotes, getNote as getStoredNote, saveNote, getFolders, saveFolder } from './services/offlineDB';
import { showSuccess, showError } from './services/notificationService';
import api from './services/api';
import { hydrateVaultFromServer } from './services/vaultSyncService';
import Spinner from './components/ui/Spinner';
import { useSyncEngine } from './hooks/useSync';

import './styles/globals.css';
import './styles/animations.css';
import './styles/editor.css';

const VAULT_VERIFIER_STORAGE_KEY = 'sv_vaultVerifier';
const SettingsPortal = lazy(() => import('./components/settings/SettingsPortal'));

async function persistVaultSession(user, salt, key) {
  localStorage.setItem('sv_pbkdf2Salt', salt);
  localStorage.setItem('sv_user', JSON.stringify(user));
  localStorage.setItem(VAULT_VERIFIER_STORAGE_KEY, JSON.stringify(await createVaultVerifier(key)));
}

async function verifyLocalVaultAccess(key) {
  const storedVerifier = localStorage.getItem(VAULT_VERIFIER_STORAGE_KEY);
  if (storedVerifier) {
    return verifyVaultVerifier(key, JSON.parse(storedVerifier));
  }

  const storedNotes = await getAllNotes();
  if (storedNotes.length === 0) {
    return true;
  }

  try {
    const sample = storedNotes[0];
    await decryptNote(key, sample.encrypted || sample);
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const { isAuthenticated, isLocked } = useAuthStore();

  useEffect(() => {
    const setOnline = () => useSyncStore.getState().setOnline(true);
    const setOffline = () => useSyncStore.getState().setOnline(false);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    return () => { window.removeEventListener('online', setOnline); window.removeEventListener('offline', setOffline); };
  }, []);

  if (!isAuthenticated) return <><AuthScreen /><ToastContainer /></>;
  if (isLocked) return <><LockScreen /><ToastContainer /></>;
  return <><Dashboard /><ToastContainer /></>;
}

// ──────────────── AUTH SCREEN ────────────────
function AuthScreen() {
  const pathname = window.location.pathname;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialMode = pathname === '/verify-email'
    ? 'verify-email'
    : pathname === '/reset-password'
      ? 'reset-password'
      : 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { setUser, setVaultKey } = useAuthStore();
  const isOnline = useSyncStore((s) => s.isOnline);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccessMsg('');

    const nextPath = nextMode === 'verify-email'
      ? '/verify-email'
      : nextMode === 'reset-password'
        ? '/reset-password'
        : '/';

    const nextSearch = nextPath === '/' ? '' : window.location.search;
    window.history.replaceState({}, '', `${nextPath}${nextSearch}`);
  };

  useEffect(() => {
    if (mode === 'verify-email' && isOnline) {
      const token = params.get('token');
      if (token) {
        setLoading(true);
        api.get(`/auth/verify-email?token=${token}`)
          .then(() => {
            setSuccessMsg('Email verified successfully! You can now log in.');
            switchMode('login');
          })
          .catch(err => setError(err.response?.data?.error?.message || 'Verification failed'))
          .finally(() => setLoading(false));
      }
    }
  }, [mode, isOnline, params]);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (!isOnline) {
        throw new Error('Password reset requires server access');
      }

      await api.post('/auth/forgot-password', { email });
      setSuccessMsg('If that email exists, a reset link has been sent.');
      switchMode('login');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to send reset email');
    }

    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (!isOnline) {
        throw new Error('Password reset requires server access');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const token = params.get('token');
      if (!token) {
        throw new Error('Reset token is missing');
      }

      await api.post('/auth/reset-password', { token, password });
      setSuccessMsg('Password reset successful. You can now log in.');
      switchMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to reset password');
    }

    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (isOnline) {
        try {
          const { data } = await api.post('/auth/login', { email, password });
          if (data.data?.requires2FA) { setError('2FA verification needed'); setLoading(false); return; }
          sessionStorage.setItem('accessToken', data.data.accessToken);
          const key = await deriveKey(password, data.data.user.pbkdf2Salt);
          await persistVaultSession(data.data.user, data.data.user.pbkdf2Salt, key);
          setUser(data.data.user);
          setVaultKey(key);
          showSuccess('Vault unlocked');
          setLoading(false); return;
        } catch (apiErr) {
          // If server unreachable or returns 5xx (DB down), fall through to offline mode
          if (!apiErr.response || apiErr.response.status >= 500) {
            console.warn('Server unreachable or returning 5xx, trying offline mode');
          } else {
            setError(apiErr.response?.data?.error?.message || 'Login failed');
            setLoading(false); return;
          }
        }
      }
      // Offline mode
      const storedSalt = localStorage.getItem('sv_pbkdf2Salt');
      const storedUser = localStorage.getItem('sv_user');
      if (storedSalt) {
        const key = await deriveKey(password, storedSalt);
        const isValid = await verifyLocalVaultAccess(key);
        if (!isValid) {
          throw new Error('Incorrect password');
        }
        if (!localStorage.getItem(VAULT_VERIFIER_STORAGE_KEY)) {
          await persistVaultSession(storedUser ? JSON.parse(storedUser) : { name: 'User', email }, storedSalt, key);
        }
        setVaultKey(key);
        setUser(storedUser ? JSON.parse(storedUser) : { name: 'User', email });
        showSuccess('Offline mode — vault unlocked with local key');
      } else {
        // First-time offline use: generate a salt and store locally
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        const key = await deriveKey(password, salt);
        await persistVaultSession({ name: name || 'User', email }, salt, key);
        setVaultKey(key);
        setUser({ name: name || 'User', email });
        showSuccess('Vault created locally — works offline-first!');
      }
    } catch (err) {
      setError('Key derivation failed: ' + (err.message || 'Unknown error'));
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      if (isOnline) {
        try {
          await api.post('/auth/register', { name, email, password, confirmPassword });
          showSuccess('Account created! You can now log in.');
          switchMode('login');
          setLoading(false); return;
        } catch (apiErr) {
          if (!apiErr.response || apiErr.response.status >= 500) {
             console.warn('Server unreachable or returning 5xx, trying offline mode');
          } else {
            setError(apiErr.response?.data?.error?.message || 'Registration failed');
            setLoading(false); return;
          }
        }
      }
      // Offline registration: create local vault
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const key = await deriveKey(password, salt);
      await persistVaultSession({ name, email }, salt, key);
      setVaultKey(key);
      setUser({ name, email });
      showSuccess('Local vault created! Your data is encrypted on this device.');
    } catch (err) {
      setError('Failed: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-bg)' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ width: 420, padding: 40, textAlign: 'center' }}>
        {/* Shield */}
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}
          style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px', background: 'var(--vault-surface)', border: '2px solid var(--vault-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(88, 166, 255, 0.15)' }}>
          <Shield size={36} style={{ color: 'var(--vault-primary)' }} />
        </motion.div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 4 }}>SecureVault</h1>
        <p style={{ color: 'var(--vault-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 24 }}>
          Zero-Knowledge Encrypted Notes
        </p>

        {/* Online/Offline indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20, fontSize: 'var(--text-xs)', color: 'var(--vault-text-disabled)' }}>
          {isOnline ? <><Wifi size={12} style={{ color: 'var(--vault-green)' }} /> Online — server sync available</> :
            <><WifiOff size={12} style={{ color: 'var(--vault-orange)' }} /> Offline — local vault mode</>}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: 'var(--vault-red)', fontSize: 'var(--text-sm)', marginBottom: 16, textAlign: 'left' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}
        
        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', color: 'var(--vault-green)', fontSize: 'var(--text-sm)', marginBottom: 16, textAlign: 'left' }}>
            {successMsg}
          </div>
        )}

        {mode === 'verify-email' ? (
          <div style={{ padding: 20 }}>
            {loading ? <Spinner size={24} color="var(--vault-primary)" /> : <p>Checking verification code...</p>}
            <button className="vault-btn" onClick={() => switchMode('login')} style={{ marginTop: 16 }}>Back to Login</button>
          </div>
        ) : mode === 'forgot-password' ? (
          <form onSubmit={handleForgotPassword}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--vault-text-secondary)', marginBottom: 16 }}>Enter your email to receive a password reset link. Note: This will not recover your encrypted data.</p>
            <input className="vault-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={{ marginBottom: 12 }} />
            <button className="vault-btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <Spinner size={16} color="#000" /> : 'Send Reset Link'}
            </button>
            <button type="button" className="vault-btn" onClick={() => switchMode('login')} style={{ marginTop: 8 }}>Back to Login</button>
          </form>
        ) : mode === 'reset-password' ? (
          <form onSubmit={handleResetPassword}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--vault-text-secondary)', marginBottom: 16 }}>Enter a new master password. This will invalidate all current sessions.</p>
            <input className="vault-input" type="password" placeholder="New Master Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ marginBottom: 12 }} />
            <input className="vault-input" type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ marginBottom: 16 }} />
            <button className="vault-btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <Spinner size={16} color="#000" /> : 'Reset Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
          {mode === 'register' && (
            <input className="vault-input" placeholder="Full Name" value={name}
              onChange={(e) => setName(e.target.value)} required style={{ marginBottom: 12 }} />
          )}
          <input className="vault-input" type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={{ marginBottom: 12 }} />
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input className="vault-input" type={showPassword ? 'text' : 'password'}
              placeholder="Master Password" value={password} onChange={(e) => setPassword(e.target.value)}
              required style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--vault-text-disabled)', cursor: 'pointer' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mode === 'register' && (
            <input className="vault-input" type="password" placeholder="Confirm Password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ marginBottom: 12 }} />
          )}
          
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: 12 }}>
              <button type="button" onClick={() => switchMode('forgot-password')} style={{ background: 'none', border: 'none', color: 'var(--vault-primary)', cursor: 'pointer', fontSize: '12px' }}>Forgot password?</button>
            </div>
          )}

          <button className="vault-btn-primary" type="submit" disabled={loading} style={{ marginTop: 8, gap: 8 }}>
            {loading ? <Spinner size={16} color="#000" /> : mode === 'login' ? <><Unlock size={16} /> Unlock Vault</> : <><UserPlus size={16} /> Create Vault</>}
          </button>
        </form>
        )}

        {['login', 'register'].includes(mode) && (
          <p style={{ marginTop: 20, color: 'var(--vault-text-disabled)', fontSize: 'var(--text-sm)' }}>
            {mode === 'login' ? 'No account? ' : 'Already have a vault? '}
            <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              style={{ background: 'none', border: 'none', color: 'var(--vault-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', textDecoration: 'underline' }}>
              {mode === 'login' ? 'Create one' : 'Log in'}
            </button>
          </p>
        )}

        <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span className="vault-badge vault-badge-accent" style={{ fontSize: 11 }}>🔐 AES-256-GCM</span>
          <span className="vault-badge" style={{ fontSize: 11 }}>PBKDF2</span>
          <span className="vault-badge" style={{ fontSize: 11 }}>Web Crypto API</span>
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────── LOCK SCREEN ────────────────
function LockScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setVaultKey } = useAuthStore();

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const salt = user?.pbkdf2Salt || localStorage.getItem('sv_pbkdf2Salt');
      if (!salt) { showError('No vault key found. Please log in again.'); setLoading(false); return; }
      const key = await deriveKey(password, salt);
      const isValid = await verifyLocalVaultAccess(key);
      if (!isValid) {
        throw new Error('Incorrect password');
      }
      setVaultKey(key);
      showSuccess('Vault unlocked');
    } catch {
      showError('Incorrect password');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-bg)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ width: 360, textAlign: 'center', padding: 40 }}>
        <Lock size={48} style={{ color: 'var(--vault-primary)', marginBottom: 20 }} />
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Vault Locked</h2>
        <p style={{ color: 'var(--vault-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 24 }}>Enter your master password to unlock</p>
        <form onSubmit={handleUnlock}>
          <input className="vault-input" type="password" placeholder="Master Password"
            value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus style={{ marginBottom: 12 }} />
          <button className="vault-btn-primary" type="submit" disabled={loading} style={{ gap: 8 }}>
            {loading ? <Spinner size={16} color="#000" /> : <><Unlock size={16} /> Unlock</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ──────────────── DASHBOARD ────────────────
function Dashboard() {
  const { activeNote, setNotes, addNote, updateNote, removeNote, setActiveNote, clearActiveNote, filters, setFilter, resetFilters, folders, setFolders, addFolder } = useNotesStore();
  const { vaultKey } = useAuthStore();
  const isOnline = useSyncStore((s) => s.isOnline);
  const [activeView, setActiveView] = useState('all');
  const [decryptedNotes, setDecryptedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  useSyncEngine();

  // Load and decrypt notes from IndexedDB
  useEffect(() => {
    if (!vaultKey) return;

    let cancelled = false;

    const loadVault = async () => {
      setLoadingNotes(true);
      try {
        if (isOnline && sessionStorage.getItem('accessToken')) {
          try {
            await hydrateVaultFromServer();
          } catch (err) {
            if (!err.response || err.response.status >= 500) {
              console.warn('Remote vault hydration unavailable, continuing with local data');
            }
          }
        }

        const [storedNotes, storedFolders] = await Promise.all([getAllNotes(), getFolders()]);
        const decrypted = [];
        for (const note of storedNotes) {
          try {
            const enc = note.encrypted || { title: note.title, content: note.content, preview: note.preview, tags: note.tags };
            const meta = note.metadata || note;
            const dec = await decryptNote(vaultKey, { ...enc, _id: note.id, id: note.id });
            decrypted.push({ ...meta, ...dec, id: note.id, _id: note.id, syncStatus: note.syncStatus });
          } catch {
            decrypted.push({ id: note.id, _id: note.id, title: '🔒 Cannot decrypt', content: '', preview: '', tags: [], ...(note.metadata || {}) });
          }
        }
        decrypted.sort((a, b) => new Date(b.lastEditedAt || 0) - new Date(a.lastEditedAt || 0));
        if (cancelled) return;
        setDecryptedNotes(decrypted);
        setNotes(decrypted);
        
        const decryptedFolders = [];
        for (const folder of storedFolders || []) {
          try {
            const decryptedName = folder.encryptedName
              ? await decryptField(vaultKey, folder.encryptedName)
              : folder.decryptedName || 'Folder';
            decryptedFolders.push({ ...folder, decryptedName });
          } catch {
            decryptedFolders.push({ ...folder, decryptedName: 'Encrypted' });
          }
        }
        if (cancelled) return;
        setFolders(decryptedFolders);
      } finally {
        if (!cancelled) {
          setLoadingNotes(false);
        }
      }
    };

    void loadVault();

    return () => {
      cancelled = true;
    };
  }, [isOnline, setFolders, setNotes, vaultKey]);

  const handleCreateFolder = async (name, color) => {
    const id = generateObjectId();
    const now = new Date().toISOString();
    
    // Encrypt the folder name
    const encryptedName = await encryptField(vaultKey, name);
    
    const newFolder = {
      _id: id, id,
      encryptedName,
      decryptedName: name,
      color: color || 'var(--vault-primary)',
      lastEditedAt: now,
      createdAt: now,
      syncStatus: 'pending_create',
    };
    
    await saveFolder(newFolder);
    addFolder(newFolder);
    showSuccess('Folder created');
  };

  const handleNewNote = async () => {
    const id = generateObjectId();
    const now = new Date().toISOString();
    const newNote = {
      _id: id, id, title: '', content: '', preview: '', tags: [],
      folderId: null, color: null,
      isPinned: false, isLocked: false, isTrashed: false, isArchived: false, isStarred: false,
      version: 1, lastEditedAt: now, createdAt: now,
    };
    const encrypted = await encryptNote(vaultKey, newNote);
    await saveNote({ ...encrypted, _id: id, syncStatus: 'pending_create' });
    addNote(newNote);
    setDecryptedNotes((prev) => [newNote, ...prev]);
    setActiveNote(newNote);
    showSuccess('New encrypted note created');
  };

  // Note actions
  const handleToggle = async (noteId, field) => {
    const note = decryptedNotes.find(n => n.id === noteId || n._id === noteId);
    if (!note) return;
    const updated = { ...note, [field]: !note[field], lastEditedAt: new Date().toISOString() };
    updateNote(noteId, { [field]: updated[field] });
    setDecryptedNotes(prev => prev.map(n => (n.id === noteId || n._id === noteId) ? updated : n));
    if (activeNote?.id === noteId || activeNote?._id === noteId) setActiveNote(updated);
    const encrypted = await encryptNote(vaultKey, updated);
    await saveNote({ ...encrypted, _id: noteId, syncStatus: 'pending_update' });
  };

  const handleDeleteNote = async (noteId) => {
    const note = decryptedNotes.find(n => n.id === noteId || n._id === noteId);
    if (!note) return;
    if (note.isTrashed) {
      const storedRecord = await getStoredNote(noteId);
      if (storedRecord?.syncStatus === 'pending_create') {
        await deleteNoteDB(noteId);
      } else if (storedRecord) {
        await saveNote({ ...storedRecord, id: noteId, _id: noteId, syncStatus: 'pending_delete' });
      }
      removeNote(noteId);
      setDecryptedNotes(prev => prev.filter(n => n.id !== noteId && n._id !== noteId));
      if (activeNote?.id === noteId || activeNote?._id === noteId) clearActiveNote();
      showSuccess('Note permanently deleted');
    } else {
      // Move to trash
      await handleToggle(noteId, 'isTrashed');
      showSuccess('Moved to trash');
    }
  };

  const handleMoveToFolder = async (noteId, folderId) => {
    const note = decryptedNotes.find(n => n.id === noteId || n._id === noteId);
    if (!note) return;
    const updated = { ...note, folderId, lastEditedAt: new Date().toISOString() };
    updateNote(noteId, { folderId });
    setDecryptedNotes(prev => prev.map(n => (n.id === noteId || n._id === noteId) ? updated : n));
    if (activeNote?.id === noteId || activeNote?._id === noteId) setActiveNote(updated);
    const encrypted = await encryptNote(vaultKey, updated);
    await saveNote({ ...encrypted, _id: noteId, syncStatus: 'pending_update' });
    showSuccess(folderId ? 'Moved to folder' : 'Removed from folder');
  };

  const handleColorChange = async (noteId, color) => {
    const note = decryptedNotes.find(n => n.id === noteId || n._id === noteId);
    if (!note) return;
    const updated = { ...note, color, lastEditedAt: new Date().toISOString() };
    updateNote(noteId, { color });
    setDecryptedNotes(prev => prev.map(n => (n.id === noteId || n._id === noteId) ? updated : n));
    if (activeNote?.id === noteId || activeNote?._id === noteId) setActiveNote(updated);
    const encrypted = await encryptNote(vaultKey, updated);
    await saveNote({ ...encrypted, _id: noteId, syncStatus: 'pending_update' });
  };

  const handleRestore = async (noteId) => {
    const note = decryptedNotes.find(n => n.id === noteId || n._id === noteId);
    if (!note) return;
    const updated = { ...note, isTrashed: false };
    updateNote(noteId, { isTrashed: false });
    setDecryptedNotes(prev => prev.map(n => (n.id === noteId || n._id === noteId) ? updated : n));
    const encrypted = await encryptNote(vaultKey, updated);
    await saveNote({ ...encrypted, _id: noteId, syncStatus: 'pending_update' });
    showSuccess('Note restored');
  };

  const handleViewChange = (view, filter = {}) => {
    setActiveView(view);
    resetFilters();
    Object.entries(filter).forEach(([k, v]) => setFilter(k, v));
    clearActiveNote();
  };

  // Filter
  const filteredNotes = decryptedNotes.filter((n) => {
    if (activeView === 'starred') return n.isStarred && !n.isTrashed;
    if (activeView === 'archive') return n.isArchived && !n.isTrashed;
    if (activeView === 'trash') return n.isTrashed;
    if (activeView === 'folder') return n.folderId === filters.folderId && !n.isTrashed;
    return !n.isTrashed && !n.isArchived;
  });

  // Sort: pinned first, then by lastEditedAt
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastEditedAt || 0) - new Date(a.lastEditedAt || 0);
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--vault-bg)' }}>
      <Topbar onSearchClick={() => {}} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar folders={folders} activeView={activeView} onViewChange={handleViewChange} onNewNote={handleNewNote} onCreateFolder={handleCreateFolder} />
        {activeView === 'settings' ? (
          <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={24} /></div>}>
            <SettingsPortal />
          </Suspense>
        ) : (
          <>
            <NoteList
              notes={sortedNotes}
              folders={folders}
              activeNote={activeNote}
              onSelect={setActiveNote}
              loading={loadingNotes}
              activeView={activeView}
              onTogglePin={(id) => handleToggle(id, 'isPinned')}
              onToggleStar={(id) => handleToggle(id, 'isStarred')}
              onToggleLock={(id) => handleToggle(id, 'isLocked')}
              onToggleArchive={(id) => handleToggle(id, 'isArchived')}
              onDelete={handleDeleteNote}
              onRestore={handleRestore}
              onColorChange={handleColorChange}
              onMoveToFolder={(id, folderId) => handleMoveToFolder(id, folderId)}
            />
            <NoteEditor
              note={activeNote}
              vaultKey={vaultKey}
              onUpdate={(updated) => {
                setActiveNote(updated);
                updateNote(updated.id || updated._id, updated);
                setDecryptedNotes(prev => prev.map(n => (n.id === updated.id || n._id === updated._id) ? { ...n, ...updated } : n));
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
