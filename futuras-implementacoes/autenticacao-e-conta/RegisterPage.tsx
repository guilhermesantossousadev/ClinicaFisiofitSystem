import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, X, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import loginBg from "@/assets/login-bg.jpg";

const inputClass =
  "w-full bg-white/50 backdrop-blur-sm border-0 rounded-lg px-5 py-4 text-sm tracking-widest uppercase placeholder:text-muted-foreground/70 placeholder:tracking-widest focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all";

const RegisterPage = () => {
  const [form, setForm] = useState({
    firstName: "", lastName: "", practiceType: "", phone: "", email: "", password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !agreed) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          practice_type: form.practiceType,
          phone: form.phone,
        },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email to confirm your account!");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:block">
        <img src={loginBg} alt="Hands in meditation mudra" className="w-full h-full object-cover" width={960} height={1080} />
      </div>

      <div className="flex flex-col bg-gradient-to-b from-coral-400/30 via-terracotta-100/40 to-cream-100">
        <div className="flex justify-between items-center px-6 py-4">
          <Link to="/login" className="p-2 rounded-full hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <Link to="/" className="text-xl font-bold tracking-wide text-foreground">Thrive</Link>
          <Link to="/" className="p-2 rounded-full hover:bg-white/30 transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
          <div className="w-full max-w-md space-y-6 text-center">
            <div>
              <span className="font-serif italic text-5xl md:text-6xl text-foreground">Awesome</span>
              <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground mt-2">
                to have you here!
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <input type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="FIRST NAME" className={inputClass} required />
              <input type="text" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="LAST NAME" className={inputClass} required />
              <select value={form.practiceType} onChange={(e) => update("practiceType", e.target.value)} className={`${inputClass} appearance-none`} required>
                <option value="" disabled>PRACTICE TYPE</option>
                <option>Yoga</option>
                <option>Pilates</option>
                <option>Strength</option>
                <option>Meditation</option>
                <option>Mixed</option>
              </select>
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="PHONE NUMBER" className={inputClass} />
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="EMAIL ADDRESS" className={inputClass} required />
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="PASSWORD" className={`${inputClass} pr-12`} required minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 accent-foreground rounded cursor-pointer" />
                <span className="text-sm text-muted-foreground">
                  I read and accept the{" "}
                  <Link to="/terms" className="uppercase font-semibold tracking-wider text-foreground underline">Thrive Terms</Link>
                </span>
              </label>
            </form>
          </div>
        </div>

        <div className="px-6 pb-8 w-full max-w-md mx-auto">
          <button
            type="submit"
            onClick={handleSubmit as any}
            disabled={!agreed || loading}
            className="w-full border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-sm hover:bg-foreground hover:text-background transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Make account <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
