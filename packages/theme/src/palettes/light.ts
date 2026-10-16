import type { ColorPalette } from './types'

/**
 * Unified light mode color palette.
 * Merged from web and mobile palettes with mobile's extended colors as the base.
 */
const lightPalette: ColorPalette = {
  text: {
    primary: '#121312',
    secondary: '#A1A3A7',
    disabled: '#DDDEE0',
    contrast: '#FFFFFF',
  },
  primary: {
    dark: '#0A1428',
    main: '#0F1E3C',
    light: '#2A3A55',
  },
  secondary: {
    dark: '#C9560A',
    main: '#F5730D',
    light: '#FFA24D',
    background: '#FFF4EB',
  },
  border: {
    main: '#A1A3A7',
    light: '#DCDEE0',
    background: '#F4F4F4',
  },
  error: {
    dark: '#8A1C27',
    main: '#FF5F72',
    light: '#F79BA7',
    background: '#FFE0E6',
  },
  error1: {
    main: '#FFE0E6',
    contrastText: '#8A1C27',
  },
  success: {
    dark: '#028D4C',
    main: '#00B460',
    light: '#D3F2E4',
    background: '#EFFAF1',
  },
  info: {
    dark: '#15566A',
    main: '#00BFE5',
    light: '#78D2E7',
    background: '#CEF0FD',
  },
  warning: {
    dark: '#6C2D19',
    main: '#FF8C00',
    light: '#F9B37C',
    background: '#FFECC2',
  },
  warning1: {
    main: '#FFECC2',
    text: '#6C2D19',
    contrastText: '#FF8C00',
  },
  background: {
    default: '#FFFFFF',
    main: '#F4F4F4',
    sheet: '#F4F4F4',
    paper: '#FFFFFF',
    light: '#FFF4EB',
    secondary: '#DDDEE0',
    skeleton: 'rgba(0, 0, 0, 0.04)',
    disabled: '#7878801F',
  },
  backdrop: {
    main: '#636669',
  },
  logo: {
    main: '#121312',
    background: '#EEEFF0',
  },
  static: {
    main: '#121312',
    light: '#636669',
    primary: '#FFFFFF',
    textSecondary: '#A1A3A7',
    textBrand: '#F5730D',
    welcomeGradientStart: '#F04A0F',
    welcomeGradientEnd: '#FBC21A',
    welcomeFg: '#000000',
    welcomeFgMuted: 'rgba(0, 0, 0, 0.65)',
  },
}

export default lightPalette
