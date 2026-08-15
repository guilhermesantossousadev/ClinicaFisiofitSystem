import { PUBLIC_PRIVACY_POLICY } from "@fisiofit/contracts";
import Layout from "@/components/Layout";
import { PageHero } from "@/components/SitePrimitives";

export default function PrivacyPage() {
  const { controller, sections, updatedAt, version } = PUBLIC_PRIVACY_POLICY;

  return <Layout><PageHero eyebrow="Privacidade" title="Política de Privacidade" description="Como a Clínica Fisiofit protege e utiliza dados pessoais." /><div className="site-section-compact"><div className="site-reading-container legal-content">{sections.map(({ title, text })=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}<section><h2>Controladora e contato</h2><p>Controladora: {controller.legalName}, nome fantasia {controller.tradeName}, {controller.document}. Canal de privacidade: <a href={`mailto:${controller.privacyEmail}`}>{controller.privacyEmail}</a>.</p></section><p className="border-t border-line pt-6 text-xs">Versão {version} — atualizada em {updatedAt}.</p></div></div></Layout>;
}
