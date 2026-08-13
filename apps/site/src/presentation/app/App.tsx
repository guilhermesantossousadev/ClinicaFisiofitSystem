import { useEffect } from "react";
import { Route, Switch } from "wouter";
import Index from "@/pages/Index";
import AboutPage from "@/pages/AboutPage";
import ServicesPage from "@/pages/ServicesPage";
import StudiosPage from "@/pages/StudiosPage";
import ContactPage from "@/pages/ContactPage";
import LinksPage from "@/pages/LinksPage";
import NotFound from "@/pages/NotFound";
import PrivacyPage from "@/pages/PrivacyPage";
import CookiesPage from "@/pages/CookiesPage";
import CookieConsent from "@/components/CookieConsent";

function ButtonFeedback() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      if (button.classList.contains("is-loading")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      button.classList.add("is-loading");
      button.setAttribute("aria-busy", "true");
      window.setTimeout(() => {
        button.classList.remove("is-loading");
        button.removeAttribute("aria-busy");
      }, 450);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  return null;
}

const App = () => <>
  <Switch>
    <Route path="/" component={Index} />
    <Route path="/sobre" component={AboutPage} />
    <Route path="/servicos" component={ServicesPage} />
    <Route path="/unidades" component={StudiosPage} />
    <Route path="/contato" component={ContactPage} />
    <Route path="/links" component={LinksPage} />
    <Route path="/privacidade" component={PrivacyPage} />
    <Route path="/cookies" component={CookiesPage} />
    <Route component={NotFound} />
  </Switch>
  <CookieConsent />
  <ButtonFeedback />
</>;

export default App;
