import { BADGES_CATALOG, CLASSIC_ANTHEMS } from '../data/badgesCatalog';
import type {
  ShowAttendanceRecord,
  ShowEvent,
  UnlockedBadge,
} from '../types/models';

export interface BadgeEvaluationResult {
  allUnlocked: UnlockedBadge[];
  newlyUnlocked: UnlockedBadge[];
}

export interface UserPassportStats {
  attendedCount: number;
  goingCount: number;
  uniqueArtistsCount: number;
  totalSongsHeard: number;
  uniqueSongsHeard: number;
  uniqueCitiesCount: number;
  topArtist: { name: string; count: number } | null;
  anthemsHeard: string[];
}

export function computeUserStats(
  records: ShowAttendanceRecord[]
): UserPassportStats {
  const attended = records.filter((r) => r.status === 'attended');
  const going = records.filter((r) => r.status === 'going');

  const artistCounts = new Map<string, { display: string; count: number }>();
  const cities = new Set<string>();
  const uniqueSongs = new Set<string>();
  const anthemsSet = new Set<string>();
  let totalSongsHeard = 0;

  for (const rec of attended) {
    const artistKey = rec.show.artistName.trim().toLowerCase();
    const prev = artistCounts.get(artistKey);
    artistCounts.set(artistKey, {
      display: rec.show.artistName,
      count: (prev?.count ?? 0) + 1,
    });

    if (rec.show.cityName) {
      cities.add(rec.show.cityName.trim().toLowerCase());
    }

    totalSongsHeard += rec.heardSongs.length;

    const showAnthemLookup = new Set(
      rec.show.songs
        .filter((s) => s.isAnthem)
        .map((s) => s.name.trim().toLowerCase())
    );

    for (const song of rec.heardSongs) {
      const normalized = song.trim().toLowerCase();
      uniqueSongs.add(`${artistKey}::${normalized}`);
      if (CLASSIC_ANTHEMS.has(normalized) || showAnthemLookup.has(normalized)) {
        anthemsSet.add(`${song} (${rec.show.artistName})`);
      }
    }
  }

  let topArtist: { name: string; count: number } | null = null;
  for (const entry of artistCounts.values()) {
    if (!topArtist || entry.count > topArtist.count) {
      topArtist = { name: entry.display, count: entry.count };
    }
  }

  return {
    attendedCount: attended.length,
    goingCount: going.length,
    uniqueArtistsCount: artistCounts.size,
    totalSongsHeard,
    uniqueSongsHeard: uniqueSongs.size,
    uniqueCitiesCount: cities.size,
    topArtist,
    anthemsHeard: Array.from(anthemsSet),
  };
}

export function evaluateBadges(
  records: ShowAttendanceRecord[],
  existingUnlocked: UnlockedBadge[],
  triggerShow?: ShowEvent
): BadgeEvaluationResult {
  const attended = records.filter((r) => r.status === 'attended');
  const unlockedMap = new Map<string, UnlockedBadge>(
    existingUnlocked.map((b) => [b.badgeId, b])
  );
  const newlyUnlocked: UnlockedBadge[] = [];

  if (attended.length === 0) {
    return { allUnlocked: existingUnlocked, newlyUnlocked: [] };
  }

  const artistCounts = new Map<string, number>();
  const dateCounts = new Map<string, number>();
  const cities = new Set<string>();

  let totalSongsHeard = 0;
  let maxSongsSingleShow = 0;
  let hasEncore = false;
  let hasAnthem = false;
  let hasFestival = false;
  let hasPre2020 = false;

  for (const rec of attended) {
    const aKey = rec.show.artistName.trim().toLowerCase();
    artistCounts.set(aKey, (artistCounts.get(aKey) ?? 0) + 1);

    dateCounts.set(
      rec.show.eventDate,
      (dateCounts.get(rec.show.eventDate) ?? 0) + 1
    );

    if (rec.show.cityName) {
      cities.add(rec.show.cityName.trim().toLowerCase());
    }

    const heardCount = rec.heardSongs.length;
    totalSongsHeard += heardCount;
    if (heardCount > maxSongsSingleShow) {
      maxSongsSingleShow = heardCount;
    }

    const heardNormalized = new Set(
      rec.heardSongs.map((s) => s.trim().toLowerCase())
    );

    for (const songObj of rec.show.songs) {
      const sNorm = songObj.name.trim().toLowerCase();
      if (heardNormalized.has(sNorm)) {
        if (songObj.isEncore) hasEncore = true;
        if (songObj.isAnthem || CLASSIC_ANTHEMS.has(sNorm)) hasAnthem = true;
      }
    }

    for (const sNorm of heardNormalized) {
      if (CLASSIC_ANTHEMS.has(sNorm)) {
        hasAnthem = true;
      }
    }

    if (
      rec.show.festivalName ||
      /festival|rock in rio|lollapalooza|the town|knotfest|monsters of rock/i.test(
        `${rec.show.tourName ?? ''} ${rec.show.venueName}`
      )
    ) {
      hasFestival = true;
    }

    if (rec.show.eventDate < '2020-01-01') {
      hasPre2020 = true;
    }
  }

  const maxSameArtist = Math.max(0, ...Array.from(artistCounts.values()));
  const maxSameDate = Math.max(0, ...Array.from(dateCounts.values()));

  const conditionChecks: Record<string, boolean> = {
    badge_first_show: attended.length >= 1,
    badge_stage_regular: attended.length >= 5,
    badge_rail_legend: attended.length >= 10,
    badge_loyal_fan: maxSameArtist >= 2,
    badge_band_devotee: maxSameArtist >= 3,
    badge_marathon_setlist: maxSongsSingleShow >= 10,
    badge_encore_witness: hasEncore,
    badge_anthem_hunter: hasAnthem,
    badge_song_collector_30: totalSongsHeard >= 25,
    badge_living_encyclopedia: totalSongsHeard >= 60,
    badge_festival_survivor: hasFestival,
    badge_double_stage_day: maxSameDate >= 2,
    badge_time_traveler: hasPre2020,
    badge_roadtripper: cities.size >= 3,
  };

  const fallbackShow = triggerShow ?? attended[attended.length - 1].show;
  const nowIso = new Date().toISOString();

  for (const badge of BADGES_CATALOG) {
    if (conditionChecks[badge.id] && !unlockedMap.has(badge.id)) {
      const unlockedEntry: UnlockedBadge = {
        badgeId: badge.id,
        unlockedAt: nowIso,
        triggeredByShowId: fallbackShow.id,
        triggeredByLabel: `${fallbackShow.artistName} (${fallbackShow.cityName})`,
      };
      unlockedMap.set(badge.id, unlockedEntry);
      newlyUnlocked.push(unlockedEntry);
    }
  }

  return {
    allUnlocked: Array.from(unlockedMap.values()),
    newlyUnlocked,
  };
}
