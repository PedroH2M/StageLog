import type {
  AutoSyncSummary,
  ShowAttendanceRecord,
  ShowEvent,
  UnlockedBadge,
  UserProfile,
} from '../types/models';
import { evaluateBadges } from './badgeEngine';

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Fã de Shows',
  handle: '@stagelog',
  bio: 'Colecionando memórias de palco, setlists históricos e insígnias ao vivo.',
  autoUpdateFutureShows: true,
  setlistFmApiKey: '',
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function keyFor(base: string, uid?: string): string {
  return uid ? `${base}_${uid}` : `${base}_guest`;
}

export const storageRepository = {
  getProfile(uid?: string): UserProfile {
    return safeParse<UserProfile>(
      localStorage.getItem(keyFor('stagelog_profile_v2', uid)),
      DEFAULT_PROFILE
    );
  },

  saveProfile(profile: UserProfile, uid?: string): void {
    localStorage.setItem(
      keyFor('stagelog_profile_v2', uid),
      JSON.stringify(profile)
    );
  },

  getRecords(uid?: string): ShowAttendanceRecord[] {
    return safeParse<ShowAttendanceRecord[]>(
      localStorage.getItem(keyFor('stagelog_records_v2', uid)),
      []
    );
  },

  saveRecords(records: ShowAttendanceRecord[], uid?: string): void {
    localStorage.setItem(
      keyFor('stagelog_records_v2', uid),
      JSON.stringify(records)
    );
  },

  getUnlockedBadges(uid?: string): UnlockedBadge[] {
    return safeParse<UnlockedBadge[]>(
      localStorage.getItem(keyFor('stagelog_badges_v2', uid)),
      []
    );
  },

  saveUnlockedBadges(badges: UnlockedBadge[], uid?: string): void {
    localStorage.setItem(
      keyFor('stagelog_badges_v2', uid),
      JSON.stringify(badges)
    );
  },

  getCustomShows(uid?: string): ShowEvent[] {
    return safeParse<ShowEvent[]>(
      localStorage.getItem(keyFor('stagelog_custom_shows_v2', uid)),
      []
    );
  },

  saveCustomShows(shows: ShowEvent[], uid?: string): void {
    localStorage.setItem(
      keyFor('stagelog_custom_shows_v2', uid),
      JSON.stringify(shows)
    );
  },

  syncDueUpcomingShows(
    records: ShowAttendanceRecord[],
    existingBadges: UnlockedBadge[],
    referenceDate: string,
    autoUpdateEnabled: boolean,
    uid?: string
  ): {
    updatedRecords: ShowAttendanceRecord[];
    updatedBadges: UnlockedBadge[];
    summary: AutoSyncSummary;
  } {
    if (!autoUpdateEnabled) {
      return {
        updatedRecords: records,
        updatedBadges: existingBadges,
        summary: { convertedShows: [], newlyUnlockedBadges: [] },
      };
    }

    const convertedShows: ShowEvent[] = [];
    const updatedRecords = records.map((rec) => {
      if (rec.status === 'going' && rec.show.eventDate <= referenceDate) {
        convertedShows.push(rec.show);
        return {
          ...rec,
          status: 'attended' as const,
          heardSongs:
            rec.heardSongs.length > 0
              ? rec.heardSongs
              : rec.show.songs.map((s) => s.name),
          autoUpdatedFromGoing: true,
          loggedAt: new Date().toISOString(),
        };
      }
      return rec;
    });

    if (convertedShows.length === 0) {
      return {
        updatedRecords: records,
        updatedBadges: existingBadges,
        summary: { convertedShows: [], newlyUnlockedBadges: [] },
      };
    }

    const evalRes = evaluateBadges(
      updatedRecords,
      existingBadges,
      convertedShows[convertedShows.length - 1]
    );

    this.saveRecords(updatedRecords, uid);
    this.saveUnlockedBadges(evalRes.allUnlocked, uid);

    return {
      updatedRecords,
      updatedBadges: evalRes.allUnlocked,
      summary: {
        convertedShows,
        newlyUnlockedBadges: evalRes.newlyUnlocked,
      },
    };
  },

  resetAll(uid?: string): void {
    localStorage.removeItem(keyFor('stagelog_profile_v2', uid));
    localStorage.removeItem(keyFor('stagelog_records_v2', uid));
    localStorage.removeItem(keyFor('stagelog_badges_v2', uid));
    localStorage.removeItem(keyFor('stagelog_custom_shows_v2', uid));
  },
};
