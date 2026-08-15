import { Clock3, ExternalLink, MapPin, Phone } from "lucide-react";
import Layout from "@/components/Layout";
import { CtaBand, PageHero } from "@/components/SitePrimitives";
import lagoaImage from "@/assets/studio-lagoa.avif";
import centroImage from "@/assets/studio-centro.avif";

const units = [
  { name: "Unidade Lagoa", address: "R. Ver. José Maria Moreira, 461", city: "Praia dos Bandeirantes · Sabará · MG", phone: "(31) 98399-0321", href: "tel:+5531983990321", map: "https://maps.google.com/?q=R.+Ver.+Jos%C3%A9+Maria+Moreira,+461,+Praia+dos+Bandeirantes,+Sabar%C3%A1,+MG", image: lagoaImage },
  { name: "Unidade Centro", address: "Rua da República, Centro", city: "Sabará · MG", phone: "(31) 98399-0321", href: "tel:+5531983990321", map: "https://maps.google.com/?q=Rua+da+Rep%C3%BAblica,+Centro,+Sabar%C3%A1,+MG", image: centroImage },
];

const StudiosPage = () => (
  <Layout>
    <PageHero eyebrow="Unidades" title="Escolha a Fisiofit mais perto de você" description="Dois espaços preparados para oferecer conforto, segurança e um atendimento acolhedor." />
    <section className="px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-7 md:grid-cols-2">
        {units.map((unit) => (
          <article key={unit.name} className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-sm">
            <div className="relative h-72 overflow-hidden">
              <img src={unit.image} alt={`Ambiente da ${unit.name}`} className="h-full w-full object-cover transition duration-700 hover:scale-105" loading="lazy" decoding="async" width="1600" height="1067" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/45 to-transparent" />
              <span className="absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-extrabold text-navy backdrop-blur"><MapPin size={15} className="text-blue" /> Sabará</span>
            </div>
            <div className="p-7 md:p-9">
              <h2 className="text-3xl font-black text-navy">{unit.name}</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-blue" /><span>{unit.address}<br /><span className="text-muted-foreground">{unit.city}</span></span></div>
                <a href={unit.href} className="flex items-center gap-3 hover:text-blue-dark"><Phone size={18} className="text-blue" />{unit.phone}</a>
                <div className="flex items-center gap-3"><Clock3 size={18} className="text-blue" />Segunda a sexta, das 6h às 20h</div>
              </div>
              <a href={unit.map} target="_blank" rel="noreferrer" className="site-button mt-7">Abrir no Google Maps <ExternalLink size={15} /></a>
            </div>
          </article>
        ))}
      </div>
    </section>
    <section className="bg-surface px-5 py-20 md:px-8"><div className="mx-auto max-w-7xl"><CtaBand title="Pronto para cuidar do seu movimento?" description="Escolha a unidade e fale diretamente com nossa equipe." label="Agendar atendimento" /></div></section>
  </Layout>
);

export default StudiosPage;
