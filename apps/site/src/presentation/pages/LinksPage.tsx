import { ArrowLeft, Building2, Instagram, MessageCircle } from "lucide-react";
import { Link } from "wouter";

const links = [
  { label: "Agendar pelo WhatsApp", href: "https://wa.me/5531983990321?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consulta%20na%20Cl%C3%ADnica%20Fisiofit.", icon: MessageCircle },
  { label: "Instagram @fisi0fit", href: "https://instagram.com/fisi0fit", icon: Instagram },
  { label: "Unidade Lagoa", href: "https://maps.google.com/?q=R.+Ver.+Jos%C3%A9+Maria+Moreira,+461,+Praia+dos+Bandeirantes,+Sabar%C3%A1,+MG", icon: Building2 },
  { label: "Unidade Centro", href: "https://maps.google.com/?q=Rua+da+Rep%C3%BAblica,+Centro,+Sabar%C3%A1,+MG", icon: Building2 },
];

const LinksPage = () => (
  <main className="min-h-screen bg-gradient-to-br from-sky via-white to-mint px-5 py-8">
    <div className="mx-auto max-w-md text-center">
      <Link href="/" aria-label="Voltar ao site" className="grid h-11 w-11 place-items-center rounded-full bg-blue text-white transition-colors duration-200 hover:bg-blue-dark active:bg-navy"><ArrowLeft size={20} /></Link>
      <img src="/fisiofit-logo.jpg" alt="Clínica Fisiofit" className="mx-auto mt-4 h-28 w-28 rounded-full object-cover" />
      <h1 className="mt-5 text-2xl font-black tracking-[0.08em] text-navy">FISIOFIT</h1>
      <p className="mt-1 text-sm font-bold tracking-wide text-muted-foreground">PILATES &amp; FISIOTERAPIA</p>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">Reabilitação, prevenção e qualidade de vida por meio do movimento.</p>
      <div className="mt-8 grid gap-3">
        {links.map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" className="site-button min-h-16 justify-start px-5 text-left"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"><Icon size={20} /></span>{label}</a>)}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">Sabará · Minas Gerais</p>
    </div>
  </main>
);

export default LinksPage;
