import { useEffect } from "react";
import { useLocation } from "wouter";

const origin = "https://clinicafisiofitsabara.com";
const defaults = {
  title: "Clínica Fisiofit | Fisioterapia e Pilates em Sabará",
  description: "Fisioterapia, Pilates clínico e reabilitação funcional com atendimento individualizado em Sabará, MG. Agende sua avaliação.",
};

const pages: Record<string, { title: string; description: string }> = {
  "/": defaults,
  "/sobre": { title: "Sobre a Fisiofit | Clínica Fisiofit", description: "Conheça a Clínica Fisiofit, sua abordagem humana e o cuidado individualizado em fisioterapia e Pilates clínico." },
  "/servicos": { title: "Fisioterapia e Pilates em Sabará | Fisiofit", description: "Conheça os tratamentos de fisioterapia, Pilates clínico e reabilitação funcional oferecidos pela Fisiofit." },
  "/unidades": { title: "Unidades da Clínica Fisiofit em Sabará", description: "Veja endereços, horários e contatos das unidades Lagoa e Centro da Clínica Fisiofit em Sabará, MG." },
  "/contato": { title: "Agende sua avaliação | Clínica Fisiofit", description: "Fale com a equipe da Clínica Fisiofit e agende uma avaliação de fisioterapia ou Pilates em Sabará." },
  "/links": { title: "Links oficiais | Clínica Fisiofit", description: "Acesse os canais, contatos e links oficiais da Clínica Fisiofit." },
  "/privacidade": { title: "Política de Privacidade | Clínica Fisiofit", description: "Consulte como a Clínica Fisiofit trata e protege dados pessoais." },
  "/cookies": { title: "Política de Cookies | Clínica Fisiofit", description: "Entenda como o site da Clínica Fisiofit utiliza cookies e gerencie suas preferências." },
};

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

export default function SeoMetadata() {
  const [location] = useLocation();
  useEffect(() => {
    const path = location === "/" ? "/" : location.replace(/\/$/, "");
    const metadata = pages[path] ?? { title: "Página não encontrada | Clínica Fisiofit", description: defaults.description };
    const canonicalUrl = new URL(path, origin).toString();
    document.title = metadata.title;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = canonicalUrl;
    upsertMeta('meta[name="description"]', "name", "description", metadata.description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", metadata.title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", metadata.description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
  }, [location]);
  return null;
}
