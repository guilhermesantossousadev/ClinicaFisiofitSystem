import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eeltguuoxpfttjznugla.supabase.co";
const adminUserId = "d0422411-434d-43c8-af22-f8f163c9a3eb";

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error("Execute este comando em um terminal interativo."));
      return;
    }

    let input = "";
    const stdin = process.stdin;
    const finish = (error) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(input);
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          finish(new Error("Operação cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          input = input.slice(0, -1);
          continue;
        }
        if (character >= " ") input += character;
      }
    };

    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}

try {
  const serviceRoleKey = await readHidden("Cole a service_role do Supabase: ");
  const password = await readHidden("Digite a nova senha administrativa: ");
  const confirmation = await readHidden("Confirme a nova senha: ");

  if (!serviceRoleKey) throw new Error("A service_role não foi informada.");
  if (password.length < 10 || password.length > 72) {
    throw new Error("A senha precisa ter entre 10 e 72 caracteres.");
  }
  if (password !== confirmation) throw new Error("As senhas não são iguais.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.admin.updateUserById(adminUserId, { password });
  if (error) throw error;

  console.log(`Senha alterada com sucesso para ${data.user.email ?? adminUserId}.`);
  console.log("Agora entre no portal usando a nova senha.");
} catch (error) {
  console.error(`Erro: ${error instanceof Error ? error.message : "não foi possível alterar a senha."}`);
  process.exitCode = 1;
}
