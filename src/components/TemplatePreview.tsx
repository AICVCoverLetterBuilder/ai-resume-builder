'use client';

import React from 'react';
import { TemplateId } from '@/lib/types';
import { templateComponents } from '@/components/cv-templates';
import type { CVData } from '@/lib/types';

interface TemplatePreviewProps {
  templateId: TemplateId;
}

// Sample CV data used to populate the preview. Each profile shows variety
// that matches the template's typical use-case (creative, executive, tech).
function getSampleData(templateId: TemplateId): CVData {
  const isExecutive =
    templateId === 'executive-premium' ||
    templateId === 'elegant-formal' ||
    templateId === 'corporate-navy' ||
    templateId === 'professional-classic';

  const isCreative =
    templateId === 'creative-bold' || templateId === 'creative-artistic';

  const isTech =
    templateId === 'tech-sidebar' ||
    templateId === 'ats-standard' ||
    templateId === 'modern-minimal' ||
    templateId === 'nordic-clean';

  const isJapanese = templateId === 'rirekisho';

  let personal: CVData['personal'];
  let experience: CVData['experience'];
  let education: CVData['education'];
  let skills: CVData['skills'];
  let languages: CVData['languages'];
  let summary: string;

  if (isJapanese) {
    personal = {
      fullName: '山田 太郎',
      jobTitle: 'ソフトウェアエンジニア',
      email: 'taro@example.jp',
      phone: '090-1234-5678',
      address: '東京都渋谷区',
      dateOfBirth: '1990/04/15',
      gender: '男',
      photoEnabled: false,
    };
    experience = [
      { id: '1', company: '株式会社テック', position: 'エンジニア', startDate: '2018-04', endDate: '', isPresent: true, description: 'Webアプリ開発' },
    ];
    education = [
      { id: '1', school: '東京大学', degree: '工学部', startDate: '2010-04', endDate: '2014-03', description: '' },
    ];
    skills = ['JavaScript', 'React', 'Node.js'];
    languages = [{ name: 'Japanese', level: 'Native' }, { name: 'English', level: 'Business' }];
    summary = '積極的なエンジニアです。';
  } else if (isExecutive) {
    personal = {
      fullName: 'Marcus Thorne',
      jobTitle: 'Sales Director',
      email: 'm.thorne@corp.com',
      phone: '+1 212 555 0198',
      address: 'New York, NY',
      photo: 'https://i.pravatar.cc/150?u=marcus',
      photoEnabled: true,
    };
    experience = [
      { id: '1', company: 'Global Ventures', position: 'Sales Director', startDate: '2019-03', endDate: '', isPresent: true, description: 'Led a team of 20 sales reps, exceeding quarterly targets by 35% consistently.' },
      { id: '2', company: 'Apex Solutions', position: 'Senior Manager', startDate: '2015-06', endDate: '2019-02', isPresent: false, description: 'Managed key enterprise accounts and drove $12M in annual revenue.' },
    ];
    education = [
      { id: '1', school: 'Harvard Business School', degree: 'MBA', startDate: '2012-09', endDate: '2014-05', description: '' },
    ];
    skills = ['Strategic Planning', 'Leadership', 'Negotiation', 'CRM', 'Forecasting'];
    languages = [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Intermediate' }];
    summary = 'Results-driven executive with 10+ years driving revenue growth and building high-performance teams.';
  } else if (isCreative) {
    personal = {
      fullName: 'Sofia Rossi',
      jobTitle: 'Creative Director',
      email: 's.rossi@studio.io',
      phone: '+39 02 123 4567',
      address: 'Milan, Italy',
      photo: 'https://i.pravatar.cc/150?u=sofia',
      photoEnabled: true,
    };
    experience = [
      { id: '1', company: 'Studio Visiva', position: 'Creative Director', startDate: '2020-01', endDate: '', isPresent: true, description: 'Directed brand campaigns for Fortune 500 clients across Europe and North America.' },
      { id: '2', company: 'Pixel & Co', position: 'Senior Designer', startDate: '2016-03', endDate: '2019-12', isPresent: false, description: 'Designed visual identities for 50+ brands.' },
    ];
    education = [
      { id: '1', school: 'Politecnico di Milano', degree: 'MA Graphic Design', startDate: '2012-09', endDate: '2014-07', description: '' },
    ];
    skills = ['Figma', 'Adobe CC', 'Brand Strategy', 'Motion Design', 'Art Direction'];
    languages = [{ name: 'Italian', level: 'Native' }, { name: 'English', level: 'Fluent' }];
    summary = 'Award-winning creative director with a passion for bold, purposeful design that connects brands to people.';
  } else if (isTech) {
    personal = {
      fullName: 'John Carter',
      jobTitle: 'Software Engineer',
      email: 'john.carter@dev.io',
      phone: '+1 415 555 2671',
      address: 'San Francisco, CA',
      photo: 'https://i.pravatar.cc/150?u=john',
      photoEnabled: true,
    };
    experience = [
      { id: '1', company: 'Acme Corp', position: 'Senior Engineer', startDate: '2021-01', endDate: '', isPresent: true, description: 'Built scalable microservices handling 10M+ requests/day using Node.js and Kubernetes.' },
      { id: '2', company: 'ByteWorks', position: 'Full Stack Developer', startDate: '2018-06', endDate: '2020-12', isPresent: false, description: 'Developed React front-ends and REST APIs for SaaS products.' },
    ];
    education = [
      { id: '1', school: 'Stanford University', degree: 'BS Computer Science', startDate: '2014-09', endDate: '2018-06', description: '' },
    ];
    skills = ['TypeScript', 'React', 'Node.js', 'Docker', 'PostgreSQL', 'AWS'];
    languages = [{ name: 'English', level: 'Native' }];
    summary = 'Full-stack engineer with 6+ years building high-performance web applications and cloud infrastructure.';
  } else {
    // Default (contemporary-bold, clean-simple, etc.)
    personal = {
      fullName: 'Alex Morgan',
      jobTitle: 'Product Manager',
      email: 'alex.morgan@work.com',
      phone: '+1 650 555 1234',
      address: 'Austin, TX',
      photo: 'https://i.pravatar.cc/150?u=alex',
      photoEnabled: true,
    };
    experience = [
      { id: '1', company: 'Innovate Inc', position: 'Product Manager', startDate: '2020-03', endDate: '', isPresent: true, description: 'Launched 3 products from 0 to 100K users each within 12 months.' },
      { id: '2', company: 'StartupXYZ', position: 'Associate PM', startDate: '2017-07', endDate: '2020-02', isPresent: false, description: 'Defined roadmap and delivered key features for B2B SaaS platform.' },
    ];
    education = [
      { id: '1', school: 'UT Austin', degree: 'BS Business Administration', startDate: '2013-09', endDate: '2017-05', description: '' },
    ];
    skills = ['Product Strategy', 'Agile', 'Data Analysis', 'Roadmapping', 'Stakeholder Management'];
    languages = [{ name: 'English', level: 'Native' }, { name: 'Spanish', level: 'Intermediate' }];
    summary = 'Product manager with 7+ years turning user insights into products people love.';
  }

  return {
    id: 'preview',
    name: 'Preview',
    personal,
    summary,
    experience,
    education,
    skills,
    languages,
    certifications: [],
    templateId,
    region: isJapanese ? 'Japan' : 'US',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ templateId }) => {
  const TemplateComponent = templateComponents[templateId];

  if (!TemplateComponent) {
    return (
      <div className="bg-white h-full w-full rounded-sm overflow-hidden flex items-center justify-center">
        <p className="text-xs text-gray-400">Preview unavailable</p>
      </div>
    );
  }

  const sampleData = getSampleData(templateId);

  return (
    // Outer container: clips and scales the full-size template down to fit the card
    <div
      className="bg-white h-full w-full rounded-sm overflow-hidden"
      style={{ position: 'relative' }}
    >
      {/*
        Scale the full A4-width template (210mm ≈ 794px) down to fit inside
        the card container. We use a fixed origin-top-left scale so the visual
        output is pixel-perfect identical to the full preview — just smaller.

        The outer div has overflow:hidden, so any overflow is clipped cleanly.
        We use a transform wrapper with pointer-events:none so the template
        doesn't interfere with the card click handler.
      */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          // Scale to ~18% of original size so 794px → ~143px card width
          transform: 'scale(0.18)',
          transformOrigin: 'top left',
          width: '555%',   // 100 / 0.18 = 555%  → restores logical width for the template
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <TemplateComponent data={sampleData} locale="en" />
      </div>
    </div>
  );
};
