// The one Apple-HIG palette every page draws from. Emitted as --app-* custom
// properties (light defaults, dark override); each page aliases its legacy
// token names onto these so both screens read as one app.
export function sharedTokens(): string {
  return `
:root{--app-bg:#f5f5f7;--app-elev:#ffffff;--app-label:#1d1d1f;--app-l2:#6e6e73;--app-l3:#8e8e93;
  --app-hair:rgba(0,0,0,.1);--app-sep:rgba(0,0,0,.07);--app-fill:rgba(120,120,128,.12);--app-subbg:rgba(120,120,128,.06);
  --app-blue:#007aff;--app-blue2:#0067d6;--app-add:#1d7d3f;--app-del:#c4271f;--app-addbar:#34c759;--app-delbar:#ff453a}
@media (prefers-color-scheme:dark){:root{--app-bg:#1c1c1e;--app-elev:#2c2c2e;--app-label:#f5f5f7;--app-l2:#aeaeb2;--app-l3:#8e8e93;
  --app-hair:rgba(255,255,255,.12);--app-sep:rgba(255,255,255,.08);--app-fill:rgba(120,120,128,.24);--app-subbg:rgba(255,255,255,.035);
  --app-blue:#0a84ff;--app-blue2:#3395ff;--app-add:#30d158;--app-del:#ff6961;--app-addbar:#30d158;--app-delbar:#ff453a}}
`;
}
