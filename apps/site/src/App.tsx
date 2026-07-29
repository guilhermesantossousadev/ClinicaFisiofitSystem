import { Route, Switch } from "wouter";
import Index from "@/pages/Index";
import AboutPage from "@/pages/AboutPage";
import ServicesPage from "@/pages/ServicesPage";
import StudiosPage from "@/pages/StudiosPage";
import ContactPage from "@/pages/ContactPage";
import LinksPage from "@/pages/LinksPage";
import NotFound from "@/pages/NotFound";

const App = () => (
  <Switch>
    <Route path="/" component={Index} />
    <Route path="/sobre" component={AboutPage} />
    <Route path="/servicos" component={ServicesPage} />
    <Route path="/unidades" component={StudiosPage} />
    <Route path="/contato" component={ContactPage} />
    <Route path="/links" component={LinksPage} />
    <Route component={NotFound} />
  </Switch>
);

export default App;
