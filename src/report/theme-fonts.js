// The theme with its fonts embedded (Plus Jakarta Sans, JetBrains Mono): the local web app's look.
import { FONT_FACES } from './fonts.js';
import { THEME_CSS } from './theme.js';

const fontFaces = FONT_FACES.map((f) => `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(data:font/woff2;base64,${f.data}) format("woff2")}`).join('\n');

export const NEXTGEN_CSS = `${fontFaces}\n${THEME_CSS}`;
