import { Check, Move, PersonStanding, Plus } from "lucide-react";
import Layout from "@/components/Layout";
import { CtaBand, Eyebrow, PageHero } from "@/components/SitePrimitives";

const services = [
  { id: "pilates", icon: PersonStanding, title: "Pilates Clínico", description: "Exercícios orientados que desenvolvem força, flexibilidade, postura e controle corporal.", items: ["Prevenção de dores e lesões", "Melhora do equilíbrio e da mobilidade", "Indicado para diferentes idades"] },
  { id: "fisioterapia", icon: Plus, title: "Fisioterapia Traumato-Ortopédica", description: "Avaliação e tratamento de alterações musculares, articulares e da coluna.", items: ["Lesões e dores agudas ou crônicas", "Recuperação pós-operatória", "Retorno seguro às atividades"] },
  { id: "reabilitacao", icon: Move, title: "Reabilitação Funcional", description: "Exercícios terapêuticos voltados para recuperar movimentos importantes para sua rotina.", items: ["Ganho de força e estabilidade", "Treino de movimentos funcionais", "Retorno às atividades diárias ou esportivas"] },
];

const ServicesPage = () => (
  <Layout>
    <PageHero eyebrow="Serviços" title="Cuidado especializado para cada objetivo" description="Tratamentos personalizados para prevenir lesões, aliviar dores e recuperar movimentos com segurança." />
    <section className="px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
        {services.map(({ id, icon: Icon, title, description, items }, index) => (
          <article id={id} key={id} className="site-card scroll-mt-28 transition hover:-translate-y-1 hover:shadow-soft">
            <span className={`site-icon-badge ${index === 1 ? "bg-mint text-teal" : ""}`}><Icon /></span>
            <h2 className="site-heading-3 mt-6">{title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
            <ul className="mt-6 grid gap-3">{items.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-foreground"><Check size={17} className="mt-0.5 shrink-0 text-teal" />{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
    <section className="bg-surface px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div><Eyebrow>Como funciona</Eyebrow><h2 className="text-4xl font-black tracking-[-0.045em] text-navy md:text-5xl">Um plano construído com você</h2><p className="mt-5 text-lg leading-relaxed text-muted-foreground">O tratamento começa com uma avaliação para entender suas necessidades e definir objetivos possíveis. A partir daí, acompanhamos a evolução e ajustamos o plano sempre que necessário.</p></div>
        <div className="rounded-[2rem] bg-navy p-8 text-white shadow-soft md:p-11"><h2 className="text-3xl font-black">Etapas do atendimento</h2><ul className="mt-7 grid gap-4">{["Conversa inicial e avaliação física", "Definição do plano de cuidado", "Sessões acompanhadas por profissional", "Reavaliação e orientação preventiva"].map((item) => <li key={item} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal/20 text-[#73e0cc]"><Check size={16} /></span>{item}</li>)}</ul></div>
      </div>
    </section>
    <section className="px-5 py-20 md:px-8"><div className="mx-auto max-w-7xl"><CtaBand title="Não sabe qual tratamento é indicado?" description="Nossa equipe ajuda você a encontrar o melhor caminho." label="Solicitar avaliação" /></div></section>
  </Layout>
);

export default ServicesPage;
