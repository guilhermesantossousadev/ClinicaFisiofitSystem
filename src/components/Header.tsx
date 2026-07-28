import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Início", path: "/" },
  { label: "Sobre", path: "/sobre" },
  { label: "Serviços", path: "/servicos" },
  { label: "Unidades", path: "/unidades" },
  { label: "Contato", path: "/contato" },
];

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-white/90 shadow-sm backdrop-blur-xl animate-slide-down">
      <div className="mx-auto flex min-h-[78px] max-w-7xl items-center justify-between gap-3 px-4 md:gap-6 md:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="Fisiofit — página inicial">
          <img src="/fisiofit-logo.jpg" alt="" className="h-11 w-11 rounded-full object-cover md:h-12 md:w-12" />
          <span className="hidden leading-none sm:block">
            <strong className="block text-lg font-extrabold tracking-[0.12em] text-navy">FISIOFIT</strong>
            <span className="mt-1.5 block text-[9px] font-bold tracking-[0.08em] text-muted-foreground">
              PILATES &amp; FISIOTERAPIA
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {navLinks.map((link) => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  active ? "bg-sky text-blue-dark" : "text-muted-foreground hover:bg-sky/70 hover:text-blue-dark"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/contato"
            className="site-button px-5 text-xs sm:px-7 sm:text-sm"
          >
            Agendar avaliação
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-12 w-12 place-items-center text-navy transition hover:text-blue lg:hidden"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-line bg-white px-5 py-5 lg:hidden animate-fade-in" aria-label="Navegação móvel">
          <div className="mx-auto grid max-w-7xl gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-bold text-navy hover:bg-sky"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/contato"
              onClick={() => setMenuOpen(false)}
              className="site-button mt-2"
            >
              Agendar avaliação
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
