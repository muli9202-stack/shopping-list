import { Capacitor } from '@capacitor/core';
import { AdMob, MaxAdContentRating } from '@capacitor-community/admob';

/**
 * Ads follow Google Play's Families policy:
 *  - child-directed treatment + "G" rating + non-personalised ads only
 *  - shown only between stages, never during learning or writing
 *  - at most one interstitial every few minutes
 */
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';
const interstitialId = (import.meta.env.VITE_ADMOB_INTERSTITIAL_ID as string) || TEST_INTERSTITIAL;
const MIN_GAP_MS = 4 * 60 * 1000;

let ready = false;
let lastShown = Date.now();

export async function initAds(): Promise<void> {
  if (!Capacitor.isNativePlatform() || ready) return;
  try {
    await AdMob.initialize({
      initializeForTesting: interstitialId === TEST_INTERSTITIAL,
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
      maxAdContentRating: MaxAdContentRating.General,
    });
    ready = true;
  } catch (e) {
    console.warn('AdMob init failed', e);
  }
}

/** Call only at natural breaks (after finishing a stage). */
export async function maybeShowBreakAd(): Promise<void> {
  if (!ready || Date.now() - lastShown < MIN_GAP_MS) return;
  try {
    await AdMob.prepareInterstitial({ adId: interstitialId, npa: true, immersiveMode: true });
    await AdMob.showInterstitial();
    lastShown = Date.now();
  } catch (e) {
    console.warn('ad not shown', e);
  }
}
