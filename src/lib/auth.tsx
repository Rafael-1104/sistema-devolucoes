import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { campo, texto, type Payload } from "@/lib/supabase-flex";

const lerTempoConfigurado = (nome: string, padrao: number) => {
  const valor = Number(import.meta.env?.[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
};

const INACTIVITY_TIMEOUT = lerTempoConfigurado("VITE_INACTIVITY_TIMEOUT_MS", 2 * 60 * 60 * 1000);
const WARNING_TIME = lerTempoConfigurado("VITE_WARNING_TIME_MS", 5 * 60 * 1000);
const ACTIVITY_THROTTLE_MS = 250;
const STORAGE_KEY_LAST_ACTIVITY = "sistema-devolucoes-last-activity";

const lerUltimaAtividadePersistida = () => {
  if (typeof window === "undefined") return null;

  const valor = window.localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
  if (!valor) return null;

  const timestamp = Number(valor);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
};

const salvarUltimaAtividadePersistida = (timestamp: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(timestamp));
};

const limparUltimaAtividadePersistida = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
};

export interface PerfilUsuario {
  nome: string | null;
  cargo: string | null;
  email: string | null;
}

interface AuthContexto {
  sessao: Session | null;
  usuario: User | null;
  perfil: PerfilUsuario | null;
  carregando: boolean;
  nomeExibicao: string;
  iniciais: string;
  entrar: (email: string, senha: string) => Promise<{ erro: string | null }>;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthContexto | null>(null);

function derivarIniciais(nome: string) {
  const partes = nome.trim().split(/[\s.@_-]+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => p[0] ?? "");
  return (letras.join("") || "US").toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarAvisoInatividade, setMostrarAvisoInatividade] = useState(false);
  const [painelDebugAberto, setPainelDebugAberto] = useState(false);
  const [estadoDebugInatividade, setEstadoDebugInatividade] = useState({
    tempoDecorrido: 0,
    restante: INACTIVITY_TIMEOUT,
  });

  const timeoutRef = useRef<number | null>(null);
  const avisoRef = useRef<number | null>(null);
  const ultimaAtividadeRef = useRef(Date.now());
  const encerrandoSessaoRef = useRef(false);

  const limparTimersInatividade = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (avisoRef.current !== null) {
      window.clearTimeout(avisoRef.current);
      avisoRef.current = null;
    }
    setMostrarAvisoInatividade(false);
  }, []);

  const encerrarSessaoPorInatividade = useCallback(async () => {
    if (!sessao || encerrandoSessaoRef.current) return;

    encerrandoSessaoRef.current = true;
    limparTimersInatividade();
    limparUltimaAtividadePersistida();

    try {
      await supabase.auth.signOut();
    } finally {
      encerrandoSessaoRef.current = false;
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
  }, [limparTimersInatividade, sessao]);

  const agendarTimersInatividade = useCallback(() => {
    if (!sessao || encerrandoSessaoRef.current) return;

    const agora = Date.now();
    const tempoDesdeUltimaAtividade = agora - ultimaAtividadeRef.current;
    const tempoRestante = Math.max(0, INACTIVITY_TIMEOUT - tempoDesdeUltimaAtividade);
    const tempoAteAviso = Math.max(0, INACTIVITY_TIMEOUT - WARNING_TIME - tempoDesdeUltimaAtividade);

    limparTimersInatividade();

    if (tempoRestante <= 0) {
      void encerrarSessaoPorInatividade();
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      void encerrarSessaoPorInatividade();
    }, tempoRestante);

    avisoRef.current = window.setTimeout(() => {
      setMostrarAvisoInatividade(true);
    }, tempoAteAviso);
  }, [encerrarSessaoPorInatividade, limparTimersInatividade, sessao]);

  const registrarAtividade = useCallback(() => {
    if (!sessao || encerrandoSessaoRef.current) return;

    const agora = Date.now();
    if (agora - ultimaAtividadeRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }

    ultimaAtividadeRef.current = agora;
    salvarUltimaAtividadePersistida(agora);
    setMostrarAvisoInatividade(false);
    agendarTimersInatividade();
  }, [agendarTimersInatividade, sessao]);

  useEffect(() => {
    let ativo = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSessao(data.session ?? null);
      setCarregando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
      setCarregando(false);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessao) {
      ultimaAtividadeRef.current = Date.now();
      limparTimersInatividade();
      return;
    }

    const ultimoTimestampPersistido = lerUltimaAtividadePersistida();
    const agora = Date.now();

    if (ultimoTimestampPersistido) {
      ultimaAtividadeRef.current = ultimoTimestampPersistido;

      if (agora - ultimoTimestampPersistido >= INACTIVITY_TIMEOUT) {
        void encerrarSessaoPorInatividade();
        return;
      }
    } else {
      ultimaAtividadeRef.current = agora;
      salvarUltimaAtividadePersistida(ultimaAtividadeRef.current);
    }

    setMostrarAvisoInatividade(false);
    agendarTimersInatividade();
  }, [agendarTimersInatividade, limparTimersInatividade, sessao, encerrarSessaoPorInatividade]);

  useEffect(() => {
    if (!sessao) return;

    const onActivity = () => {
      registrarAtividade();
    };

    const eventos = ["pointerdown", "keydown", "click", "mousemove", "scroll", "touchstart", "touchmove"] as const;

    for (const evento of eventos) {
      window.addEventListener(evento, onActivity, { passive: true, capture: evento === "scroll" });
    }

    document.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("touchmove", onActivity, { passive: true });

    return () => {
      for (const evento of eventos) {
        window.removeEventListener(evento, onActivity, { capture: evento === "scroll" });
      }
      document.removeEventListener("touchstart", onActivity);
      document.removeEventListener("touchmove", onActivity);
    };
  }, [registrarAtividade, sessao]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onKeyDown = (evento: KeyboardEvent) => {
      if (evento.ctrlKey && evento.shiftKey && evento.key.toLowerCase() === "i") {
        evento.preventDefault();
        setPainelDebugAberto((valor) => !valor);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !sessao) return;

    const atualizarEstadoDebug = () => {
      const tempoDecorrido = Date.now() - ultimaAtividadeRef.current;
      setEstadoDebugInatividade({
        tempoDecorrido,
        restante: Math.max(0, INACTIVITY_TIMEOUT - tempoDecorrido),
      });
    };

    atualizarEstadoDebug();
    const intervalo = window.setInterval(atualizarEstadoDebug, 1000);
    return () => window.clearInterval(intervalo);
  }, [sessao, mostrarAvisoInatividade]);

  const usuario = sessao?.user ?? null;

  // Dados complementares vindos da tabela existente `usuarios` (opcionais).
  useEffect(() => {
    let ativo = true;
    if (!usuario) {
      setPerfil(null);
      return;
    }
    void supabase
      .from("usuarios")
      .select("*")
      .eq("id", usuario.id)
      .limit(1)
      .then(({ data }) => {
        if (!ativo) return;
        const linha = (data as Payload[] | null)?.[0];
        setPerfil(
          linha
            ? {
                nome: texto(campo(linha, ["nome", "nome_completo", "name"])),
                cargo: texto(campo(linha, ["cargo", "funcao", "perfil"])),
                email: texto(campo(linha, ["email"])),
              }
            : null,
        );
      });
    return () => {
      ativo = false;
    };
  }, [usuario]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    return { erro: error ? error.message : null };
  }, []);

  const sair = useCallback(async () => {
    encerrandoSessaoRef.current = true;
    limparTimersInatividade();
    limparUltimaAtividadePersistida();
    try {
      await supabase.auth.signOut();
      setPerfil(null);
    } finally {
      encerrandoSessaoRef.current = false;
    }
  }, [limparTimersInatividade]);

  const valor = useMemo<AuthContexto>(() => {
    const nomeExibicao = perfil?.nome ?? usuario?.email ?? "Usuário";
    return {
      sessao,
      usuario,
      perfil,
      carregando,
      nomeExibicao,
      iniciais: derivarIniciais(nomeExibicao),
      entrar,
      sair,
    };
  }, [sessao, usuario, perfil, carregando, entrar, sair]);

  return (
    <>
      <Ctx.Provider value={valor}>{children}</Ctx.Provider>
      {import.meta.env.DEV && painelDebugAberto && sessao && (
        <div className="fixed bottom-4 right-4 z-50 w-[320px] rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Debug de inatividade</p>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPainelDebugAberto(false)}
            >
              Fechar
            </button>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Última atividade: {Math.round(estadoDebugInatividade.tempoDecorrido / 1000)}s atrás</p>
            <p>Tempo restante: {Math.max(0, Math.ceil(estadoDebugInatividade.restante / 1000))}s</p>
            <p>Alerta ativo: {mostrarAvisoInatividade ? "Sim" : "Não"}</p>
            <p>Timeout: {INACTIVITY_TIMEOUT / 1000}s</p>
            <p>Aviso: {WARNING_TIME / 1000}s</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground"
              onClick={() => {
                ultimaAtividadeRef.current = Date.now() - (INACTIVITY_TIMEOUT - WARNING_TIME - 1000);
                registrarAtividade();
              }}
            >
              Trigger aviso
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground"
              onClick={() => {
                ultimaAtividadeRef.current = Date.now() - INACTIVITY_TIMEOUT;
                void encerrarSessaoPorInatividade();
              }}
            >
              Logout agora
            </button>
            <button
              type="button"
              className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground"
              onClick={() => {
                registrarAtividade();
                setMostrarAvisoInatividade(false);
              }}
            >
              Simular atividade
            </button>
          </div>
        </div>
      )}
      {sessao && (
        <Dialog open={mostrarAvisoInatividade} onOpenChange={(aberto) => {
          if (!aberto) {
            registrarAtividade();
            setMostrarAvisoInatividade(false);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sessão prestes a expirar</DialogTitle>
              <DialogDescription>Sua sessão será encerrada por inatividade em 5 minutos.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark"
                onClick={() => {
                  registrarAtividade();
                  setMostrarAvisoInatividade(false);
                }}
              >
                Continuar sessão
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
