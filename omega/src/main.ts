import './style.css';
import { Game } from './game';

// Entry point: a title screen (also unlocks audio on the first tap), then the game.
const host = document.getElementById('app')!;
const start = document.getElementById('start')!;

start.querySelector('button')!.addEventListener('click', () => {
  start.remove();
  const game = new Game(host);
  game.init();
  (window as unknown as { omega: Game }).omega = game;
  if (!game.input.touch) game.renderer.domElement.requestPointerLock?.();
});
