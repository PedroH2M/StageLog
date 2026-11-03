import {
  Award,
  Calendar,
  CalendarClock,
  Compass,
  Globe,
  Lock,
  LogOut,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AddCustomShowModal } from './components/AddCustomShowModal';
import { AuthScreen } from './components/AuthScreen';
import { BadgeIcon } from './components/BadgeIcon';
import { BadgeUnlockModal } from './components/BadgeUnlockModal';
import { SettingsModal } from './components/SettingsModal';
import { ShowCard } from './components/ShowCard';
import { ShowDetailModal } from './components/ShowDetailModal';
import { BADGES_CATALOG } from './data/badgesCatalog';
import { computeUserStats, evaluateBadges } from './services/badgeEngine';
import { cloudSyncService } from './services/cloudSyncService';
import {
  fetchUpcomingLiveShows,
  searchShows,
  type RegionScope,
  type SearchMode,
} from './services/setlistApiService';
import { storageRepository } from './services/storageRepository';
import type {
  AttendanceStatus,
  CloudAuthUser,
  ShowAttendanceRecord,
  ShowEvent,
  UnlockedBadge,
  UserProfile,
} from './types/models';
import {
  addDaysISO,
  formatDateParts,
  formatDateShortBR,
  getLocalTodayISO,
} from './utils/dateUtils';

type ActiveTab = 'explore' | 'calendar' | 'upcoming' | 'badges' | 'passport';
type ExploreFilter =
  | 'all'
  | 'upcoming'
  | 'today'
  | 'past'
  | 'festivals'
  | 'pre2020'
  | 'marked';

const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  diamond: 'Diamante',
};

export function App() {
  const realToday = useMemo(() => getLocalTodayISO(), []);

  const [authChecking, setAuthChecking] = useState(true);
  const [cloudUser, setCloudUser] = useState<CloudAuthUser | null>(null);
  const [isHydratingCloud, setIsHydratingCloud] = useState(false);

  const [profile, setProfile] = useState<UserProfile>(() =>
    storageRepository.getProfile()
  );
  const [records, setRecords] = useState<ShowAttendanceRecord[]>([]);
  const [unlockedBadges, setUnlockedBadges] = useState<UnlockedBadge[]>([]);
  const [customShows, setCustomShows] = useState<ShowEvent[]>([]);

  const referenceDate = profile.customReferenceDate || realToday;

  const [activeTab, setActiveTab] = useState<ActiveTab>('explore');
  const [regionScope, setRegionScope] = useState<RegionScope>('BR');
  const [searchMode, setSearchMode] = useState<SearchMode>('artist');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [festivalSubFilter, setFestivalSubFilter] = useState<
    'all_festivals' | 'rock_in_rio' | 'lollapalooza' | 'the_town'
  >('all_festivals');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [exploreFilter, setExploreFilter] = useState<ExploreFilter>('all');
  const [showRefineDrawer, setShowRefineDrawer] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [fetchedShows, setFetchedShows] = useState<ShowEvent[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(realToday);
  const [dayCityQuery, setDayCityQuery] = useState<string>('');
  const [debouncedDayCity, setDebouncedDayCity] = useState<string>('');
  const [upcomingShowsList, setUpcomingShowsList] = useState<ShowEvent[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  const [activeShowModal, setActiveShowModal] = useState<ShowEvent | null>(
    null
  );
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [celebrationBadges, setCelebrationBadges] = useState<UnlockedBadge[]>(
    []
  );
  const [syncBannerShows, setSyncBannerShows] = useState<ShowEvent[]>([]);

  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>(
    'all'
  );
  const [passportYearFilter, setPassportYearFilter] = useState<string>('all');

  useEffect(() => {
    const unsub = cloudSyncService.subscribeAuth(async (authUser) => {
      setCloudUser(authUser);
      setAuthChecking(false);

      if (authUser) {
        setIsHydratingCloud(true);
        const localProf = storageRepository.getProfile(authUser.uid);
        const localRecs = storageRepository.getRecords(authUser.uid);
        const localBdgs = storageRepository.getUnlockedBadges(authUser.uid);
        const localCust = storageRepository.getCustomShows(authUser.uid);

        setProfile(localProf);
        setRecords(localRecs);
        setUnlockedBadges(localBdgs);
        setCustomShows(localCust);

        try {
          const merged = await cloudSyncService.hydrateAndMergeUserCloudData(
            authUser,
            localProf,
            localRecs,
            localBdgs,
            localCust
          );
          setProfile(merged.profile);
          setRecords(merged.records);
          setUnlockedBadges(merged.badges);
          setCustomShows(merged.customShows);

          storageRepository.saveProfile(merged.profile, authUser.uid);
          storageRepository.saveRecords(merged.records, authUser.uid);
          storageRepository.saveUnlockedBadges(merged.badges, authUser.uid);
          storageRepository.saveCustomShows(merged.customShows, authUser.uid);
        } catch (err) {
          console.error('[StageLog] Erro ao sincronizar Firestore:', err);
        } finally {
          setIsHydratingCloud(false);
        }
      } else {
        setRecords([]);
        setUnlockedBadges([]);
        setCustomShows([]);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDayCity(dayCityQuery);
      setCurrentPage(1);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [dayCityQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    selectedDate,
    regionScope,
    searchMode,
    selectedYear,
    exploreFilter,
    festivalSubFilter,
  ]);

  useEffect(() => {
    if (!cloudUser) return;
    const syncRes = storageRepository.syncDueUpcomingShows(
      records,
      unlockedBadges,
      referenceDate,
      profile.autoUpdateFutureShows,
      cloudUser.uid
    );

    if (syncRes.summary.convertedShows.length > 0) {
      setRecords(syncRes.updatedRecords);
      setUnlockedBadges(syncRes.updatedBadges);
      setSyncBannerShows(syncRes.summary.convertedShows);

      for (const conv of syncRes.summary.convertedShows) {
        const rec = syncRes.updatedRecords.find((r) => r.showId === conv.id);
        if (rec) {
          void cloudSyncService.syncAttendanceRecord(
            cloudUser.uid,
            rec,
            syncRes.updatedRecords
          );
        }
      }
      void cloudSyncService.syncBadges(cloudUser.uid, syncRes.updatedBadges);

      if (syncRes.summary.newlyUnlockedBadges.length > 0) {
        setCelebrationBadges(syncRes.summary.newlyUnlockedBadges);
      }
    }
  }, [cloudUser, referenceDate, profile.autoUpdateFutureShows]);

  useEffect(() => {
    if (!cloudUser) return;
    if (activeTab !== 'explore' && activeTab !== 'calendar') return;

    let cancelled = false;
    if (currentPage === 1) {
      setIsLoadingShows(true);
    } else {
      setIsLoadingMore(true);
    }

    const exactDateParam =
      activeTab === 'calendar'
        ? selectedDate
        : exploreFilter === 'today'
          ? referenceDate
          : '';

    const effectiveYearParam =
      activeTab === 'explore'
        ? selectedYear || (exploreFilter === 'pre2020' ? '2019' : '')
        : '';

    const effectiveFestivalPreset =
      activeTab === 'explore' && exploreFilter === 'festivals'
        ? festivalSubFilter
        : '';

    searchShows({
      query: activeTab === 'explore' ? debouncedQuery : '',
      searchMode,
      exactDate: exactDateParam,
      dayCityFilter: activeTab === 'calendar' ? debouncedDayCity : '',
      year: effectiveYearParam,
      onlyUpcoming: activeTab === 'explore' && exploreFilter === 'upcoming',
      festivalPreset: effectiveFestivalPreset,
      region: regionScope,
      page: currentPage,
      customShows,
      runtimeApiKey: profile.setlistFmApiKey,
    }).then((res) => {
      if (cancelled) return;
      if (currentPage === 1) {
        setFetchedShows(res.shows);
      } else {
        setFetchedShows((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          const appended = [...prev];
          for (const item of res.shows) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              appended.push(item);
            }
          }
          return appended;
        });
      }
      setTotalAvailable(res.totalAvailable);
      setHasMorePages(res.hasMore);
      setIsLoadingShows(false);
      setIsLoadingMore(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    cloudUser,
    activeTab,
    debouncedQuery,
    debouncedDayCity,
    searchMode,
    selectedYear,
    exploreFilter,
    festivalSubFilter,
    selectedDate,
    referenceDate,
    regionScope,
    currentPage,
    customShows,
    profile.setlistFmApiKey,
  ]);

  useEffect(() => {
    if (!cloudUser || activeTab !== 'upcoming') return;
    let cancelled = false;
    setLoadingUpcoming(true);

    fetchUpcomingLiveShows(referenceDate, regionScope, customShows).then(
      (list) => {
        if (cancelled) return;
        setUpcomingShowsList(list);
        setLoadingUpcoming(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [cloudUser, activeTab, referenceDate, regionScope, customShows]);

  const recordsMap = useMemo(() => {
    const map = new Map<string, ShowAttendanceRecord>();
    for (const r of records) {
      map.set(r.showId, r);
    }
    return map;
  }, [records]);

  const stats = useMemo(() => computeUserStats(records), [records]);

  const exploreShowsList = useMemo(() => {
    if (exploreFilter === 'marked') {
      return records.map((r) => r.show);
    }
    return fetchedShows.filter((s) => {
      if (exploreFilter === 'upcoming') return s.eventDate > referenceDate;
      if (exploreFilter === 'today') return s.eventDate === referenceDate;
      if (exploreFilter === 'past') return s.eventDate <= referenceDate;
      if (exploreFilter === 'pre2020') return s.eventDate < '2020-01-01';
      return true;
    });
  }, [fetchedShows, exploreFilter, referenceDate, records]);

  const featuredDates = useMemo(
    () => [
      realToday,
      '2027-03-19',
      '2027-03-20',
      '2027-03-21',
      '2027-01-30',
      '2027-09-04',
      '2026-12-05',
      '2026-09-13',
      '2026-09-07',
      '2025-09-07',
    ],
    [realToday]
  );

  const attendedHistory = useMemo(() => {
    return records
      .filter((r) => r.status === 'attended')
      .filter((r) =>
        passportYearFilter === 'all'
          ? true
          : r.show.eventDate.startsWith(passportYearFilter)
      )
      .sort((a, b) => b.show.eventDate.localeCompare(a.show.eventDate));
  }, [records, passportYearFilter]);

  const attendedYears = useMemo(() => {
    const years = new Set<string>();
    for (const r of records) {
      if (r.status === 'attended') {
        years.add(r.show.eventDate.slice(0, 4));
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const unlockedLookup = useMemo(
    () => new Map(unlockedBadges.map((u) => [u.badgeId, u])),
    [unlockedBadges]
  );

  const handleSaveAttendance = (payload: {
    show: ShowEvent;
    status: AttendanceStatus;
    heardSongs: string[];
    favoriteSong?: string;
    rating: number;
    notes: string;
  }) => {
    if (!cloudUser) return;

    const newRecord: ShowAttendanceRecord = {
      showId: payload.show.id,
      show: payload.show,
      status: payload.status,
      heardSongs: payload.heardSongs,
      favoriteSong: payload.favoriteSong,
      rating: payload.rating,
      notes: payload.notes,
      loggedAt: new Date().toISOString(),
    };

    const nextRecords = [
      ...records.filter((r) => r.showId !== payload.show.id),
      newRecord,
    ];
    setRecords(nextRecords);
    storageRepository.saveRecords(nextRecords, cloudUser.uid);
    setActiveShowModal(null);

    void cloudSyncService.syncAttendanceRecord(
      cloudUser.uid,
      newRecord,
      nextRecords
    );

    if (payload.status === 'attended') {
      const evalRes = evaluateBadges(
        nextRecords,
        unlockedBadges,
        payload.show
      );
      setUnlockedBadges(evalRes.allUnlocked);
      storageRepository.saveUnlockedBadges(evalRes.allUnlocked, cloudUser.uid);

      if (evalRes.newlyUnlocked.length > 0) {
        void cloudSyncService.syncBadges(cloudUser.uid, evalRes.allUnlocked);
        setCelebrationBadges(evalRes.newlyUnlocked);
      }
    }
  };

  const handleRemoveAttendance = (showId: string) => {
    if (!cloudUser) return;
    const nextRecords = records.filter((r) => r.showId !== showId);
    setRecords(nextRecords);
    storageRepository.saveRecords(nextRecords, cloudUser.uid);
    setActiveShowModal(null);

    void cloudSyncService.removeAttendanceRecord(
      cloudUser.uid,
      showId,
      nextRecords
    );
  };

  const handleCreateCustomShow = (
    newShow: ShowEvent,
    markAttendedNow: boolean
  ) => {
    if (!cloudUser) return;
    const nextCustom = [newShow, ...customShows];
    setCustomShows(nextCustom);
    storageRepository.saveCustomShows(nextCustom, cloudUser.uid);
    setShowAddCustomModal(false);

    void cloudSyncService.syncCustomShow(cloudUser.uid, newShow);

    if (markAttendedNow) {
      const autoStatus: AttendanceStatus =
        newShow.eventDate > referenceDate ? 'going' : 'attended';
      handleSaveAttendance({
        show: newShow,
        status: autoStatus,
        heardSongs: newShow.songs.map((s) => s.name),
        rating: 5,
        notes: '',
      });
    }
  };

  const handleSaveProfile = (updated: UserProfile) => {
    if (!cloudUser) return;
    setProfile(updated);
    storageRepository.saveProfile(updated, cloudUser.uid);
    void cloudSyncService.syncProfile(cloudUser.uid, updated);
  };

  const handleAdvanceSimulatedDate = (days: number) => {
    if (!cloudUser) return;
    const nextDate = addDaysISO(referenceDate, days);
    const updated = { ...profile, customReferenceDate: nextDate };
    setProfile(updated);
    storageRepository.saveProfile(updated, cloudUser.uid);
  };

  const handleResetSimulatedDate = () => {
    if (!cloudUser) return;
    const updated = { ...profile, customReferenceDate: undefined };
    setProfile(updated);
    storageRepository.saveProfile(updated, cloudUser.uid);
  };

  const handleLogout = async () => {
    await cloudSyncService.logout();
    setCloudUser(null);
  };

  const handleResetAllData = () => {
    if (!cloudUser) return;
    storageRepository.resetAll(cloudUser.uid);
    setRecords([]);
    setUnlockedBadges([]);
    setCustomShows([]);
    setSyncBannerShows([]);
  };

  if (authChecking) {
    return (
      <div className="app-viewport-wrapper">
        <div
          className="mobile-shell"
          style={{ alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <p className="brand-wordmark">
            StageLog<span className="brand-dot">.</span>
          </p>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Carregando...
          </span>
        </div>
      </div>
    );
  }

  if (!cloudUser) {
    return <AuthScreen onAuthenticated={(u) => setCloudUser(u)} />;
  }

  const hasActiveRefinements = searchMode !== 'artist' || Boolean(selectedYear);

  return (
    <div className="app-viewport-wrapper">
      <div className="mobile-shell">
        {/* Clean Editorial Top Bar */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h1 className="brand-wordmark">
              StageLog<span className="brand-dot">.</span>
            </h1>
            {isHydratingCloud && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                sincronizando
              </span>
            )}
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="ghost-pill-btn"
              title="Alternar região"
              onClick={() =>
                setRegionScope((r) => (r === 'BR' ? 'WORLD' : 'BR'))
              }
            >
              <Globe size={13} strokeWidth={1.8} />
              {regionScope === 'BR' ? 'Brasil' : 'Mundo'}
            </button>
            <button
              type="button"
              className="primary-pill-btn"
              onClick={() => setShowAddCustomModal(true)}
            >
              <Plus size={14} strokeWidth={2.3} />
              Registrar
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Ajustes"
              onClick={() => setShowSettingsModal(true)}
            >
              <Settings size={16} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="screen-content">
          {syncBannerShows.length > 0 && (
            <div className="sync-banner">
              <div>
                <p className="sync-banner-title">Agenda sincronizada</p>
                <p className="sync-banner-desc">
                  {syncBannerShows.map((s) => s.artistName).join(', ')}{' '}
                  adicionado ao seu histórico.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSyncBannerShows([])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 1: EXPLORE                             */}
          {/* ========================================== */}
          {activeTab === 'explore' && (
            <>
              <div className="editorial-hero">
                <h2 className="editorial-title">
                  Descubra <span className="editorial-serif-accent">shows</span>
                </h2>
              </div>

              <div className="search-bar-row">
                <div className="search-box">
                  <Search
                    size={16}
                    strokeWidth={1.8}
                    className="search-box-icon"
                  />
                  <input
                    type="text"
                    className="search-input"
                    placeholder={
                      searchMode === 'city'
                        ? 'Cidade (ex: Rio de Janeiro, Curitiba)...'
                        : searchMode === 'venue'
                          ? 'Casa ou palco (ex: Allianz Parque)...'
                          : 'Artista ou festival (ex: Rock in Rio 2026)...'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  aria-label="Opções de busca"
                  title="Opções de busca e ano"
                  className={`filter-toggle-btn ${showRefineDrawer ? 'active' : ''}`}
                  onClick={() => setShowRefineDrawer((v) => !v)}
                >
                  <SlidersHorizontal size={16} strokeWidth={1.8} />
                  {hasActiveRefinements && !showRefineDrawer && (
                    <span className="filter-active-dot" />
                  )}
                </button>
              </div>

              {showRefineDrawer && (
                <div className="search-refine-drawer">
                  <div className="refine-row">
                    <span className="refine-label">Buscar por</span>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`segmented-item ${searchMode === 'artist' ? 'active' : ''}`}
                        onClick={() => setSearchMode('artist')}
                      >
                        Artista
                      </button>
                      <button
                        type="button"
                        className={`segmented-item ${searchMode === 'city' ? 'active' : ''}`}
                        onClick={() => setSearchMode('city')}
                      >
                        Cidade
                      </button>
                      <button
                        type="button"
                        className={`segmented-item ${searchMode === 'venue' ? 'active' : ''}`}
                        onClick={() => setSearchMode('venue')}
                      >
                        Local
                      </button>
                    </div>
                  </div>

                  <div className="refine-row">
                    <span className="refine-label">Ano da apresentação</span>
                    <select
                      aria-label="Ano"
                      className="minimal-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="">Qualquer ano</option>
                      {Array.from({ length: 34 }, (_, i) =>
                        String(2028 - i)
                      ).map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="chips-row">
                <button
                  type="button"
                  className={`filter-chip ${exploreFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setExploreFilter('all')}
                >
                  Em destaque
                </button>
                <button
                  type="button"
                  className={`filter-chip ${exploreFilter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setExploreFilter('upcoming')}
                >
                  Futuros
                </button>
                <button
                  type="button"
                  className={`filter-chip ${exploreFilter === 'festivals' ? 'active' : ''}`}
                  onClick={() => setExploreFilter('festivals')}
                >
                  Festivais
                </button>
                <button
                  type="button"
                  className={`filter-chip ${exploreFilter === 'today' ? 'active' : ''}`}
                  onClick={() => setExploreFilter('today')}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={`filter-chip ${exploreFilter === 'past' ? 'active' : ''}`}
                  onClick={() => setExploreFilter('past')}
                >
                  Passados
                </button>
                <button
                  type="button"
                  className={`filter-chip ${exploreFilter === 'pre2020' ? 'active' : ''}`}
                  onClick={() => setExploreFilter('pre2020')}
                >
                  Clássicos pré-2020
                </button>
                <button
                  type="button"
                  className={`filter-chip ${exploreFilter === 'marked' ? 'active' : ''}`}
                  onClick={() => setExploreFilter('marked')}
                >
                  Meus shows{records.length > 0 ? ` · ${records.length}` : ''}
                </button>
              </div>

              {exploreFilter === 'festivals' && (
                <div className="chips-row">
                  <button
                    type="button"
                    className={`filter-chip sub-chip ${festivalSubFilter === 'all_festivals' ? 'active' : ''}`}
                    onClick={() => setFestivalSubFilter('all_festivals')}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className={`filter-chip sub-chip ${festivalSubFilter === 'rock_in_rio' ? 'active' : ''}`}
                    onClick={() => setFestivalSubFilter('rock_in_rio')}
                  >
                    Rock in Rio
                  </button>
                  <button
                    type="button"
                    className={`filter-chip sub-chip ${festivalSubFilter === 'lollapalooza' ? 'active' : ''}`}
                    onClick={() => setFestivalSubFilter('lollapalooza')}
                  >
                    Lollapalooza
                  </button>
                  <button
                    type="button"
                    className={`filter-chip sub-chip ${festivalSubFilter === 'the_town' ? 'active' : ''}`}
                    onClick={() => setFestivalSubFilter('the_town')}
                  >
                    The Town
                  </button>
                </div>
              )}

              {(debouncedQuery ||
                selectedYear ||
                exploreFilter === 'upcoming') &&
                !isLoadingShows && (
                  <span className="eyebrow-label">
                    {totalAvailable.toLocaleString('pt-BR')} registros
                    encontrados
                    {selectedYear ? ` em ${selectedYear}` : ''}
                  </span>
                )}

              {isLoadingShows ? (
                <div className="empty-state">Buscando programação...</div>
              ) : exploreShowsList.length === 0 ? (
                <div className="empty-state">
                  <p style={{ margin: '0 0 16px' }}>
                    Nenhum show encontrado para esta seleção.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {regionScope === 'BR' && (
                      <button
                        type="button"
                        className="ghost-pill-btn"
                        onClick={() => setRegionScope('WORLD')}
                      >
                        Buscar no mundo todo
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary-pill-btn"
                      onClick={() => setShowAddCustomModal(true)}
                    >
                      Registrar manualmente
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="shows-list">
                    {exploreShowsList.map((show) => (
                      <ShowCard
                        key={show.id}
                        show={show}
                        record={recordsMap.get(show.id)}
                        referenceDate={referenceDate}
                        onSelect={setActiveShowModal}
                      />
                    ))}
                  </div>

                  {hasMorePages && exploreFilter !== 'marked' && (
                    <button
                      type="button"
                      className="cta-button-full cta-secondary"
                      style={{ marginTop: 16 }}
                      disabled={isLoadingMore}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      {isLoadingMore ? 'Carregando...' : 'Ver mais shows'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ========================================== */}
          {/* TAB 2: BY EXACT DATE                       */}
          {/* ========================================== */}
          {activeTab === 'calendar' && (
            <>
              <div className="editorial-hero">
                <h2 className="editorial-title">
                  Arquivo <span className="editorial-serif-accent">por dia</span>
                </h2>
              </div>

              <div className="surface-panel">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h3 className="section-heading">Escolha a data</h3>
                    <p className="section-desc">
                      Veja quem subiu ao palco em uma noite específica.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-pill-btn"
                    onClick={() => setSelectedDate(referenceDate)}
                  >
                    Hoje
                  </button>
                </div>

                <input
                  type="date"
                  className="date-input-native"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />

                <input
                  type="text"
                  className="form-input"
                  placeholder="Cidade opcional (ex: Rio de Janeiro)..."
                  value={dayCityQuery}
                  onChange={(e) => setDayCityQuery(e.target.value)}
                />

                <div className="chips-row">
                  {featuredDates.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      className={`filter-chip ${selectedDate === dt ? 'active' : ''}`}
                      onClick={() => setSelectedDate(dt)}
                    >
                      {formatDateShortBR(dt)}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span className="eyebrow-label">
                  {formatDateShortBR(selectedDate)} · {fetchedShows.length}{' '}
                  shows
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  + Registrar nesta data
                </button>
              </div>

              {isLoadingShows ? (
                <div className="empty-state">Consultando data...</div>
              ) : fetchedShows.length === 0 ? (
                <div className="empty-state">
                  <p style={{ margin: '0 0 16px' }}>
                    Sem registros para {formatDateShortBR(selectedDate)}.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'center',
                    }}
                  >
                    {regionScope === 'BR' && (
                      <button
                        type="button"
                        className="ghost-pill-btn"
                        onClick={() => setRegionScope('WORLD')}
                      >
                        Expandir para o mundo
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary-pill-btn"
                      onClick={() => setShowAddCustomModal(true)}
                    >
                      Adicionar show
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="shows-list">
                    {fetchedShows.map((show) => (
                      <ShowCard
                        key={show.id}
                        show={show}
                        record={recordsMap.get(show.id)}
                        referenceDate={referenceDate}
                        onSelect={setActiveShowModal}
                      />
                    ))}
                  </div>

                  {hasMorePages && (
                    <button
                      type="button"
                      className="cta-button-full cta-secondary"
                      style={{ marginTop: 16 }}
                      disabled={isLoadingMore}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      {isLoadingMore ? 'Carregando...' : 'Ver mais shows'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ========================================== */}
          {/* TAB 3: UPCOMING AGENDA                     */}
          {/* ========================================== */}
          {activeTab === 'upcoming' && (
            <>
              <div className="editorial-hero">
                <h2 className="editorial-title">
                  Próximas <span className="editorial-serif-accent">noites</span>
                </h2>
              </div>

              <div className="surface-panel">
                <p className="section-desc" style={{ margin: 0 }}>
                  Shows confirmados na sua agenda viram presença automaticamente
                  assim que a data chega.
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px dashed var(--border-perforation)',
                  }}
                >
                  <div>
                    <span className="eyebrow-label">Hoje no app</span>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        marginTop: 3,
                      }}
                    >
                      {formatDateShortBR(referenceDate)}
                      {profile.customReferenceDate ? ' · simulado' : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="ghost-pill-btn"
                      onClick={() => handleAdvanceSimulatedDate(7)}
                    >
                      +7 dias
                    </button>
                    {profile.customReferenceDate && (
                      <button
                        type="button"
                        className="ghost-pill-btn"
                        onClick={handleResetSimulatedDate}
                      >
                        Data real
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {loadingUpcoming ? (
                <div className="empty-state">Carregando programação...</div>
              ) : upcomingShowsList.length === 0 ? (
                <div className="empty-state">
                  Nenhum evento futuro listado para esta região.
                </div>
              ) : (
                <div className="shows-list">
                  {upcomingShowsList.map((show) => (
                    <ShowCard
                      key={show.id}
                      show={show}
                      record={recordsMap.get(show.id)}
                      referenceDate={referenceDate}
                      onSelect={setActiveShowModal}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ========================================== */}
          {/* TAB 4: BADGES                              */}
          {/* ========================================== */}
          {activeTab === 'badges' && (
            <>
              <div className="editorial-hero">
                <h2 className="editorial-title">
                  Suas <span className="editorial-serif-accent">insígnias</span>
                </h2>
              </div>

              <div className="surface-panel">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h3 className="section-heading">Coleção desbloqueada</h3>
                    <p className="section-desc">
                      Conquistadas por bandas vistas e hinos ouvidos ao vivo.
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {unlockedBadges.length}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      /{BADGES_CATALOG.length}
                    </span>
                  </span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.round(
                        (unlockedBadges.length / BADGES_CATALOG.length) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="chips-row">
                <button
                  type="button"
                  className={`filter-chip ${badgeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setBadgeFilter('all')}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className={`filter-chip ${badgeFilter === 'unlocked' ? 'active' : ''}`}
                  onClick={() => setBadgeFilter('unlocked')}
                >
                  Conquistadas · {unlockedBadges.length}
                </button>
                <button
                  type="button"
                  className={`filter-chip ${badgeFilter === 'locked' ? 'active' : ''}`}
                  onClick={() => setBadgeFilter('locked')}
                >
                  Faltam · {BADGES_CATALOG.length - unlockedBadges.length}
                </button>
              </div>

              <div className="badges-grid">
                {BADGES_CATALOG.filter((b) => {
                  const isUnl = unlockedLookup.has(b.id);
                  if (badgeFilter === 'unlocked') return isUnl;
                  if (badgeFilter === 'locked') return !isUnl;
                  return true;
                }).map((badge) => {
                  const unlockedInfo = unlockedLookup.get(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`badge-card ${unlockedInfo ? 'unlocked' : 'locked'}`}
                    >
                      <div
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div className={`badge-medallion tier-${badge.tier}`}>
                          {unlockedInfo ? (
                            <BadgeIcon iconKey={badge.iconKey} size={19} />
                          ) : (
                            <Lock size={15} strokeWidth={1.7} />
                          )}
                        </div>
                        <span className="badge-tier-tag">
                          {TIER_LABELS[badge.tier] ?? badge.tier}
                        </span>
                      </div>

                      <div>
                        <h3 className="badge-title">{badge.title}</h3>
                        <p className="badge-desc" style={{ marginTop: 4 }}>
                          {unlockedInfo
                            ? badge.description
                            : badge.unlockRuleText}
                        </p>
                      </div>

                      {unlockedInfo && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--status-gold)',
                            marginTop: 'auto',
                            fontWeight: 500,
                          }}
                        >
                          {unlockedInfo.triggeredByLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ========================================== */}
          {/* TAB 5: PASSPORT                            */}
          {/* ========================================== */}
          {activeTab === 'passport' && (
            <>
              <div className="editorial-hero">
                <h2 className="editorial-title">
                  Passaporte <span className="editorial-serif-accent">musical</span>
                </h2>
              </div>

              <section className="credential-pass">
                <div className="credential-slot" />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'var(--brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '0.96rem',
                      color: '#ffffff',
                      flexShrink: 0,
                    }}
                  >
                    {profile.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.14rem',
                        fontWeight: 700,
                        letterSpacing: '-0.025em',
                      }}
                    >
                      {profile.displayName}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        color: 'var(--text-muted)',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {cloudUser.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Sair"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} strokeWidth={1.8} />
                  </button>
                </div>

                {profile.bio && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {profile.bio}
                  </p>
                )}

                <div className="stats-grid-4">
                  <div className="stat-tile">
                    <span className="stat-value">{stats.attendedCount}</span>
                    <span className="stat-label">Shows</span>
                  </div>
                  <div className="stat-tile">
                    <span className="stat-value">
                      {stats.uniqueArtistsCount}
                    </span>
                    <span className="stat-label">Artistas</span>
                  </div>
                  <div className="stat-tile">
                    <span className="stat-value">{stats.totalSongsHeard}</span>
                    <span className="stat-label">Faixas</span>
                  </div>
                  <div className="stat-tile">
                    <span className="stat-value">{stats.uniqueCitiesCount}</span>
                    <span className="stat-label">Cidades</span>
                  </div>
                </div>

                {stats.topArtist && (
                  <div
                    style={{
                      paddingTop: 14,
                      borderTop: '1px dashed var(--border-perforation)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Mais visto ao vivo
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {stats.topArtist.name} · {stats.topArtist.count}x
                    </span>
                  </div>
                )}

                {stats.anthemsHeard.length > 0 && (
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: '1px dashed var(--border-perforation)',
                    }}
                  >
                    <span
                      className="eyebrow-label"
                      style={{ display: 'block', marginBottom: 8 }}
                    >
                      Hinos ouvidos ao vivo ({stats.anthemsHeard.length})
                    </span>
                    <div className="chips-row">
                      {stats.anthemsHeard.map((anthem) => (
                        <span key={anthem} className="filter-chip">
                          {anthem}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}
              >
                <span className="eyebrow-label">
                  Ingressos guardados ({attendedHistory.length})
                </span>
              </div>

              {attendedYears.length > 0 && (
                <div className="chips-row">
                  <button
                    type="button"
                    className={`filter-chip ${passportYearFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setPassportYearFilter('all')}
                  >
                    Todos
                  </button>
                  {attendedYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      className={`filter-chip ${passportYearFilter === yr ? 'active' : ''}`}
                      onClick={() => setPassportYearFilter(yr)}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              )}

              {attendedHistory.length === 0 ? (
                <div className="empty-state">
                  <p style={{ margin: '0 0 16px' }}>
                    Seu passaporte ainda está em branco. Marque o primeiro show
                    que você viveu.
                  </p>
                  <button
                    type="button"
                    className="primary-pill-btn"
                    onClick={() => setActiveTab('explore')}
                  >
                    Explorar shows
                  </button>
                </div>
              ) : (
                <div className="shows-list">
                  {attendedHistory.map((rec) => {
                    const { day, month, year } = formatDateParts(
                      rec.show.eventDate
                    );
                    return (
                      <article
                        key={rec.showId}
                        className="ticket-card"
                        onClick={() => setActiveShowModal(rec.show)}
                      >
                        <div
                          className="ticket-spine"
                          style={{ background: 'var(--status-ok)' }}
                        />
                        <div className="ticket-stub">
                          <span className="date-day">{day}</span>
                          <span className="date-month-year">
                            {month} '{year.slice(2)}
                          </span>
                        </div>

                        <div className="ticket-body">
                          <div className="show-main">
                            <h4 className="show-artist">
                              {rec.show.artistName}
                            </h4>
                            <p className="show-venue-line">
                              {[rec.show.venueName, rec.show.cityName]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            <p className="show-sub-line">
                              {rec.heardSongs.length} faixas
                              {rec.favoriteSong ? ` · ${rec.favoriteSong}` : ''}
                              {rec.autoUpdatedFromGoing ? ' · Automático' : ''}
                            </p>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: 2,
                              flexShrink: 0,
                            }}
                          >
                            {Array.from({ length: rec.rating }).map((_, i) => (
                              <Star
                                key={i}
                                size={12}
                                strokeWidth={1.6}
                                color="var(--status-gold)"
                                fill="var(--status-gold)"
                              />
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>

        {/* Floating Pill Dock Navigation */}
        <div className="bottom-nav-wrap">
          <nav className="bottom-nav">
            <button
              type="button"
              className={`nav-tab ${activeTab === 'explore' ? 'active' : ''}`}
              onClick={() => setActiveTab('explore')}
            >
              <Compass
                size={19}
                strokeWidth={activeTab === 'explore' ? 2.2 : 1.7}
              />
              <span>Explorar</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <Calendar
                size={19}
                strokeWidth={activeTab === 'calendar' ? 2.2 : 1.7}
              />
              <span>Por Dia</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              <CalendarClock
                size={19}
                strokeWidth={activeTab === 'upcoming' ? 2.2 : 1.7}
              />
              {stats.goingCount > 0 && <span className="nav-badge-dot" />}
              <span>Agenda</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${activeTab === 'badges' ? 'active' : ''}`}
              onClick={() => setActiveTab('badges')}
            >
              <Award
                size={19}
                strokeWidth={activeTab === 'badges' ? 2.2 : 1.7}
              />
              <span>Insígnias</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${activeTab === 'passport' ? 'active' : ''}`}
              onClick={() => setActiveTab('passport')}
            >
              <User
                size={19}
                strokeWidth={activeTab === 'passport' ? 2.2 : 1.7}
              />
              <span>Perfil</span>
            </button>
          </nav>
        </div>

        {/* Modals */}
        {activeShowModal && (
          <ShowDetailModal
            show={activeShowModal}
            existingRecord={recordsMap.get(activeShowModal.id)}
            referenceDate={referenceDate}
            onClose={() => setActiveShowModal(null)}
            onSaveAttendance={handleSaveAttendance}
            onRemoveAttendance={handleRemoveAttendance}
          />
        )}

        {showAddCustomModal && (
          <AddCustomShowModal
            initialDate={activeTab === 'calendar' ? selectedDate : referenceDate}
            onClose={() => setShowAddCustomModal(false)}
            onCreateShow={handleCreateCustomShow}
          />
        )}

        {celebrationBadges.length > 0 && (
          <BadgeUnlockModal
            unlockedList={celebrationBadges}
            onClose={() => setCelebrationBadges([])}
          />
        )}

        {showSettingsModal && (
          <SettingsModal
            profile={profile}
            onClose={() => setShowSettingsModal(false)}
            onSaveProfile={handleSaveProfile}
            onResetData={handleResetAllData}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}
