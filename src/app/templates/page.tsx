'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useI18n } from '@/lib/i18n/context';
import { templateInfo, type TemplateId } from '@/lib/types';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { TemplatePreview } from '@/components/TemplatePreview';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function TemplatesPage() {
  const { t } = useI18n();

  const categoryMap: Record<string, keyof typeof t.templates.categories> = {
    'ATS-Friendly': 'ats',
    'Creative': 'creative',
    'Executive': 'executive',
    'Modern': 'modern'
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h1 className="text-3xl font-bold sm:text-4xl text-foreground">{t.templates.title}</h1>
              <p className="mt-3 text-lg text-muted-foreground">{t.templates.subtitle}</p>
            </motion.div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.entries(templateInfo) as [TemplateId, typeof templateInfo[TemplateId]][]).map(([id, info]) => {
                  const translatedItem = t.templates.items[id];
                  // Use the category from the translation if possible, otherwise use the one in templateInfo
                  const translatedCategory = translatedItem?.category || t.templates.categories[categoryMap[info.category] || 'modern'];

                  return (
                    <motion.div key={id} variants={fadeUp}>
                      <Link href="/cv-builder" className="group block h-full">
                        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-foreground/20 hover:shadow-xl hover:-translate-y-1.5">
                          <div className="relative aspect-[1/1.4] w-full bg-muted/40 overflow-hidden shrink-0">
                            {info.isPro && (
                              <div className="absolute top-3 end-3 z-10 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-md">
                                <Crown className="h-3 w-3" />{t.templates.proBadge}
                              </div>
                            )}
                            <div className="absolute inset-0 p-4 transition-transform duration-500 ease-out group-hover:scale-[1.05]">
                                <TemplatePreview templateId={id} />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                          </div>
                          <div className="p-4 border-t border-border flex flex-col flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-sm text-foreground leading-tight">{translatedItem?.name || info.name}</h3>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap">
                                {translatedCategory}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {translatedItem?.description || info.description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
