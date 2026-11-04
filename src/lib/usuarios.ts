import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { campo, texto, type Payload } from "@/lib/supabase-flex";

/** Usuários reais da tabela public.usuarios (sem qualquer dado fictício). */
export interface UsuarioRegistro {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  ativo: boolean;
}

export async function listarUsuarios(): Promise<UsuarioRegistro[]> {
  const { data, error } = await supabase.from("usuarios").select("*");
  if (error) throw error;
  return ((data ?? []) as Payload[]).map((linha) => ({
    id: String(campo(linha, ["id"]) ?? ""),
    nome: texto(campo(linha, ["nome", "nome_completo", "username", "email"])) ?? "—",
    email: texto(campo(linha, ["email"])) ?? "—",
    cargo: texto(campo(linha, ["cargo", "perfil", "role"])) ?? "—",
    ativo: campo(linha, ["ativo"]) !== false,
  }));
}

export function useUsuarios() {
  const { sessao } = useAuth();
  const query = useQuery({
    queryKey: ["usuarios"],
    queryFn: listarUsuarios,
    enabled: typeof window !== "undefined" && Boolean(sessao),
    staleTime: 60_000,
  });
  return { usuarios: query.data ?? [], erro: query.error };
}
