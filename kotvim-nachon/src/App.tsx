import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useNav, useRoute } from './nav';
import { useStore } from './store';
import { watchUser } from './services/auth';
import { startSync, stopSync } from './services/sync';
import { hebrewVoiceAvailable, setVoiceEnabled, stop } from './services/tts';
import { setVisualOnly } from './engine/questions';
import { firebaseEnabled } from './services/firebase';
import { DeleteAccountScreen } from './screens/DeleteAccountScreen';
import { LoginScreen } from './screens/LoginScreen';
import { FamilyScreen } from './screens/FamilyScreen';
import { ParentGateScreen } from './screens/ParentGateScreen';
import { ParentsScreen } from './screens/ParentsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ChildHomeScreen } from './screens/ChildHomeScreen';
import { LearnScreen } from './screens/LearnScreen';
import { TeacherScreen } from './screens/TeacherScreen';
import { WeekWordsScreen } from './screens/WeekWordsScreen';
import { ArcadeScreen } from './arcade/ArcadeScreen';
import { TutorScreen } from './tutor/TutorScreen';
import { ArcadePlayScreen } from './arcade/ArcadePlayScreen';
import { DiagnosticScreen } from './screens/DiagnosticScreen';
import { PracticeScreen, StageScreen } from './screens/StageScreen';
import { TrickScreen, TricksScreen } from './screens/TricksScreen';
import { WriteScreen } from './screens/WriteScreen';
import { RoomScreen } from './room/RoomScreen';
import { GamesScreen } from './screens/GamesScreen';
import { ReviewScreen } from './screens/ReviewScreen';

export default function App() {
  const route = useRoute();
  const stackLen = useNav((s) => s.stack.length);
  const voiceOn = useStore((s) => s.settings.voiceOn);

  useEffect(() => setVoiceEnabled(voiceOn), [voiceOn]);

  // demo builds without Firebase keep data on the device; real builds require the parent's login
  useEffect(() => {
    const wantsDelete = window.location.hash === '#delete-account';
    if (!firebaseEnabled && useStore.getState().mode !== 'none') useNav.getState().reset({ name: 'family' });
    if (wantsDelete) useNav.getState().go({ name: 'deleteAccount' });
    hebrewVoiceAvailable().then((ok) => setVisualOnly(!ok));
  }, []);

  // parent account: sign in → sync and open the family page; sign out → back to login
  useEffect(
    () =>
      watchUser((u) => {
        const st = useStore.getState();
        const nav = useNav.getState();
        if (u) {
          // another parent signed in on this device: never mix families
          if (st.uid && st.uid !== u.uid) st.resetAll();
          useStore.getState().setMode('cloud', u.uid, u.email);
          startSync(u.uid);
          hebrewVoiceAvailable().then((ok) => setVisualOnly(!ok));
          if (nav.stack[0].name === 'login' && nav.stack[nav.stack.length - 1].name !== 'deleteAccount') nav.reset({ name: 'family' });
        } else if (firebaseEnabled) {
          stopSync();
          if (nav.stack[nav.stack.length - 1].name !== 'deleteAccount') nav.reset({ name: 'login' });
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
    case 'teacher':
      return <TeacherScreen />;
    case 'weekwords':
      return <WeekWordsScreen />;
    case 'arcade':
      return <ArcadeScreen />;
    case 'tutor':
      return <TutorScreen />;
    case 'arcadePlay':
      return <ArcadePlayScreen id={route.id} />;
    case 'diagnostic':
      return <DiagnosticScreen />;
    case 'stage':
      return <StageScreen />;
    case 'trick':
      return <TrickScreen skill={route.skill} />;
    case 'tricks':
      return <TricksScreen />;
    case 'practice':
      return <PracticeScreen skill={route.skill} game={route.game} level={route.level ?? 1} />;
    case 'games':
      return <GamesScreen />;
    case 'review':
      return <ReviewScreen />;
    case 'write':
      return <WriteScreen />;
    case 'room':
      return <RoomScreen />;
    case 'deleteAccount':
      return <DeleteAccountScreen />;
  }
}
