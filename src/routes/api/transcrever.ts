import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcrever")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "Transcrição indisponível: chave de IA não configurada." }, { status: 500 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Envio inválido." }, { status: 400 });
        }

        const file = form.get("audio");
        if (!(file instanceof File) || file.size < 2048) {
          return Response.json({ error: "Áudio vazio ou muito curto. Grave novamente." }, { status: 400 });
        }
        if (file.size > 20 * 1024 * 1024) {
          return Response.json({ error: "Áudio muito longo. Grave trechos mais curtos." }, { status: 400 });
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, "gravacao.wav");
        upstream.append("language", "pt");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });

        if (!res.ok) {
          const detalhe = await res.text().catch(() => "");
          const mensagem =
            res.status === 429
              ? "Muitas transcrições seguidas. Aguarde alguns segundos e tente novamente."
              : res.status === 402
                ? "Créditos de IA esgotados. Peça ao administrador para adicionar créditos."
                : `Falha na transcrição (${res.status}). ${detalhe.slice(0, 200)}`;
          return Response.json({ error: mensagem }, { status: res.status });
        }

        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
