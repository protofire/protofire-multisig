import type { ColorPalette } from './types'

/**
 * Unified dark mode color palette.
 * Merged from web and mobile palettes with mobile's extended colors as the base.
 */
const darkPalette: ColorPalette = {
  text: {
    primary: '#FFFFFF',
    secondary: '#636669',
    disabled: '#636669',
    contrast: '#000000',
  },
  primary: {
    dark: '#C9560A',
    main: '#FF8A2B',
    light: '#FFB067',
  },
  secondary: {
    dark: '#8B96A8',
    main: '#F2F4F7',
    light: '#2A3A55',
    background: '#1A1410',
  },
  border: {
    main: '#636669',
    light: '#303033',
    background: '#121312',
  },
  error: {
    dark: '#FFE0E6',
    main: '#FF5F72',
    light: '#4A2125',
    background: '#4A2125',
  },
  error1: {
    main: '#4A2125',
    contrastText: '#FFE0E6',
  },
  success: {
    dark: '#388E3C',
    main: '#00B460',
    light: '#81C784',
    background: '#1F2920',
  },
  info: {
    dark: '#D9F4FB',
    main: '#00BFE5',
    light: '#458898',
    background: '#203339',
  },
  warning: {
    dark: '#FFE4CB',
    main: '#FF8C00',
    light: '#A65F34',
    background: '#4A3621',
  },
  warning1: {
    main: '#4A3621',
    text: '#FFE4CB',
    contrastText: '#FF8C00',
  },
  background: {
    default: '#121312',
    main: '#121312',
    sheet: '#121312',
    paper: '#1C1C1C',
    light: '#1A1410',
    secondary: '#303033',
    skeleton: 'rgba(255, 255, 255, 0.04)',
    disabled: '#7878801F',
  },
  backdrop: {
    main: '#636669',
  },
  logo: {
    main: '#FFFFFF',
    background: '#303033',
  },
  static: {
    main: '#121312',
    light: '#636669',
    primary: '#FFFFFF',
    textSecondary: '#A1A3A7',
    textBrand: '#FF8A2B',
    welcomeGradientStart: '#F04A0F',
    welcomeGradientEnd: '#FBC21A',
    welcomeFg: '#000000',
    welcomeFgMuted: 'rgba(0, 0, 0, 0.65)',
  },
}

export default darkPalette
