import { Check, ChevronRight } from 'lucide-react';
import type { ShowAttendanceRecord, ShowEvent } from '../types/models';
import { formatDateParts, isFutureDate } from '../utils/dateUtils';

interface ShowCardProps {
  show: ShowEvent;
  record?: ShowAttendanceRecord;
  referenceDate: string;
  onSelect: (show: ShowEvent) => void;
}

const VINYL_SPINE_PALETTE = [
  '#E55A3C', // Terracotta
  '#DFAA4C', // Ochre Brass
  '#57B887', // Sage Mint
  '#D07287', // Dusty Rose
  '#6BA3D6', // Denim Blue
  '#9E82DC', // Warm Iris
];

function getArtistSpineColor(artistName: string): string {
  let hash = 0;
  for (let i = 0; i < artistName.length; i++) {
    hash = (hash * 31 + artistName.charCodeAt(i)) | 0;
  }
  return VINYL_SPINE_PALETTE[Math.abs(hash) % VINYL_SPINE_PALETTE.length];
}

export function ShowCard({
  show,
  record,
  referenceDate,
  onSelect,
}: ShowCardProps) {
  const { day, month, year } = formatDateParts(show.eventDate);
  const isUpcoming = isFutureDate(show.eventDate, referenceDate);
  const isToday = show.eventDate === referenceDate;
  const spineColor = getArtistSpineColor(show.artistName);

  const locationText = [show.venueName, show.cityName]
    .filter(Boolean)
    .join(' · ');

  const subMetaParts: string[] = [];
  if (!show.festivalName && show.tourName) {
    subMetaParts.push(show.tourName);
  }
  if (show.songs.length > 0) {
    subMetaParts.push(`${show.songs.length} faixas`);
  } else if (isUpcoming) {
    subMetaParts.push('Programado');
  }

  return (
    <article className="ticket-card" onClick={() => onSelect(show)}>
      <div
        className="ticket-spine"
        style={{
          background:
            record?.status === 'attended' ? 'var(--status-ok)' : spineColor,
        }}
      />

      <div className="ticket-stub">
        <span className="date-day">{day}</span>
        <span className="date-month-year">
          {month} '{year.slice(2)}
        </span>
      </div>

      <div className="ticket-body">
        <div className="show-main">
          <h3 className="show-artist">{show.artistName}</h3>
          <p className="show-venue-line">{locationText}</p>
          {(show.festivalName || subMetaParts.length > 0) && (
            <div className="show-sub-line">
              {show.festivalName && (
                <span className="festival-inline">{show.festivalName}</span>
              )}
              {subMetaParts.length > 0 && (
                <span>{subMetaParts.join(' · ')}</span>
              )}
            </div>
          )}
        </div>

        {record?.status === 'attended' ? (
          <span className="status-tag attended">
            <Check size={12} strokeWidth={2.8} />
            Fui
          </span>
        ) : record?.status === 'going' ? (
          <span className="status-tag going">Agenda</span>
        ) : isToday ? (
          <span className="status-tag today">Hoje</span>
        ) : (
          <ChevronRight
            size={17}
            strokeWidth={1.7}
            color="var(--text-muted)"
            style={{ flexShrink: 0 }}
          />
        )}
      </div>
    </article>
  );
}
