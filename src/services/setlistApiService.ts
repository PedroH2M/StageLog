import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { CLASSIC_ANTHEMS } from '../data/badgesCatalog';
import { OFFICIAL_UPCOMING_SHOWS } from '../data/officialUpcomingCatalog';
import type { ShowEvent, SongItem } from '../types/models';
import {
  getLocalTodayISO,
  isoToSetlistFmDate,
  setlistFmDateToIso,
} from '../utils/dateUtils';

interface SetlistFmRawItem {
  id: string;
  eventDate: string;
  artist?: { name?: string; mbid?: string };
  venue?: {
    name?: string;
    city?: {
      name?: string;
      stateCode?: string;
      country?: { name?: string; code?: string };
    };
  };
  tour?: { name?: string };
  info?: string;
  sets?: {
    set?: Array<{
      encore?: number;
      song?: Array<{ name?: string; tape?: boolean; cover?: { name?: string } }>;
    }>;
  };
}

interface MusicBrainzRecording {
  title?: string;
}

interface BandsintownRawEvent {
  id: string;
  datetime: string;
  title?: string;
  description?: string;
  artist?: { name?: string; mbid?: string };
  venue?: {
    name?: string;
    city?: string;
    region?: string;
    country?: string;
  };
}

const artistSongsCache = new Map<string, SongItem[]>();
const setlistResponseCache = new Map<string, SearchShowsResponse>();
const bandsintownArtistCache = new Map<string, ShowEvent[]>();
let bandsintownRadarPromise: Promise<ShowEvent[]> | null = null;

// Radar de artistas nacionais e internacionais em turnê ativa (consultado ao vivo na Bandsintown API)
const UPCOMING_RADAR_ARTISTS = [
  'System Of A Down',
  'Rush',
  'Foo Fighters',
  'U2',
  'Slipknot',
  'Ed Sheeran',
  'Simple Plan',
  'Slash',
  'Queens of the Stone Age',
  'Cage the Elephant',
  'RAYE',
  'Travis Scott',
  'The Killers',
  'Charli XCX',
  'Fontaines D.C.',
  'The Prodigy',
  'Pitbull',
  'Karol G',
  'Jack Johnson',
  'Hayley Williams',
  'Opeth',
  'Sepultura',
  'Metallica',
  'Iron Maiden',
  'Coldplay',
  'Linkin Park',
  'Bad Bunny',
  'Green Day',
  'Guns N\' Roses',
  'AC/DC',
  'Oasis',
  'The Weeknd',
  'Shakira',
  'Olivia Rodrigo',
  'Bring Me The Horizon',
  'Avenged Sevenfold',
  'Deftones',
  'My Chemical Romance',
  'Twenty One Pilots',
  'Imagine Dragons',
  'Evanescence',
  'Caetano Veloso',
  'Gilberto Gil',
  'Djavan',
  'Ney Matogrosso',
  'Maria Bethânia',
  'Zeca Pagodinho',
  'Seu Jorge',
  'Liniker',
  'Marina Sena',
  'Criolo',
  'BaianaSystem',
  'Planet Hemp',
  'Pitty',
  'Nando Reis',
  'Capital Inicial',
  'Jota Quest',
  'Os Paralamas do Sucesso',
  'Titãs',
  'Fresno',
  'CPM 22',
  'Alok',
  'Ludmilla',
  'Ivete Sangalo',
];

// Fila simples para respeitar estritamente o rate-limit gratuito de 2 req/s da Setlist.fm
let lastSetlistRequestTs = 0;

export type RegionScope = 'BR' | 'WORLD';
export type SearchMode = 'artist' | 'city' | 'venue';

export interface SearchShowsParams {
  query?: string;
  searchMode?: SearchMode;
  exactDate?: string; // YYYY-MM-DD
  dayCityFilter?: string;
  year?: string;
  onlyUpcoming?: boolean;
  festivalPreset?: '' | 'all_festivals' | 'rock_in_rio' | 'lollapalooza' | 'the_town';
  region?: RegionScope;
  page?: number;
  customShows: ShowEvent[];
  runtimeApiKey?: string;
}

export interface SearchShowsResponse {
  shows: ShowEvent[];
  totalAvailable: number;
  hasMore: boolean;
  providerUsed: 'setlistfm' | 'catalog';
  hasOfficialSetlistKey: boolean;
}

export function getEffectiveSetlistApiKey(runtimeKey?: string): string {
  const envKey = import.meta.env.VITE_SETLIST_FM_API_KEY?.trim();
  if (envKey) return envKey;
  return runtimeKey?.trim() ?? '';
}

function getSetlistFmBaseUrl(): string {
  return Capacitor.isNativePlatform()
    ? 'https://api.setlist.fm/rest/1.0'
    : '/api/setlistfm';
}

function getBandsintownBaseUrl(): string {
  return Capacitor.isNativePlatform()
    ? 'https://rest.bandsintown.com'
    : '/api/bandsintown';
}

interface SimpleHttpResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

async function nativeAwareGet(
  url: string,
  headers: Record<string, string>
): Promise<SimpleHttpResponse> {
  if (Capacitor.isNativePlatform()) {
    const nativeRes = await CapacitorHttp.get({
      url,
      headers: {
        ...headers,
        'User-Agent': 'StageLogMobile/1.0.0',
      },
    });
    return {
      ok: nativeRes.status >= 200 && nativeRes.status < 300,
      status: nativeRes.status,
      json: async () =>
        typeof nativeRes.data === 'string'
          ? JSON.parse(nativeRes.data)
          : nativeRes.data,
    };
  }

  const webRes = await fetch(url, { headers });
  return {
    ok: webRes.ok,
    status: webRes.status,
    json: () => webRes.json(),
  };
}

async function throttledSetlistFetch(
  url: string,
  apiKey: string
): Promise<SimpleHttpResponse> {
  const now = Date.now();
  const elapsed = now - lastSetlistRequestTs;
  if (elapsed < 520) {
    await new Promise((r) => setTimeout(r, 520 - elapsed));
  }
  lastSetlistRequestTs = Date.now();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-api-key': apiKey,
  };

  const first = await nativeAwareGet(url, headers);
  if (first.status === 429) {
    await new Promise((r) => setTimeout(r, 850));
    lastSetlistRequestTs = Date.now();
    return nativeAwareGet(url, headers);
  }
  return first;
}

function extractSongsFromSetlistItem(item: SetlistFmRawItem): SongItem[] {
  const songs: SongItem[] = [];
  const rawSets = item.sets?.set ?? [];

  for (const s of rawSets) {
    const isEncore = Boolean(s.encore && s.encore > 0);
    for (const song of s.song ?? []) {
      if (!song.name || song.tape) continue;
      const norm = song.name.trim().toLowerCase();
      songs.push({
        name: song.name,
        isEncore,
        isAnthem: CLASSIC_ANTHEMS.has(norm),
        coverOf: song.cover?.name,
      });
    }
  }
  return songs;
}

/**
 * Infere automaticamente o nome oficial do festival mesmo quando a Setlist.fm
 * cadastra apenas o nome do palco (ex: "Palco Mundo", "Palco Sunset", "Espaço Favela").
 */
function inferFestivalName(
  venueName: string,
  cityName: string,
  tourName: string | undefined,
  info: string | undefined,
  isoDate: string
): string | undefined {
  const yr = isoDate.slice(0, 4);
  const month = isoDate.slice(5, 7);
  const vLower = venueName.toLowerCase();
  const cLower = cityName.toLowerCase();
  const combined = `${venueName} ${tourName ?? ''} ${info ?? ''}`.toLowerCase();

  // Palcos oficiais do Rock in Rio no Rio de Janeiro
  const rirStages = [
    'palco mundo',
    'palco sunset',
    'palco supernova',
    'espaço favela',
    'global village',
    'new dance order',
    'rock district',
    'rock street',
    'cidade do rock',
  ];
  if (
    combined.includes('rock in rio') ||
    (cLower.includes('rio de janeiro') &&
      rirStages.some((st) => vLower.includes(st)))
  ) {
    return `Rock in Rio ${yr}`;
  }

  if (
    (cLower.includes('lisbon') || cLower.includes('lisboa')) &&
    (vLower.includes('palco mundo') || vLower.includes('bela vista') || vLower.includes('parque tejo'))
  ) {
    return `Rock in Rio Lisboa ${yr}`;
  }

  // Autódromo de Interlagos: Lollapalooza (Março) & The Town (Setembro em anos ímpares)
  if (combined.includes('lollapalooza')) {
    return `Lollapalooza ${yr}`;
  }
  if (vLower.includes('interlagos') && month === '03') {
    return `Lollapalooza Brasil ${yr}`;
  }
  if (combined.includes('the town')) {
    return `The Town ${yr}`;
  }
  if (
    vLower.includes('interlagos') &&
    month === '09' &&
    ['2023', '2025', '2027'].includes(yr)
  ) {
    return `The Town ${yr}`;
  }

  if (combined.includes('knotfest')) return `Knotfest ${yr}`;
  if (combined.includes('monsters of rock')) return `Monsters of Rock ${yr}`;
  if (combined.includes('joão rock') || combined.includes('joao rock')) {
    return `João Rock ${yr}`;
  }
  if (combined.includes('planeta atlântida') || combined.includes('planeta atlantida')) {
    return `Planeta Atlântida ${yr}`;
  }
  if (combined.includes('primavera sound')) return `Primavera Sound ${yr}`;
  if (combined.includes('coala')) return `Coala Festival ${yr}`;
  if (
    combined.includes('rock the mountain') ||
    (cLower.includes('petrópolis') && vLower.includes('paulo rattes'))
  ) {
    return `Rock the Mountain ${yr}`;
  }

  if (/festival/i.test(combined)) {
    return tourName && /festival/i.test(tourName) ? tourName : venueName;
  }

  return undefined;
}

/**
 * Na Setlist.fm (wiki colaborativa), shows futuros legítimos ainda não têm músicas.
 * Qualquer entrada com data futura (> hoje) que já contenha setlist preenchido é
 * vandalismo/spam não moderado ("dream setlist") e deve ser descartada.
 */
function isUnverifiedFutureSpam(item: SetlistFmRawItem): boolean {
  const isoDate = setlistFmDateToIso(item.eventDate);
  if (isoDate <= getLocalTodayISO()) return false;
  return extractSongsFromSetlistItem(item).length > 0;
}

function mapSetlistFmItem(
  item: SetlistFmRawItem,
  forcedFestivalLabel?: string
): ShowEvent {
  const songs = extractSongsFromSetlistItem(item);
  const venueName = item.venue?.name ?? 'Local confirmado';
  const cityName = item.venue?.city?.name ?? '';
  const tourName = item.tour?.name;
  const isoDate = setlistFmDateToIso(item.eventDate);

  const detectedFestival =
    inferFestivalName(venueName, cityName, tourName, item.info, isoDate) ||
    (forcedFestivalLabel ? `${forcedFestivalLabel} ${isoDate.slice(0, 4)}` : undefined);

  return {
    id: `sfm-${item.id}`,
    artistName: item.artist?.name ?? 'Artista',
    artistMbid: item.artist?.mbid,
    genre: 'Setlist.fm Oficial',
    tourName,
    festivalName: detectedFestival,
    eventDate: isoDate,
    venueName,
    cityName,
    countryName: item.venue?.city?.country?.name ?? '',
    songs,
    accentGradient: 'none',
    source: 'setlistfm',
  };
}

type DetectedFestivalAlias =
  | 'rock_in_rio'
  | 'lollapalooza'
  | 'the_town'
  | 'joao_rock'
  | 'planeta_atlantida'
  | 'coala'
  | null;

/**
 * Interpreta buscas em linguagem natural como:
 * "Rock and Rio de 2026", "shows do Rock in Rio 2024", "Elton John Rock in Rio 2026", "Lollapalooza 2026"
 */
function parseSmartQuery(
  rawQuery: string,
  explicitYear: string
): {
  cleanedText: string;
  effectiveYear: string;
  cityHint: string;
  festivalAlias: DetectedFestivalAlias;
} {
  let text = rawQuery.trim();
  let effectiveYear = explicitYear;
  let cityHint = '';

  // Extrai ano de 4 dígitos (1970-2039) caso presente na frase
  const yearMatch = text.match(/\b(19[7-9]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    if (!effectiveYear) {
      effectiveYear = yearMatch[1];
    }
    text = text
      .replace(new RegExp(`\\b(de|do|da|em)?\\s*${yearMatch[1]}\\b`, 'gi'), '')
      .trim();
  }

  // Remove prefixos conversacionais comuns ("shows do", "festival")
  text = text
    .replace(/^(shows?\s+(do|da|de|no|na)\s+)/i, '')
    .replace(/^festival\s+/i, '')
    .trim();

  const lower = text.toLowerCase();

  // Caso 1: Busca direta pelo festival
  if (
    /^(rock\s*(in|and|&|n)\s*rio(\s+brasil|\s+rj)?|rir|cidade\s+do\s+rock)$/i.test(
      lower
    )
  ) {
    return {
      cleanedText: 'Rock in Rio',
      effectiveYear,
      cityHint: '',
      festivalAlias: 'rock_in_rio',
    };
  }

  if (/^(lollapalooza(\s+brasil)?|lolla(\s+brasil)?)$/i.test(lower)) {
    return {
      cleanedText: 'Lollapalooza',
      effectiveYear,
      cityHint: '',
      festivalAlias: 'lollapalooza',
    };
  }

  if (/^the\s+town$/i.test(lower)) {
    return {
      cleanedText: 'The Town',
      effectiveYear,
      cityHint: '',
      festivalAlias: 'the_town',
    };
  }

  if (/^jo[aã]o\s+rock$/i.test(lower)) {
    return {
      cleanedText: 'João Rock',
      effectiveYear,
      cityHint: '',
      festivalAlias: 'joao_rock',
    };
  }

  if (/^planeta\s+atl[aâ]ntida$/i.test(lower)) {
    return {
      cleanedText: 'Planeta Atlântida',
      effectiveYear,
      cityHint: '',
      festivalAlias: 'planeta_atlantida',
    };
  }

  if (/^coala(\s+festival)?$/i.test(lower)) {
    return {
      cleanedText: 'Coala Festival',
      effectiveYear,
      cityHint: '',
      festivalAlias: 'coala',
    };
  }

  // Caso 2: Artista + Festival na mesma frase (ex: "Elton John Rock in Rio 2026")
  if (/rock\s*(in|and|&|n)\s*rio/i.test(text)) {
    const artistOnly = text
      .replace(/\b(no|na|em|at)?\s*rock\s*(in|and|&|n)\s*rio(\s+brasil)?/gi, '')
      .trim();
    if (artistOnly.length >= 2) {
      return {
        cleanedText: artistOnly,
        effectiveYear,
        cityHint: 'Rio de Janeiro',
        festivalAlias: null,
      };
    }
  }

  if (/lollapalooza|\blolla\b|the\s+town/i.test(text)) {
    const artistOnly = text
      .replace(
        /\b(no|na|em|at)?\s*(lollapalooza(\s+brasil)?|lolla|the\s+town)/gi,
        ''
      )
      .trim();
    if (artistOnly.length >= 2) {
      return {
        cleanedText: artistOnly,
        effectiveYear,
        cityHint: 'São Paulo',
        festivalAlias: null,
      };
    }
  }

  return {
    cleanedText: text,
    effectiveYear,
    cityHint,
    festivalAlias: null,
  };
}

/**
 * Busca dedicada para grandes festivais brasileiros na Setlist.fm,
 * consultando diretamente os palcos oficiais cadastrados na base.
 */
async function fetchFestivalShowsFromSetlistFm(params: {
  alias: Exclude<DetectedFestivalAlias, null> | 'all_festivals';
  year: string;
  exactDate: string;
  page: number;
  apiKey: string;
}): Promise<{ shows: ShowEvent[]; total: number; hasMore: boolean }> {
  const { alias, year, exactDate, page, apiKey } = params;
  const baseUrl = getSetlistFmBaseUrl();

  const runVenueQuery = async (
    queryObj: Record<string, string>,
    forcedLabel?: string
  ): Promise<{ items: ShowEvent[]; total: number }> => {
    const sp = new URLSearchParams({ p: String(page), ...queryObj });
    if (year && !exactDate) sp.set('year', year);
    if (exactDate) sp.set('date', isoToSetlistFmDate(exactDate));

    const resp = await throttledSetlistFetch(
      `${baseUrl}/search/setlists?${sp.toString()}`,
      apiKey
    );
    if (!resp.ok) return { items: [], total: 0 };
    const data = (await resp.json()) as {
      total?: number;
      setlist?: SetlistFmRawItem[];
    };
    return {
      items: (data.setlist ?? [])
        .filter((it) => !isUnverifiedFutureSpam(it))
        .map((it) => mapSetlistFmItem(it, forcedLabel)),
      total: data.total ?? 0,
    };
  };

  if (alias === 'rock_in_rio') {
    // Consulta os palcos principais do Rock in Rio (Palco Mundo + Palco Sunset + Palco Supernova/Favela)
    const mundo = await runVenueQuery(
      { venueName: 'Palco Mundo', cityName: 'Rio de Janeiro', countryCode: 'BR' },
      'Rock in Rio'
    );
    const sunset = await runVenueQuery(
      { venueName: 'Palco Sunset', cityName: 'Rio de Janeiro', countryCode: 'BR' },
      'Rock in Rio'
    );
    let extra: { items: ShowEvent[]; total: number } = { items: [], total: 0 };
    if (page === 1) {
      extra = await runVenueQuery(
        { venueName: 'Espaço Favela', cityName: 'Rio de Janeiro', countryCode: 'BR' },
        'Rock in Rio'
      );
    }

    // Caso seja uma edição antiga (ex: 2011, 2013, 2015, 2017) cadastrada como "Cidade do Rock"
    let cidadeDoRock: { items: ShowEvent[]; total: number } = {
      items: [],
      total: 0,
    };
    if (mundo.total === 0 && sunset.total === 0) {
      cidadeDoRock = await runVenueQuery(
        { venueName: 'Cidade do Rock', countryCode: 'BR' },
        'Rock in Rio'
      );
    }

    const combined = mergeUniqueShows(
      mergeUniqueShows(mundo.items, sunset.items),
      mergeUniqueShows(extra.items, cidadeDoRock.items)
    );
    const totalSum =
      mundo.total + sunset.total + extra.total + cidadeDoRock.total;
    return {
      shows: combined,
      total: totalSum,
      hasMore: page * 20 < Math.max(mundo.total, sunset.total),
    };
  }

  if (alias === 'lollapalooza') {
    const sfmPage1 = (page - 1) * 2 + 1;
    const sfmPage2 = sfmPage1 + 1;
    const p1 = await runVenueQuery({
      venueName: 'Autódromo de Interlagos',
      cityName: 'São Paulo',
      countryCode: 'BR',
      p: String(sfmPage1),
    });
    const p2 =
      sfmPage1 * 20 < p1.total
        ? await runVenueQuery({
            venueName: 'Autódromo de Interlagos',
            cityName: 'São Paulo',
            countryCode: 'BR',
            p: String(sfmPage2),
          })
        : { items: [], total: p1.total };

    const combinedInterlagos = mergeUniqueShows(p1.items, p2.items);
    const marchOnly = combinedInterlagos.filter(
      (s) => s.eventDate.slice(5, 7) === '03'
    );
    return {
      shows: marchOnly.map((s) => ({
        ...s,
        festivalName: `Lollapalooza Brasil ${s.eventDate.slice(0, 4)}`,
      })),
      total: marchOnly.length > 0 ? p1.total : 0,
      hasMore: sfmPage2 * 20 < p1.total && marchOnly.length > 0,
    };
  }

  if (alias === 'the_town') {
    const targetYear = year || '2025';
    const sp = new URLSearchParams({
      venueName: 'Autódromo de Interlagos',
      cityName: 'São Paulo',
      countryCode: 'BR',
      year: targetYear,
      p: String(page),
    });
    const resp = await throttledSetlistFetch(
      `${baseUrl}/search/setlists?${sp.toString()}`,
      apiKey
    );
    if (!resp.ok) return { shows: [], total: 0, hasMore: false };
    const data = (await resp.json()) as {
      total?: number;
      setlist?: SetlistFmRawItem[];
    };
    const septOnly = (data.setlist ?? [])
      .filter((it) => !isUnverifiedFutureSpam(it))
      .map((it) => mapSetlistFmItem(it, 'The Town'))
      .filter((s) => s.eventDate.slice(5, 7) === '09');
    return {
      shows: septOnly,
      total: septOnly.length,
      hasMore: page * 20 < (data.total ?? 0) && septOnly.length > 0,
    };
  }

  if (alias === 'joao_rock') {
    const res = await runVenueQuery(
      { cityName: 'Ribeirão Preto', countryCode: 'BR' },
      'João Rock'
    );
    return {
      shows: res.items,
      total: res.total,
      hasMore: page * 20 < res.total,
    };
  }

  if (alias === 'planeta_atlantida') {
    const res = await runVenueQuery(
      { venueName: 'Saba', countryCode: 'BR' },
      'Planeta Atlântida'
    );
    return {
      shows: res.items,
      total: res.total,
      hasMore: page * 20 < res.total,
    };
  }

  if (alias === 'coala') {
    const res = await runVenueQuery(
      { venueName: 'Memorial da América Latina', countryCode: 'BR' },
      'Coala Festival'
    );
    return {
      shows: res.items,
      total: res.total,
      hasMore: page * 20 < res.total,
    };
  }

  // 'all_festivals': traz Rock in Rio + festivais oficiais de Interlagos (Lolla/The Town)
  const rirMundo = await runVenueQuery(
    { venueName: 'Palco Mundo', cityName: 'Rio de Janeiro', countryCode: 'BR' },
    'Rock in Rio'
  );
  const interlagos = await runVenueQuery({
    venueName: 'Autódromo de Interlagos',
    cityName: 'São Paulo',
    countryCode: 'BR',
  });
  const interlagosFestivals = interlagos.items.filter((s) =>
    Boolean(s.festivalName)
  );
  const combined = mergeUniqueShows(rirMundo.items, interlagosFestivals);
  return {
    shows: combined,
    total: rirMundo.total + interlagosFestivals.length,
    hasMore: page * 20 < Math.max(rirMundo.total, interlagos.total),
  };
}

export async function fetchArtistDefaultRepertoire(
  artistName: string
): Promise<SongItem[]> {
  const cleaned = artistName.split(' at ')[0].split(' - ')[0].trim();
  const cacheKey = cleaned.toLowerCase();
  if (!cleaned) return [];
  if (artistSongsCache.has(cacheKey)) {
    return artistSongsCache.get(cacheKey)!;
  }

  const apiKey = getEffectiveSetlistApiKey();
  if (apiKey) {
    try {
      const qs = new URLSearchParams({
        artistName: cleaned,
        p: '1',
      });
      const resp = await throttledSetlistFetch(
        `${getSetlistFmBaseUrl()}/search/setlists?${qs.toString()}`,
        apiKey
      );
      if (resp.ok) {
        const data = (await resp.json()) as { setlist?: SetlistFmRawItem[] };
        const withSongs = (data.setlist ?? []).find((item) => {
          const count = (item.sets?.set ?? []).reduce(
            (acc, s) => acc + (s.song ?? []).length,
            0
          );
          return count >= 3;
        });
        if (withSongs) {
          const extracted = extractSongsFromSetlistItem(withSongs);
          artistSongsCache.set(cacheKey, extracted);
          return extracted;
        }
      }
    } catch {
      // Fallback para MusicBrainz caso necessário
    }
  }

  try {
    const mbBase = Capacitor.isNativePlatform()
      ? 'https://musicbrainz.org/ws/2'
      : '/api/musicbrainz';

    const q = encodeURIComponent(`artist:"${cleaned}" AND status:official`);
    const resp = await nativeAwareGet(
      `${mbBase}/recording?query=${q}&limit=25&fmt=json`,
      { Accept: 'application/json' }
    );

    if (!resp.ok) return [];

    const data = (await resp.json()) as { recordings?: MusicBrainzRecording[] };
    const seen = new Set<string>();
    const songs: SongItem[] = [];

    for (const rec of data.recordings ?? []) {
      if (!rec.title) continue;
      const cleanTitle = rec.title.replace(/\s*\(live.*?\)/i, '').trim();
      const lower = cleanTitle.toLowerCase();
      if (!cleanTitle || seen.has(lower)) continue;
      seen.add(lower);

      songs.push({
        name: cleanTitle,
        isAnthem: CLASSIC_ANTHEMS.has(lower),
        isEncore: songs.length >= 10,
      });
      if (songs.length >= 12) break;
    }

    artistSongsCache.set(cacheKey, songs);
    return songs;
  } catch {
    return [];
  }
}

function normalizeBrazilianCity(
  rawCity: string,
  venueName: string,
  isBrazil: boolean
): string {
  const c = rawCity.trim();
  if (!isBrazil) return c;
  const lower = c.toLowerCase();
  const vLower = venueName.toLowerCase();

  if (
    lower === 'sao paulo' ||
    lower === 'são paulo' ||
    lower === 'agua branca' ||
    lower === 'água branca' ||
    lower === 'perdizes' ||
    lower === 'morumbi' ||
    lower === 'interlagos' ||
    lower === 'cidade dutra' ||
    lower === 'barra funda'
  ) {
    return 'São Paulo';
  }

  if (
    lower === 'rio de janeiro' ||
    lower === 'engenho de dentro' ||
    lower === 'barra da tijuca' ||
    lower === 'jacarepaguá' ||
    lower === 'jacarepagua' ||
    lower === 'maracanã' ||
    lower === 'maracana' ||
    vLower.includes('nilton santos') ||
    vLower.includes('maracanã') ||
    vLower.includes('qualistage')
  ) {
    return 'Rio de Janeiro';
  }

  if (
    lower === 'curitiba' ||
    lower === 'batel' ||
    lower === 'abranches' ||
    vLower.includes('arena da baixada') ||
    vLower.includes('pedreira paulo leminski') ||
    vLower.includes('ópera de arame')
  ) {
    return 'Curitiba';
  }

  if (
    lower === 'brasilia' ||
    lower === 'brasília' ||
    lower === 'lago norte' ||
    lower === 'asa norte' ||
    lower === 'asa sul' ||
    vLower.includes('mané garrincha')
  ) {
    return 'Brasília';
  }

  if (lower === 'belo horizonte' || lower === 'pampulha') {
    return 'Belo Horizonte';
  }

  if (lower === 'florianopolis' || lower === 'florianópolis') {
    return 'Florianópolis';
  }

  return c;
}

function mapBandsintownEvent(
  ev: BandsintownRawEvent,
  fallbackArtist: string
): ShowEvent | null {
  const isoDate = (ev.datetime ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;

  const artistName = ev.artist?.name?.trim() || fallbackArtist;
  const rawVenue = (ev.venue?.name ?? '').trim();
  const cleanCompare = (str: string) =>
    str
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim()
      .toLowerCase();

  const venueName =
    !rawVenue || cleanCompare(rawVenue) === cleanCompare(artistName)
      ? 'Local a confirmar'
      : rawVenue;

  const countryRaw = ev.venue?.country?.trim() ?? '';
  const isBrazil =
    countryRaw.toLowerCase() === 'brazil' ||
    countryRaw.toLowerCase() === 'brasil';
  const countryName = isBrazil ? 'Brasil' : countryRaw;
  const cityName = normalizeBrazilianCity(
    ev.venue?.city ?? '',
    venueName,
    isBrazil
  );

  const detectedFestival = inferFestivalName(
    rawVenue || venueName,
    cityName,
    ev.title,
    ev.description,
    isoDate
  );

  const tourName =
    ev.title &&
    cleanCompare(ev.title) !== cleanCompare(artistName) &&
    ev.title !== detectedFestival
      ? ev.title
      : undefined;

  return {
    id: `bit-${ev.id}`,
    artistName,
    artistMbid: ev.artist?.mbid,
    genre: 'Turnê Oficial',
    tourName,
    festivalName: detectedFestival,
    eventDate: isoDate,
    venueName,
    cityName,
    countryName,
    songs: [],
    accentGradient: 'none',
    source: 'setlistfm',
  };
}

async function fetchBandsintownArtistUpcoming(
  artistName: string
): Promise<ShowEvent[]> {
  const trimmed = artistName.trim();
  if (trimmed.length < 2) return [];
  const cacheKey = trimmed.toLowerCase();
  if (bandsintownArtistCache.has(cacheKey)) {
    return bandsintownArtistCache.get(cacheKey)!;
  }

  try {
    const url = `${getBandsintownBaseUrl()}/artists/${encodeURIComponent(
      trimmed
    )}/events?app_id=js_stagelog_app&date=upcoming`;
    const resp = await nativeAwareGet(url, { Accept: 'application/json' });
    if (!resp.ok) {
      bandsintownArtistCache.set(cacheKey, []);
      return [];
    }
    const raw = await resp.json();
    if (!Array.isArray(raw)) {
      bandsintownArtistCache.set(cacheKey, []);
      return [];
    }

    const mapped = (raw as BandsintownRawEvent[])
      .map((ev) => mapBandsintownEvent(ev, trimmed))
      .filter((x): x is ShowEvent => Boolean(x));

    bandsintownArtistCache.set(cacheKey, mapped);
    return mapped;
  } catch {
    return [];
  }
}

async function getBandsintownUpcomingRadar(): Promise<ShowEvent[]> {
  if (!bandsintownRadarPromise) {
    bandsintownRadarPromise = (async () => {
      const concurrency = 12;
      let cursor = 0;
      const results: ShowEvent[][] = [];
      const workers = Array.from({ length: concurrency }, async () => {
        while (cursor < UPCOMING_RADAR_ARTISTS.length) {
          const idx = cursor++;
          const artist = UPCOMING_RADAR_ARTISTS[idx];
          results[idx] = await fetchBandsintownArtistUpcoming(artist);
        }
      });
      await Promise.all(workers);

      // Parte do calendário oficial verificado (ex: 3 dias completos do Lollapalooza 2027)
      // como base primária para preservar a divisão exata por dia e palco
      let combined: ShowEvent[] = [...OFFICIAL_UPCOMING_SHOWS];
      for (const list of results) {
        if (list) combined = mergeUniqueShows(combined, list);
      }
      return combined;
    })();
  }
  return bandsintownRadarPromise;
}

function filterShowsByCriteria(
  shows: ShowEvent[],
  criteria: {
    exactDate: string;
    cityFilter: string;
    effectiveYear: string;
    region: RegionScope;
    activeFestival: DetectedFestivalAlias | 'all_festivals';
    qNorm: string;
    searchMode: SearchMode;
    onlyFutureAfter?: string;
  }
): ShowEvent[] {
  const {
    exactDate,
    cityFilter,
    effectiveYear,
    region,
    activeFestival,
    qNorm,
    searchMode,
    onlyFutureAfter,
  } = criteria;

  return shows.filter((show) => {
    if (onlyFutureAfter && show.eventDate <= onlyFutureAfter) return false;
    if (exactDate && show.eventDate !== exactDate) return false;
    if (
      cityFilter &&
      !`${show.cityName} ${show.venueName} ${show.artistName}`
        .toLowerCase()
        .includes(cityFilter.toLowerCase())
    ) {
      return false;
    }
    if (effectiveYear && !show.eventDate.startsWith(effectiveYear)) {
      return false;
    }
    if (
      region === 'BR' &&
      show.countryName &&
      show.countryName.toLowerCase() !== 'brasil' &&
      show.countryName.toLowerCase() !== 'brazil'
    ) {
      return false;
    }
    if (activeFestival === 'rock_in_rio') {
      return /rock in rio/i.test(show.festivalName ?? '');
    }
    if (activeFestival === 'lollapalooza') {
      return /lollapalooza/i.test(show.festivalName ?? '');
    }
    if (activeFestival === 'the_town') {
      return /the town/i.test(show.festivalName ?? '');
    }
    if (activeFestival === 'all_festivals') {
      return Boolean(show.festivalName);
    }
    if (qNorm) {
      if (searchMode === 'city') {
        return show.cityName.toLowerCase().includes(qNorm);
      }
      if (searchMode === 'venue') {
        return `${show.venueName} ${show.festivalName ?? ''}`
          .toLowerCase()
          .includes(qNorm);
      }
      const haystack = [
        show.artistName,
        show.venueName,
        show.cityName,
        show.tourName ?? '',
        show.festivalName ?? '',
        ...show.songs.map((s) => s.name),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(qNorm)) return false;
    }
    return true;
  });
}

export async function fetchUpcomingLiveShows(
  referenceDate: string,
  region: RegionScope,
  customShows: ShowEvent[]
): Promise<ShowEvent[]> {
  const localUpcoming = customShows.filter((s) => {
    if (s.eventDate <= referenceDate) return false;
    if (
      region === 'BR' &&
      s.countryName &&
      s.countryName.toLowerCase() !== 'brasil' &&
      s.countryName.toLowerCase() !== 'brazil'
    ) {
      return false;
    }
    return true;
  });

  const radarPromise = getBandsintownUpcomingRadar().then((all) =>
    filterShowsByCriteria(all, {
      exactDate: '',
      cityFilter: '',
      effectiveYear: '',
      region,
      activeFestival: null,
      qNorm: '',
      searchMode: 'artist',
      onlyFutureAfter: referenceDate,
    })
  );

  const apiKey = getEffectiveSetlistApiKey();
  const sfmPromise = (async (): Promise<ShowEvent[]> => {
    if (!apiKey) return [];
    try {
      const qs = new URLSearchParams({ p: '1' });
      if (region === 'BR') {
        qs.set('countryCode', 'BR');
      } else {
        qs.set('year', referenceDate.slice(0, 4));
      }

      const resp = await throttledSetlistFetch(
        `${getSetlistFmBaseUrl()}/search/setlists?${qs.toString()}`,
        apiKey
      );
      if (!resp.ok) return [];
      const data = (await resp.json()) as { setlist?: SetlistFmRawItem[] };
      return (data.setlist ?? [])
        .filter((it) => !isUnverifiedFutureSpam(it))
        .map((it) => mapSetlistFmItem(it))
        .filter((s) => s.eventDate > referenceDate);
    } catch {
      return [];
    }
  })();

  const [radarUpcoming, sfmUpcoming] = await Promise.all([
    radarPromise,
    sfmPromise,
  ]);

  const merged = mergeUniqueShows(
    mergeUniqueShows(localUpcoming, sfmUpcoming),
    radarUpcoming
  );
  merged.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return merged;
}

export async function searchShows(
  params: SearchShowsParams
): Promise<SearchShowsResponse> {
  const {
    query = '',
    searchMode = 'artist',
    exactDate = '',
    dayCityFilter = '',
    year = '',
    onlyUpcoming = false,
    festivalPreset = '',
    region = 'BR',
    page = 1,
    customShows,
    runtimeApiKey,
  } = params;

  const todayISO = getLocalTodayISO();
  const currentYearNum = Number(todayISO.slice(0, 4));

  const effectiveSetlistKey = getEffectiveSetlistApiKey(runtimeApiKey);
  const hasOfficialSetlistKey = Boolean(effectiveSetlistKey);

  const parsed = parseSmartQuery(query, year);
  const qNorm = parsed.cleanedText.toLowerCase();
  const effectiveYear = parsed.effectiveYear;
  const activeFestival =
    parsed.festivalAlias || (festivalPreset ? festivalPreset : null);

  const effectiveCityFilter = dayCityFilter.trim() || parsed.cityHint;
  const isStrictlyFutureYear =
    Boolean(effectiveYear) && Number(effectiveYear) > currentYearNum;
  const isFutureExactDate = Boolean(exactDate) && exactDate > todayISO;

  const cacheSignature = JSON.stringify({
    qNorm,
    searchMode,
    exactDate,
    dayCityFilter: effectiveCityFilter.toLowerCase(),
    effectiveYear,
    onlyUpcoming,
    activeFestival,
    region,
    page,
    customCount: customShows.length,
  });

  if (setlistResponseCache.has(cacheSignature)) {
    return setlistResponseCache.get(cacheSignature)!;
  }

  const criteria = {
    exactDate,
    cityFilter: effectiveCityFilter,
    effectiveYear,
    region,
    activeFestival,
    qNorm,
    searchMode,
    onlyFutureAfter: onlyUpcoming ? todayISO : undefined,
  };

  // 1. Filtra shows criados manualmente pelo usuário
  const localMatches =
    page === 1 ? filterShowsByCriteria(customShows, criteria) : [];

  // 2. Coleta shows futuros oficiais via Bandsintown quando relevante (página 1)
  let upcomingMatches: ShowEvent[] = [];
  const shouldIncludeUpcoming =
    page === 1 &&
    (!effectiveYear || Number(effectiveYear) >= currentYearNum) &&
    (!exactDate || exactDate >= todayISO);

  if (shouldIncludeUpcoming) {
    if (qNorm.length >= 2 && searchMode === 'artist' && !activeFestival) {
      const [officialMatches, artistUpcoming] = await Promise.all([
        Promise.resolve(
          filterShowsByCriteria(OFFICIAL_UPCOMING_SHOWS, criteria)
        ),
        fetchBandsintownArtistUpcoming(parsed.cleanedText),
      ]);
      upcomingMatches = mergeUniqueShows(
        officialMatches,
        filterShowsByCriteria(artistUpcoming, criteria)
      );
    } else if (
      onlyUpcoming ||
      (Boolean(effectiveYear) && Number(effectiveYear) >= currentYearNum) ||
      isFutureExactDate ||
      Boolean(activeFestival) ||
      (qNorm.length >= 2 && (searchMode === 'city' || searchMode === 'venue'))
    ) {
      const radarAll = await getBandsintownUpcomingRadar();
      upcomingMatches = filterShowsByCriteria(radarAll, criteria);
    }
  }

  // Se o filtro for exclusivamente de shows futuros ("Futuros" ou ano > atual, ex: 2027/2028)
  if (onlyUpcoming || isStrictlyFutureYear) {
    let sfmNearFuture: ShowEvent[] = [];
    if (onlyUpcoming && !isStrictlyFutureYear && effectiveSetlistKey) {
      try {
        const sp = new URLSearchParams({ p: '1' });
        if (region === 'BR') sp.set('countryCode', 'BR');
        if (qNorm.length >= 2 && searchMode === 'artist') {
          sp.set('artistName', parsed.cleanedText);
        }
        const resp = await throttledSetlistFetch(
          `${getSetlistFmBaseUrl()}/search/setlists?${sp.toString()}`,
          effectiveSetlistKey
        );
        if (resp.ok) {
          const data = (await resp.json()) as { setlist?: SetlistFmRawItem[] };
          sfmNearFuture = filterShowsByCriteria(
            (data.setlist ?? [])
              .filter((it) => !isUnverifiedFutureSpam(it))
              .map((it) => mapSetlistFmItem(it)),
            criteria
          );
        }
      } catch {
        // Segue com Bandsintown
      }
    }

    const mergedFuture = mergeUniqueShows(
      mergeUniqueShows(upcomingMatches, sfmNearFuture),
      localMatches
    );
    // Ordena shows futuros do mais próximo para o mais distante
    mergedFuture.sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    const futureResult: SearchShowsResponse = {
      shows: mergedFuture,
      totalAvailable: mergedFuture.length,
      hasMore: false,
      providerUsed: 'setlistfm',
      hasOfficialSetlistKey: true,
    };
    setlistResponseCache.set(cacheSignature, futureResult);
    return futureResult;
  }

  if (effectiveSetlistKey) {
    try {
      // A) Caso o usuário tenha pesquisado um Festival ou clicado no filtro Festivais
      if (activeFestival) {
        const festRes = await fetchFestivalShowsFromSetlistFm({
          alias: activeFestival,
          year: effectiveYear,
          exactDate,
          page,
          apiKey: effectiveSetlistKey,
        });

        const merged = mergeUniqueShows(
          mergeUniqueShows(upcomingMatches, festRes.shows),
          localMatches
        );
        const result: SearchShowsResponse = {
          shows: merged,
          totalAvailable: Math.max(
            festRes.total + upcomingMatches.length,
            merged.length
          ),
          hasMore: festRes.hasMore,
          providerUsed: 'setlistfm',
          hasOfficialSetlistKey: true,
        };
        setlistResponseCache.set(cacheSignature, result);
        return result;
      }

      // B) Busca padrão na Setlist.fm com fallback inteligente (Artista -> Local -> Cidade)
      const executeSetlistSearch = async (
        modeToTry: SearchMode
      ): Promise<SimpleHttpResponse> => {
        const sp = new URLSearchParams();
        if (qNorm.length >= 2) {
          if (modeToTry === 'city') sp.set('cityName', parsed.cleanedText);
          else if (modeToTry === 'venue')
            sp.set('venueName', parsed.cleanedText);
          else sp.set('artistName', parsed.cleanedText);
        }
        if (exactDate) sp.set('date', isoToSetlistFmDate(exactDate));
        if (effectiveCityFilter && modeToTry !== 'city') {
          sp.set('cityName', effectiveCityFilter);
        }
        if (effectiveYear && !exactDate) sp.set('year', effectiveYear);
        if (region === 'BR') sp.set('countryCode', 'BR');

        if (!qNorm && !exactDate && !effectiveYear && region === 'WORLD') {
          sp.set('year', String(new Date().getFullYear()));
        }
        sp.set('p', String(page));

        return throttledSetlistFetch(
          `${getSetlistFmBaseUrl()}/search/setlists?${sp.toString()}`,
          effectiveSetlistKey
        );
      };

      let resp = await executeSetlistSearch(searchMode);

      if (resp.status === 404 && qNorm.length >= 2 && searchMode === 'artist') {
        resp = await executeSetlistSearch('venue');
        if (resp.status === 404) {
          resp = await executeSetlistSearch('city');
        }
      }

      if (resp.ok) {
        const data = (await resp.json()) as {
          total?: number;
          itemsPerPage?: number;
          setlist?: SetlistFmRawItem[];
        };
        const apiShows = (data.setlist ?? [])
          .filter((it) => !isUnverifiedFutureSpam(it))
          .map((it) => mapSetlistFmItem(it));
        const merged = mergeUniqueShows(
          mergeUniqueShows(upcomingMatches, apiShows),
          localMatches
        );
        const total = (data.total ?? 0) + upcomingMatches.length;
        const perPage = data.itemsPerPage ?? 20;

        const result: SearchShowsResponse = {
          shows: merged,
          totalAvailable: Math.max(total, merged.length),
          hasMore: page * perPage < (data.total ?? 0),
          providerUsed: 'setlistfm',
          hasOfficialSetlistKey: true,
        };
        setlistResponseCache.set(cacheSignature, result);
        return result;
      } else if (resp.status === 404) {
        const fallbackMerged = mergeUniqueShows(upcomingMatches, localMatches);
        const emptyResult: SearchShowsResponse = {
          shows: fallbackMerged,
          totalAvailable: fallbackMerged.length,
          hasMore: false,
          providerUsed: 'setlistfm',
          hasOfficialSetlistKey: true,
        };
        setlistResponseCache.set(cacheSignature, emptyResult);
        return emptyResult;
      }
    } catch (err) {
      console.error('[StageLog] Erro Setlist.fm:', err);
    }
  }

  const finalFallback = mergeUniqueShows(upcomingMatches, localMatches);
  return {
    shows: finalFallback,
    totalAvailable: finalFallback.length,
    hasMore: false,
    providerUsed: 'catalog',
    hasOfficialSetlistKey,
  };
}

function mergeUniqueShows(
  primary: ShowEvent[],
  incoming: ShowEvent[]
): ShowEvent[] {
  const seenDateKeys = new Set<string>();
  const seenFestivalKeys = new Set<string>();

  for (const s of primary) {
    const artistNorm = s.artistName.trim().toLowerCase();
    seenDateKeys.add(`${artistNorm}::${s.eventDate}`);
    if (s.festivalName) {
      seenFestivalKeys.add(
        `${artistNorm}::fest::${s.festivalName.trim().toLowerCase()}`
      );
    }
  }

  const merged = [...primary];
  for (const item of incoming) {
    const artistNorm = item.artistName.trim().toLowerCase();
    const dateKey = `${artistNorm}::${item.eventDate}`;
    const festKey = item.festivalName
      ? `${artistNorm}::fest::${item.festivalName.trim().toLowerCase()}`
      : null;

    if (seenDateKeys.has(dateKey)) continue;
    if (festKey && seenFestivalKeys.has(festKey)) continue;

    seenDateKeys.add(dateKey);
    if (festKey) seenFestivalKeys.add(festKey);
    merged.push(item);
  }
  merged.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return merged;
}
