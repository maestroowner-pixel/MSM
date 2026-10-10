// While a finger is writing on a signature pad, a sideways stroke must not be
// taken for "swipe to the next screen". The pad holds this; the swipe checks it.
export const swipeLock = { held: false };
