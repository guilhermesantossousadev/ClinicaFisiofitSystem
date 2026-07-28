import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Index from "@/pages/Index";
import AboutPage from "@/pages/AboutPage";
import ServicesPage from "@/pages/ServicesPage";
import StudiosPage from "@/pages/StudiosPage";
import ContactPage from "@/pages/ContactPage";
import LinksPage from "@/pages/LinksPage";
import NotFound from "@/pages/NotFound";

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Toaster richColors />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/sobre" element={<AboutPage />} />
      <Route path="/servicos" element={<ServicesPage />} />
      <Route path="/unidades" element={<StudiosPage />} />
      <Route path="/contato" element={<ContactPage />} />
      <Route path="/links" element={<LinksPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
