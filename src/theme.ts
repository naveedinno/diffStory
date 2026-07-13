// The shared graphite review palette. Git truth stays neutral, blue is reserved
// for the current action, and diff semantics keep their familiar green/red.
export function sharedTokens(): string {
  return `
:root{--app-bg:#f1f3f6;--app-elev:#ffffff;--app-label:#17191e;--app-l2:#5e6470;--app-l3:#858c99;
  --app-hair:rgba(18,23,32,.13);--app-sep:rgba(18,23,32,.075);--app-fill:rgba(15,23,42,.055);--app-subbg:rgba(15,23,42,.028);
  --app-blue:#0866e5;--app-blue2:#0057ca;--app-add:#177a51;--app-del:#bd2a22;--app-addbar:#2b9a68;--app-delbar:#e14a43}
@media (prefers-color-scheme:dark){:root{--app-bg:#15171b;--app-elev:#22252b;--app-label:#f4f6f8;--app-l2:#b3b8c2;--app-l3:#858c98;
  --app-hair:rgba(255,255,255,.13);--app-sep:rgba(255,255,255,.075);--app-fill:rgba(255,255,255,.075);--app-subbg:rgba(255,255,255,.035);
  --app-blue:#4a9cff;--app-blue2:#72b2ff;--app-add:#48d597;--app-del:#ff756e;--app-addbar:#48d597;--app-delbar:#ff625b}}
`;
}
