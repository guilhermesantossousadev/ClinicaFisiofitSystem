import { Instagram } from "lucide-react";
import { Link } from "wouter";

const Footer = () => (
  <footer className="bg-navy-deep text-white">
    <div className="mx-auto max-w-7xl px-5 pb-8 pt-16 md:px-8 md:pt-20">
      <div className="grid gap-12 border-b border-white/10 pb-12 md:grid-cols-[1.4fr_.7fr_.7fr]">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <img src="/fisiofit-logo.jpg" alt="" className="h-12 w-12 rounded-full object-cover" />
            <span className="leading-none">
              <strong className="block text-lg font-extrabold tracking-[0.12em]">FISIOFIT</strong>
              <span className="mt-1.5 block text-[9px] font-bold tracking-[0.08em] text-white/50">PILATES &amp; FISIOTERAPIA</span>
            </span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            Reabilitação, prevenção e qualidade de vida por meio do movimento.
          </p>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-extrabold">Navegação</h2>
          <div className="grid gap-2 text-sm text-white/60">
            <Link href="/sobre" className="hover:text-white">Sobre</Link>
            <Link href="/servicos" className="hover:text-white">Serviços</Link>
            <Link href="/unidades" className="hover:text-white">Unidades</Link>
            <Link href="/contato" className="hover:text-white">Contato</Link>
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-extrabold">Atendimento</h2>
          <div className="grid gap-2 text-sm text-white/60">
            <a href="tel:+5531983990321" className="hover:text-white">(31) 98399-0321</a>
            <a href="https://instagram.com/fisi0fit" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white">
              <Instagram size={15} /> @fisi0fit
            </a>
            <Link href="/links" className="hover:text-white">Links úteis</Link>
            <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
            <button type="button" onClick={() => window.dispatchEvent(new Event("fisiofit:cookie-settings"))} className="w-fit text-left hover:text-white">Configurar cookies</button>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-2 pt-6 text-xs text-white/40 sm:flex-row">
        <span>© 2026 Clínica Fisiofit. Todos os direitos reservados.</span>
        <span>Sabará · Minas Gerais</span>
      </div>
    </div>
  </footer>
);

export default Footer;
