// Sample only when entering a room, never during animation updates.
export function chooseGuestAppearance(id, random = Math.random) {
  return id === 'zhu' && random() >= .5 ? 'winter' : 'classic';
}
