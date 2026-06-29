// Font catalog shared by the picker and the canvas loader.
// `stack` is what canvas/CSS uses; `google` families are pulled from Google Fonts.
export const FONTS = [
  { name: 'Helvetica Neue', stack: '"Helvetica Neue", Arial, sans-serif' },
  { name: 'Arial', stack: 'Arial, sans-serif' },
  { name: 'Georgia', stack: 'Georgia, serif' },
  { name: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { name: 'Courier New', stack: '"Courier New", monospace' },
  { name: 'Impact', stack: 'Impact, "Arial Narrow Bold", sans-serif' },
  { name: 'Anton', stack: '"Anton", sans-serif', google: true },
  { name: 'Bebas Neue', stack: '"Bebas Neue", sans-serif', google: true },
  { name: 'Archivo Black', stack: '"Archivo Black", sans-serif', google: true },
  { name: 'Oswald', stack: '"Oswald", sans-serif', google: true },
  { name: 'Montserrat', stack: '"Montserrat", sans-serif', google: true },
  { name: 'Inter', stack: '"Inter", sans-serif', google: true },
  { name: 'Poppins', stack: '"Poppins", sans-serif', google: true },
  { name: 'Playfair Display', stack: '"Playfair Display", serif', google: true },
]

export const WEIGHTS = [
  { v: 300, label: 'Light 300' },
  { v: 400, label: 'Regular 400' },
  { v: 500, label: 'Medium 500' },
  { v: 600, label: 'SemiBold 600' },
  { v: 700, label: 'Bold 700' },
  { v: 800, label: 'ExtraBold 800' },
  { v: 900, label: 'Black 900' },
]

export const DEFAULT_FONT = 'Helvetica Neue'

export function fontStack(name) {
  return (FONTS.find((f) => f.name === name) || FONTS[0]).stack
}

// Ensure the glyphs for a given family/weight/style are loaded before canvas draws,
// otherwise the first paint falls back to a system font.
export async function ensureFont(name, weight, italic) {
  const stack = fontStack(name)
  const spec = `${italic ? 'italic ' : ''}${weight} 100px ${stack}`
  try {
    await document.fonts.load(spec)
    await document.fonts.ready
  } catch {
    /* faux fallback is fine */
  }
}
