import Layout from "@/components/Layout";
import { PageHero } from "@/components/SitePrimitives";

const sections = [
  ["Quais dados tratamos", "No site, tratamos os dados informados no contato, como nome, telefone, unidade de interesse e mensagem. No atendimento e no sistema interno também podem existir dados cadastrais, financeiros e dados de saúde necessários à prestação dos serviços."],
  ["Para que usamos", "Usamos os dados para responder solicitações, organizar atendimentos, cumprir obrigações legais e profissionais, executar serviços contratados, proteger a clínica e seus pacientes e, quando aplicável, realizar comunicações autorizadas."],
  ["Compartilhamentos", "Os dados podem ser tratados por fornecedores de infraestrutura e comunicação estritamente necessários, incluindo Supabase, Hostinger e Meta/WhatsApp. Publicidade do Google permanece desativada até a autorização de cookies."],
  ["Conservação e segurança", "Mantemos os dados pelo período necessário à finalidade e às obrigações legais e profissionais. Aplicamos controle de acesso, autenticação multifator, segregação por unidade, registros de auditoria e armazenamento privado."],
  ["Seus direitos", "Você pode solicitar confirmação, acesso, correção, informações sobre compartilhamentos, oposição, revogação e eliminação quando aplicável. Alguns registros clínicos e financeiros precisam ser conservados por obrigação legal ou regulatória."],
];

export default function PrivacyPage() {
  return <Layout><PageHero eyebrow="Privacidade" title="Política de Privacidade" description="Como a Clínica Fisiofit protege e utiliza dados pessoais." /><main className="px-5 py-16 md:px-8"><div className="mx-auto max-w-3xl space-y-8 text-muted-foreground"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><strong>Documento em validação:</strong> a razão social, o CNPJ e o e-mail dedicado de privacidade serão inseridos antes da publicação em produção.</div>{sections.map(([title,text])=><section key={title}><h2 className="text-2xl font-black text-navy">{title}</h2><p className="mt-3 leading-relaxed">{text}</p></section>)}<section><h2 className="text-2xl font-black text-navy">Controladora e contato</h2><p className="mt-3 leading-relaxed">Controladora: Clínica Fisiofit — razão social e CNPJ pendentes de confirmação. Canal de privacidade: endereço dedicado pendente de confirmação.</p></section><p className="text-xs">Versão 1.0 — atualizada em 2 de agosto de 2026.</p></div></main></Layout>;
}
