import { X } from 'lucide-react';
import { useState } from 'react';
import { CLASSIC_ANTHEMS } from '../data/badgesCatalog';
import type { ShowEvent, SongItem } from '../types/models';

interface AddCustomShowModalProps {
  initialDate?: string;
  onClose: () => void;
  onCreateShow: (newShow: ShowEvent, markAttendedNow: boolean) => void;
}

export function AddCustomShowModal({
  initialDate,
  onClose,
  onCreateShow,
}: AddCustomShowModalProps) {
  const [artistName, setArtistName] = useState('');
  const [eventDate, setEventDate] = useState(initialDate || '2024-08-10');
  const [venueName, setVenueName] = useState('');
  const [cityName, setCityName] = useState('São Paulo');
  const [festivalName, setFestivalName] = useState('');
  const [songsText, setSongsText] = useState('');
  const [markNow, setMarkNow] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistName.trim() || !eventDate || !venueName.trim()) return;

    const lines = songsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const songs: SongItem[] = lines.map((line) => {
      const isEncore = /\[bis\]|\(bis\)/i.test(line);
      const cleanName = line.replace(/\[bis\]|\(bis\)/gi, '').trim();
      return {
        name: cleanName,
        isEncore,
        isAnthem: CLASSIC_ANTHEMS.has(cleanName.toLowerCase()),
      };
    });

    const newShow: ShowEvent = {
      id: `custom-${Date.now()}`,
      artistName: artistName.trim(),
      genre: 'Registro manual',
      festivalName: festivalName.trim() || undefined,
      eventDate,
      venueName: venueName.trim(),
      cityName: cityName.trim() || 'Brasil',
      countryName: 'Brasil',
      songs,
      accentGradient: 'none',
      source: 'custom',
    };

    onCreateShow(newShow, markNow);
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
            Registrar show
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
            <label className="form-label">Artista ou banda</label>
            <input
              required
              className="form-input"
              placeholder="Nome do artista"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div className="form-field">
              <label className="form-label">Data</label>
              <input
                required
                type="date"
                className="date-input-native"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Cidade</label>
              <input
                required
                className="form-input"
                placeholder="Cidade"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Local</label>
            <input
              required
              className="form-input"
              placeholder="Casa de show, arena ou estádio"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Festival (opcional)</label>
            <input
              className="form-input"
              placeholder="Ex: Lollapalooza, Rock in Rio"
              value={festivalName}
              onChange={(e) => setFestivalName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              Repertório (uma faixa por linha — use "(Bis)" quando aplicável)
            </label>
            <textarea
              rows={4}
              className="form-textarea"
              placeholder={'Faixa 1\nFaixa 2\nFaixa 3 (Bis)'}
              value={songsText}
              onChange={(e) => setSongsText(e.target.value)}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={markNow}
              onChange={(e) => setMarkNow(e.target.checked)}
            />
            Marcar presença automaticamente ao salvar
          </label>

          <button type="submit" className="cta-button-full cta-primary">
            Salvar show
          </button>
        </form>
      </div>
    </div>
  );
}
