'use client';

import React, { useRef } from 'react';
import type { CVData } from '@/lib/types';
import { regionSettings } from '@/lib/types';
import { translations, type Locale } from '@/lib/i18n/translations';


interface TemplateProps {
  data: CVData;
  locale?: Locale;
}

function getLabels(locale?: Locale) {
  const t = translations[locale ?? 'en'] ?? translations['en'];
  return {
    summary: t.cv.summary,
    experience: t.cv.experience,
    education: t.cv.education,
    skills: t.cv.skills,
    languages: t.cv.languages,
    certifications: t.cv.certifications,
    present: t.cv.present,
  };
}

function PhotoFill({ photo, alt = '', shape = 'circle' }: { photo: string; alt?: string; shape?: 'circle' | 'rectangle' }) {
  const imgRef = useRef<HTMLImageElement>(null);

  // For circle templates: the image source may be the full original or a circular PNG.
  // Apply smart object-position after load: portrait → focus upper 30% (face area), square/landscape → center.
  // For rectangle templates: the image is already cropped by the user (300×400 JPEG with face centered).
  // Just use center positioning — no dynamic repositioning needed.
  const handleLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    if (shape === 'rectangle') {
      // Already cropped with correct face framing — use center
      el.style.objectPosition = '50% 35%';
    } else {
      const isPortrait = el.naturalHeight > el.naturalWidth;
      el.style.objectPosition = isPortrait ? '50% 20%' : '50% 50%';
    }
  };

  return (
    <img
      ref={imgRef}
      src={photo}
      alt={alt}
      onLoad={handleLoad}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // Rect: default to center 35% (upper-center) until load; circle: top center
        objectPosition: shape === 'rectangle' ? '50% 35%' : 'top center',
        display: 'block',
      }}
    />
  );
}

function shouldShowPhoto(data: CVData): boolean {
  if (data.personal.photoEnabled !== undefined) return data.personal.photoEnabled;
  return data.region !== 'US';
}

// --- Modern Minimal: circular photo, top-right corner ---
export function ModernMinimalTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  return (
    <div
      data-template-id="modern-minimal"
      className="box-border w-[210mm] bg-white text-gray-900 p-8 mx-auto font-sans text-sm leading-relaxed"
      style={{ minHeight: '297mm' }}
    >
      <header className="border-b-2 border-indigo-600 pb-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-indigo-600 font-medium">{data.personal.jobTitle || 'Job Title'}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
              {data.personal.email && <span>{data.personal.email}</span>}
              {data.personal.phone && <span>{data.personal.phone}</span>}
              {rs.showAddress && data.personal.address && <span>{data.personal.address}</span>}
            </div>
          </div>
          {showPhoto && data.personal.photo && (
            <div className="flex-shrink-0 rounded-full overflow-hidden border border-gray-200 shadow-sm" style={{ width: 110, height: 110 }}>
              <PhotoFill photo={data.personal.photo} />
            </div>
          )}
        </div>
      </header>
      {data.summary && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">{L.summary}</h2>
          <p className="text-gray-700">{data.summary}</p>
        </section>
      )}
      {data.experience.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">{L.experience}</h2>
          {data.experience.map(exp => (
            <div key={exp.id} className="mb-4">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold">{exp.position}</h3>
                  <p className="text-gray-500">{exp.company}</p>
                </div>
                <span className="text-xs text-gray-400">{exp.startDate} - {exp.isPresent ? L.present : exp.endDate}</span>
              </div>
              <p className="mt-1 text-gray-600 whitespace-pre-line">{exp.description}</p>
            </div>
          ))}
        </section>
      )}
      {data.education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">{L.education}</h2>
          {data.education.map(edu => (
            <div key={edu.id} className="mb-3">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold">{edu.degree}</h3>
                  <p className="text-gray-500">{edu.school}</p>
                </div>
                <span className="text-xs text-gray-400">{edu.startDate} - {edu.endDate}</span>
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="grid grid-cols-2 gap-6">
        {data.skills.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">{L.skills}</h2>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s, i) => (
                <span key={i} className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{s}</span>
              ))}
            </div>
          </section>
        )}
        {data.languages.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">{L.languages}</h2>
            {data.languages.map((l, i) => (
              <div key={i} className="text-xs"><span className="font-medium">{l.name}</span> - {l.level}</div>
            ))}
          </section>
        )}
      </div>
      {data.certifications.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">{L.certifications}</h2>
          <ul className="list-disc list-inside text-gray-700">
            {data.certifications.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

// --- Creative Bold: round photo in sidebar ---
export function CreativeBoldTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  return (
    <div className="bg-white text-gray-900 max-w-[210mm] mx-auto font-sans text-sm" style={{ minHeight: '297mm' }}>
      <div className="flex min-h-[297mm]">
        <aside className="w-1/3 bg-gradient-to-b from-rose-600 to-pink-700 text-white p-6">
          {showPhoto && (
            <div className="mx-auto mb-4 rounded-full overflow-hidden border-2 border-white/50 shadow-lg" style={{ width: 110, height: 110 }}>
              {data.personal.photo ? (
                <PhotoFill photo={data.personal.photo} />
              ) : (
                <div className="h-full w-full bg-white/20" />
              )}
            </div>
          )}
          <h1 className="text-xl font-bold">{data.personal.fullName || 'Your Name'}</h1>
          <p className="text-rose-200 text-sm mt-1">{data.personal.jobTitle}</p>
          <div className="mt-6 space-y-2 text-xs text-rose-100">
            {data.personal.email && <p>{data.personal.email}</p>}
            {data.personal.phone && <p>{data.personal.phone}</p>}
            {rs.showAddress && data.personal.address && <p>{data.personal.address}</p>}
          </div>
          {data.skills.length > 0 && (
            <div className="mt-6">
              <h2 className="font-bold text-xs uppercase tracking-wider mb-2">{L.skills}</h2>
              <div className="space-y-1.5">
                {data.skills.map((s, i) => (
                  <div key={i} className="rounded bg-white/10 px-2 py-1 text-xs">{s}</div>
                ))}
              </div>
            </div>
          )}
          {data.languages.length > 0 && (
            <div className="mt-6">
              <h2 className="font-bold text-xs uppercase tracking-wider mb-2">{L.languages}</h2>
              {data.languages.map((l, i) => (
                <p key={i} className="text-xs text-rose-100">{l.name} - {l.level}</p>
              ))}
            </div>
          )}
        </aside>
        <main className="flex-1 p-6">
          {data.summary && (
            <section className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-600 mb-2">{L.summary}</h2>
              <p className="text-gray-700 leading-relaxed">{data.summary}</p>
            </section>
          )}
          {data.experience.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-600 mb-3">{L.experience}</h2>
              {data.experience.map(exp => (
                <div key={exp.id} className="mb-4 border-l-2 border-rose-200 pl-3">
                  <h3 className="font-semibold">{exp.position}</h3>
                  <p className="text-xs text-gray-500">{exp.company} | {exp.startDate} - {exp.isPresent ? L.present : exp.endDate}</p>
                  <p className="mt-1 text-gray-600 whitespace-pre-line">{exp.description}</p>
                </div>
              ))}
            </section>
          )}
          {data.education.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-600 mb-3">{L.education}</h2>
              {data.education.map(edu => (
                <div key={edu.id} className="mb-2">
                  <h3 className="font-semibold">{edu.degree}</h3>
                  <p className="text-xs text-gray-500">{edu.school} | {edu.startDate} - {edu.endDate}</p>
                </div>
              ))}
            </section>
          )}
          {data.certifications.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-600 mb-2">{L.certifications}</h2>
              <ul className="list-disc list-inside text-gray-700">
                {data.certifications.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

// --- Elegant Formal: rectangular formal photo, left aligned with name ---
// photo is pre-processed to a clean white-background 3:4 JPEG by the page before being passed in.
export function ElegantFormalTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  return (
    <div className="bg-white text-gray-900 p-10 max-w-[210mm] mx-auto font-serif text-sm leading-relaxed" style={{ minHeight: '297mm' }}>
      <header className="border-b border-gray-300 pb-6 mb-6">
        <div className="flex items-start gap-5">
          {showPhoto && data.personal.photo && (
            <div className="flex-shrink-0 overflow-hidden rounded-sm border border-gray-200 shadow-sm" style={{ width: 82, aspectRatio: '3/4', backgroundColor: '#ffffff' }}>
              <PhotoFill photo={data.personal.photo} shape="rectangle" />
            </div>
          )}
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-light tracking-wide text-gray-800">{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-amber-700 mt-1 tracking-wider uppercase text-xs">{data.personal.jobTitle}</p>
            <div className="mt-3 flex justify-center gap-6 text-xs text-gray-400">
              {data.personal.email && <span>{data.personal.email}</span>}
              {data.personal.phone && <span>{data.personal.phone}</span>}
              {rs.showAddress && data.personal.address && <span>{data.personal.address}</span>}
            </div>
          </div>
        </div>
      </header>
      {data.summary && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 mb-2 text-center">{L.summary}</h2>
          <p className="text-gray-700 text-center italic">{data.summary}</p>
        </section>
      )}
      {data.experience.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 mb-4 text-center border-b border-gray-200 pb-1">{L.experience}</h2>
          {data.experience.map(exp => (
            <div key={exp.id} className="mb-4">
              <div className="flex justify-between items-baseline">
                <h3 className="font-semibold">{exp.position}</h3>
                <span className="text-xs text-gray-400 italic">{exp.startDate} - {exp.isPresent ? L.present : exp.endDate}</span>
              </div>
              <p className="text-amber-700 text-xs">{exp.company}</p>
              <p className="mt-1 text-gray-600 whitespace-pre-line">{exp.description}</p>
            </div>
          ))}
        </section>
      )}
      {data.education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 mb-4 text-center border-b border-gray-200 pb-1">{L.education}</h2>
          {data.education.map(edu => (
            <div key={edu.id} className="mb-2 text-center">
              <h3 className="font-semibold">{edu.degree}</h3>
              <p className="text-xs text-gray-500">{edu.school} | {edu.startDate} - {edu.endDate}</p>
            </div>
          ))}
        </section>
      )}
      <div className="grid grid-cols-3 gap-6 text-center">
        {data.skills.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 mb-2">{L.skills}</h2>
            {data.skills.map((s, i) => <p key={i} className="text-xs text-gray-600">{s}</p>)}
          </section>
        )}
        {data.languages.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 mb-2">{L.languages}</h2>
            {data.languages.map((l, i) => <p key={i} className="text-xs text-gray-600">{l.name} ({l.level})</p>)}
          </section>
        )}
        {data.certifications.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 mb-2">{L.certifications}</h2>
            {data.certifications.map((c, i) => <p key={i} className="text-xs text-gray-600">{c}</p>)}
          </section>
        )}
      </div>
    </div>
  );
}

// --- Clean Simple: small aligned square photo next to name ---
export function CleanSimpleTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  const contacts = [
    data.personal.email,
    data.personal.phone,
    rs.showAddress ? data.personal.address : '',
  ].filter(Boolean);
  return (
    <div
      data-template-id="clean-simple"
      className="box-border w-[210mm] bg-white text-gray-900 p-8 mx-auto font-sans text-sm leading-relaxed"
      style={{
        minHeight: '297mm',
        boxSizing: 'border-box',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#111827',
        backgroundColor: '#ffffff',
        wordSpacing: '0.08em',
      }}
    >
      <header className="mb-6">
        <div className="flex items-center gap-3">
          {showPhoto && data.personal.photo && (
            <div
              data-clean-simple-photo="frame"
              className="flex-shrink-0 rounded-full overflow-hidden border border-gray-200"
              style={{ width: 80, height: 80, borderRadius: 9999, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
            >
              <PhotoFill photo={data.personal.photo} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight" style={{ fontSize: 24, lineHeight: 1.15, fontWeight: 700 }}>{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-emerald-600 font-medium" style={{ color: '#059669', fontWeight: 500 }}>{data.personal.jobTitle}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500" style={{ fontSize: 12, color: '#6b7280' }}>
              {contacts.map((contact, index) => (
                <React.Fragment key={`${contact}-${index}`}>
                  {index > 0 && <span aria-hidden="true" className="text-gray-300">|</span>}
                  <span className="break-all">{contact}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </header>
      <hr className="border-gray-200 mb-6" style={{ borderColor: '#e5e7eb' }} />
      {data.summary && (
        <section data-clean-simple-section="summary" className="mb-6">
          <h2 className="font-bold text-emerald-600 mb-2" style={{ color: '#059669', fontWeight: 700 }}>{L.summary.toUpperCase()}</h2>
          <p className="text-gray-700" style={{ color: '#374151', whiteSpace: 'break-spaces' }}>{data.summary}</p>
        </section>
      )}
      {data.experience.length > 0 && (
        <section data-clean-simple-section="experience" className="mb-6">
          <h2 className="font-bold text-emerald-600 mb-3" style={{ color: '#059669', fontWeight: 700 }}>{L.experience.toUpperCase()}</h2>
          {data.experience.map(exp => (
            <div key={exp.id} className="mb-3">
              <div className="flex justify-between gap-4">
                <h3 className="font-semibold" style={{ fontWeight: 600 }}>{exp.position}{exp.company ? ` at ${exp.company}` : ''}</h3>
                <span className="shrink-0 text-xs text-gray-400" style={{ fontSize: 12, color: '#9ca3af' }}>{exp.startDate} - {exp.isPresent ? L.present : exp.endDate}</span>
              </div>
              <p className="mt-1 text-gray-600 whitespace-pre-line" style={{ color: '#4b5563', whiteSpace: 'break-spaces' }}>{exp.description}</p>
            </div>
          ))}
        </section>
      )}
      {data.education.length > 0 && (
        <section data-clean-simple-section="education" className="mb-6">
          <h2 className="font-bold text-emerald-600 mb-3" style={{ color: '#059669', fontWeight: 700 }}>{L.education.toUpperCase()}</h2>
          {data.education.map(edu => (
            <div key={edu.id} className="mb-2">
              <div className="flex justify-between gap-4">
                <h3 className="font-semibold" style={{ fontWeight: 600 }}>{edu.degree}</h3>
                <span className="shrink-0 text-xs text-gray-400" style={{ fontSize: 12, color: '#9ca3af' }}>{edu.startDate} - {edu.endDate}</span>
              </div>
              <p className="text-xs text-gray-500" style={{ fontSize: 12, color: '#6b7280' }}>{edu.school}</p>
            </div>
          ))}
        </section>
      )}
      {data.skills.length > 0 && (
        <section data-clean-simple-section="skills" className="mb-6">
          <h2 className="font-bold text-emerald-600 mb-2" style={{ color: '#059669', fontWeight: 700 }}>{L.skills.toUpperCase()}</h2>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-gray-700" style={{ color: '#374151' }}>
            {data.skills.map((skill, index) => (
              <React.Fragment key={`${skill}-${index}`}>
                {index > 0 && <span aria-hidden="true" className="text-gray-300">|</span>}
                <span data-clean-simple-skill="item" className="break-words" style={{ whiteSpace: 'break-spaces' }}>{skill}</span>
              </React.Fragment>
            ))}
          </div>
        </section>
      )}
      {data.languages.length > 0 && (
        <section data-clean-simple-section="languages" className="mb-6">
          <h2 className="font-bold text-emerald-600 mb-2" style={{ color: '#059669', fontWeight: 700 }}>{L.languages.toUpperCase()}</h2>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-gray-700" style={{ color: '#374151' }}>
            {data.languages.map((l, i) => (
              <React.Fragment key={`${l.name}-${i}`}>
                {i > 0 && <span aria-hidden="true" className="text-gray-300">|</span>}
                <span style={{ whiteSpace: 'break-spaces' }}>{l.name} ({l.level})</span>
              </React.Fragment>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Professional Classic: square photo in dark header ---
export function ProfessionalClassicTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  const contacts = [
    data.personal.email,
    data.personal.phone,
    rs.showAddress ? data.personal.address : '',
  ].filter(Boolean);

  return (
    <div
      data-template-id="professional-classic"
      className="box-border w-[210mm] bg-white text-gray-900 p-8 mx-auto font-sans text-sm leading-relaxed"
      style={{
        minHeight: '297mm',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#111827',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        wordSpacing: 'normal',
        letterSpacing: 'normal',
        whiteSpace: 'normal',
        fontKerning: 'normal',
        textRendering: 'geometricPrecision',
      }}
    >
      <header
        data-professional-classic-header="true"
        className="bg-slate-800 text-white p-6 -m-8 mb-6"
        style={{ backgroundColor: '#1f2937', color: '#ffffff' }}
      >
        <div className="flex items-center gap-4" style={{ alignItems: 'center', gap: '1rem' }}>
          {showPhoto && data.personal.photo && (
            <div
              data-professional-classic-photo="frame"
              className="flex-shrink-0 rounded-full overflow-hidden border-2 border-slate-600"
              style={{
                width: 90,
                height: 90,
                borderRadius: '9999px',
                overflow: 'hidden',
                borderColor: '#475569',
                backgroundColor: '#334155',
                flexShrink: 0,
              }}
            >
              <PhotoFill photo={data.personal.photo} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="text-2xl font-bold" style={{ fontSize: '1.5rem', lineHeight: '2rem', fontWeight: 700, color: '#ffffff' }}>{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-slate-300" style={{ color: '#cbd5e1' }}>{data.personal.jobTitle}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400" style={{ color: '#94a3b8', fontSize: '0.75rem', lineHeight: '1rem', columnGap: '0.75rem', rowGap: '0.25rem' }}>
              {contacts.map((contact, i) => (
                <React.Fragment key={`${contact}-${i}`}>
                  {i > 0 && <span aria-hidden="true" className="text-slate-500" style={{ color: '#64748b' }}>|</span>}
                  <span style={{ wordBreak: 'break-word' }}>{contact}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </header>
      <div className="pt-6">
        {data.summary && <section data-professional-classic-section="summary" className="mb-6"><h2 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2" style={{ color: '#1e293b', borderColor: '#e2e8f0' }}>{L.summary.toUpperCase()}</h2><p className="text-gray-700" style={{ color: '#374151', whiteSpace: 'break-spaces' }}>{data.summary}</p></section>}
        {data.experience.length > 0 && <section data-professional-classic-section="experience" className="mb-6"><h2 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3" style={{ color: '#1e293b', borderColor: '#e2e8f0' }}>{L.experience.toUpperCase()}</h2>{data.experience.map(exp => (<div key={exp.id} className="mb-4"><div className="flex justify-between gap-4" style={{ justifyContent: 'space-between', gap: '1rem' }}><h3 className="font-semibold" style={{ color: '#111827', fontWeight: 600 }}>{exp.position}</h3><span className="text-xs text-gray-400" style={{ color: '#9ca3af', fontSize: '0.75rem', flexShrink: 0 }}>{exp.startDate} - {exp.isPresent ? L.present : exp.endDate}</span></div><p className="text-gray-500" style={{ color: '#6b7280' }}>{exp.company}</p><p className="mt-1 text-gray-600 whitespace-pre-line" style={{ color: '#4b5563', whiteSpace: 'break-spaces' }}>{exp.description}</p></div>))}</section>}
        {data.education.length > 0 && <section data-professional-classic-section="education" className="mb-6"><h2 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3" style={{ color: '#1e293b', borderColor: '#e2e8f0' }}>{L.education.toUpperCase()}</h2>{data.education.map(edu => (<div key={edu.id} className="mb-2"><h3 className="font-semibold" style={{ color: '#111827', fontWeight: 600 }}>{edu.degree}</h3><p className="text-xs text-gray-500" style={{ color: '#6b7280' }}>{edu.school} | {edu.startDate} - {edu.endDate}</p></div>))}</section>}
        <div className="grid grid-cols-2 gap-6">
          {data.skills.length > 0 && <section data-professional-classic-section="skills"><h2 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2" style={{ color: '#1e293b', borderColor: '#e2e8f0' }}>{L.skills.toUpperCase()}</h2><div className="flex flex-wrap gap-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>{data.skills.map((s, i) => <span data-professional-classic-skill="item" key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs" style={{ backgroundColor: '#f1f5f9', color: '#374151', fontSize: '0.75rem', lineHeight: '1rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', whiteSpace: 'break-spaces' }}>{s}</span>)}</div></section>}
          {data.languages.length > 0 && <section data-professional-classic-section="languages"><h2 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2" style={{ color: '#1e293b', borderColor: '#e2e8f0' }}>{L.languages.toUpperCase()}</h2>{data.languages.map((l, i) => <p key={i} className="text-xs" style={{ fontSize: '0.75rem', color: '#374151' }}>{l.name} - {l.level}</p>)}</section>}
        </div>
      </div>
    </div>
  );
}

// --- ATS Standard: no photo (ATS-friendly, keeps layout clean) ---
export function ATSStandardTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const L = getLabels(locale);
  return (
    <div className="bg-white text-gray-900 p-8 max-w-[210mm] mx-auto font-sans text-sm leading-relaxed" style={{ minHeight: '297mm' }}>
      <header className="text-center mb-6">
        <h1 className="text-xl font-bold">{data.personal.fullName || 'Your Name'}</h1>
        <p className="text-gray-600">{data.personal.jobTitle}</p>
        <p className="text-xs text-gray-400 mt-1">
          {[data.personal.email, data.personal.phone, rs.showAddress ? data.personal.address : ''].filter(Boolean).join(' | ')}
        </p>
      </header>
      {data.summary && <section className="mb-4"><h2 className="font-bold border-b border-gray-300 pb-1 mb-2">{L.summary.toUpperCase()}</h2><p>{data.summary}</p></section>}
      {data.experience.length > 0 && <section className="mb-4"><h2 className="font-bold border-b border-gray-300 pb-1 mb-2">{L.experience.toUpperCase()}</h2>{data.experience.map(exp => (<div key={exp.id} className="mb-3"><p className="font-semibold">{exp.position}, {exp.company}</p><p className="text-xs text-gray-500">{exp.startDate} - {exp.isPresent ? L.present : exp.endDate}</p><p className="mt-1 whitespace-pre-line">{exp.description}</p></div>))}</section>}
      {data.education.length > 0 && <section className="mb-4"><h2 className="font-bold border-b border-gray-300 pb-1 mb-2">{L.education.toUpperCase()}</h2>{data.education.map(edu => (<div key={edu.id} className="mb-2"><p className="font-semibold">{edu.degree}, {edu.school}</p><p className="text-xs text-gray-500">{edu.startDate} - {edu.endDate}</p></div>))}</section>}
      {data.skills.length > 0 && <section className="mb-4"><h2 className="font-bold border-b border-gray-300 pb-1 mb-2">{L.skills.toUpperCase()}</h2><p>{data.skills.join(', ')}</p></section>}
      {data.languages.length > 0 && <section className="mb-4"><h2 className="font-bold border-b border-gray-300 pb-1 mb-2">{L.languages.toUpperCase()}</h2>{data.languages.map((l, i) => <p key={i}>{l.name} - {l.level}</p>)}</section>}
      {data.certifications.length > 0 && <section><h2 className="font-bold border-b border-gray-300 pb-1 mb-2">{L.certifications.toUpperCase()}</h2>{data.certifications.map((c, i) => <p key={i}>{c}</p>)}</section>}
    </div>
  );
}

// --- Creative Artistic: round photo in colorful header ---
export function CreativeArtisticTemplate({ data, locale }: TemplateProps) {
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  return (
    <div className="bg-white text-gray-900 max-w-[210mm] mx-auto font-sans text-sm" style={{ minHeight: '297mm' }}>
      <header className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-8">
        <div className="flex items-center gap-4">
          {showPhoto && (
            <div className="flex-shrink-0 rounded-full overflow-hidden border-2 border-white/40 shadow-md" style={{ width: 100, height: 100 }}>
              {data.personal.photo ? (
                <PhotoFill photo={data.personal.photo} />
              ) : (
                <div className="h-full w-full bg-white/20" />
              )}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-violet-200 text-lg mt-1">{data.personal.jobTitle}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-violet-200">
              {data.personal.email && <span>{data.personal.email}</span>}
              {data.personal.phone && <span>{data.personal.phone}</span>}
            </div>
          </div>
        </div>
      </header>
      <div className="p-8">
        {data.summary && <section className="mb-6"><p className="text-gray-700 text-base leading-relaxed">{data.summary}</p></section>}
        {data.experience.length > 0 && <section className="mb-6"><h2 className="text-violet-600 font-bold mb-3">{L.experience}</h2>{data.experience.map(exp => (<div key={exp.id} className="mb-4 pl-4 border-l-2 border-violet-200"><h3 className="font-semibold">{exp.position}</h3><p className="text-xs text-violet-500">{exp.company} | {exp.startDate} - {exp.isPresent ? L.present : exp.endDate}</p><p className="mt-1 text-gray-600 whitespace-pre-line">{exp.description}</p></div>))}</section>}
        {data.education.length > 0 && <section className="mb-6"><h2 className="text-violet-600 font-bold mb-3">{L.education}</h2>{data.education.map(edu => (<div key={edu.id} className="mb-2"><h3 className="font-semibold">{edu.degree}</h3><p className="text-xs text-gray-500">{edu.school}</p></div>))}</section>}
        <div className="grid grid-cols-2 gap-6">
          {data.skills.length > 0 && <section><h2 className="text-violet-600 font-bold mb-2">{L.skills}</h2><div className="flex flex-wrap gap-1">{data.skills.map((s, i) => <span key={i} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">{s}</span>)}</div></section>}
          {data.languages.length > 0 && <section><h2 className="text-violet-600 font-bold mb-2">{L.languages}</h2>{data.languages.map((l, i) => <p key={i} className="text-xs">{l.name} - {l.level}</p>)}</section>}
        </div>
      </div>
    </div>
  );
}

// --- Executive Premium: centered dark navy header, gold accent, formal executive style ---
// photo is pre-processed to a clean white-background 3:4 JPEG by the page before being passed in.
export function ExecutivePremiumTemplate({ data, locale }: TemplateProps) {
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  const colCount = [data.skills.length > 0, data.languages.length > 0, data.certifications.length > 0].filter(Boolean).length || 1;
  return (
    <div className="bg-white text-gray-900 max-w-[210mm] mx-auto font-serif text-sm" style={{ minHeight: '297mm' }}>
      {/* Dark navy header — inline backgroundColor ensures html2canvas captures background correctly */}
      <header
        className="text-white px-10 py-8"
        style={{ backgroundColor: '#111827', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}
      >
        <div className="flex flex-col items-center gap-3">
          {showPhoto && data.personal.photo && (
            <div className="overflow-hidden rounded-sm border border-gray-700 shadow-md" style={{ width: 60, height: 80, backgroundColor: '#ffffff' }}>
              <PhotoFill photo={data.personal.photo} shape="rectangle" />
            </div>
          )}
          <div className="text-center">
            <h1 className="text-3xl font-light tracking-[0.15em]">{(data.personal.fullName || 'YOUR NAME').toUpperCase()}</h1>
            <div className="mt-2 h-px w-16 mx-auto" style={{ backgroundColor: '#D97706' }} />
            <p className="mt-2 tracking-wider text-sm" style={{ color: '#FCD34D' }}>{data.personal.jobTitle}</p>
            <div className="mt-3 flex justify-center gap-6 text-xs" style={{ color: '#9CA3AF' }}>
              {data.personal.email && <span>{data.personal.email}</span>}
              {data.personal.phone && <span>{data.personal.phone}</span>}
            </div>
          </div>
        </div>
      </header>
      <div className="px-10 py-8">
        {data.summary && (
          <section className="mb-8 text-center">
            <p className="text-gray-600 italic leading-relaxed">{data.summary}</p>
          </section>
        )}
        {data.experience.length > 0 && (
          <section className="mb-8">
            <h2 className="text-center text-xs font-bold tracking-[0.3em] text-gray-400 mb-4">{L.experience.toUpperCase()}</h2>
            {data.experience.map(exp => (
              <div key={exp.id} className="mb-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-bold text-sm text-gray-900">{exp.position}</h3>
                  <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">{exp.startDate} – {exp.isPresent ? L.present : exp.endDate}</span>
                </div>
                <p className="text-amber-700 text-xs mt-0.5">{exp.company}</p>
                {exp.description && <p className="mt-2 text-gray-600 text-xs whitespace-pre-line leading-relaxed">{exp.description}</p>}
              </div>
            ))}
          </section>
        )}
        {data.education.length > 0 && (
          <section className="mb-8">
            <h2 className="text-center text-xs font-bold tracking-[0.3em] text-gray-400 mb-4">{L.education.toUpperCase()}</h2>
            {data.education.map(edu => (
              <div key={edu.id} className="mb-2 text-center">
                <h3 className="font-semibold text-sm">{edu.degree}</h3>
                <p className="text-xs text-gray-500">{edu.school}</p>
              </div>
            ))}
          </section>
        )}
        <div className="border-t border-gray-100 pt-6">
          <div className="grid gap-6 text-center" style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
            {data.skills.length > 0 && (
              <section>
                <h2 className="text-xs font-bold tracking-[0.2em] text-gray-400 mb-2">{L.skills.toUpperCase()}</h2>
                {data.skills.map((s, i) => <p key={i} className="text-xs text-gray-600">{s}</p>)}
              </section>
            )}
            {data.languages.length > 0 && (
              <section>
                <h2 className="text-xs font-bold tracking-[0.2em] text-gray-400 mb-2">{L.languages.toUpperCase()}</h2>
                {data.languages.map((l, i) => <p key={i} className="text-xs text-gray-600">{l.name}</p>)}
              </section>
            )}
            {data.certifications.length > 0 && (
              <section>
                <h2 className="text-xs font-bold tracking-[0.2em] text-gray-400 mb-2">{L.certifications.toUpperCase()}</h2>
                {data.certifications.map((c, i) => <p key={i} className="text-xs text-gray-600">{c}</p>)}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Nordic Clean: minimalist Scandinavian layout, teal accent, generous whitespace ---
export function NordicCleanTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  return (
    <div className="bg-white text-gray-800 p-10 max-w-[210mm] mx-auto font-sans text-sm leading-relaxed" style={{ minHeight: '297mm' }}>
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-gray-900">{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-teal-600 mt-1 font-medium">{data.personal.jobTitle}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
              {data.personal.email && <span>{data.personal.email}</span>}
              {data.personal.phone && <span>{data.personal.phone}</span>}
              {rs.showAddress && data.personal.address && <span>{data.personal.address}</span>}
            </div>
          </div>
          {showPhoto && data.personal.photo && (
            <div className="flex-shrink-0 rounded-full overflow-hidden border border-gray-100" style={{ width: 90, height: 90 }}>
              <PhotoFill photo={data.personal.photo} />
            </div>
          )}
        </div>
        <div className="mt-5 h-px bg-teal-500/30" />
      </header>
      {data.summary && (
        <section className="mb-7">
          <p className="text-gray-600 leading-relaxed">{data.summary}</p>
        </section>
      )}
      {data.experience.length > 0 && (
        <section className="mb-7">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-4">{L.experience}</h2>
          {data.experience.map(exp => (
            <div key={exp.id} className="mb-5 grid grid-cols-[1fr_auto] gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">{exp.position}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{exp.company}</p>
                <p className="mt-2 text-gray-600 whitespace-pre-line">{exp.description}</p>
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap pt-0.5">{exp.startDate} – {exp.isPresent ? L.present : exp.endDate}</div>
            </div>
          ))}
        </section>
      )}
      {data.education.length > 0 && (
        <section className="mb-7">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-4">{L.education}</h2>
          {data.education.map(edu => (
            <div key={edu.id} className="mb-3 grid grid-cols-[1fr_auto] gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                <p className="text-gray-500 text-xs">{edu.school}</p>
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">{edu.startDate} – {edu.endDate}</div>
            </div>
          ))}
        </section>
      )}
      <div className="grid grid-cols-2 gap-8">
        {data.skills.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-3">{L.skills}</h2>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s, i) => (
                <span key={i} className="rounded-md bg-teal-50 border border-teal-100 px-2 py-0.5 text-xs text-teal-700">{s}</span>
              ))}
            </div>
          </section>
        )}
        {data.languages.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-3">{L.languages}</h2>
            {data.languages.map((l, i) => (
              <p key={i} className="text-xs text-gray-600">{l.name} <span className="text-gray-400">/ {l.level}</span></p>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

// --- Tech Sidebar: two-column with dark sidebar for tech roles ---
export function TechSidebarTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  return (
    <div className="bg-white text-gray-900 max-w-[210mm] mx-auto font-sans text-sm" style={{ minHeight: '297mm' }}>
      <div className="flex min-h-[297mm]">
        <aside className="w-[38%] bg-slate-900 text-white p-7 flex flex-col gap-6">
          {showPhoto && (
            <div className="mx-auto rounded-full overflow-hidden border-2 border-slate-600" style={{ width: 100, height: 100 }}>
              {data.personal.photo ? (
                <PhotoFill photo={data.personal.photo} />
              ) : (
                <div className="h-full w-full bg-slate-700" />
              )}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold leading-tight">{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-blue-400 text-xs mt-1">{data.personal.jobTitle}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              {data.personal.email && <p>{data.personal.email}</p>}
              {data.personal.phone && <p>{data.personal.phone}</p>}
              {rs.showAddress && data.personal.address && <p>{data.personal.address}</p>}
            </div>
          </div>
          {data.skills.length > 0 && (
            <div>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-2">{L.skills}</h2>
              <div className="flex flex-wrap gap-1">
                {data.skills.map((s, i) => (
                  <span key={i} className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200">{s}</span>
                ))}
              </div>
            </div>
          )}
          {data.languages.length > 0 && (
            <div>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-2">{L.languages}</h2>
              {data.languages.map((l, i) => (
                <p key={i} className="text-xs text-slate-300">{l.name} <span className="text-slate-500">· {l.level}</span></p>
              ))}
            </div>
          )}
          {data.certifications.length > 0 && (
            <div>
              <h2 className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-2">{L.certifications}</h2>
              {data.certifications.map((c, i) => (
                <p key={i} className="text-xs text-slate-300">{c}</p>
              ))}
            </div>
          )}
        </aside>
        <main className="flex-1 p-7">
          {data.summary && (
            <section className="mb-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">{L.summary}</h2>
              <p className="text-gray-600 leading-relaxed">{data.summary}</p>
            </section>
          )}
          {data.experience.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">{L.experience}</h2>
              {data.experience.map(exp => (
                <div key={exp.id} className="mb-4">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold">{exp.position}</h3>
                    <span className="text-xs text-gray-400">{exp.startDate} – {exp.isPresent ? L.present : exp.endDate}</span>
                  </div>
                  <p className="text-blue-600 text-xs mt-0.5">{exp.company}</p>
                  <p className="mt-1 text-gray-600 whitespace-pre-line">{exp.description}</p>
                </div>
              ))}
            </section>
          )}
          {data.education.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">{L.education}</h2>
              {data.education.map(edu => (
                <div key={edu.id} className="mb-3">
                  <h3 className="font-semibold">{edu.degree}</h3>
                  <p className="text-xs text-gray-500">{edu.school} · {edu.startDate} – {edu.endDate}</p>
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

// --- Corporate Navy: bold navy header, formal corporate style ---
export function CorporateNavyTemplate({ data, locale }: TemplateProps) {
  const rs = regionSettings[data.region];
  const showPhoto = shouldShowPhoto(data);
  const L = getLabels(locale);
  return (
    <div className="bg-white text-gray-900 max-w-[210mm] mx-auto font-sans text-sm leading-relaxed" style={{ minHeight: '297mm' }}>
      <header className="bg-[#0F172A] text-white px-10 py-8">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">{data.personal.fullName || 'Your Name'}</h1>
            <p className="text-blue-300 mt-1 text-sm">{data.personal.jobTitle}</p>
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-400">
              {data.personal.email && <span>{data.personal.email}</span>}
              {data.personal.phone && <span>{data.personal.phone}</span>}
              {rs.showAddress && data.personal.address && <span>{data.personal.address}</span>}
            </div>
          </div>
          {showPhoto && data.personal.photo && (
            <div className="flex-shrink-0 rounded-full overflow-hidden border-2 border-slate-600" style={{ width: 100, height: 100 }}>
              <PhotoFill photo={data.personal.photo} />
            </div>
          )}
        </div>
      </header>
      <div className="h-1 bg-blue-500" />
      <div className="p-10">
        {data.summary && (
          <section className="mb-7">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-gray-200 pb-1 mb-3">{L.summary}</h2>
            <p className="text-gray-700">{data.summary}</p>
          </section>
        )}
        {data.experience.length > 0 && (
          <section className="mb-7">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-gray-200 pb-1 mb-4">{L.experience}</h2>
            {data.experience.map(exp => (
              <div key={exp.id} className="mb-5">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold text-gray-900">{exp.position}</h3>
                  <span className="text-xs text-gray-400">{exp.startDate} – {exp.isPresent ? L.present : exp.endDate}</span>
                </div>
                <p className="text-blue-700 text-xs font-medium mt-0.5">{exp.company}</p>
                <p className="mt-2 text-gray-600 whitespace-pre-line">{exp.description}</p>
              </div>
            ))}
          </section>
        )}
        {data.education.length > 0 && (
          <section className="mb-7">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-gray-200 pb-1 mb-4">{L.education}</h2>
            {data.education.map(edu => (
              <div key={edu.id} className="mb-3">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-semibold">{edu.degree}</h3>
                  <span className="text-xs text-gray-400">{edu.startDate} – {edu.endDate}</span>
                </div>
                <p className="text-gray-500 text-xs">{edu.school}</p>
              </div>
            ))}
          </section>
        )}
        <div className="grid grid-cols-3 gap-6">
          {data.skills.length > 0 && (
            <section className="col-span-2">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-gray-200 pb-1 mb-3">{L.skills}</h2>
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map((s, i) => (
                  <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{s}</span>
                ))}
              </div>
            </section>
          )}
          {data.languages.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-gray-200 pb-1 mb-3">{L.languages}</h2>
              {data.languages.map((l, i) => (
                <p key={i} className="text-xs text-gray-600">{l.name} <span className="text-gray-400">/ {l.level}</span></p>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
    );
}

// --- Rirekisho: Standard Japanese CV format ---
export function RirekishoTemplate({ data }: TemplateProps) {
  const showPhoto = data.personal.photoEnabled !== undefined ? data.personal.photoEnabled : true;
  const gender = data.personal.gender;
  const dob = data.personal.dateOfBirth;
  const coverLetter = (data as CVData & { coverLetterContent?: string }).coverLetterContent;

  return (
    <div
      className="bg-white text-gray-900 p-8 max-w-[210mm] mx-auto text-sm leading-relaxed"
      style={{ minHeight: '297mm', fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic Pro', Meiryo, sans-serif" }}
    >
      {/* Title */}
      <div className="text-center mb-6 border-b-2 border-gray-900 pb-3">
        <h1 className="text-2xl font-bold tracking-[0.3em]">履　歴　書</h1>
        <p className="text-xs text-gray-500 mt-1">（Curriculum Vitae）</p>
      </div>

      {/* Top section: photo + personal info */}
      <div className="flex gap-6 mb-5">
        {/* Left: personal details */}
        <div className="flex-1 space-y-3">
          {/* Name */}
          <div className="border border-gray-300 rounded p-3">
            <p className="text-[10px] text-gray-500 mb-0.5">氏名 <span className="text-gray-400 text-[9px]">(Full Name)</span></p>
            <p className="text-xl font-bold tracking-wider">{data.personal.fullName || '　'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* DOB */}
            <div className="border border-gray-300 rounded p-2.5">
              <p className="text-[10px] text-gray-500 mb-0.5">生年月日</p>
              <p className="font-medium">{dob || '　'}</p>
            </div>
            {/* Gender */}
            <div className="border border-gray-300 rounded p-2.5">
              <p className="text-[10px] text-gray-500 mb-0.5">性別</p>
              <div className="flex gap-3 mt-0.5">
                {['男', '女', 'その他'].map(g => (
                  <label key={g} className="flex items-center gap-1 text-xs cursor-default">
                    <span className={`inline-block w-3.5 h-3.5 rounded-full border flex-shrink-0 ${gender === g ? 'bg-gray-900 border-gray-900' : 'border-gray-400'}`} />
                    {g}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Address */}
          {data.personal.address && (
            <div className="border border-gray-300 rounded p-2.5">
              <p className="text-[10px] text-gray-500 mb-0.5">住所</p>
              <p>{data.personal.address}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Phone */}
            {data.personal.phone && (
              <div className="border border-gray-300 rounded p-2.5">
                <p className="text-[10px] text-gray-500 mb-0.5">電話番号</p>
                <p>{data.personal.phone}</p>
              </div>
            )}
            {/* Email */}
            {data.personal.email && (
              <div className="border border-gray-300 rounded p-2.5">
                <p className="text-[10px] text-gray-500 mb-0.5">メール</p>
                <p className="text-xs break-all">{data.personal.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: photo */}
        <div className="flex-shrink-0">
          {showPhoto && data.personal.photo ? (
            <div className="w-[90px] h-[120px] border border-gray-300 overflow-hidden rounded">
              <PhotoFill photo={data.personal.photo} alt="写真" />
            </div>
          ) : (
            <div className="w-[90px] h-[120px] border border-gray-300 rounded flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <p className="text-[9px] text-gray-400">写真</p>
                <p className="text-[8px] text-gray-300">3×4cm</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Education 学歴 */}
      {data.education.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold border-b-2 border-gray-900 pb-1 mb-2 tracking-wider">学　歴</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-2 py-1 font-semibold text-left w-28">期間</th>
                <th className="border border-gray-300 px-2 py-1 font-semibold text-left">学校名・学部・学科</th>
              </tr>
            </thead>
            <tbody>
              {data.education.map((edu) => (
                <tr key={edu.id}>
                  <td className="border border-gray-300 px-2 py-1.5 text-gray-600 whitespace-nowrap">
                    {edu.startDate}{edu.startDate && edu.endDate ? '〜' : ''}{edu.endDate}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5">
                    <span className="font-medium">{edu.school}</span>
                    {edu.degree && <span className="text-gray-500 ml-2">{edu.degree}</span>}
                    {edu.description && <p className="text-gray-500 mt-0.5">{edu.description}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Work Experience 職歴 */}
      {data.experience.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold border-b-2 border-gray-900 pb-1 mb-2 tracking-wider">職　歴</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-2 py-1 font-semibold text-left w-28">期間</th>
                <th className="border border-gray-300 px-2 py-1 font-semibold text-left">会社名・職位・職務内容</th>
              </tr>
            </thead>
            <tbody>
              {data.experience.map((exp) => (
                <tr key={exp.id}>
                  <td className="border border-gray-300 px-2 py-1.5 text-gray-600 whitespace-nowrap">
                    {exp.startDate}{exp.startDate ? '〜' : ''}{exp.isPresent ? '現在' : exp.endDate}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5">
                    <p className="font-medium">{exp.company}</p>
                    {exp.position && <p className="text-gray-600">{exp.position}</p>}
                    {exp.description && <p className="text-gray-500 mt-0.5 whitespace-pre-line">{exp.description}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Skills & Languages */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {data.skills.length > 0 && (
          <section>
            <h2 className="text-sm font-bold border-b-2 border-gray-900 pb-1 mb-2 tracking-wider">スキル</h2>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s, i) => (
                <span key={i} className="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs">{s}</span>
              ))}
            </div>
          </section>
        )}
        {data.languages.length > 0 && (
          <section>
            <h2 className="text-sm font-bold border-b-2 border-gray-900 pb-1 mb-2 tracking-wider">語学</h2>
            {data.languages.map((l, i) => (
              <p key={i} className="text-xs mb-0.5"><span className="font-medium">{l.name}</span> <span className="text-gray-500">— {l.level}</span></p>
            ))}
          </section>
        )}
      </div>

      {/* Summary / PR 自己PR */}
      {data.summary && (
        <section className="mb-5">
          <h2 className="text-sm font-bold border-b-2 border-gray-900 pb-1 mb-2 tracking-wider">自己PR</h2>
          <div className="border border-gray-300 rounded p-3 min-h-[80px]">
            <p className="text-xs text-gray-700 whitespace-pre-line">{data.summary}</p>
          </div>
        </section>
      )}

      {/* Cover Letter / 添え状 */}
      {coverLetter && (
        <section className="mb-5">
          <h2 className="text-sm font-bold border-b-2 border-gray-900 pb-1 mb-2 tracking-wider">添え状</h2>
          <div className="border border-gray-300 rounded p-3 min-h-[80px]">
            <p className="text-xs text-gray-700 whitespace-pre-line">{coverLetter}</p>
          </div>
        </section>
      )}

      {/* Certifications 資格・免許 */}
      {data.certifications.length > 0 && (
        <section>
          <h2 className="text-sm font-bold border-b-2 border-gray-900 pb-1 mb-2 tracking-wider">資格・免許</h2>
          <ul className="text-xs space-y-0.5">
            {data.certifications.map((c, i) => (
              <li key={i} className="flex items-start gap-1"><span className="text-gray-400">・</span>{c}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const templateComponents: Record<string, React.ComponentType<TemplateProps>> = {
  'modern-minimal': ModernMinimalTemplate,
  'creative-bold': CreativeBoldTemplate,
  'creative-artistic': CreativeArtisticTemplate,
  'elegant-formal': ElegantFormalTemplate,
  'clean-simple': CleanSimpleTemplate,
  'professional-classic': ProfessionalClassicTemplate,
  'ats-standard': ATSStandardTemplate,
  'executive-premium': ExecutivePremiumTemplate,
  'nordic-clean': NordicCleanTemplate,
  'tech-sidebar': TechSidebarTemplate,
  'corporate-navy': CorporateNavyTemplate,
  'modern-minimal-executive': ModernMinimalTemplate,
  'contemporary-bold': CorporateNavyTemplate,
  'rirekisho': RirekishoTemplate,
};
