#!/usr/bin/env node
/**
 * Patches two upstream library bugs that prevent Arabic and Hindi PDF rendering:
 *
 * 1. @react-pdf/textkit – bidi reorderLine crashes on Arabic ligatures
 * 2. fontkit – getAnchor crashes on null GPOS mark anchor in Devanagari fonts
 *
 * Bug: getItemAtIndex crashes with "Cannot read properties of undefined (reading 'id')"
 * when Arabic text contains ligatures (e.g. "إليكم", "مهتماً") because the bidi
 * reordering indices are character-based but the glyph array is shorter after
 * ligature substitution — stringIndices[n] returns undefined for the extra codepoints
 * that collapsed into a single ligature glyph.
 *
 * Fix: guard against undefined in both getItemAtIndex and the reorderLine loop.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const textkitPath = path.join(__dirname, '../node_modules/@react-pdf/textkit/lib/textkit.js');

if (!fs.existsSync(textkitPath)) {
  console.log('[patch-textkit] File not found, skipping:', textkitPath);
  process.exit(0);
}

let src = fs.readFileSync(textkitPath, 'utf8');

// ── Patch 1: getItemAtIndex — return undefined for ligature-collapsed codepoints ──
const OLD_GET_ITEM = `const getItemAtIndex = (runs, objectName, index) => {
    for (let i = 0; i < runs.length; i += 1) {
        const run = runs[i];
        const updatedIndex = run.stringIndices[index - run.start];
        if (index >= run.start && index < run.end) {
            return run[objectName][updatedIndex];
        }
    }
    throw new Error(\`index \${index} out of range\`);
};`;

const NEW_GET_ITEM = `const getItemAtIndex = (runs, objectName, index) => {
    for (let i = 0; i < runs.length; i += 1) {
        const run = runs[i];
        if (index >= run.start && index < run.end) {
            const updatedIndex = run.stringIndices[index - run.start];
            // updatedIndex is undefined for Arabic ligatures where multiple
            // codepoints collapse into one glyph — return undefined so callers skip.
            if (updatedIndex === undefined) return undefined;
            return run[objectName][updatedIndex];
        }
    }
    throw new Error(\`index \${index} out of range\`);
};`;

// ── Patch 2: reorderLine loop — skip undefined glyphs ──
const OLD_LOOP = `        for (let i = 0; i < selectedIndices.length; i += 1) {
            const index = selectedIndices[i];
            const glyph = getItemAtIndex(line.runs, 'glyphs', index);
            if (addedGlyphs.has(glyph.id))
                continue;
            updatedGlyphs.push(glyph);
            updatedPositions.push(getItemAtIndex(line.runs, 'positions', index));
            if (glyph.isLigature) {
                addedGlyphs.add(glyph.id);
            }
        }`;

const NEW_LOOP = `        for (let i = 0; i < selectedIndices.length; i += 1) {
            const index = selectedIndices[i];
            const glyph = getItemAtIndex(line.runs, 'glyphs', index);
            // glyph is undefined when the codepoint was absorbed into an Arabic
            // ligature already added — skip it to avoid a crash on glyph.id.
            if (glyph === undefined) continue;
            if (addedGlyphs.has(glyph.id))
                continue;
            updatedGlyphs.push(glyph);
            const pos = getItemAtIndex(line.runs, 'positions', index);
            if (pos !== undefined) updatedPositions.push(pos);
            if (glyph.isLigature) {
                addedGlyphs.add(glyph.id);
            }
        }`;

let patched = false;

if (src.includes(OLD_GET_ITEM)) {
  src = src.replace(OLD_GET_ITEM, NEW_GET_ITEM);
  patched = true;
  console.log('[patch-textkit] Applied patch 1: getItemAtIndex ligature guard');
} else {
  console.log('[patch-textkit] Patch 1 already applied or source changed — skipping');
}

if (src.includes(OLD_LOOP)) {
  src = src.replace(OLD_LOOP, NEW_LOOP);
  patched = true;
  console.log('[patch-textkit] Applied patch 2: reorderLine undefined-glyph guard');
} else {
  console.log('[patch-textkit] Patch 2 already applied or source changed — skipping');
}

if (patched) {
  fs.writeFileSync(textkitPath, src, 'utf8');
  console.log('[patch-textkit] Done.');
} else {
  console.log('[patch-textkit] No changes needed.');
}

// ── Patch 3: fontkit getAnchor — null anchor guard (Hindi / Devanagari) ──────
// Must be applied to ALL three fontkit bundles:
//   module.mjs        – used by Node / server-side
//   browser-module.mjs – used by bundlers (Webpack/Turbopack) in browser builds
//   browser.cjs       – CJS browser fallback

const OLD_GET_ANCHOR = `    getAnchor(anchor) {
        // TODO: contour point, device tables
        let x = anchor.xCoordinate;
        let y = anchor.yCoordinate;`;

const NEW_GET_ANCHOR = `    getAnchor(anchor) {
        // Guard: anchor can be null for certain GPOS mark lookups in complex scripts
        // (e.g. NotoSansDevanagari mark-to-base). Return zero coords to skip safely.
        if (!anchor) return { x: 0, y: 0 };
        // TODO: contour point, device tables
        let x = anchor.xCoordinate;
        let y = anchor.yCoordinate;`;

const fontkitFiles = [
  '../node_modules/fontkit/dist/module.mjs',
  '../node_modules/fontkit/dist/browser-module.mjs',
  '../node_modules/fontkit/dist/browser.cjs',
];

for (const rel of fontkitFiles) {
  const fkPath = path.join(__dirname, rel);
  if (!fs.existsSync(fkPath)) {
    console.log('[patch-fontkit] Not found, skipping:', rel);
    continue;
  }
  let fkSrc = fs.readFileSync(fkPath, 'utf8');
  if (fkSrc.includes(OLD_GET_ANCHOR)) {
    fkSrc = fkSrc.replace(OLD_GET_ANCHOR, NEW_GET_ANCHOR);
    fs.writeFileSync(fkPath, fkSrc, 'utf8');
    console.log('[patch-fontkit] Patched:', rel);
  } else {
    console.log('[patch-fontkit] Already patched or changed:', rel);
  }
}
