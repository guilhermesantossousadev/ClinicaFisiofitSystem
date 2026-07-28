import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";

const NotFound = () => (
  <Layout>
    <section className="grid min-h-[65vh] place-items-center bg-gradient-to-br from-sky via-white to-mint px-5 text-center">
      <div>
        <span className="text-sm font-extrabold uppercase tracking-[0.16em] text-blue">Erro 404</span>
        <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] text-navy md:text-7xl">Página não encontrada</h1>
        <p className="mx-auto mt-5 max-w-lg text-muted-foreground">O endereço acessado não existe ou foi removido.</p>
        <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue px-6 py-3.5 text-sm font-extrabold text-white hover:bg-blue-dark"><ArrowLeft size={16} /> Voltar ao início</Link>
      </div>
    </section>
  </Layout>
);

export default NotFound;
