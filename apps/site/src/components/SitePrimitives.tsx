import type { ReactNode } from "react";
import { Link } from "wouter";

export const Eyebrow = ({ children, centered = false }: { children: ReactNode; centered?: boolean }) => (
  <span className={`mb-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-blue-dark ${centered ? "justify-center" : ""}`}>
    {!centered && <span className="h-0.5 w-6 rounded bg-teal" />}
    {children}
  </span>
);

export const PageHero = ({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) => (
  <section className="overflow-hidden bg-gradient-to-br from-sky via-white to-mint px-5 py-16 text-center md:px-8 md:py-24">
    <div className="mx-auto max-w-4xl animate-fade-in">
      <Eyebrow centered>{eyebrow}</Eyebrow>
      <h1 className="text-4xl font-black leading-[1.04] tracking-[-0.045em] text-navy md:text-6xl">{title}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
    </div>
  </section>
);

export const CtaBand = ({ title, description, label = "Agendar avaliação" }: { title: string; description: string; label?: string }) => (
  <div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] bg-gradient-to-br from-navy to-[#1b5772] p-8 text-white shadow-soft md:flex-row md:items-center md:p-12">
    <div>
      <h2 className="max-w-2xl text-3xl font-black leading-tight tracking-[-0.035em] md:text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-white/75">{description}</p>
    </div>
    <Link href="/contato" className="site-button shrink-0">
      {label}
    </Link>
  </div>
);

export const SectionIntro = ({ eyebrow, title, description, centered = false }: { eyebrow: string; title: string; description?: string; centered?: boolean }) => (
  <div className={`${centered ? "mx-auto text-center" : ""} max-w-3xl`}>
    <Eyebrow centered={centered}>{eyebrow}</Eyebrow>
    <h2 className="site-heading-2">{title}</h2>
    {description && <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{description}</p>}
  </div>
);
