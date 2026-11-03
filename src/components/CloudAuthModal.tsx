import {
  CheckCircle2,
  Cloud,
  Database,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cloudSyncService } from '../services/cloudSyncService';
import {
  clearRuntimeFirebaseConfig,
  getActiveFirebaseConfig,
  getFirebaseServices,
  parseFirebaseSnippet,
  saveRuntimeFirebaseConfig,
} from '../services/firebaseClient';
import type { CloudAuthUser } from '../types/models';

interface CloudAuthModalProps {
  currentUser: CloudAuthUser | null;
  isSyncing: boolean;
  onClose: () => void;
  onFirebaseConnected: () => void;
  onAuthSuccess: (user: CloudAuthUser) => void;
  onLogoutSuccess: () => void;
}

function translateFirebaseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Método de login ainda desativado no Firebase Console! Vá em Authentication > Sign-in method no projeto stagelog-1087e e ative "Google" e/ou "E-mail/senha".';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'E-mail ou senha incorretos.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'Este e-mail já possui conta cadastrada. Mude para "Já tenho conta".';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'A janela de login do Google foi fechada antes de concluir.';
  }
  if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return 'Permissão negada no Firestore. Verifique as Regras em Firestore Database > Regras no projeto stagelog-1087e.';
  }
  return msg;
}

export function CloudAuthModal({
  currentUser,
  isSyncing,
  onClose,
  onFirebaseConnected,
  onAuthSuccess,
  onLogoutSuccess,
}: CloudAuthModalProps) {
  const fbStatus = getFirebaseServices();
  const activeCfg = getActiveFirebaseConfig();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [snippetInput, setSnippetInput] = useState('');
  const [showConfigEditor, setShowConfigEditor] = useState(
    !fbStatus.isConfigured
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSaveFirebaseSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const parsed = parseFirebaseSnippet(snippetInput);
    if (!parsed) {
      setErrorMsg(
        'Não foi possível identificar apiKey, projectId e appId. Cole o objeto firebaseConfig completo do Console do Firebase.'
      );
      return;
    }

    await saveRuntimeFirebaseConfig(parsed);
    setShowConfigEditor(false);
    onFirebaseConnected();
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const user = await cloudSyncService.loginWithGoogle();
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const user =
        mode === 'login'
          ? await cloudSyncService.loginWithEmail(email, password)
          : await cloudSyncService.registerWithEmail(
              displayName,
              email,
              password
            );
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await cloudSyncService.logout();
    setLoading(false);
    onLogoutSuccess();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '18px 18px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Cloud size={19} color="#38bdf8" />
            Conta na Nuvem (Firebase)
          </h3>
          <button className="icon-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: '16px 18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* ETAPA 1: CONECTAR CREDENCIAIS DO FIREBASE CASO AINDA NÃO PREENCHIDAS */}
          {showConfigEditor ? (
            <form
              onSubmit={handleSaveFirebaseSnippet}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div
                style={{
                  background: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  borderRadius: 12,
                  padding: '12px',
                  fontSize: '0.79rem',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: '#7dd3fc' }}>
                  Conecte seu Projeto Firebase em segundos:
                </strong>
                <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  <li>
                    Acesse <strong>console.firebase.google.com</strong> e crie
                    um projeto.
                  </li>
                  <li>
                    Ative <strong>Authentication</strong> (Google e E-mail/Senha)
                    e <strong>Cloud Firestore</strong>.
                  </li>
                  <li>
                    Em <em>Configurações do Projeto &gt; Web (&lt;/&gt;)</em>,
                    copie o bloco <code>firebaseConfig</code> e cole abaixo (ou
                    no arquivo <code>.env</code>):
                  </li>
                </ol>
              </div>

              <div className="form-field">
                <label className="form-label">
                  Cole o bloco firebaseConfig (JS ou JSON):
                </label>
                <textarea
                  rows={6}
                  required
                  className="form-textarea"
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "seu-app.firebaseapp.com",\n  projectId: "seu-app",\n  appId: "1:123456:web:abcdef"\n};`}
                  value={snippetInput}
                  onChange={(e) => setSnippetInput(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    color: '#f87171',
                    fontSize: '0.77rem',
                    background: 'rgba(239,68,68,0.12)',
                    padding: '9px 11px',
                    borderRadius: 9,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="cta-button-full cta-going">
                <Database size={18} />
                Conectar Firebase Agora
              </button>

              {fbStatus.isConfigured && (
                <button
                  type="button"
                  className="cta-button-full cta-secondary"
                  onClick={() => setShowConfigEditor(false)}
                >
                  Cancelar
                </button>
              )}
            </form>
          ) : currentUser ? (
            /* ETAPA 2: USUÁRIO AUTENTICADO E SINCRONIZADO */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 14,
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <CheckCircle2 size={28} color="#34d399" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem' }}>
                    {currentUser.displayName || 'Usuário Conectado'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {currentUser.email}
                  </div>
                  <div
                    style={{
                      fontSize: '0.71rem',
                      color: '#34d399',
                      marginTop: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={12} /> Sincronizando com Cloud
                        Firestore...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={13} /> Passaporte e Insígnias salvos
                        no Firestore ({fbStatus.projectId})
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="cta-button-full cta-secondary"
                disabled={loading}
                onClick={handleLogout}
              >
                <LogOut size={17} />
                Sair da Conta
              </button>
            </div>
          ) : (
            /* ETAPA 3: TELA DE LOGIN / CADASTRO FIREBASE AUTH */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '8px 11px',
                  borderRadius: 9,
                }}
              >
                <span>
                  Projeto conectado: <strong>{fbStatus.projectId}</strong>
                </span>
                {activeCfg.source === 'runtime' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await clearRuntimeFirebaseConfig();
                      setShowConfigEditor(true);
                      onFirebaseConnected();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ff7a5c',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Trocar projeto
                  </button>
                )}
              </div>

              <button
                type="button"
                className="cta-button-full cta-going"
                disabled={loading}
                onClick={handleGoogleLogin}
              >
                <LogIn size={18} />
                Entrar com Conta Google
              </button>

              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                }}
              >
                — ou use seu e-mail —
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`filter-chip ${mode === 'login' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setMode('login')}
                >
                  Já tenho conta
                </button>
                <button
                  type="button"
                  className={`filter-chip ${mode === 'register' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setMode('register')}
                >
                  Criar nova conta
                </button>
              </div>

              <form
                onSubmit={handleEmailSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {mode === 'register' && (
                  <div className="form-field">
                    <label className="form-label">Seu Nome</label>
                    <input
                      required
                      className="form-input"
                      placeholder="Ex: Pedro Miguel"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-field">
                  <label className="form-label">E-mail</label>
                  <input
                    required
                    type="email"
                    className="form-input"
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Senha (mín. 6 caracteres)</label>
                  <input
                    required
                    minLength={6}
                    type="password"
                    className="form-input"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {errorMsg && (
                  <div
                    style={{
                      color: '#f87171',
                      fontSize: '0.76rem',
                      background: 'rgba(239,68,68,0.12)',
                      padding: '8px 10px',
                      borderRadius: 8,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="cta-button-full cta-attended"
                >
                  {mode === 'login' ? (
                    <>
                      <Mail size={18} /> Entrar e Sincronizar Shows
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} /> Criar Conta no StageLog
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
