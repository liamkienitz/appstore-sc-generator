// Master design canvas. Tallest/narrowest Apple ratio so cover-crop never starves other targets.
export const MASTER = { w: 1320, h: 2868 }

// Safe zone: keep all text + key content inside this fraction of the master width/height,
// so cover-cropping to wider/narrower targets never clips the message.
export const SAFE = { x: 0.11, y: 0.05, w: 0.78, h: 0.9 }

// Every accepted output target. `group` drives the zip folder layout.
export const TARGETS = [
  // iOS iPhone (App Store Connect accepted portrait sizes)
  { id: 'ios-iphone-6.9', group: 'ios/iphone', label: 'iPhone 6.9"', w: 1320, h: 2868, required: true },
  { id: 'ios-iphone-6.7', group: 'ios/iphone', label: 'iPhone 6.7"', w: 1290, h: 2796 },
  { id: 'ios-iphone-6.5', group: 'ios/iphone', label: 'iPhone 6.5"', w: 1242, h: 2688 },
  { id: 'ios-iphone-6.3', group: 'ios/iphone', label: 'iPhone 6.3"', w: 1206, h: 2622 },
  { id: 'ios-iphone-6.1', group: 'ios/iphone', label: 'iPhone 6.1"', w: 1170, h: 2532 },

  // iOS iPad
  { id: 'ios-ipad-13', group: 'ios/ipad', label: 'iPad 13"', w: 2064, h: 2752 },
  { id: 'ios-ipad-12.9', group: 'ios/ipad', label: 'iPad 12.9"', w: 2048, h: 2732 },
  { id: 'ios-ipad-11', group: 'ios/ipad', label: 'iPad 11"', w: 1668, h: 2388 },

  // Android (Google Play)
  { id: 'android-phone', group: 'android', label: 'Android phone', w: 1080, h: 1920, required: true },
  { id: 'android-tablet-7', group: 'android', label: 'Android 7" tablet', w: 1206, h: 2144 },
  { id: 'android-tablet-10', group: 'android', label: 'Android 10" tablet', w: 1449, h: 2576 },
]

// Default selection when the user hasn't picked anything.
export const DEFAULT_TARGET_IDS = ['ios-iphone-6.9', 'ios-iphone-6.5', 'android-phone']

// Each target belongs to an aspect family. We render one master per family at
// these dimensions (matching each family's aspect ratio), so the composition is
// laid out for that shape rather than cropped from a single mismatched master.
export const RENDER_GROUPS = {
  iphone: { w: 1320, h: 2868 }, // ~0.460
  ipad: { w: 2064, h: 2752 }, //   ~0.750
  android: { w: 1080, h: 1920 }, // 0.5625 (9:16)
}

export function groupFor(targetId) {
  if (targetId.startsWith('ios-ipad')) return 'ipad'
  if (targetId.startsWith('android')) return 'android'
  return 'iphone'
}

export function renderDimsFor(targetId) {
  return RENDER_GROUPS[groupFor(targetId)]
}
