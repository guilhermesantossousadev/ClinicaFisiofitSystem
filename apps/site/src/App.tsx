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
</>;

export default App;
