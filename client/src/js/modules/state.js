// /public/js/modules/state.js

export const lineCharts = {};
export let alertAudio = null;
export let isSoundLooping = false;
export let isMuted = true;
export let soundUnlocked = false;

// Functions to mutate state
export function setAlertAudio(element) { alertAudio = element; }
export function setSoundLooping(value) { isSoundLooping = value; }
export function setMuted(value) { isMuted = value; }
export function setSoundUnlocked(value) { soundUnlocked = value; }