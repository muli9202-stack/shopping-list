import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';

/** Which way the signed-in parent logged in. */
export function signInMethod(): 'password' | 'google' | null {
  const u = auth?.currentUser;
  if (!u) return null;
  return u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password';
}

export function currentEmail(): string | null {
  return auth?.currentUser?.email ?? null;
}

/** Ask the parent to prove it is them again (used for PIN reset and account deletion). */
export async function reauthenticate(password?: string): Promise<void> {
  const u = auth?.currentUser;
  if (!u) throw new Error('לא מחוברים לחשבון');
  if (signInMethod() === 'google') {
    if (Capacitor.isNativePlatform()) {
      const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      const idToken = res.credential?.idToken;
      if (!idToken) throw new Error('האימות בוטל');
      await reauthenticateWithCredential(u, GoogleAuthProvider.credential(idToken));
    } else await reauthenticateWithPopup(u, new GoogleAuthProvider());
    return;
  }
  if (!password) throw new Error('צריך להקליד את הסיסמה');
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email ?? '', password));
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase לא מוגדר');
  await sendPasswordResetEmail(auth, email);
}

/**
 * Delete the parent's account and all family data (Google Play account-deletion requirement).
 * Call reauthenticate() first – Firebase requires a recent login to delete a user.
 */
export async function deleteAccountAndData(): Promise<void> {
  const u = auth?.currentUser;
  if (!u || !db) throw new Error('לא מחוברים לחשבון');
  const fam = doc(db, 'families', u.uid);
  const kids = await getDocs(collection(fam, 'children'));
  await Promise.all(kids.docs.map((d) => deleteDoc(d.ref)));
  const tomb = await getDocs(collection(fam, 'deleted'));
  await Promise.all(tomb.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(fam);
  await deleteUser(u);
  if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut().catch(() => undefined);
}
