// /public/js/modules/sound.js

import * as state from './state.js';
import { SOUND_DELAY } from './config.js';

function playAlertSound() {
    if (state.isSoundLooping && state.alertAudio) {
        state.alertAudio.play().catch(e => {
            // Autoplay was prevented, stop trying.
            if (e.name === 'NotAllowedError') {
                console.warn("Autoplay was prevented. User interaction is required to enable sound.");
                state.setSoundLooping(false);
            }
        });
    }
}

export function manageAlertSound(shouldPlay) {
    if (shouldPlay && !state.isMuted && state.soundUnlocked && !state.isSoundLooping) {
        state.setSoundLooping(true);
        playAlertSound();
    } else if ((!shouldPlay || state.isMuted) && state.isSoundLooping) {
        state.setSoundLooping(false);
        if (state.alertAudio) {
            state.alertAudio.pause();
            state.alertAudio.currentTime = 0;
        }
    }
}

export { playAlertSound };