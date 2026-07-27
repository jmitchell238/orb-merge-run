'use strict';

// Track helpers used by render + game

function sampleTrackHalf(z, levelData) {
  if (!levelData) return TRACK_HALF;
  return trackHalfAt(z, levelData.trackKeys);
}
