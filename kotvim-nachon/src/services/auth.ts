import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Firebase לא מוגדר');
  if (Capacitor.isNativePlatform()) {
    // Native Google account picker, then hand the token to the web SDK (skipNativeAuth mode)
    const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = res.credential?.idToken;
    if (!idToken) throw new Error('ההתחברות בוטלה');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } else {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }
}

export async function signInWithEmail(email: string, password: string, create: boolean): Promise<void> {
  if (!auth) throw new Error('Firebase לא מוגדר');
  if (create) await createUserWithEmailAndPassword(auth, email, password);
  else await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut(): Promise<void> {
  if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut().catch(() => undefined);
  if (auth) await fbSignOut(auth);
}

export function watchUser(cb: (u: User | null) => void): () => void {
  if (!auth) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, cb);
}

export function authErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'המייל או הסיסמה לא נכונים';
  if (code.includes('email-already-in-use')) return 'כבר יש חשבון עם המייל הזה – נסו "כניסה"';
  if (code.includes('weak-password')) return 'הסיסמה צריכה לפחות 6 תווים';
  if (code.includes('invalid-email')) return 'כתובת המייל לא תקינה';
  if (code.includes('network')) return 'אין חיבור לאינטרנט';
  return (e as Error)?.message || 'משהו השתבש, נסו שוב';
}
