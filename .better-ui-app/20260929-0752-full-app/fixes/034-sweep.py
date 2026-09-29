#!/usr/bin/env python3
"""Plan 034: physical -> logical properties. Fails loudly on count mismatch."""
import sys

CSS = "client/surfaces/review/review.css"

def convert_global(path, pairs):
    src = open(path).read()
    for old, new, expect in pairs:
        found = src.count(old)
        assert found == expect, f"{path} {old!r}: expected {expect}, found {found}"
        src = src.replace(old, new)
    open(path, "w").write(src)

def convert_lines(path, edits):
    lines = open(path).read().split("\n")
    for n, old, new, count in edits:
        i = n - 1
        found = lines[i].count(old)
        assert found == count, f"{path}:{n} {old!r}: expected {count}, found {found}"
        lines[i] = lines[i].replace(old, new)
    open(path, "w").write("\n".join(lines))

# --- review.css margins (global; physical keeps are absent from these strings) ---
# NOTE: margin-left:auto/right:auto handled line-wise below (keeps on 850/851/1305).
convert_global(CSS, [
    ("margin-left:6px", "margin-inline-start:6px", 2),
    ("margin-right:1px", "margin-inline-end:1px", 1),
    ("margin-right:8px", "margin-inline-end:8px", 2),
    ("margin-left:1px", "margin-inline-start:1px", 1),
    ("margin-left:5px", "margin-inline-start:5px", 1),
    ("margin-right:6px", "margin-inline-end:6px", 1),
    ("margin-left:14px", "margin-inline-start:14px", 1),
    ("margin-right:2px", "margin-inline-end:2px", 1),
    ("gap:2px;margin-left:2px;overflow-x:auto", "gap:2px;margin-inline-start:2px;overflow-x:auto", 1),
    ("padding-right:7px", "padding-inline-end:7px", 1),
    ("padding-left:18px", "padding-inline-start:18px", 1),
    ("padding-left:22px", "padding-inline-start:22px", 2),
    ("padding-left:2px", "padding-inline-start:2px", 1),
    ("padding-left:8px", "padding-inline-start:8px", 2),
    ("padding-right:8px", "padding-inline-end:8px", 2),
    ("padding-left:9px", "padding-inline-start:9px", 1),
    ("padding-right:9px", "padding-inline-end:9px", 1),
    ("padding-left:10px", "padding-inline-start:10px", 1),
    ("padding-right:5px", "padding-inline-end:5px", 1),
    ("padding-left:calc(5px + var(--tree-indent,0px))", "padding-inline-start:calc(5px + var(--tree-indent,0px))", 1),
    ("padding-left:11px", "padding-inline-start:11px", 1),
    ("padding-right:11px", "padding-inline-end:11px", 1),
    ("padding-left:7px", "padding-inline-start:7px", 1),
    ("border-left:2px solid var(--accent)", "border-inline-start:2px solid var(--accent)", 1),
    ("border-left:1px solid var(--line);", "border-inline-start:1px solid var(--line);", 1),
    ("border-right:1px solid var(--line)", "border-inline-end:1px solid var(--line)", 1),
    ("border-left:0}", "border-inline-start:0}", 1),
    ("border-left:3px solid var(--accent-blue)", "border-inline-start:3px solid var(--accent-blue)", 1),
    ("border-left:1px solid color-mix", "border-inline-start:1px solid color-mix", 1),
])

src = open(CSS).read()
n_align = src.count("text-align:left")
assert n_align > 0
src = src.replace("text-align:left", "text-align:start")
open(CSS, "w").write(src)
print("text-align:left converted:", n_align)

# --- review.css auto/zero margins: every line EXCEPT 850/851/1305 keeps ---
lines = open(CSS).read().split("\n")
n_auto = 0
for i, line in enumerate(lines):
    if (i + 1) in (850, 851, 1305):
        continue
    new = line.replace("margin-left:auto", "margin-inline-start:auto")
    new = new.replace("margin-right:auto", "margin-inline-end:auto")
    new = new.replace("margin-left:0", "margin-inline-start:0")
    new = new.replace("margin-right:0", "margin-inline-end:0")
    if new != line:
        n_auto += 1
        lines[i] = new
open(CSS, "w").write("\n".join(lines))
print("auto/zero lines converted:", n_auto)

# --- review.css offsets ---
convert_global(CSS, [
    ("left:0;right:0", "inset-inline-start:0;inset-inline-end:0", 2),
    (";left:0;", ";inset-inline-start:0;", 5),
    ("left:min(var(--ds-rail-width,240px),calc(100vw - 48px))", "inset-inline-start:min(var(--ds-rail-width,240px),calc(100vw - 48px))", 1),
    ("left:14px;right:14px", "inset-inline-start:14px;inset-inline-end:14px", 1),
    ("left:34px", "inset-inline-start:34px", 1),
    ("left:25px", "inset-inline-start:25px", 1),
    ("left:-6px;right:-6px", "inset-inline-start:-6px;inset-inline-end:-6px", 1),
    ("left:-12px;right:-12px", "inset-inline-start:-12px;inset-inline-end:-12px", 1),
    ("left:1px;right:1px", "inset-inline-start:1px;inset-inline-end:1px", 1),
    ("left:var(--ds-film-tooltip-x,50%)", "inset-inline-start:var(--ds-film-tooltip-x,50%)", 1),
    ("top:32px;right:10px", "top:32px;inset-inline-end:10px", 1),
    ("right:18px;left:18px", "inset-inline-end:18px;inset-inline-start:18px", 1),
    ("right:-2px", "inset-inline-end:-2px", 1),
    ("left:-13px", "inset-inline-start:-13px", 1),
    ("top:10px;right:10px", "top:10px;inset-inline-end:10px", 1),
    ("top:72px;right:16px", "top:72px;inset-inline-end:16px", 1),
    ("top:64px;right:8px", "top:64px;inset-inline-end:8px", 1),
])
convert_lines(CSS, [
    (188, ";right:0;", ";inset-inline-end:0;", 1),
    (205, ";right:0;", ";inset-inline-end:0;", 1),
    (699, ";right:0;", ";inset-inline-end:0;", 1),
    (642, "padding-right:10px", "padding-inline-end:10px", 1),
])

# --- shared.css ---
convert_global("client/shared/shared.css", [
    ("text-align: left;", "text-align: start;", 3),
    ("right: 12px;\n      left: 12px;", "inset-inline-end: 12px;\n      inset-inline-start: 12px;", 1),
])

# --- TSX utilities ---
import glob
TSX = [
    ("text-left", "text-start", 8),
    ("ml-auto", "ms-auto", 3),
    ("ml-0", "ms-0", 1),
    ("ml-1.5", "ms-1.5", 1),
    ("ml-3.5", "ms-3.5", 1),
    ("ml-[3px]", "ms-[3px]", 1),
    ("ml-[5px]", "ms-[5px]", 1),
    ("ml-[7px]", "ms-[7px]", 1),
    ("mr-2", "me-2", 1),
    ("pl-0", "ps-0", 1),
    ("pl-3.5", "ps-3.5", 1),
    ("pl-[22px]", "ps-[22px]", 1),
    ("pl-[25px]", "ps-[25px]", 1),
    ("pl-[35px]", "ps-[35px]", 1),
    ("pr-0", "pe-0", 1),
    ("pr-3.5", "pe-3.5", 1),
    ("pr-4", "pe-4", 1),
    ("pr-11", "pe-11", 1),
    ("pr-[34px]", "pe-[34px]", 1),
    ("pr-[54px]", "pe-[54px]", 1),
    ("left-0", "start-0", 1),
    ("left-[11px]", "start-[11px]", 1),
    ("right-1.5", "end-1.5", 1),
    ("right-3", "end-3", 1),
    ("right-[13px]", "end-[13px]", 1),
    ("right-[calc(18px+env(safe-area-inset-right))]", "end-[calc(18px+env(safe-area-inset-right))]", 1),
]
files = [f for f in glob.glob("client/surfaces/**/*.tsx", recursive=True)
         + glob.glob("client/shared/*.tsx") + glob.glob("client/entry/*.tsx")
         if "/vendor/" not in f]
for old, new, expect in TSX:
    total = 0
    for f in files:
        s = open(f).read()
        c = s.count(old)
        if c:
            # guard: never touch prose or vendor-prop contexts
            total += c
            open(f, "w").write(s.replace(old, new))
    if expect is None:
        print(f"{old}: converted {total} (no assertion)")
    else:
        assert total == expect, f"TSX {old}: expected {expect}, found {total}"
        print(f"{old}: {total} ok")

# bottom also handled: bottom-[calc(18px+env(safe-area-inset-bottom))] is physical-safe, keep.
print("ALL OK")
