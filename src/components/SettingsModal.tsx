import { X } from 'lucide-react';
import { useState } from 'react';
import { getEffectiveSetlistApiKey } from '../services/setlistApiService';
import type { UserProfile } from '../types/models';

interface SettingsModalProps {
  profile: UserProfile;
  onClose: () => void;
  onSaveProfile: (updated: UserProfile) => void;
  onResetData: () => void;
  onLogout: () => void;
}

export function SettingsModal({
  profile,
  onClose,
  onSaveProfile,
  onResetData,
  onLogout,
}: SettingsModalProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [autoUpdate, setAutoUpdate] = useState(profile.autoUpdateFutureShows);

  const hasSetlistFmEnv = Boolean(
    getEffectiveSetlistApiKey(profile.setlistFmApiKey)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      ...profile,
      displayName: displayName.trim() || 'Usuário',
      handle: handle.trim() || '@stagelog',
      bio: bio.trim(),
      autoUpdateFutureShows: autoUpdate,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        <div
          style={{
            padding: '16px 22px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: '1.08rem',
              fontWeight: 600,
              letterSpacing: '-0.025em',
            }}
          >
            Ajustes da conta
          </h3>
          <button className="icon-btn" onClick={onClose} type="button">
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            padding: '18px 22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div className="form-field">
            <label className="form-label">Nome</label>
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Identificador</label>
            <input
              className="form-input"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Bio</label>
            <input
              className="form-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              padding: '12px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            <input
              type="checkbox"
              checked={autoUpdate}
              onChange={(e) => setAutoUpdate(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ fontWeight: 500 }}>
                Atualizar shows futuros automaticamente
              </strong>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  marginTop: 2,
                  fontSize: '0.74rem',
                  lineHeight: 1.4,
                }}
              >
                Converte eventos agendados em presença confirmada assim que a
                data ocorre.
              </div>
            </div>
          </label>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Integração Setlist.fm</span>
            <span style={{ color: hasSetlistFmEnv ? '#4ade80' : 'var(--text-muted)' }}>
              {hasSetlistFmEnv ? 'Conectada' : 'Padrão'}
            </span>
          </div>

          <button type="submit" className="cta-button-full cta-primary">
            Salvar
          </button>

          <button
            type="button"
            className="cta-button-full cta-secondary"
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            Sair da conta
          </button>

          <button
            type="button"
            className="cta-button-full cta-danger-outline"
            onClick={() => {
              if (
                window.confirm(
                  'Deseja limpar os dados salvos localmente neste dispositivo?'
                )
              ) {
                onResetData();
                onClose();
              }
            }}
          >
            Limpar cache local
          </button>
        </form>
      </div>
    </div>
  );
}
