import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground">
    <a
      href="#conteudo"
      className="fixed left-4 -top-20 z-[100] rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white transition-all focus:top-4"
    >
      Ir para o conteúdo
    </a>
    <Header />
    <main id="conteudo">{children}</main>
    <Footer />
  </div>
);

export default Layout;
