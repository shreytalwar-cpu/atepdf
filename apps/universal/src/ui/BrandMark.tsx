import {useId} from 'react';
import Svg, {Defs, Mask, Path, Polygon, Rect} from 'react-native-svg';
import {useTheme} from './theme';

// A16 BrandMark: the approved Folio Eight (OD-1), built from docs/design/brand/mark-a-folio-eight.svg.
// Used in onboarding, About, the empty workspace and (16 pt, still) the toolbar's leading edge:
// the owner's SHR-106 polish review asked for more brand presence than DESIGN_SYSTEM 2.6 allowed.
export function BrandMark({size = 32, tone = 'iris', label}: {size?: 16 | 20 | 32 | 48 | 64; tone?: 'iris' | 'mono'; label?: string}) {
  const {c, scheme} = useTheme();
  const id = `folio${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // brand.iris on light, brand.irisLight on dark, or monochrome text.tertiary in UI chrome.
  const color = tone === 'mono' ? c.inkTertiary : scheme === 'dark' ? '#A79EFF' : '#5646F0';
  const fold = tone === 'mono' ? undefined : scheme === 'dark' ? '#E0DCFF' : '#A9A2FF';
  return <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={label} accessible={!!label} aria-hidden={!label}>
    <Defs>
      <Mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <Rect x="27" y="8" width="46" height="44" rx="13" fill="#fff"/>
        <Rect x="21" y="44" width="58" height="48" rx="16" fill="#fff"/>
        <Rect x="40" y="21" width="20" height="17" rx="6.5" fill="#000"/>
        <Rect x="37" y="57" width="26" height="22" rx="8" fill="#000"/>
        <Polygon points="58,4 80,4 80,26" fill="#000"/>
      </Mask>
    </Defs>
    <Rect width="100" height="100" fill={color} mask={`url(#${id})`}/>
    {/* Below 24 pt the fold tint is dropped and only the cut remains (DESIGN_SYSTEM 2.4). */}
    {fold && size >= 24 && <Path d="M61.5 8.5 L72.5 19.5 L64.5 19.5 Q61.5 19.5 61.5 16.5 Z" fill={fold}/>}
  </Svg>;
}
