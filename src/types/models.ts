export interface SongItem {
  name: string;
  isEncore?: boolean;
  isAcoustic?: boolean;
  isAnthem?: boolean;
  coverOf?: string;
}

export interface ShowEvent {
  id: string;
  artistName: string;
  artistMbid?: string;
  genre: string;
  tourName?: string;
  festivalName?: string;
  eventDate: string; // Formato ISO YYYY-MM-DD para ordenação e filtro exato por dia
  venueName: string;
  cityName: string;
  countryName: string;
  songs: SongItem[];
  accentGradient: string;
  source: 'catalog' | 'setlistfm' | 'musicbrainz' | 'custom';
}

export type AttendanceStatus = 'attended' | 'going';

export interface ShowAttendanceRecord {
  showId: string;
  show: ShowEvent;
  status: AttendanceStatus;
  heardSongs: string[];
  favoriteSong?: string;
  rating: number;
  notes: string;
  loggedAt: string;
  autoUpdatedFromGoing?: boolean;
}

export type BadgeCategory =
  | 'volume'
  | 'band'
  | 'songs'
  | 'festival'
  | 'retroactive'
  | 'explorer';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  unlockRuleText: string;
  category: BadgeCategory;
  tier: BadgeTier;
  iconKey: string;
}

export interface UnlockedBadge {
  badgeId: string;
  unlockedAt: string;
  triggeredByShowId: string;
  triggeredByLabel: string;
}

export interface UserProfile {
  displayName: string;
  handle: string;
  bio: string;
  photoUrl?: string;
  autoUpdateFutureShows: boolean;
  setlistFmApiKey: string;
  customReferenceDate?: string;
}

export interface CloudAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

export interface AutoSyncSummary {
  convertedShows: ShowEvent[];
  newlyUnlockedBadges: UnlockedBadge[];
}
