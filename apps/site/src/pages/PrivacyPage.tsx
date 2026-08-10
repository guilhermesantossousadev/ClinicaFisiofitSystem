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
  return <Layout><PageHero eyebrow="Privacidade" title="Política de Privacidade" description="Como a Clínica Fisiofit protege e utiliza dados pessoais." /><div className="site-section-compact"><div className="site-reading-container legal-content"><div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950"><strong>Documento em validação:</strong> a política deve ser revisada juridicamente antes da publicação definitiva.</div>{sections.map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}<section><h2>Controladora e contato</h2><p>Controladora: Maria Leonilda Cordeiro dos Santos, nome fantasia Clínica Fisiofit, CNPJ 30.379.368/0001-73. Canal de privacidade: contato@clinicafisiofitsabara.com.</p></section><p className="border-t border-line pt-6 text-xs">Versão 1.0 — atualizada em 10 de agosto de 2026.</p></div></div></Layout>;
}
