import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, HardDrive, Palette, Moon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getFolders, getAllNotes, saveFolder, saveNote } from '../../services/offlineDB';
import { createVaultVerifier, decryptField, decryptNote, deriveKey, encryptField, encryptNote, verifyVaultVerifier } from '../../services/encryptionService';
import { showSuccess, showError } from '../../services/notificationService';
import api from '../../services/api';
import Spinner from '../ui/Spinner';

const TABS = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'security', label: 'Security & Auth', icon: Shield },
  { id: 'data', label: 'Data & Sync', icon: HardDrive },
];

export default function SettingsPortal() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div style={{ flex: 1, background: 'var(--vault-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ borderBottom: '1px solid var(--vault-border-subtle)', padding: '24px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--vault-text)', margin: 0 }}>Settings</h2>
        <p style={{ color: 'var(--vault-text-secondary)', fontSize: 'var(--text-sm)' }}>Manage your vault preferences and security.</p>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Settings Navigation */}
        <div style={{ width: 240, borderRight: '1px solid var(--vault-border-subtle)', padding: '24px 16px', background: 'var(--vault-surface)' }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: isActive ? 'var(--vault-hover)' : 'transparent',
                  color: isActive ? 'var(--vault-primary)' : 'var(--vault-text-secondary)',
                  fontWeight: isActive ? 600 : 400, fontSize: 'var(--text-sm)', textAlign: 'left',
                  marginBottom: 4, transition: 'all 0.2s',
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ maxWidth: 640 }}
          >
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'security' && <SecuritySettings user={user} />}
            {activeTab === 'data' && <DataSettings />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div>
      <h3 style={{ borderBottom: '1px solid var(--vault-border-subtle)', paddingBottom: 12, marginBottom: 24 }}>Appearance</h3>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--vault-text-secondary)', marginBottom: 8 }}>Interface Theme</label>
        <div className="vault-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
          <Moon size={16} />
          <span>Dark theme is the active interface mode.</span>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings({ user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { vaultKey, setVaultKey, setUser } = useAuthStore();
  
  // 2FA State
  const [twoFAState, setTwoFAState] = useState(user?.twoFAEnabled ? 'enabled' : 'disabled');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [disablePassword, setDisablePassword] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { showError('New passwords do not match'); return; }
    if (newPassword.length < 8) { showError('Password must be at least 8 characters'); return; }
    setLoading(true);
    
    try {
      // 1. Verify current password derives the correct key
      const currentSalt = localStorage.getItem('sv_pbkdf2Salt');
      if (!currentSalt || !vaultKey) {
        throw new Error('Vault is locked. Unlock it before changing password.');
      }
      const testKey = await deriveKey(currentPassword, currentSalt);
      const storedVerifier = localStorage.getItem('sv_vaultVerifier');
      const isCorrect = storedVerifier
        ? await verifyVaultVerifier(testKey, JSON.parse(storedVerifier))
        : false;
      
      if (!isCorrect) {
        throw new Error('Current password incorrect');
      }

      // 2. Tell server. It will clear refresh tokens and return new salt.
      const { data } = await api.post('/settings/change-password', { currentPassword, newPassword });
      const newSalt = data.data.pbkdf2Salt;
      const newKey = await deriveKey(newPassword, newSalt);

      // 3. Re-encrypt all local data
      const notes = await getAllNotes();
      const folders = await getFolders();
      
      showSuccess('Re-encrypting vault... please do not close the window.');
      
      for (const note of notes) {
        try {
           const enc = note.encrypted || { title: note.title, content: note.content, preview: note.preview, tags: note.tags };
           const dec = await decryptNote(vaultKey, { ...enc, id: note.id, _id: note.id });
           const reEncrypted = await encryptNote(newKey, { ...dec, id: note.id, _id: note.id });
           await saveNote({
             ...note,
             encrypted: {
               title: reEncrypted.title,
               content: reEncrypted.content,
               preview: reEncrypted.preview,
               tags: reEncrypted.tags,
             },
             metadata: {
               ...note.metadata,
               checksum: reEncrypted.checksum,
             },
             syncStatus: 'pending_update',
           });
        } catch (e) { console.warn('Failed to re-encrypt note', note.id, e); }
      }
      
      for (const folder of folders) {
        try {
           const decName = await decryptField(vaultKey, folder.encryptedName);
           const reEncName = await encryptField(newKey, decName);
           await saveFolder({ ...folder, encryptedName: reEncName, syncStatus: 'pending_update' });
        } catch (e) { console.warn('Failed to re-encrypt folder', folder.id, e); }
      }

      // 4. Update local session
      localStorage.setItem('sv_pbkdf2Salt', newSalt);
      localStorage.setItem('sv_vaultVerifier', JSON.stringify(await createVaultVerifier(newKey)));
      setVaultKey(newKey);
      setUser({ ...user, pbkdf2Salt: newSalt });
      sessionStorage.removeItem('accessToken');
      
      showSuccess('Master password changed. Sign in again to refresh your server session.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      showError(err.response?.data?.error?.message || err.message || 'Failed to change password');
    }
    setLoading(false);
  };

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setQrCode(data.data.qrCode);
      setSecret(data.data.secret);
      setTwoFAState('setup');
    } catch (err) { showError('Failed to initiate 2FA setup'); }
    setLoading(false);
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/2fa/verify-setup', { code: authCode });
      setBackupCodes(data.data.backupCodes);
      setTwoFAState('backupCodes');
      setUser({ ...user, twoFAEnabled: true });
    } catch (err) { showError('Invalid 2FA code'); }
    setLoading(false);
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { password: disablePassword });
      setTwoFAState('disabled');
      setDisablePassword('');
      setUser({ ...user, twoFAEnabled: false });
      showSuccess('2FA has been disabled');
    } catch (err) { showError('Incorrect password'); }
    setLoading(false);
  };

  return (
    <div>
      <h3 style={{ borderBottom: '1px solid var(--vault-border-subtle)', paddingBottom: 12, marginBottom: 24 }}>Authentication</h3>
      <div style={{ background: 'var(--vault-surface-elevated)', border: '1px solid var(--vault-border-subtle)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        
        {twoFAState === 'disabled' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-md)' }}>Two-Factor Authentication</h4>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--vault-text-disabled)' }}>Add an extra layer of security to your account.</p>
            </div>
            <button onClick={handleSetup2FA} className="vault-btn-primary" disabled={loading} style={{ padding: '6px 16px' }}>{loading ? '...' : 'Enable'}</button>
          </div>
        )}

        {twoFAState === 'setup' && (
          <div>
            <h4 style={{ margin: '0 0 16px', fontSize: 'var(--text-md)' }}>Setup Authenticator App</h4>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--vault-text-secondary)', marginBottom: 16 }}>Scan this QR code with Google Authenticator, Authy, or your preferred 2FA app.</p>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div style={{ background: '#fff', padding: 8, borderRadius: 8 }}>
                {qrCode && <img src={qrCode} alt="2FA QR Code" style={{ width: 140, height: 140, display: 'block' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--vault-text-disabled)', marginBottom: 8 }}>Or enter key manually:</p>
                <code style={{ display: 'block', background: 'var(--vault-surface-3)', padding: '6px 10px', borderRadius: 4, fontSize: '11px', letterSpacing: 1, marginBottom: 16 }}>{secret}</code>
                <form onSubmit={handleVerify2FA} style={{ display: 'flex', gap: 8 }}>
                  <input className="vault-input" placeholder="6-digit code" value={authCode} onChange={(e) => setAuthCode(e.target.value)} maxLength={6} required style={{ flex: 1 }} />
                  <button className="vault-btn-primary" type="submit" disabled={loading}>{loading ? '...' : 'Verify'}</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {twoFAState === 'backupCodes' && (
          <div>
            <h4 style={{ margin: '0 0 16px', fontSize: 'var(--text-md)', color: 'var(--vault-green)' }}>2FA Enabled Successfully!</h4>
            <div style={{ background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.3)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h5 style={{ margin: '0 0 8px', color: 'var(--vault-gold)' }}>Save Your Backup Codes</h5>
              <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--vault-text-secondary)' }}>If you lose access to your authenticator app, these codes are the only way to log in. Each code can be used exactly once.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {backupCodes.map((code, i) => (
                  <code key={i} style={{ background: 'var(--vault-surface-3)', padding: '4px 8px', borderRadius: 4, fontSize: 13, textAlign: 'center' }}>{code}</code>
                ))}
              </div>
            </div>
            <button onClick={() => { setTwoFAState('enabled'); setBackupCodes([]); }} className="vault-btn">I saved these safely</button>
          </div>
        )}

        {twoFAState === 'enabled' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-md)' }}>Two-Factor Authentication</h4>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--vault-green)' }}>2FA is currently enabled on your account.</p>
              </div>
            </div>
            <form onSubmit={handleDisable2FA} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="vault-input" type="password" placeholder="Master Password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} required style={{ flex: 1, maxWidth: 200 }} />
              <button disabled={loading} type="submit" className="vault-btn" style={{ color: 'var(--vault-red)', borderColor: 'rgba(248,81,73,0.3)' }}>{loading ? '...' : 'Disable 2FA'}</button>
            </form>
          </div>
        )}

      </div>

      <h3 style={{ borderBottom: '1px solid var(--vault-border-subtle)', paddingBottom: 12, marginBottom: 24, marginTop: 40 }}>Master Password</h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--vault-text-secondary)', marginBottom: 16 }}>Your master password cannot be recovered by SecureVault if lost. Changing it will re-encrypt your entire vault key.</p>
      
      <form onSubmit={handleChangePassword} style={{ background: 'var(--vault-surface-elevated)', border: '1px solid var(--vault-border-subtle)', borderRadius: 8, padding: 20 }}>
        <input className="vault-input" type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required style={{ marginBottom: 12 }} />
        <input className="vault-input" type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={{ marginBottom: 12 }} />
        <input className="vault-input" type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ marginBottom: 16 }} />
        <button className="vault-btn-primary" type="submit" disabled={loading} style={{ width: 'auto', padding: '8px 20px' }}>
           {loading ? <Spinner size={16} color="#000" /> : 'Change Master Password'}
        </button>
      </form>
    </div>
  );
}

function DataSettings() {
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  
  const handleDelete = async (e) => {
    e.preventDefault();
    if (confirmText !== 'DELETE MY ACCOUNT') { showError('Type DELETE MY ACCOUNT to confirm'); return; }
    setLoading(true);
    try {
      await api.post('/settings/delete-account', { password, confirmation: confirmText });
      
      // Wipe local indexedDB
      const { deleteDB } = await import('idb');
      await deleteDB('securevault');
      localStorage.clear();
      sessionStorage.clear();
      
      showSuccess('Account permanently deleted.');
      logout();
    } catch (err) {
      showError(err.response?.data?.error?.message || 'Failed to delete account');
    }
    setLoading(false);
  };

  return (
    <div>
      <h3 style={{ borderBottom: '1px solid var(--vault-border-subtle)', paddingBottom: 12, marginBottom: 24, color: 'var(--vault-red)' }}>Danger Zone</h3>
      <form onSubmit={handleDelete} style={{ border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: 20 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 'var(--text-md)', color: 'var(--vault-text)' }}>Delete Account & Vault</h4>
        <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--vault-text-secondary)' }}>
          Permanently delete your account, settings, and completely wipe all encrypted notes from our servers and your local device. This action is irreversible.
        </p>
        <input className="vault-input" type="password" placeholder="Master Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ marginBottom: 12, borderColor: 'rgba(248,81,73,0.5)' }} />
        <input className="vault-input" type="text" placeholder="Type 'DELETE MY ACCOUNT'" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} required style={{ marginBottom: 16, borderColor: 'rgba(248,81,73,0.5)' }} />
        
        <button type="submit" className="vault-btn" disabled={loading} style={{ color: 'var(--vault-red)', borderColor: 'rgba(248,81,73,0.5)' }}>
          {loading ? <Spinner size={16} color="var(--vault-red)" /> : 'Delete Permanently'}
        </button>
      </form>
    </div>
  );
}
