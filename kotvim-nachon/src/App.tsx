import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useNav, useRoute } from './nav';
import { useStore } from './store';
import { watchUser } from './services/auth';
import { startSync, stopSync } from './services/sync';
import { setVoiceEnabled, stop } from './services/tts';
import { initAds } from './services/ads';
import { LoginScreen } from './screens/LoginScreen';
import { FamilyScreen } from './screens/FamilyScreen';
import { ParentGateScreen } from './screens/ParentGateScreen';
import { ParentsScreen } from './screens/ParentsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ChildHomeScreen } from './screens/ChildHomeScreen';
import { LearnScreen } from './screens/LearnScreen';
import { DiagnosticScreen } from './screens/DiagnosticScreen';
import { PracticeScreen, StageScreen } from './screens/StageScreen';
import { TrickScreen, TricksScreen } from './screens/TricksScreen';
import { WriteScreen } from './screens/WriteScreen';
import { RoomScreen } from './room/RoomScreen';

export default function App() {
  const route = useRoute();
  const stackLen = useNav((s) => s.stack.length);
  const voiceOn = useStore((s) => s.settings.voiceOn);

  useEffect(() => setVoiceEnabled(voiceOn), [voiceOn]);

  // start on the family page if the parent already chose a mode earlier
  useEffect(() => {
    if (useStore.getState().mode !== 'none') useNav.getState().reset({ name: 'family' });
    initAds();
  }, []);

  // cloud account: sign in → sync; sign out → back to login
  useEffect(
    () =>
      watchUser((u) => {
        const st = useStore.getState();
        if (u) {
          if (st.uid && st.uid !== u.uid) st.resetAll();
          useStore.getState().setMode('cloud', u.uid, u.email);
          startSync(u.uid);
          if (useNav.getState().stack[0].name === 'login') useNav.getState().reset({ name: 'family' });
        } else if (st.mode === 'cloud') {
          stopSync();
        }
      }),
    [],
  );

  // Android back button
  useEffect(() => {
    const h = CapApp.addListener('backButton', () => {
      stop();
      if (useNav.getState().stack.length > 1) useNav.getState().back();
      else CapApp.minimizeApp();
    });
    return () => {
      h.then((x) => x.remove());
    };
  }, []);

  useEffect(() => stop(), [stackLen]);

  switch (route.name) {
    case 'login':
      return <LoginScreen />;
    case 'family':
      return <FamilyScreen />;
    case 'parentGate':
      return <ParentGateScreen next={route.next} />;
    case 'parents':
      return <ParentsScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'privacy':
      return <PrivacyScreen />;
    case 'child':
      return <ChildHomeScreen />;
    case 'learn':
      return <LearnScreen />;
    case 'diagnostic':
      return <DiagnosticScreen />;
    case 'stage':
      return <StageScreen />;
    case 'trick':
      return <TrickScreen skill={route.skill} />;
    case 'tricks':
      return <TricksScreen />;
    case 'practice':
      return <PracticeScreen skill={route.skill} game={route.game} />;
    case 'write':
      return <WriteScreen />;
    case 'room':
      return <RoomScreen />;
  }
}
