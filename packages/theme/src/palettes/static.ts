import type { StaticColors } from './types'

/**
 * Static colors that remain constant regardless of light/dark theme mode.
 * Used for consistent brand elements and specific UI components that should
 * not change appearance when theme switches.
 */
const staticColors: StaticColors = {
  main: '#121312',
  light: '#636669',
  primary: '#FFFFFF',
  textSecondary: '#A1A3A7',
  textBrand: '#F5730D',
  welcomeGradientStart: '#F04A0F',
  welcomeGradientEnd: '#FBC21A',
  welcomeFg: '#000000',
  welcomeFgMuted: 'rgba(0, 0, 0, 0.65)',
}

export default staticColors
