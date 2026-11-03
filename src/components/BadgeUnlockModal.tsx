import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import { BADGES_CATALOG } from '../data/badgesCatalog';
import type { UnlockedBadge } from '../types/models';
import { BadgeIcon } from './BadgeIcon';

interface BadgeUnlockModalProps {
  unlockedList: UnlockedBadge[];
  onClose: () => void;
}

const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  diamond: 'Diamante',
};

export function BadgeUnlockModal({
  unlockedList,
  onClose,
}: BadgeUnlockModalProps) {
  useEffect(() => {
    try {
      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#FF5533', '#F59E0B', '#38BDF8', '#FAFAFA'],
      });
    } catch {
      // Ignora em ambientes sem canvas
    }
  }, []);

  if (unlockedList.length === 0) return null;

  const badgeDefs = unlockedList
    .map((u) => ({
      unlocked: u,
      def: BADGES_CATALOG.find((b) => b.id === u.badgeId),
    }))
    .filter((item) => Boolean(item.def));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '0 22px 24px',
          gap: 16,
        }}
      >
        <div className="sheet-grabber" />
        <div style={{ paddingTop: 10 }}>
          <span className="eyebrow-label">
            {badgeDefs.length === 1 ? 'Nova insígnia' : 'Novas insígnias'}
          </span>
          <h2
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-display)',
              fontSize: '1.35rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            Conquista desbloqueada
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {badgeDefs.map(({ unlocked, def }) => {
            if (!def) return null;
            return (
              <div
                key={def.id}
                className="badge-card unlocked"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: '15px',
                }}
              >
                <div className={`badge-medallion tier-${def.tier}`}>
                  <BadgeIcon iconKey={def.iconKey} size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <span className="badge-tier-tag">
                    {TIER_LABELS[def.tier] ?? def.tier}
                  </span>
                  <h4
                    style={{
                      margin: '2px 0 3px',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                    }}
                  >
                    {def.title}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {def.description}
                  </p>
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {unlocked.triggeredByLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="cta-button-full cta-primary"
          onClick={onClose}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
