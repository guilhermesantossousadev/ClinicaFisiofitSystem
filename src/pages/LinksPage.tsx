import { ArrowLeft, Building2, Instagram, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-fisiofit.svg";

const links = [
  { label: "Agendar pelo WhatsApp", href: "https://wa.me/5548999999999?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consulta%20na%20Cl%C3%ADnica%20Fisiofit.", icon: MessageCircle },
  { label: "Instagram @clinicafisiofitbr", href: "https://instagram.com/clinicafisiofitbr", icon: Instagram },
  { label: "Unidade Lagoa", href: "https://maps.google.com/?q=Fisiofit+Pilates+Fisioterapia+Lagoa", icon: Building2 },
  { label: "Unidade Centro", href: "https://maps.google.com/?q=Fisiofit+Pilates+Fisioterapia+Centro", icon: Building2 },
];

const LinksPage = () => (
  <main className="min-h-screen bg-gradient-to-br from-sky via-white to-mint px-5 py-8">
    <div className="mx-auto max-w-md text-center">
      <Link to="/" aria-label="Voltar ao site" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white/80 text-navy shadow-sm"><ArrowLeft size={20} /></Link>
      <img src={logo} alt="Clínica Fisiofit" className="mx-auto mt-4 h-28 w-28 rounded-full bg-white p-2 shadow-soft" />
      <h1 className="mt-5 text-2xl font-black tracking-[0.08em] text-navy">FISIOFIT</h1>
      <p className="mt-1 text-sm font-bold tracking-wide text-muted-foreground">PILATES &amp; FISIOTERAPIA</p>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">Reabilitação, prevenção e qualidade de vida por meio do movimento.</p>
      <div className="mt-8 grid gap-3">
        {links.map(({ label, href, icon: Icon }, index) => <a key={label} href={href} target="_blank" rel="noreferrer" className={`flex min-h-16 items-center gap-3 rounded-full px-5 py-3 text-left text-sm font-extrabold shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${index === 0 ? "bg-blue text-white" : "border border-line bg-white text-navy hover:border-blue/30"}`}><span className={`grid h-10 w-10 place-items-center rounded-full ${index === 0 ? "bg-white/15 text-white" : "bg-sky text-blue"}`}><Icon size={20} /></span>{label}</a>)}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">Florianópolis · Santa Catarina</p>
    </div>
  </main>
);

export default LinksPage;
