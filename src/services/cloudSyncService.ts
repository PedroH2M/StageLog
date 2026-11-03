import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Unsubscribe,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type {
  CloudAuthUser,
  ShowAttendanceRecord,
  ShowEvent,
  UnlockedBadge,
  UserProfile,
} from '../types/models';
import { computeUserStats } from './badgeEngine';
import { getFirebaseServices } from './firebaseClient';

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const cloudSyncService = {
  subscribeAuth(
    callback: (user: CloudAuthUser | null) => void
  ): Unsubscribe | null {
    const { auth } = getFirebaseServices();
    if (!auth) {
      callback(null);
      return null;
    }

    return onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        callback(null);
      } else {
        callback({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
        });
      }
    });
  },

  async loginWithGoogle(): Promise<CloudAuthUser> {
    const { auth } = getFirebaseServices();
    if (!auth) throw new Error('Firebase ainda não está configurado.');

    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName,
      photoURL: cred.user.photoURL,
    };
  },

  async loginWithEmail(
    email: string,
    password: string
  ): Promise<CloudAuthUser> {
    const { auth } = getFirebaseServices();
    if (!auth) throw new Error('Firebase ainda não está configurado.');

    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName,
      photoURL: cred.user.photoURL,
    };
  },

  async registerWithEmail(
    displayName: string,
    email: string,
    password: string
  ): Promise<CloudAuthUser> {
    const { auth } = getFirebaseServices();
    if (!auth) throw new Error('Firebase ainda não está configurado.');

    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    return {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: displayName.trim() || cred.user.displayName,
      photoURL: cred.user.photoURL,
    };
  },

  async logout(): Promise<void> {
    const { auth } = getFirebaseServices();
    if (auth) {
      await signOut(auth);
    }
  },

  async sendPasswordReset(email: string): Promise<void> {
    const { auth } = getFirebaseServices();
    if (!auth) throw new Error('Firebase não inicializado.');
    await sendPasswordResetEmail(auth, email.trim());
  },

  /**
   * Hidrata os dados da nuvem no login e faz merge inteligente com os shows
   * marcados localmente (para o usuário nunca perder o que marcou offline).
   */
  async hydrateAndMergeUserCloudData(
    authUser: CloudAuthUser,
    localProfile: UserProfile,
    localRecords: ShowAttendanceRecord[],
    localBadges: UnlockedBadge[],
    localCustomShows: ShowEvent[]
  ): Promise<{
    profile: UserProfile;
    records: ShowAttendanceRecord[];
    badges: UnlockedBadge[];
    customShows: ShowEvent[];
  }> {
    const { db } = getFirebaseServices();
    if (!db) {
      return {
        profile: localProfile,
        records: localRecords,
        badges: localBadges,
        customShows: localCustomShows,
      };
    }

    const userRef = doc(db, 'users', authUser.uid);
    const [userSnap, showsSnap, badgesSnap, customSnap] = await Promise.all([
      getDoc(userRef),
      getDocs(collection(db, 'users', authUser.uid, 'attended_shows')),
      getDocs(collection(db, 'users', authUser.uid, 'user_badges')),
      getDocs(collection(db, 'users', authUser.uid, 'custom_shows')),
    ]);

    // Merge Shows Marcados (Nuvem + Local)
    const mergedRecordsMap = new Map<string, ShowAttendanceRecord>();
    for (const r of localRecords) {
      mergedRecordsMap.set(r.showId, r);
    }
    showsSnap.forEach((docSnap) => {
      const cloudRec = docSnap.data() as ShowAttendanceRecord;
      mergedRecordsMap.set(cloudRec.showId, cloudRec);
    });
    const mergedRecords = Array.from(mergedRecordsMap.values());

    // Merge Insígnias (Nuvem + Local)
    const mergedBadgesMap = new Map<string, UnlockedBadge>();
    for (const b of localBadges) {
      mergedBadgesMap.set(b.badgeId, b);
    }
    badgesSnap.forEach((docSnap) => {
      const cloudBadge = docSnap.data() as UnlockedBadge;
      mergedBadgesMap.set(cloudBadge.badgeId, cloudBadge);
    });
    const mergedBadges = Array.from(mergedBadgesMap.values());

    // Merge Shows Customizados
    const mergedCustomMap = new Map<string, ShowEvent>();
    for (const cs of localCustomShows) {
      mergedCustomMap.set(cs.id, cs);
    }
    customSnap.forEach((docSnap) => {
      const cloudCustom = docSnap.data() as ShowEvent;
      mergedCustomMap.set(cloudCustom.id, cloudCustom);
    });
    const mergedCustomShows = Array.from(mergedCustomMap.values());

    // Perfil Consolidado
    const cloudProfileData = userSnap.exists()
      ? (userSnap.data() as Partial<UserProfile>)
      : {};

    const mergedProfile: UserProfile = {
      ...localProfile,
      displayName:
        cloudProfileData.displayName ||
        authUser.displayName ||
        localProfile.displayName,
      handle:
        cloudProfileData.handle ||
        (authUser.email
          ? `@${authUser.email.split('@')[0]}`
          : localProfile.handle),
      bio: cloudProfileData.bio ?? localProfile.bio,
      photoUrl: authUser.photoURL || cloudProfileData.photoUrl,
      autoUpdateFutureShows:
        cloudProfileData.autoUpdateFutureShows ??
        localProfile.autoUpdateFutureShows,
    };

    // Grava o estado unificado no Firestore em Batch
    const stats = computeUserStats(mergedRecords);
    const batch = writeBatch(db);

    batch.set(
      userRef,
      stripUndefined({
        uid: authUser.uid,
        email: authUser.email,
        displayName: mergedProfile.displayName,
        handle: mergedProfile.handle,
        bio: mergedProfile.bio,
        photoUrl: mergedProfile.photoUrl,
        autoUpdateFutureShows: mergedProfile.autoUpdateFutureShows,
        totalShowsCount: stats.attendedCount,
        uniqueArtistsCount: stats.uniqueArtistsCount,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );

    for (const rec of mergedRecords) {
      const ref = doc(db, 'users', authUser.uid, 'attended_shows', rec.showId);
      batch.set(ref, stripUndefined(rec));
    }

    for (const b of mergedBadges) {
      const ref = doc(db, 'users', authUser.uid, 'user_badges', b.badgeId);
      batch.set(ref, stripUndefined(b));
    }

    for (const cs of mergedCustomShows) {
      const ref = doc(db, 'users', authUser.uid, 'custom_shows', cs.id);
      batch.set(ref, stripUndefined(cs));
    }

    await batch.commit();

    return {
      profile: mergedProfile,
      records: mergedRecords,
      badges: mergedBadges,
      customShows: mergedCustomShows,
    };
  },

  async syncAttendanceRecord(
    uid: string,
    record: ShowAttendanceRecord,
    allRecords: ShowAttendanceRecord[]
  ): Promise<void> {
    const { db } = getFirebaseServices();
    if (!db) return;

    const stats = computeUserStats(allRecords);
    const showRef = doc(
      db,
      'users',
      uid,
      'attended_shows',
      record.showId
    );
    const userRef = doc(db, 'users', uid);

    await Promise.all([
      setDoc(showRef, stripUndefined(record)),
      setDoc(
        userRef,
        {
          totalShowsCount: stats.attendedCount,
          uniqueArtistsCount: stats.uniqueArtistsCount,
          lastShowDate: serverTimestamp(),
        },
        { merge: true }
      ),
    ]);
  },

  async removeAttendanceRecord(
    uid: string,
    showId: string,
    remainingRecords: ShowAttendanceRecord[]
  ): Promise<void> {
    const { db } = getFirebaseServices();
    if (!db) return;

    const stats = computeUserStats(remainingRecords);
    await Promise.all([
      deleteDoc(doc(db, 'users', uid, 'attended_shows', showId)),
      setDoc(
        doc(db, 'users', uid),
        {
          totalShowsCount: stats.attendedCount,
          uniqueArtistsCount: stats.uniqueArtistsCount,
        },
        { merge: true }
      ),
    ]);
  },

  async syncBadges(uid: string, badges: UnlockedBadge[]): Promise<void> {
    const { db } = getFirebaseServices();
    if (!db || badges.length === 0) return;

    const batch = writeBatch(db);
    for (const b of badges) {
      const ref = doc(db, 'users', uid, 'user_badges', b.badgeId);
      batch.set(ref, stripUndefined(b));
    }
    await batch.commit();
  },

  async syncCustomShow(uid: string, show: ShowEvent): Promise<void> {
    const { db } = getFirebaseServices();
    if (!db) return;

    await setDoc(
      doc(db, 'users', uid, 'custom_shows', show.id),
      stripUndefined(show)
    );
  },

  async syncProfile(uid: string, profile: UserProfile): Promise<void> {
    const { db } = getFirebaseServices();
    if (!db) return;

    await setDoc(
      doc(db, 'users', uid),
      stripUndefined({
        displayName: profile.displayName,
        handle: profile.handle,
        bio: profile.bio,
        autoUpdateFutureShows: profile.autoUpdateFutureShows,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  },
};
