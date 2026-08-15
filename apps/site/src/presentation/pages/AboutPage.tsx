import { Check } from "lucide-react";
import Layout from "@/components/Layout";
import { CtaBand, Eyebrow, PageHero } from "@/components/SitePrimitives";
import storyImage from "@/assets/fachada-fisiofit.avif";

const values = [
  ["01", "Acolhimento", "Escutamos com atenção e respeitamos o momento, os limites e os objetivos de cada pessoa."],
  ["02", "Excelência", "Buscamos evolução profissional constante e escolhas terapêuticas responsáveis."],
  ["03", "Autonomia", "Mais do que aliviar sintomas, ajudamos você a recuperar confiança no próprio corpo."],
];

const AboutPage = () => (
  <Layout>
    <PageHero eyebrow="Sobre a Fisiofit" title="Cuidado que começa pela escuta" description="Acreditamos que entender sua história é o primeiro passo para construir um tratamento que faça sentido para a sua vida." />
    <section className="px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <Eyebrow>Nossa essência</Eyebrow>
          <h2 className="text-4xl font-black leading-tight tracking-[-0.045em] text-navy md:text-5xl">Movimento como caminho para viver melhor</h2>
          <p className="mt-6 leading-relaxed text-muted-foreground">A Clínica Fisiofit nasceu para oferecer um atendimento próximo, técnico e humano. Unimos fisioterapia, Pilates clínico e reabilitação funcional para cuidar de cada pessoa de forma integral.</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">Nossa equipe olha além do sintoma: consideramos sua rotina, seus objetivos e o que realmente importa para você. Assim, cada plano de cuidado é único e evolui junto com o paciente.</p>
        </div>
        <div className="relative overflow-hidden rounded-[2rem]">
          <img src={storyImage} alt="Fachada da Clínica Fisiofit" className="aspect-[4/5] w-full object-cover" loading="lazy" decoding="async" width="1067" height="1600" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/10 to-transparent" />
          <div className="absolute bottom-0 p-7 text-white md:p-9">
            <h3 className="text-2xl font-black">O que você encontra aqui</h3>
            <p className="mt-2 text-sm text-white/70">Um ambiente preparado para acolher diferentes necessidades e fases da vida.</p>
            <ul className="mt-5 grid gap-2 text-sm font-semibold">
              {["Atendimento individualizado", "Condutas baseadas em avaliação", "Comunicação clara e acolhedora", "Foco em autonomia e qualidade de vida"].map((item) => <li key={item} className="flex gap-2"><Check size={17} className="text-[#73e0cc]" />{item}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
    <section className="bg-surface px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center"><Eyebrow centered>Nossos valores</Eyebrow><h2 className="text-4xl font-black tracking-[-0.045em] text-navy md:text-5xl">O que orienta cada atendimento</h2></div>
        <div className="grid gap-6 md:grid-cols-3">
          {values.map(([number, title, text]) => <article key={number} className="rounded-3xl border border-line bg-white p-8"><span className="font-extrabold tracking-widest text-teal">{number}</span><h3 className="mt-4 text-2xl font-black text-navy">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p></article>)}
        </div>
      </div>
    </section>
    <section className="px-5 py-20 md:px-8"><div className="mx-auto max-w-7xl"><CtaBand title="Vamos construir sua jornada de recuperação?" description="Agende uma avaliação e conte para nós como podemos ajudar." label="Falar com a equipe" /></div></section>
  </Layout>
);

export default AboutPage;
