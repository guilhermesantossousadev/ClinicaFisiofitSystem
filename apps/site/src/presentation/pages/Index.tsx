import { ArrowRight, Check, Move, PersonStanding, Plus } from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { CtaBand, Eyebrow } from "@/components/SitePrimitives";
import heroImage from "@/assets/hero-fisiofit.jpeg";
import storyImage from "@/assets/cuidado-humano-fisiofit.jpeg";

const services = [
  { icon: PersonStanding, title: "Pilates Clínico", text: "Força, mobilidade, equilíbrio e consciência corporal com exercícios adaptados para você.", hash: "pilates" },
  { icon: Plus, title: "Fisioterapia", text: "Recuperação de lesões, pós-operatórios e dores musculares ou articulares com cuidado especializado.", hash: "fisioterapia" },
  { icon: Move, title: "Reabilitação Funcional", text: "Treino terapêutico para retomar movimentos e atividades do dia a dia com segurança.", hash: "reabilitacao" },
];

const Index = () => (
  <Layout>
    <section className="relative overflow-hidden bg-gradient-to-br from-[#f7fbfe] via-white to-mint px-5 py-16 md:px-8 md:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div className="relative z-10 animate-fade-in">
          <Eyebrow>Cuidado em cada movimento</Eyebrow>
          <h1 className="max-w-3xl text-5xl font-black leading-[.96] tracking-[-0.06em] text-navy md:text-7xl lg:text-[5.4rem]">
            Movimente-se melhor. <span className="text-blue">Viva sem limitações.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Tratamentos personalizados de pilates e fisioterapia para aliviar dores, recuperar sua autonomia e devolver confiança ao seu corpo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contato" className="site-button">
              Agendar minha avaliação
            </Link>
            <Link href="/servicos" className="site-button-secondary">
              Conhecer tratamentos
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-muted-foreground">
            {["Atendimento individualizado", "Profissionais especializados", "Duas unidades"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2"><Check size={15} className="text-teal" />{item}</span>
            ))}
          </div>
        </div>
        <div className="relative min-h-[440px] overflow-hidden rounded-[2.25rem] bg-sky shadow-soft md:min-h-[560px]">
          <img src={heroImage} alt="Profissional da Clínica Fisiofit sentada em uma bola de Pilates no estúdio" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/55 via-transparent to-blue/10" />
          <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4 rounded-2xl border border-white/50 bg-white/90 p-4 shadow-lg backdrop-blur-md">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-teal"><Check /></span>
            <span><strong className="block text-sm text-navy">Seu plano, no seu ritmo</strong><small className="text-muted-foreground">Acompanhamento próximo em todas as etapas</small></span>
          </div>
        </div>
      </div>
    </section>

    <section className="px-5 py-12 md:px-8">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-3xl border border-line bg-white shadow-sm sm:grid-cols-3">
        {[
          ["2 unidades", "para estar mais perto de você"],
          ["3 especialidades", "integradas ao seu tratamento"],
          ["1 plano único", "construído para seus objetivos"],
        ].map(([title, text], index) => (
          <div key={title} className={`p-7 text-center ${index ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
            <strong className="block text-2xl font-black text-navy">{title}</strong>
            <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
          </div>
        ))}
      </div>
    </section>

    <section className="bg-surface px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Eyebrow centered>Nossos cuidados</Eyebrow>
          <h2 className="text-4xl font-black tracking-[-0.045em] text-navy md:text-5xl">Tratamentos pensados para a sua rotina</h2>
          <p className="mt-5 text-lg text-muted-foreground">Da prevenção à recuperação, cada atendimento começa com uma avaliação cuidadosa das suas necessidades.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {services.map(({ icon: Icon, title, text, hash }, index) => (
            <article key={title} className="group rounded-3xl border border-line bg-white p-8 transition duration-300 hover:-translate-y-1.5 hover:shadow-soft">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${index === 1 ? "bg-mint text-teal" : "bg-sky text-blue"}`}><Icon /></span>
              <h3 className="mt-6 text-xl font-extrabold text-navy">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
              <Link href={`/servicos#${hash}`} className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-blue-dark">Saiba mais <ArrowRight size={16} /></Link>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative">
          <img src={storyImage} alt="Profissional da Fisiofit praticando Pilates no reformer" className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-soft" loading="lazy" />
          <div className="absolute -bottom-5 -right-3 rounded-2xl bg-navy p-6 text-white shadow-xl md:-right-6">
            <strong className="text-3xl font-black">Cuidado</strong>
            <span className="block text-sm text-white/65">humano e individualizado</span>
          </div>
        </div>
        <div>
          <Eyebrow>Por que a Fisiofit</Eyebrow>
          <h2 className="text-4xl font-black leading-tight tracking-[-0.045em] text-navy md:text-5xl">Cuidado humano com foco em resultados reais</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Você não recebe um tratamento genérico. Entendemos sua história, definimos objetivos claros e acompanhamos sua evolução de perto.</p>
          <ul className="mt-8 grid gap-4">
            {["Avaliação detalhada e definição de objetivos", "Plano terapêutico personalizado", "Acompanhamento da sua evolução", "Orientações para manter os resultados"].map((item) => (
              <li key={item} className="flex items-center gap-3 font-semibold text-navy"><span className="grid h-7 w-7 place-items-center rounded-full bg-mint text-teal"><Check size={16} /></span>{item}</li>
            ))}
          </ul>
          <Link href="/sobre" className="site-button-secondary mt-8">Conheça a Fisiofit <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>

    <section className="bg-surface px-5 py-20 md:px-8">
      <div className="mx-auto max-w-7xl"><CtaBand title="Seu próximo movimento pode começar hoje." description="Converse com nossa equipe e agende uma avaliação." label="Quero agendar" /></div>
    </section>
  </Layout>
);

export default Index;
