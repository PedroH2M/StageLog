import { useState } from 'react';
import { cloudSyncService } from '../services/cloudSyncService';
import type { CloudAuthUser } from '../types/models';

interface AuthScreenProps {
  onAuthenticated: (user: CloudAuthUser) => void;
}

function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Método desativado no Firebase Console. Ative Google e E-mail/senha em Authentication.';
  }
  if (
    msg.includes('auth/invalid-credential') ||
    msg.includes('auth/wrong-password') ||
    msg.includes('auth/user-not-found')
  ) {
    return 'E-mail ou senha incorretos.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'Este e-mail já possui conta. Alterne para Entrar.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Autenticação cancelada.';
  }
  return msg;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      const user = await cloudSyncService.loginWithGoogle();
      onAuthenticated(user);
    } catch (err) {
      setErrorMsg(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
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
      onAuthenticated(user);
    } catch (err) {
      setErrorMsg(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg('');
    setInfoMsg('');
    if (!email.trim()) {
      setErrorMsg('Informe seu e-mail no campo acima para redefinir a senha.');
      return;
    }
    try {
      await cloudSyncService.sendPasswordReset(email);
      setInfoMsg(`Link de recuperação enviado para ${email.trim()}.`);
    } catch (err) {
      setErrorMsg(translateAuthError(err));
    }
  };

  return (
    <div className="app-viewport-wrapper">
      <div
        className="mobile-shell"
        style={{
          justifyContent: 'space-between',
          padding:
            'calc(42px + env(safe-area-inset-top, 0px)) 26px calc(28px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Editorial Cover Header */}
        <div>
          <p className="brand-wordmark" style={{ fontSize: '1.25rem' }}>
            StageLog<span className="brand-dot">.</span>
          </p>

          <h1
            style={{
              margin: '28px 0 0',
              fontFamily: 'var(--font-display)',
              fontSize: '2.15rem',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              color: 'var(--text-primary)',
            }}
          >
            Todas as noites que você viveu{' '}
            <span
              className="editorial-serif-accent"
              style={{ fontSize: '2.45rem', fontWeight: 400 }}
            >
              ao vivo.
            </span>
          </h1>

          <p
            style={{
              margin: '14px 0 0',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              maxWidth: 330,
            }}
          >
            Guarde seus ingressos, marque as músicas que ouviu no palco e leve
            seu arquivo com você.
          </p>
        </div>

        {/* Clean Tactile Auth Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginTop: 32,
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="cta-button-full cta-white"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continuar com Google
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: 'var(--text-muted)',
              fontSize: '0.73rem',
            }}
          >
            <div
              style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}
            />
            <span>ou com seu e-mail</span>
            <div
              style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 20,
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom:
                  mode === 'login'
                    ? '2px solid var(--text-primary)'
                    : '2px solid transparent',
                color:
                  mode === 'login'
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                padding: '0 2px 10px',
                fontSize: '0.86rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom:
                  mode === 'register'
                    ? '2px solid var(--text-primary)'
                    : '2px solid transparent',
                color:
                  mode === 'register'
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                padding: '0 2px 10px',
                fontSize: '0.86rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Criar conta
            </button>
          </div>

          <form
            onSubmit={handleEmailSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {mode === 'register' && (
              <div className="form-field">
                <label className="form-label">Como quer ser chamado</label>
                <input
                  required
                  className="form-input"
                  placeholder="Seu nome"
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <label className="form-label">Senha</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.73rem',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Esqueci a senha
                  </button>
                )}
              </div>
              <input
                required
                minLength={6}
                type="password"
                className="form-input"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {errorMsg && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  color: 'var(--status-danger)',
                  lineHeight: 1.4,
                }}
              >
                {errorMsg}
              </p>
            )}

            {infoMsg && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  color: 'var(--status-ok)',
                  lineHeight: 1.4,
                }}
              >
                {infoMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cta-button-full cta-primary"
              style={{ marginTop: 4 }}
            >
              {loading
                ? 'Aguarde...'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Começar meu passaporte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
