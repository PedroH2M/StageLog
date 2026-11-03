import { Check, Star, X } from 'lucide-react';
import { useState } from 'react';
import { CLASSIC_ANTHEMS } from '../data/badgesCatalog';
import { fetchArtistDefaultRepertoire } from '../services/setlistApiService';
import type {
  AttendanceStatus,
  ShowAttendanceRecord,
  ShowEvent,
  SongItem,
} from '../types/models';
import { formatDateShortBR, isFutureDate } from '../utils/dateUtils';

interface ShowDetailModalProps {
  show: ShowEvent;
  existingRecord?: ShowAttendanceRecord;
  referenceDate: string;
  onClose: () => void;
  onSaveAttendance: (payload: {
    show: ShowEvent;
    status: AttendanceStatus;
    heardSongs: string[];
    favoriteSong?: string;
    rating: number;
    notes: string;
  }) => void;
  onRemoveAttendance: (showId: string) => void;
}

export function ShowDetailModal({
  show,
  existingRecord,
  referenceDate,
  onClose,
  onSaveAttendance,
  onRemoveAttendance,
}: ShowDetailModalProps) {
  const isUpcoming = isFutureDate(show.eventDate, referenceDate);

  const [resolvedSongs, setResolvedSongs] = useState<SongItem[]>(() => {
    if (show.songs.length > 0) return show.songs;
    if (existingRecord && existingRecord.heardSongs.length > 0) {
      return existingRecord.heardSongs.map((name) => ({
        name,
        isAnthem: CLASSIC_ANTHEMS.has(name.trim().toLowerCase()),
      }));
    }
    return [];
  });
  const [isSuggestedRepertoire, setIsSuggestedRepertoire] = useState(false);
  const [loadingSongs, setLoadingSongs] = useState(false);

  const [selectedSongs, setSelectedSongs] = useState<string[]>(() =>
    existingRecord
      ? existingRecord.heardSongs
      : show.songs.map((s) => s.name)
  );
  const [favoriteSong, setFavoriteSong] = useState<string>(
    existingRecord?.favoriteSong ?? ''
  );
  const [rating, setRating] = useState<number>(existingRecord?.rating ?? 5);
  const [notes, setNotes] = useState<string>(existingRecord?.notes ?? '');

  const handleLoadSuggestedSongs = async () => {
    setLoadingSongs(true);
    const fetched = await fetchArtistDefaultRepertoire(show.artistName);
    setResolvedSongs(fetched);
    setIsSuggestedRepertoire(true);
    if (!existingRecord && fetched.length > 0) {
      setSelectedSongs(fetched.map((s) => s.name));
    }
    setLoadingSongs(false);
  };

  const toggleSong = (songName: string) => {
    setSelectedSongs((prev) =>
      prev.includes(songName)
        ? prev.filter((s) => s !== songName)
        : [...prev, songName]
    );
  };

  const toggleAllSongs = () => {
    if (selectedSongs.length === resolvedSongs.length) {
      setSelectedSongs([]);
    } else {
      setSelectedSongs(resolvedSongs.map((s) => s.name));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        {/* Clean Editorial Header */}
        <div
          style={{
            padding: '18px 22px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="icon-btn"
            style={{ position: 'absolute', top: 14, right: 18 }}
          >
            <X size={16} strokeWidth={1.8} />
          </button>

          <div className="eyebrow-label" style={{ marginBottom: 6 }}>
            {formatDateShortBR(show.eventDate)}
            {isUpcoming ? ' · Programado' : ''}
          </div>

          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: '1.45rem',
              fontWeight: 700,
              letterSpacing: '-0.035em',
              paddingRight: 42,
            }}
          >
            {show.artistName}
          </h2>

          <p
            style={{
              margin: '4px 0 0',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            {[show.venueName, show.cityName, show.countryName]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {(show.festivalName || show.tourName) && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              {show.festivalName || show.tourName}
            </p>
          )}
        </div>

        {/* Sheet Body */}
        <div
          style={{
            padding: '18px 22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Setlist */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {isSuggestedRepertoire
                  ? `Repertório habitual (${selectedSongs.length}/${resolvedSongs.length})`
                  : `Setlist oficial (${selectedSongs.length}/${resolvedSongs.length})`}
              </span>
              {resolvedSongs.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllSongs}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {selectedSongs.length === resolvedSongs.length
                    ? 'Limpar seleção'
                    : 'Selecionar todas'}
                </button>
              )}
            </div>

            {loadingSongs ? (
              <div className="empty-state" style={{ padding: '20px' }}>
                Buscando repertório...
              </div>
            ) : resolvedSongs.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 16px' }}>
                <p style={{ margin: 0 }}>
                  {isUpcoming
                    ? 'Show futuro — o setlist oficial ficará disponível após a apresentação.'
                    : 'Setlist desta apresentação ainda não enviado na Setlist.fm.'}
                </p>
                {!isUpcoming && show.source !== 'custom' && (
                  <button
                    type="button"
                    className="ghost-pill-btn"
                    style={{ marginTop: 12 }}
                    onClick={handleLoadSuggestedSongs}
                  >
                    Sugerir músicas habituais do artista
                  </button>
                )}
              </div>
            ) : (
              <div
                className="setlist-list"
                style={{ maxHeight: 230, overflowY: 'auto' }}
              >
                {resolvedSongs.map((song, idx) => {
                  const isChecked = selectedSongs.includes(song.name);
                  const isClassic =
                    song.isAnthem ||
                    CLASSIC_ANTHEMS.has(song.name.trim().toLowerCase());
                  const isFav = favoriteSong === song.name;

                  return (
                    <div
                      key={`${song.name}-${idx}`}
                      className={`setlist-item ${isChecked ? '' : 'unchecked'}`}
                      onClick={() => toggleSong(song.name)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: 5,
                            border: isChecked
                              ? '1px solid var(--brand)'
                              : '1px solid var(--border-default)',
                            background: isChecked
                              ? 'var(--brand)'
                              : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isChecked && (
                            <Check
                              size={11}
                              strokeWidth={2.8}
                              color="#ffffff"
                            />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            width: 20,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 400,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {song.name}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        {isClassic && (
                          <span className="track-tag classic">Clássico</span>
                        )}
                        {song.isEncore && (
                          <span className="track-tag encore">Bis</span>
                        )}
                        <button
                          type="button"
                          title="Destacar como favorita"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavoriteSong(isFav ? '' : song.name);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 2,
                            color: isFav
                              ? 'var(--status-gold)'
                              : 'var(--text-muted)',
                          }}
                        >
                          <Star
                            size={14}
                            strokeWidth={1.7}
                            fill={isFav ? 'var(--status-gold)' : 'none'}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rating */}
          {!isUpcoming && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 4,
              }}
            >
              <span className="form-label">Avaliação</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                  >
                    <Star
                      size={18}
                      strokeWidth={1.6}
                      color={
                        star <= rating
                          ? 'var(--status-gold)'
                          : 'var(--text-muted)'
                      }
                      fill={star <= rating ? 'var(--status-gold)' : 'none'}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-field">
            <label className="form-label">
              {isUpcoming ? 'Anotação (opcional)' : 'Memória do show (opcional)'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={
                isUpcoming
                  ? 'Setor, amigos ou expectativa...'
                  : 'Algo marcante dessa apresentação...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isUpcoming ? (
              <>
                <button
                  type="button"
                  className="cta-button-full cta-primary"
                  onClick={() =>
                    onSaveAttendance({
                      show: { ...show, songs: resolvedSongs },
                      status: 'going',
                      heardSongs: selectedSongs,
                      favoriteSong: favoriteSong || undefined,
                      rating,
                      notes,
                    })
                  }
                >
                  {existingRecord?.status === 'going'
                    ? 'Atualizar na agenda'
                    : 'Confirmar na agenda futura'}
                </button>
                <button
                  type="button"
                  className="cta-button-full cta-secondary"
                  onClick={() =>
                    onSaveAttendance({
                      show: { ...show, songs: resolvedSongs },
                      status: 'attended',
                      heardSongs: selectedSongs,
                      favoriteSong: favoriteSong || undefined,
                      rating,
                      notes,
                    })
                  }
                >
                  Marcar presença antecipada
                </button>
              </>
            ) : (
              <button
                type="button"
                className="cta-button-full cta-primary"
                onClick={() =>
                  onSaveAttendance({
                    show: { ...show, songs: resolvedSongs },
                    status: 'attended',
                    heardSongs: selectedSongs,
                    favoriteSong: favoriteSong || undefined,
                    rating,
                    notes,
                  })
                }
              >
                {existingRecord?.status === 'attended'
                  ? 'Salvar alterações'
                  : 'Marcar presença'}
              </button>
            )}

            {existingRecord && (
              <button
                type="button"
                className="cta-button-full cta-danger-outline"
                onClick={() => onRemoveAttendance(show.id)}
              >
                Remover registro
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
