'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CV Export Consistency Audit Report
// Generated: 2026-05-04
//
// PURPOSE:
//   This page documents the full export consistency audit for every CV template.
//   For each template it records:
//     • DOCX status (pass / partial / fail) with exact mismatch details
//     • PDF status (always mirrors the preview, so PDF-specific notes are listed)
//     • Root cause of each mismatch
//     • Recommended fix
//
// HOW TO USE:
//   Visit /audit in the dev server to read this report in browser.
//   The report data is also embedded as code comments below for version control.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';

// ─── Audit data ───────────────────────────────────────────────────────────────

type Status = 'PASS' | 'PARTIAL' | 'FAIL' | 'N/A';

interface Mismatch {
  item: string;
  preview: string;
  docx: string;
  pdf: string;
  cause: string;
  fix: string;
  severity: 'critical' | 'medium' | 'low' | 'info';
}

interface TemplateAudit {
  id: string;
  name: string;
  layout: string;
  docxStatus: Status;
  pdfStatus: Status;
  mismatches: Mismatch[];
  notes: string;
}

const AUDIT: TemplateAudit[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. MODERN MINIMAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'modern-minimal',
    name: 'Modern Minimal',
    layout: 'single (photo top-right)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Overall structure matches. Minor rendering differences are inherent to DOCX format (no CSS grid, no tag-style skill chips).',
    mismatches: [
      {
        item: 'Skills display',
        preview: 'Indigo chip badges (rounded bg-indigo-50 px-2 py-0.5)',
        docx: 'Plain bullet-separated text: "Skill1  •  Skill2"',
        pdf: 'PASS — captures chips exactly via html2canvas',
        cause: 'DOCX has no concept of CSS badge/chip styling. docx library only supports paragraphs and tables.',
        fix: 'Acceptable limitation. For closer match, could render each skill as a bordered table cell. Low ROI.',
        severity: 'low',
      },
      {
        item: 'Skills / Languages 2-column layout',
        preview: 'grid grid-cols-2 gap-6 — skills left, languages right',
        docx: 'Skills section then Languages section stacked vertically (single column)',
        pdf: 'PASS',
        cause: 'DOCX single-column layout cannot render CSS grid. A 2-column table would be needed.',
        fix: 'Could wrap skills + languages in a 2-column borderless table. Medium effort.',
        severity: 'medium',
      },
      {
        item: 'Section heading border',
        preview: 'border-b-2 border-indigo-600 on the header; text-xs font-bold uppercase tracking-wider text-indigo-600 on section headings with no border',
        docx: 'Section heading has bottom SINGLE border in indigo color (4F46E5)',
        pdf: 'PASS',
        cause: 'HTML uses no bottom border on section headings (just colored uppercase text). DOCX adds a bottom border for visual separation.',
        fix: 'Remove the bottom border from sectionHeading() for this template OR use headingBorder: FFFFFF (invisible). Consider per-template border control.',
        severity: 'medium',
      },
      {
        item: 'Header accent border',
        preview: 'border-b-2 border-indigo-600 below the entire header block',
        docx: 'A thin gray divider() is used (CCCCCC) — different color and weight',
        pdf: 'PASS',
        cause: 'divider() function is hardcoded to CCCCCC. The template uses indigo (4F46E5).',
        fix: 'Make divider color configurable via cfg.headingBorder for single-layout templates.',
        severity: 'medium',
      },
      {
        item: 'Font rendering',
        preview: 'System sans-serif (Inter/Geist via Tailwind font-sans)',
        docx: 'Calibri',
        pdf: 'NotoSans (injected for html2canvas)',
        cause: 'DOCX cannot use web fonts. Calibri is the closest standard Word font to Inter.',
        fix: 'Acceptable — Calibri is the industry standard for professional CVs. Cannot be fixed without embedding fonts in DOCX.',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CLEAN SIMPLE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'clean-simple',
    name: 'Clean Simple',
    layout: 'single (small square photo left of name)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Photo placement differs between preview and DOCX. Preview places photo LEFT of name inline; DOCX places it to the RIGHT.',
    mismatches: [
      {
        item: 'Photo position',
        preview: 'Photo is LEFT of name (flex items-center gap-3, photo first child)',
        docx: 'Photo is RIGHT of name (table: 80% info col | 20% photo col, photo right-aligned)',
        pdf: 'PASS',
        cause: 'DOCX single layout uses a 2-column table with photo on the right for all single-layout templates. No per-template photo-side config exists.',
        fix: 'Add photoSide: "left" | "right" field to DocxTemplateConfig and swap column order for clean-simple.',
        severity: 'critical',
      },
      {
        item: 'Accent color',
        preview: 'text-emerald-600 (#10B981) for job title and section headings',
        docx: 'accent: 059669 (#059669) — slightly darker emerald',
        pdf: 'PASS',
        cause: 'Tailwind emerald-600 = #059669. Config was previously #2563EB (wrong blue) and was fixed. Now matches.',
        fix: 'RESOLVED in previous session — accent now 059669 which is the correct emerald-600.',
        severity: 'info',
      },
      {
        item: 'Section heading style',
        preview: 'font-bold text-emerald-600 — NO border, NO uppercase tracking',
        docx: 'UPPERCASE + bottom border in emerald color',
        pdf: 'PASS',
        cause: 'sectionHeading() always applies .toUpperCase() and a bottom border. HTML for clean-simple just uses font-bold text-emerald-600.',
        fix: 'Add showBorder and uppercase flags to DocxTemplateConfig and disable for clean-simple.',
        severity: 'medium',
      },
      {
        item: 'Experience format',
        preview: '"Position at Company" in single bold line, date on right',
        docx: 'Position bold + " — Company" on same line, date on separate line below',
        pdf: 'PASS',
        cause: 'HTML uses a single compound line. DOCX splits position/company the same way as other templates.',
        fix: 'For clean-simple, build the experience paragraph as "Position at Company" (no em-dash separator).',
        severity: 'medium',
      },
      {
        item: 'HR divider after header',
        preview: '<hr className="border-gray-200 mb-6" /> — a thin gray line',
        docx: 'divider() uses CCCCCC — close match',
        pdf: 'PASS',
        cause: 'Minor: HTML uses border-gray-200 (#E5E7EB), DOCX uses CCCCCC (#CCCCCC). Very similar.',
        fix: 'Update divider color to E5E7EB for exact match.',
        severity: 'low',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PROFESSIONAL CLASSIC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'professional-classic',
    name: 'Professional Classic',
    layout: 'dark-header (slate-800 bg, photo left of name)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Dark header renders correctly. Photo placement matches (left side in HTML, but DOCX puts it right — same issue as clean-simple).',
    mismatches: [
      {
        item: 'Photo position in header',
        preview: 'Photo LEFT of name (flex items-center gap-4)',
        docx: 'Photo RIGHT of name (DOCX dark-header puts 85% info | 15% photo)',
        pdf: 'PASS',
        cause: 'All dark-header layouts put photo on the right. HTML has it on the left for professional-classic.',
        fix: 'Add photoSide config option and render info/photo cells in correct order.',
        severity: 'critical',
      },
      {
        item: 'Section heading style',
        preview: 'font-bold text-slate-800 border-b border-slate-200 pb-1 — NO uppercase',
        docx: 'UPPERCASE bold with bottom border in 1E293B (dark slate)',
        pdf: 'PASS',
        cause: 'sectionHeading() always uppercases. HTML for professional-classic uses mixed-case bold.',
        fix: 'Add uppercase: boolean to DocxTemplateConfig; set false for professional-classic.',
        severity: 'medium',
      },
      {
        item: 'Skills layout',
        preview: 'grid grid-cols-2: skills (chip badges) + languages (right column)',
        docx: 'Skills bullet-separated, languages stacked below skills',
        pdf: 'PASS',
        cause: 'Same as modern-minimal: DOCX cannot render CSS grid. Chips not possible.',
        fix: 'Use a 2-column table for skills + languages section.',
        severity: 'medium',
      },
      {
        item: 'Header bg color',
        preview: 'bg-slate-800 = #1E293B',
        docx: 'headerBg: 1E293B ✓',
        pdf: 'PASS',
        cause: 'RESOLVED — colors match.',
        fix: 'No action needed.',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ELEGANT FORMAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'elegant-formal',
    name: 'Elegant Formal',
    layout: 'single (portrait photo left of name, centered text)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'This is a centered serif layout. DOCX uses Times New Roman to match font-serif. Photo placement reversed.',
    mismatches: [
      {
        item: 'Photo position',
        preview: 'Photo LEFT of name, header content centered in remaining space',
        docx: 'Photo RIGHT of name (same issue as clean-simple and professional-classic)',
        pdf: 'PASS',
        cause: 'No per-template photoSide config. All single layouts default to photo-right.',
        fix: 'Add photoSide: "left" option to DocxTemplateConfig.',
        severity: 'critical',
      },
      {
        item: 'Header text alignment',
        preview: 'text-center — name, title, contacts are all centered',
        docx: 'Left-aligned (standard paragraph alignment)',
        pdf: 'PASS',
        cause: 'No per-template header alignment option. appendContentSections uses centeredEdu but header paragraphs are always left.',
        fix: 'Add headerAlignment: "center" | "left" to DocxTemplateConfig and apply to all header paragraphs.',
        severity: 'critical',
      },
      {
        item: 'Font',
        preview: 'font-serif (Georgia/Times via browser)',
        docx: 'Times New Roman ✓',
        pdf: 'NotoSans (overridden for unicode) — visual difference for serif lovers',
        cause: 'PDF export overrides font-family with NotoSans for unicode support. Can look different from preview for Latin-only content.',
        fix: 'For PDF, conditionally skip NotoSans injection for Latin-only locales to preserve the serif look.',
        severity: 'medium',
      },
      {
        item: 'Section headings',
        preview: 'text-xs font-semibold uppercase tracking-[0.2em] text-amber-700, text-center, border-b border-gray-200 below each heading',
        docx: 'UPPERCASE bold, bottom border in 374151 (dark gray) — amber color missing',
        pdf: 'PASS',
        cause: 'headingColor set to 374151 (dark gray) not amber. Should be D97706 (amber-600) or similar.',
        fix: 'Change headingColor to D97706 (or B45309 for amber-700) for elegant-formal.',
        severity: 'critical',
      },
      {
        item: 'Education/Skills/Languages 3-column grid',
        preview: 'grid grid-cols-3 gap-6 text-center — all three sections side by side',
        docx: 'Skills then Languages then Certifications stacked vertically',
        pdf: 'PASS',
        cause: 'DOCX cannot render CSS 3-column grid natively. Would require a borderless 3-cell table.',
        fix: 'Build a 3-column table for the bottom section (Skills | Languages | Certifications).',
        severity: 'medium',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CREATIVE BOLD
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'creative-bold',
    name: 'Creative Bold',
    layout: 'sidebar-left (rose/pink sidebar 33%, circular photo)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Sidebar layout renders correctly. Gradient not reproducible in DOCX — flat bg used instead.',
    mismatches: [
      {
        item: 'Sidebar background gradient',
        preview: 'bg-gradient-to-b from-rose-600 to-pink-700 — vertical gradient',
        docx: 'Solid fill headerBg: BE123C (rose-700, flat)',
        pdf: 'PASS',
        cause: 'DOCX ShadingType.SOLID does not support gradients.',
        fix: 'Cannot be fully fixed in DOCX format. Use the dominant (darker) gradient color BE123C. Acceptable.',
        severity: 'info',
      },
      {
        item: 'Experience items style',
        preview: 'border-l-2 border-rose-200 pl-3 — left border accent on each experience block',
        docx: 'No left-border per experience item',
        pdf: 'PASS',
        cause: 'DOCX paragraphs support left borders but they were not added in the mainChildren loop.',
        fix: 'Add border: { left: { style: BorderStyle.SINGLE, size: 12, color: FECDD3 } } to each experience paragraph.',
        severity: 'low',
      },
      {
        item: 'Sidebar skills',
        preview: 'rounded bg-white/10 px-2 py-1 — white translucent chip on dark bg',
        docx: 'Plain text lines',
        pdf: 'PASS',
        cause: 'No chip styling possible in DOCX sidebar cells.',
        fix: 'Cannot precisely replicate. Acceptable limitation.',
        severity: 'info',
      },
      {
        item: 'Photo shape',
        preview: 'rounded-full (circle) with border-2 border-white/50',
        docx: 'circularCropDataUrl → PNG with transparent corners ✓',
        pdf: 'PASS',
        cause: 'RESOLVED in previous session — photoShape changed to "circle".',
        fix: 'No action needed.',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CREATIVE ARTISTIC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'creative-artistic',
    name: 'Creative Artistic',
    layout: 'dark-header (violet-fuchsia gradient, circular photo)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Header gradient not reproducible in DOCX. Everything else maps well.',
    mismatches: [
      {
        item: 'Header gradient',
        preview: 'bg-gradient-to-r from-violet-600 to-fuchsia-600',
        docx: 'Solid fill headerBg: 7C3AED (violet-600, left color only)',
        pdf: 'PASS',
        cause: 'DOCX ShadingType does not support gradients.',
        fix: 'Cannot be fixed. Using left-gradient color is the best available option.',
        severity: 'info',
      },
      {
        item: 'Photo circular border',
        preview: 'border-2 border-white/40 around circular photo',
        docx: 'Circular crop applied ✓, no visible border in DOCX',
        pdf: 'PASS',
        cause: 'PNG has transparent background — DOCX renders photo without a border ring.',
        fix: 'Could draw a white circle border on the canvas before clipping. Low priority.',
        severity: 'low',
      },
      {
        item: 'Section headings',
        preview: 'text-violet-600 font-bold — NO border, NOT uppercase, mixed case',
        docx: 'UPPERCASE + bottom border in 7C3AED',
        pdf: 'PASS',
        cause: 'sectionHeading() always uppercases and adds border. HTML for creative-artistic uses plain bold.',
        fix: 'Add uppercase: false and showBorder: false to DocxTemplateConfig for this template.',
        severity: 'medium',
      },
      {
        item: 'Skill chips (round)',
        preview: 'rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700',
        docx: 'Bullet-separated plain text',
        pdf: 'PASS',
        cause: 'CSS chip styling not available in DOCX.',
        fix: 'Acceptable limitation.',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. EXECUTIVE PREMIUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'executive-premium',
    name: 'Executive Premium',
    layout: 'centered-dark-header (gray-900 bg, portrait photo, amber accents)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Centered layout maps well. Amber divider line below name not reproduced in DOCX.',
    mismatches: [
      {
        item: 'Amber divider line below name',
        preview: 'h-px w-16 bg-amber-500 mx-auto — a short amber horizontal line between name and title',
        docx: 'Not present',
        pdf: 'PASS',
        cause: 'The amber decorative separator is a pure CSS element. DOCX would need a short border-bottom on a blank paragraph.',
        fix: 'Add a short centered paragraph with a bottom border in amber (D97706) after the name paragraph.',
        severity: 'medium',
      },
      {
        item: 'Experience company format',
        preview: 'text-amber-700 text-xs for company name',
        docx: 'accentCompany=true → " | Company" appended in amber (D97706 cfg.accent)',
        pdf: 'PASS',
        cause: 'RESOLVED — accentCompany flag is passed to appendContentSections for this layout.',
        fix: 'No action needed.',
        severity: 'info',
      },
      {
        item: 'Summary italic',
        preview: 'text-gray-700 italic leading-relaxed text-center',
        docx: 'italicSummary=true ✓, centeredEdu=true (centers all content) ✓',
        pdf: 'PASS',
        cause: 'RESOLVED.',
        fix: 'No action needed.',
        severity: 'info',
      },
      {
        item: 'Section headings',
        preview: 'text-center text-xs font-bold tracking-[0.3em] text-gray-400 — NOT uppercase in code, but text-gray-400',
        docx: 'UPPERCASE, headingColor: 6B7280 (gray-500). Gray-400 = 9CA3AF but 6B7280 = gray-500, close enough.',
        pdf: 'PASS',
        cause: 'Minor color difference: gray-400 (#9CA3AF) vs config value 6B7280 (#6B7280, gray-500).',
        fix: 'Change headingColor to 9CA3AF for executive-premium for exact match.',
        severity: 'low',
      },
      {
        item: 'Bottom skills/languages/certs 3-column grid',
        preview: 'grid grid-cols-3 gap-6 text-center at the bottom',
        docx: 'Stacked vertically (skills, then languages, then certs)',
        pdf: 'PASS',
        cause: 'DOCX cannot render CSS 3-column grid.',
        fix: 'Use a 3-column borderless table at the bottom.',
        severity: 'medium',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. NORDIC CLEAN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'nordic-clean',
    name: 'Nordic Clean',
    layout: 'single (photo top-right, teal accents)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Teal accents match. Experience grid layout (date on right, role on left) differs.',
    mismatches: [
      {
        item: 'Experience grid layout',
        preview: 'grid grid-cols-[1fr_auto] gap-4 — role/company left, date right on same row',
        docx: 'Date on a separate line below position/company',
        pdf: 'PASS',
        cause: 'DOCX paragraphs flow top-to-bottom. Inline right-alignment of date next to role requires a 2-cell table per experience entry.',
        fix: 'Render each experience entry as a 2-cell table: [role+company] | [date right-aligned].',
        severity: 'medium',
      },
      {
        item: 'Section heading style',
        preview: 'text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 — NO border',
        docx: 'UPPERCASE + bottom border in CCFBF1 (light teal)',
        pdf: 'PASS',
        cause: 'sectionHeading() always adds a bottom border. HTML uses no border for nordic-clean section headings.',
        fix: 'The light teal CCFBF1 border is subtle enough to be acceptable, but adding showBorder: false for this template would be pixel-perfect.',
        severity: 'low',
      },
      {
        item: 'Teal accent separator after header',
        preview: 'mt-5 h-px bg-teal-500/30 — a very subtle teal hairline',
        docx: 'divider() in gray CCCCCC',
        pdf: 'PASS',
        cause: 'divider() is hardcoded to CCCCCC regardless of template.',
        fix: 'Use a teal-tinted (CCFBF1) border for the header divider in nordic-clean.',
        severity: 'low',
      },
      {
        item: 'Skill chips',
        preview: 'rounded-md bg-teal-50 border border-teal-100 px-2 py-0.5 text-xs text-teal-700',
        docx: 'Bullet-separated plain text',
        pdf: 'PASS',
        cause: 'CSS chip styling not available in DOCX.',
        fix: 'Acceptable limitation.',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. TECH SIDEBAR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tech-sidebar',
    name: 'Tech Sidebar',
    layout: 'sidebar-left (slate-900 sidebar 38%, circular photo)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Sidebar layout renders correctly. Dark sidebar with correct dimensions.',
    mismatches: [
      {
        item: 'Main area section headings',
        preview: 'text-[10px] font-bold uppercase tracking-widest text-blue-600 — no visible border',
        docx: 'UPPERCASE bold, bottom border in 334155 (slate-700)',
        pdf: 'PASS',
        cause: 'mainHeading() in sidebar-left layout has a bottom border. HTML has no border for tech-sidebar.',
        fix: 'Remove border from mainHeading() for this template or make border conditional.',
        severity: 'medium',
      },
      {
        item: 'Experience inline date',
        preview: 'flex justify-between items-baseline — date floats right next to role name',
        docx: 'Date on a separate line below',
        pdf: 'PASS',
        cause: 'Same as nordic-clean: inline right-aligned date requires a 2-cell table per entry.',
        fix: 'Render experience as 2-cell table: [role] | [date right-aligned].',
        severity: 'medium',
      },
      {
        item: 'Sidebar skill chip styling',
        preview: 'rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200',
        docx: 'Plain text in sidebar',
        pdf: 'PASS',
        cause: 'CSS chip styling not possible in DOCX sidebar cells.',
        fix: 'Acceptable limitation.',
        severity: 'info',
      },
      {
        item: 'Photo in sidebar (circular)',
        preview: 'rounded-full with border-2 border-slate-600',
        docx: 'circularCropDataUrl ✓ — transparent circle PNG',
        pdf: 'PASS',
        cause: 'RESOLVED — photoShape: "circle" set correctly.',
        fix: 'No action needed.',
        severity: 'info',
      },
      {
        item: 'Education section missing from sidebar main',
        preview: 'Education in main content only',
        docx: 'Education also in main content only ✓',
        pdf: 'PASS',
        cause: 'RESOLVED — sidebar only has skills/languages/certs.',
        fix: 'No action needed.',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. CORPORATE NAVY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'corporate-navy',
    name: 'Corporate Navy',
    layout: 'dark-header (navy bg, blue accent bar, photo right)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Header structure correct. Missing the blue accent bar that appears below the header in HTML.',
    mismatches: [
      {
        item: 'Blue accent bar below header',
        preview: '<div className="h-1 bg-blue-500" /> — a full-width blue stripe between header and content',
        docx: 'Not present',
        pdf: 'PASS',
        cause: 'No equivalent element added after the dark-header table.',
        fix: 'Add a paragraph with a full bottom border in 3B82F6 (blue-500) right after the header table for corporate-navy.',
        severity: 'medium',
      },
      {
        item: 'Section headings',
        preview: 'text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-gray-200',
        docx: 'UPPERCASE bold, bottom border in E5E7EB (gray-200) ✓ — color matches',
        pdf: 'PASS',
        cause: 'MOSTLY RESOLVED — headingBorder: E5E7EB is correct. headingColor: 0F172A (navy) matches.',
        fix: 'No action needed for color. Tracking-[0.2em] letter-spacing cannot be set in docx library.',
        severity: 'info',
      },
      {
        item: 'Skills 2-column + languages 1-column (3-col grid)',
        preview: 'grid grid-cols-3: skills col-span-2 | languages col-span-1',
        docx: 'Skills bullet text, then languages stacked below',
        pdf: 'PASS',
        cause: 'DOCX cannot render CSS grid with unequal column spans.',
        fix: 'Use a 3-column table with skills spanning 2 cells and languages in 1 cell.',
        severity: 'medium',
      },
      {
        item: 'Experience inline date',
        preview: 'flex justify-between items-baseline — date floats right',
        docx: 'Date on separate line',
        pdf: 'PASS',
        cause: 'Same as tech-sidebar. Single-cell paragraph cannot have content on both left and right.',
        fix: 'Render each experience entry as a 2-cell table row.',
        severity: 'medium',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. ATS STANDARD
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ats-standard',
    name: 'ATS Standard',
    layout: 'single (no photo, centered header)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'ATS-optimized template. No photo needed. Header is centered in preview, left-aligned in DOCX.',
    mismatches: [
      {
        item: 'Header alignment',
        preview: 'text-center — name, job title, contacts all centered',
        docx: 'Left-aligned header paragraphs',
        pdf: 'PASS',
        cause: 'No per-template header alignment config. Header paragraphs in single layout are always left-aligned.',
        fix: 'Add headerAlignment: "center" to DocxTemplateConfig and apply AlignmentType.CENTER to all header paragraphs for ats-standard.',
        severity: 'critical',
      },
      {
        item: 'Experience format',
        preview: '"Position, Company" on one bold line + date below',
        docx: 'Position bold + " — Company" on same line, date separate line',
        pdf: 'PASS',
        cause: 'DOCX uses em-dash separator. HTML for ATS uses comma separator.',
        fix: 'For ats-standard, use comma format: "Position, Company".',
        severity: 'medium',
      },
      {
        item: 'Section heading style',
        preview: 'font-bold border-b border-gray-300 — black/dark text, gray border',
        docx: 'UPPERCASE bold, bottom border in 4F46E5 (indigo) — wrong color',
        pdf: 'PASS',
        cause: 'ATS-standard inherits default config accent 4F46E5. HTML uses plain dark text. Section headings should be black/dark with gray border.',
        fix: 'Create a dedicated ats-standard config with headingColor: 111827 (near-black) and headingBorder: D1D5DB (gray-300).',
        severity: 'critical',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. MODERN MINIMAL EXECUTIVE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'modern-minimal-executive',
    name: 'Modern Minimal Executive',
    layout: 'alias → renders as ModernMinimalTemplate (single layout)',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'This template ID maps to ModernMinimalTemplate in HTML but was intended as a sidebar layout variant. The DOCX config uses single layout. There is a mismatch: the TemplatePreview card and the actual preview both show the ModernMinimalTemplate, so the DOCX output matches the actual rendered output correctly — but the template card description promises a sidebar.',
    mismatches: [
      {
        item: 'Template renders as Modern Minimal',
        preview: 'ModernMinimalTemplate (indigo, single layout, no sidebar)',
        docx: 'single layout matching modern-minimal config ✓',
        pdf: 'PASS — same as modern-minimal',
        cause: 'templateComponents["modern-minimal-executive"] = ModernMinimalTemplate. No unique template exists.',
        fix: 'Either (a) create a dedicated ModernMinimalExecutive component with sidebar, or (b) rename the entry to avoid confusion. Current DOCX matches the actual HTML rendering.',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. CONTEMPORARY BOLD
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'contemporary-bold',
    name: 'Contemporary Bold',
    layout: 'alias → renders as CorporateNavyTemplate',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'This template ID maps to CorporateNavyTemplate in HTML. DOCX config also uses corporate-navy config (dark-header, navy bg). All mismatches from corporate-navy apply here too.',
    mismatches: [
      {
        item: 'Renders as Corporate Navy',
        preview: 'CorporateNavyTemplate HTML output',
        docx: 'Uses corporate-navy DOCX config ✓',
        pdf: 'PASS',
        cause: 'templateComponents["contemporary-bold"] = CorporateNavyTemplate. Same mismatches as corporate-navy apply.',
        fix: 'Same fixes as corporate-navy (blue accent bar, 3-col skills grid, inline dates).',
        severity: 'info',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. RIREKISHO (Japanese)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'rirekisho',
    name: '履歴書 (Rirekisho)',
    layout: 'Japanese table format',
    docxStatus: 'PARTIAL',
    pdfStatus: 'PASS',
    notes: 'Uses a dedicated exportRirekishoToDOCX() function. Structure is table-based and reasonably close to the HTML preview.',
    mismatches: [
      {
        item: 'Personal info top section',
        preview: 'Name in large box, DOB+Gender in 2-col grid, Address full width, Phone+Email in 2-col grid — all bordered boxes',
        docx: 'Similar structure using a nested table with thinBorder cells ✓ — reasonable match',
        pdf: 'PASS',
        cause: 'Minor layout spacing differences due to DOCX table cell padding.',
        fix: 'Adjust cell margins/spacing for tighter visual match.',
        severity: 'low',
      },
      {
        item: 'Gender radio buttons',
        preview: 'Visual radio circles (男/女/その他) with selection indicator',
        docx: 'Plain text value in a table cell — no radio UI',
        pdf: 'PASS',
        cause: 'DOCX cannot render form-like radio button UI.',
        fix: 'Cannot be fully replicated. Show selected gender as plain text. Acceptable for a formal CV document.',
        severity: 'info',
      },
      {
        item: 'Education/Experience table header row',
        preview: 'bg-gray-50 header row with 期間 | 学校名 column labels',
        docx: 'No header row — data rows only',
        pdf: 'PASS',
        cause: 'The DOCX export skips the thead row that HTML renders.',
        fix: 'Add a header TableRow for each section table with 期間 and 学校名・職歴 as header cells.',
        severity: 'medium',
      },
      {
        item: 'Skills grid chips',
        preview: 'Flex-wrap chip badges with rounded border',
        docx: '「Skill1　・　Skill2」plain text with Japanese bullet separator',
        pdf: 'PASS',
        cause: 'Same CSS chip limitation as other templates.',
        fix: 'Acceptable for Japanese CV format — comma/bullet separation is standard.',
        severity: 'info',
      },
      {
        item: 'Font for Japanese characters',
        preview: 'Noto Sans JP / Hiragino / Meiryo',
        docx: 'No Japanese font registered — Word falls back to system CJK font (MS Mincho / Hiragino on user machine)',
        pdf: 'NotoSansJP injected ✓',
        cause: 'DOCX has no font embedding. System font fallback usually works on Japanese machines but may break on Western machines.',
        fix: 'Add eastAsia: "MS Mincho" or "Meiryo" to TextRun options for better CJK fallback in DOCX.',
        severity: 'medium',
      },
    ],
  },
];

// ─── SUMMARY OF FIXES ─────────────────────────────────────────────────────────

const FIXES_NEEDED = [
  {
    priority: 'CRITICAL',
    id: 'FIX-01',
    title: 'Add photoSide config (left/right) to DocxTemplateConfig',
    affectedTemplates: ['clean-simple', 'professional-classic', 'elegant-formal'],
    description: 'These templates show the photo on the LEFT in HTML preview but DOCX always places it on the right. Add photoSide: "left" | "right" field and reverse column order when "left".',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'CRITICAL',
    id: 'FIX-02',
    title: 'Add headerAlignment config (center/left) to DocxTemplateConfig',
    affectedTemplates: ['elegant-formal', 'ats-standard'],
    description: 'These templates center their header content. DOCX always left-aligns. Add headerAlignment field and apply AlignmentType.CENTER to all header paragraphs when set.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'CRITICAL',
    id: 'FIX-03',
    title: 'Fix ATS Standard DOCX config colors',
    affectedTemplates: ['ats-standard'],
    description: 'ATS Standard should have dark/gray headings (headingColor: 111827) and gray border (headingBorder: D1D5DB). Currently inherits indigo accent from modern-minimal config.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'CRITICAL',
    id: 'FIX-04',
    title: 'Fix Elegant Formal section heading color to amber',
    affectedTemplates: ['elegant-formal'],
    description: 'HTML uses text-amber-700. DOCX config has headingColor: 374151 (dark gray). Should be B45309 (amber-700) or D97706 (amber-600).',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'MEDIUM',
    id: 'FIX-05',
    title: 'Add showHeadingBorder and uppercaseHeadings flags to DocxTemplateConfig',
    affectedTemplates: ['clean-simple', 'professional-classic', 'creative-artistic', 'nordic-clean'],
    description: 'Several templates use plain non-uppercase section headings with no bottom border in HTML. DOCX always adds uppercase + border. Add boolean flags to control this per template.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'MEDIUM',
    id: 'FIX-06',
    title: 'Add blue accent bar after header for Corporate Navy / Contemporary Bold',
    affectedTemplates: ['corporate-navy', 'contemporary-bold'],
    description: 'HTML shows a full-width h-1 bg-blue-500 stripe below the dark header. DOCX is missing this. Add a 0-height paragraph with a thick blue (3B82F6) bottom border after the header table.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'MEDIUM',
    id: 'FIX-07',
    title: 'Add amber decorative divider line in Executive Premium header',
    affectedTemplates: ['executive-premium'],
    description: 'HTML has a short w-16 amber line below the name (h-px bg-amber-500). Add a short centered paragraph with bottom border in D97706 after the name paragraph.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'MEDIUM',
    id: 'FIX-08',
    title: 'Render experience entries with inline right-aligned date',
    affectedTemplates: ['nordic-clean', 'tech-sidebar', 'corporate-navy', 'contemporary-bold'],
    description: 'These templates use CSS flex justify-between to place dates on the right of role names. DOCX puts dates on a new line. Fix by wrapping each experience entry in a 2-cell table: [role+company | date].',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'MEDIUM',
    id: 'FIX-09',
    title: 'Add table header rows to Rirekisho education/experience sections',
    affectedTemplates: ['rirekisho'],
    description: 'HTML renders 期間 | 学校名 header rows with bg-gray-50. DOCX skips these header rows.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'LOW',
    id: 'FIX-10',
    title: 'Make divider color configurable per template',
    affectedTemplates: ['modern-minimal', 'clean-simple', 'nordic-clean'],
    description: 'The divider() function is hardcoded to CCCCCC. modern-minimal uses indigo border, clean-simple uses gray-200, nordic-clean uses teal/30.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'LOW',
    id: 'FIX-11',
    title: 'Fix Executive Premium headingColor to gray-400',
    affectedTemplates: ['executive-premium'],
    description: 'HTML uses text-gray-400 (#9CA3AF) for section headings. DOCX config has headingColor: 6B7280 (gray-500). Small difference.',
    file: 'src/lib/export.ts',
  },
  {
    priority: 'INFO',
    id: 'FIX-12',
    title: 'Add CJK font eastAsia to Rirekisho TextRun options',
    affectedTemplates: ['rirekisho'],
    description: 'Rirekisho DOCX has no explicit CJK font. Add eastAsia: "MS Mincho" to TextRun for better Japanese rendering on non-Japanese systems.',
    file: 'src/lib/export.ts',
  },
];

// ─── WHAT CANNOT BE FIXED IN DOCX ─────────────────────────────────────────────

const DOCX_LIMITATIONS = [
  'CSS gradients (creative-bold sidebar, creative-artistic header) → flat color only',
  'CSS chip/badge styling for skills → plain text or simple borders only',
  'Custom font faces (Inter, Geist) → must use standard fonts (Calibri, Times New Roman, Georgia)',
  'CSS letter-spacing / tracking → no equivalent in docx library',
  'Translucent colors (bg-white/10, border-white/50) → must use solid colors',
  'CSS grid / flexbox column layouts → requires explicit Table elements in DOCX',
  'Round photo border rings (border-white/50 around circular photos) → would need canvas pre-processing',
  'Interactive elements (radio buttons in Rirekisho) → plain text values only',
  'Gradient overlays and shadow effects → not supported in DOCX format',
];

// ─── Page UI ──────────────────────────────────────────────────────────────────

const statusColors: Record<Status, string> = {
  PASS: 'bg-green-100 text-green-800 border-green-200',
  PARTIAL: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  FAIL: 'bg-red-100 text-red-800 border-red-200',
  'N/A': 'bg-gray-100 text-gray-600 border-gray-200',
};

const severityColors: Record<Mismatch['severity'], string> = {
  critical: 'bg-red-50 border-l-4 border-red-400',
  medium: 'bg-yellow-50 border-l-4 border-yellow-400',
  low: 'bg-blue-50 border-l-4 border-blue-300',
  info: 'bg-gray-50 border-l-4 border-gray-300',
};

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
  INFO: 'bg-gray-100 text-gray-600',
};

export default function AuditPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'fixes' | 'limits'>('templates');

  const criticalCount = FIXES_NEEDED.filter(f => f.priority === 'CRITICAL').length;
  const mediumCount = FIXES_NEEDED.filter(f => f.priority === 'MEDIUM').length;
  const lowCount = FIXES_NEEDED.filter(f => f.priority === 'LOW').length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CV Export Consistency Audit</h1>
              <p className="text-sm text-gray-500 mt-1">
                Full audit of preview vs DOCX vs PDF for all 13 CV templates · Generated 2026-05-04
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-semibold border border-red-200">{criticalCount} Critical</span>
              <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold border border-yellow-200">{mediumCount} Medium</span>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold border border-blue-200">{lowCount} Low</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 border-b border-gray-200 -mb-px">
            {(['templates', 'fixes', 'limits'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t border-t border-x -mb-px transition-colors ${
                  activeTab === tab
                    ? 'bg-white border-gray-200 text-gray-900 border-b-white'
                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                }`}
              >
                {tab === 'templates' ? '📋 Template Results' : tab === 'fixes' ? '🔧 Fix Backlog' : '⚠️ DOCX Limitations'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Tab: Template Results ── */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            {/* Summary table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 w-48">Template</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Layout</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 w-28">DOCX</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 w-28">PDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700 w-24">Issues</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {AUDIT.map((a, i) => (
                    <tr key={a.id} className={`border-b border-gray-100 last:border-0 ${selected === a.id ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.layout}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[a.docxStatus]}`}>{a.docxStatus}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[a.pdfStatus]}`}>{a.pdfStatus}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">
                        {a.mismatches.filter(m => m.severity !== 'info').length} issues
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(selected === a.id ? null : a.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {selected === a.id ? 'collapse' : 'details →'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detail panel */}
            {selected && (() => {
              const audit = AUDIT.find(a => a.id === selected)!;
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{audit.name}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">{audit.layout}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[audit.docxStatus]}`}>DOCX: {audit.docxStatus}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[audit.pdfStatus]}`}>PDF: {audit.pdfStatus}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-5 bg-gray-50 rounded-lg p-3 border border-gray-200">{audit.notes}</p>

                  <div className="space-y-3">
                    {audit.mismatches.map((m, i) => (
                      <div key={i} className={`rounded-lg p-4 ${severityColors[m.severity]}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            m.severity === 'critical' ? 'bg-red-200 text-red-900' :
                            m.severity === 'medium' ? 'bg-yellow-200 text-yellow-900' :
                            m.severity === 'low' ? 'bg-blue-200 text-blue-900' :
                            'bg-gray-200 text-gray-700'
                          }`}>{m.severity}</span>
                          <h3 className="font-semibold text-sm text-gray-900">{m.item}</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                          <div className="bg-white/60 rounded p-2">
                            <p className="font-semibold text-gray-500 mb-1">PREVIEW (HTML)</p>
                            <p className="text-gray-800 font-mono">{m.preview}</p>
                          </div>
                          <div className="bg-white/60 rounded p-2">
                            <p className="font-semibold text-gray-500 mb-1">DOCX EXPORT</p>
                            <p className="text-gray-800 font-mono">{m.docx}</p>
                          </div>
                          <div className="bg-white/60 rounded p-2">
                            <p className="font-semibold text-gray-500 mb-1">PDF EXPORT</p>
                            <p className="text-gray-800 font-mono">{m.pdf}</p>
                          </div>
                        </div>
                        <div className="text-xs space-y-1">
                          <p><span className="font-semibold text-gray-600">Root cause:</span> <span className="text-gray-700">{m.cause}</span></p>
                          <p><span className="font-semibold text-gray-600">Fix:</span> <span className="text-gray-700">{m.fix}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Tab: Fix Backlog ── */}
        {activeTab === 'fixes' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
              <strong>Note:</strong> These are the actionable code fixes needed in <code>src/lib/export.ts</code> to improve DOCX consistency. PDF is already at PASS for all templates (html2canvas captures the real HTML).
            </div>
            {FIXES_NEEDED.map(fix => (
              <div key={fix.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${priorityColors[fix.priority]}`}>{fix.priority}</span>
                    <span className="text-xs font-mono text-gray-400 shrink-0">{fix.id}</span>
                    <h3 className="font-semibold text-gray-900 text-sm">{fix.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3">{fix.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {fix.affectedTemplates.map(t => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">{t}</span>
                  ))}
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-mono">{fix.file}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: DOCX Limitations ── */}
        {activeTab === 'limits' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">What Cannot Be Pixel-Perfect in DOCX</h2>
              <p className="text-sm text-gray-600 mb-5">
                These are fundamental format limitations. No amount of code fixes in <code>export.ts</code> can overcome them.
                The PDF export (html2canvas) is pixel-perfect because it screenshots the actual HTML DOM.
              </p>
              <ul className="space-y-2">
                {DOCX_LIMITATIONS.map((l, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-red-400 font-bold shrink-0 mt-0.5">✗</span>
                    <span className="text-gray-700">{l}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">What CAN Be Fixed in DOCX</h2>
              <p className="text-sm text-gray-600 mb-5">
                These are solvable with code changes in <code>src/lib/export.ts</code>.
              </p>
              <ul className="space-y-2">
                {[
                  'Photo placement (left vs right) — add photoSide config',
                  'Header alignment (centered vs left) — add headerAlignment config',
                  'Section heading uppercase on/off — add uppercaseHeadings flag',
                  'Section heading border on/off — add showHeadingBorder flag',
                  'Divider color — make configurable per template',
                  'Accent bar below dark headers — add explicit paragraph after header table',
                  'Amber decorative divider in Executive Premium — add styled empty paragraph',
                  'Inline right-aligned dates in experience — use 2-cell table per entry',
                  'Table header rows in Rirekisho — add thead row to education/experience tables',
                  'Rirekisho CJK font — add eastAsia font property to TextRun',
                  'Elegant Formal / ATS Standard heading colors — fix hex values in config',
                ].map((l, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-green-500 font-bold shrink-0 mt-0.5">✓</span>
                    <span className="text-gray-700">{l}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">PDF Export Notes</h2>
              <p className="text-sm text-gray-600 mb-4">
                The PDF export uses <strong>html2canvas → jsPDF</strong> which screenshots the actual DOM.
                This makes PDF pixel-perfect for layout/colors/fonts. Known PDF-specific issues:
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-3"><span className="text-yellow-500 shrink-0">⚠</span> Serif templates (elegant-formal, executive-premium) lose their serif font because html2canvas injects NotoSans for Unicode support. For Latin-only content, consider skipping NotoSans injection.</li>
                <li className="flex gap-3"><span className="text-yellow-500 shrink-0">⚠</span> Long CVs that exceed one A4 page may have visual breaks across page edges. The current multi-page slicing code may split in the middle of text blocks.</li>
                <li className="flex gap-3"><span className="text-green-500 shrink-0">✓</span> Colors, gradients, chips, borders, layout — all captured exactly.</li>
                <li className="flex gap-3"><span className="text-green-500 shrink-0">✓</span> Photo shapes (circular, portrait) captured exactly.</li>
                <li className="flex gap-3"><span className="text-green-500 shrink-0">✓</span> Arabic/Hindi/Japanese glyphs render correctly via NotoSans injection.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
