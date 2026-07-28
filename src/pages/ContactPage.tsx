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
    window.open(`https://wa.me/5548999999999?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
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
              <li className="flex gap-4"><MessageCircle className="shrink-0 text-[#73e0cc]" /><div><strong className="block text-sm">WhatsApp</strong><a href="https://wa.me/5548999999999" target="_blank" rel="noreferrer" className="text-sm text-white/70 hover:text-white">(48) 99999-9999</a></div></li>
              <li className="flex gap-4"><Clock3 className="shrink-0 text-[#73e0cc]" /><div><strong className="block text-sm">Horário</strong><span className="text-sm text-white/70">Segunda a sexta, das 7h às 21h</span></div></li>
              <li className="flex gap-4"><Instagram className="shrink-0 text-[#73e0cc]" /><div><strong className="block text-sm">Instagram</strong><a href="https://instagram.com/clinicafisiofitbr" target="_blank" rel="noreferrer" className="text-sm text-white/70 hover:text-white">@clinicafisiofitbr</a></div></li>
            </ul>
          </aside>
          <form onSubmit={submit} className="grid gap-5 rounded-[2rem] border border-line bg-white p-7 shadow-sm md:p-10">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-extrabold text-navy">Seu nome<input required autoComplete="name" {...field("nome")} className="rounded-xl border border-line bg-surface px-4 py-3 font-normal text-foreground outline-none focus:border-blue focus:bg-white focus:ring-4 focus:ring-blue/10" /></label>
              <label className="grid gap-2 text-sm font-extrabold text-navy">WhatsApp<input required type="tel" autoComplete="tel" placeholder="(48) 99999-9999" {...field("telefone")} className="rounded-xl border border-line bg-surface px-4 py-3 font-normal text-foreground outline-none focus:border-blue focus:bg-white focus:ring-4 focus:ring-blue/10" /></label>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-extrabold text-navy">Unidade preferida<select required {...field("unidade")} className="rounded-xl border border-line bg-surface px-4 py-3 font-normal text-foreground outline-none focus:border-blue"><option value="">Selecione</option><option>Unidade Lagoa</option><option>Unidade Centro</option><option>Não tenho preferência</option></select></label>
              <label className="grid gap-2 text-sm font-extrabold text-navy">Tenho interesse em<select required {...field("servico")} className="rounded-xl border border-line bg-surface px-4 py-3 font-normal text-foreground outline-none focus:border-blue"><option value="">Selecione</option><option>Pilates Clínico</option><option>Fisioterapia</option><option>Reabilitação Funcional</option><option>Preciso de orientação</option></select></label>
            </div>
            <label className="grid gap-2 text-sm font-extrabold text-navy">Como podemos ajudar?<textarea rows={5} placeholder="Conte brevemente o que você precisa" {...field("mensagem")} className="resize-y rounded-xl border border-line bg-surface px-4 py-3 font-normal text-foreground outline-none focus:border-blue focus:bg-white focus:ring-4 focus:ring-blue/10" /></label>
            <button type="submit" className="inline-flex w-fit items-center gap-2 rounded-full bg-blue px-6 py-3.5 text-sm font-extrabold text-white shadow-blue hover:bg-blue-dark">Enviar pelo WhatsApp <Send size={16} /></button>
            <p className="text-xs text-muted-foreground">Ao clicar, o WhatsApp será aberto com sua mensagem pronta. Nenhum dado é armazenado neste site.</p>
          </form>
        </div>
      </section>
    </Layout>
  );
};

export default ContactPage;
