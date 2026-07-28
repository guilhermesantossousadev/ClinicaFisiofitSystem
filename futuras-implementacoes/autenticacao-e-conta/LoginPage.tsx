import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, X, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import loginBg from "@/assets/login-bg.jpg";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back!");
      navigate("/account");
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:block">
        <img src={loginBg} alt="Hands in meditation pose" className="w-full h-full object-cover" width={960} height={1080} />
      </div>

      <div className="flex flex-col bg-gradient-to-b from-coral-400/30 via-terracotta-100/40 to-cream-100">
        <div className="flex justify-between items-center px-6 py-4">
          <Link to="/" className="p-2 rounded-full hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <Link to="/" className="text-xl font-bold tracking-wide text-foreground">Thrive</Link>
          <Link to="/" className="p-2 rounded-full hover:bg-white/30 transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-md space-y-8 text-center">
            <div>
              <span className="font-serif italic text-5xl md:text-6xl text-foreground">Welcome</span>
              <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground mt-2">
                to have you back!
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="EMAIL"
                className="w-full bg-white/50 backdrop-blur-sm border-0 rounded-lg px-5 py-4 text-sm tracking-widest uppercase placeholder:text-muted-foreground/70 placeholder:tracking-widest focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                required
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="PASSWORD"
                  className="w-full bg-white/50 backdrop-blur-sm border-0 rounded-lg px-5 py-4 pr-12 text-sm tracking-widest uppercase placeholder:text-muted-foreground/70 placeholder:tracking-widest focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Link to="#" className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors">
                Forgot password <ArrowRight className="w-3 h-3" />
              </Link>
            </form>
          </div>
        </div>

        <div className="px-6 pb-8 w-full max-w-md mx-auto space-y-4">
          <button
            type="submit"
            onClick={handleSubmit as any}
            disabled={loading}
            className="w-full border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-sm hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Log in <ArrowRight className="w-4 h-4" /></>}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            No account <em>yet?</em>{" "}
            <Link to="/register" className="uppercase font-semibold tracking-wider text-foreground hover:underline inline-flex items-center gap-1">
              Sign up <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
