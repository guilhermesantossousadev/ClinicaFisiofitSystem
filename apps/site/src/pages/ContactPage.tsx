import { useState, type FormEvent } from "react";
import { Clock3, Instagram, MessageCircle, Send } from "lucide-react";
import Layout from "@/components/Layout";
import { PageHero } from "@/components/SitePrimitives";

const ContactPage = () => {
  const [form, setForm] = useState({ nome: "", telefone: "", unidade: "", servico: "", mensagem: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = [
      "Olá! Gostaria de solicitar um atendimento na Clínica Fisiofit.",
      "",
      `Nome: ${form.nome}`,
      `Telefone: ${form.telefone}`,
      `Unidade: ${form.unidade}`,
      `Interesse: ${form.servico}`,
      `Mensagem: ${form.mensagem || "Não informada"}`,
    ].join("\n");
    window.open(`https://wa.me/5531983990321?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value }) });

  return (
    <Layout>
      <PageHero eyebrow="Contato" title="Vamos cuidar do seu movimento?" description="Preencha os dados e envie sua solicitação pelo WhatsApp. Nossa equipe continuará o atendimento por lá." />
      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl items-start gap-7 lg:grid-cols-[.8fr_1.2fr]">
          <aside className="rounded-[2rem] bg-navy p-8 text-white shadow-soft md:p-10">
            <h2 className="text-3xl font-black">Fale com a Fisiofit</h2>
            <p className="mt-3 text-white/65">Estamos prontos para tirar suas dúvidas e ajudar no agendamento.</p>
            <ul className="mt-9 grid gap-6">
              <li className="flex gap-4"><MessageCircle className="shrink-0 text-[#73e0cc]" /><div><strong className="block text-sm">WhatsApp</strong><a href="https://wa.me/5531983990321" target="_blank" rel="noreferrer" className="text-sm text-white/70 hover:text-white">(31) 98399-0321</a></div></li>
              <li className="flex gap-4"><Clock3 className="shrink-0 text-[#73e0cc]" /><div><strong className="block text-sm">Horário</strong><span className="text-sm text-white/70">Segunda a sexta, das 6h às 20h</span></div></li>
              <li className="flex gap-4"><Instagram className="shrink-0 text-[#73e0cc]" /><div><strong className="block text-sm">Instagram</strong><a href="https://instagram.com/fisi0fit" target="_blank" rel="noreferrer" className="text-sm text-white/70 hover:text-white">@fisi0fit</a></div></li>
            </ul>
          </aside>
          <form onSubmit={submit} className="form-card">
            <div className="form-grid">
              <label className="form-field">Seu nome<input required autoComplete="name" {...field("nome")} className="form-control" /></label>
              <label className="form-field">WhatsApp<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="(31) 98399-0321" {...field("telefone")} className="form-control" /></label>
            </div>
            <div className="form-grid">
              <label className="form-field">Unidade preferida<select required {...field("unidade")} className="form-control"><option value="">Selecione</option><option>Unidade Lagoa</option><option>Unidade Centro</option><option>Não tenho preferência</option></select></label>
              <label className="form-field">Tenho interesse em<select required {...field("servico")} className="form-control"><option value="">Selecione</option><option>Pilates Clínico</option><option>Fisioterapia</option><option>Reabilitação Funcional</option><option>Preciso de orientação</option></select></label>
            </div>
            <label className="form-field">Como podemos ajudar?<textarea rows={5} placeholder="Conte brevemente o que você precisa" {...field("mensagem")} className="form-control" /></label>
            <p className="text-xs leading-relaxed text-muted-foreground">Usaremos estes dados para responder à sua solicitação. Você será direcionado ao WhatsApp, operado pela Meta. Evite informar dados clínicos neste formulário. Consulte nossa <a href="/privacidade" className="font-bold text-blue underline">Política de Privacidade</a>.</p>
            <button type="submit" className="site-button w-fit">Enviar pelo WhatsApp <Send size={16} /></button>
            <p className="text-xs text-muted-foreground">Ao clicar, o WhatsApp será aberto com sua mensagem pronta. O site não envia nem armazena o conteúdo em servidor próprio.</p>
          </form>
        </div>
      </section>
    </Layout>
  );
};

export default ContactPage;
