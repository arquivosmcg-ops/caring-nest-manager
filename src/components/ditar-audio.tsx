import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function encodeWav(chunks: Float32Array[], sampleRate: number, target = 16000) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.length;
  }
  const ratio = sampleRate / target;
  const outLen = Math.floor(merged.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = merged[Math.floor(i * ratio)] ?? 0;
    const clamped = Math.max(-1, Math.min(1, s));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, target, true);
  view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, out.length * 2, true);
  new Int16Array(buffer, 44).set(out);
  return new Blob([buffer], { type: "audio/wav" });
}

/** Botão de ditado: grava a voz e devolve o texto transcrito para anexar ao campo. */
export function DitarAudio({
  onTexto,
  className,
  titulo = "Ditar por voz",
}: {
  onTexto: (texto: string) => void;
  className?: string;
  titulo?: string;
}) {
  const [estado, setEstado] = useState<"parado" | "gravando" | "enviando">("parado");
  const ref = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    node: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    chunks: Float32Array[];
  } | null>(null);

  const iniciar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node);
      node.connect(ctx.destination);
      ref.current = { stream, ctx, node, source, chunks };
      setEstado("gravando");
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const parar = async () => {
    const r = ref.current;
    if (!r) return;
    ref.current = null;
    r.stream.getTracks().forEach((t) => t.stop());
    r.node.disconnect();
    r.source.disconnect();
    const blob = encodeWav(r.chunks, r.ctx.sampleRate);
    await r.ctx.close();

    if (blob.size < 4096) {
      setEstado("parado");
      toast.error("Gravação muito curta. Tente novamente.");
      return;
    }

    setEstado("enviando");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "gravacao.wav");
      const res = await fetch("/api/transcrever", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Falha na transcrição.");
      const texto = (data.text ?? "").trim();
      if (!texto) {
        toast.error("Nenhuma fala reconhecida no áudio.");
      } else {
        onTexto(texto);
        toast.success("Transcrição inserida no campo");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na transcrição.");
    } finally {
      setEstado("parado");
    }
  };

  return (
    <button
      type="button"
      title={estado === "gravando" ? "Parar e transcrever" : titulo}
      aria-label={estado === "gravando" ? "Parar e transcrever" : titulo}
      disabled={estado === "enviando"}
      onClick={estado === "gravando" ? parar : iniciar}
      className={cn(
        "shrink-0 grid place-items-center size-8 rounded-md border transition-colors",
        estado === "gravando"
          ? "bg-primary text-primary-foreground border-primary animate-pulse"
          : "bg-surface text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
        className,
      )}
    >
      {estado === "enviando" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : estado === "gravando" ? (
        <Square className="size-3.5 fill-current" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}

/** Textarea com botão de ditado acoplado (funciona também em formulários não controlados). */
export function TextareaDitavel(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { className, ...rest } = props;
  return (
    <div className="flex items-start gap-2">
      <textarea
        ref={ref}
        {...rest}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
      <DitarAudio
        onTexto={(t) => {
          const el = ref.current;
          if (!el) return;
          const novo = el.value ? `${el.value.trim()} ${t}` : t;
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          setter?.call(el, novo);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.focus();
        }}
      />
    </div>
  );
}
