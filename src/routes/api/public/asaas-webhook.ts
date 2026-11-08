import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/asaas-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get('asaas-access-token');
        const esperado = process.env['ASAAS_WEBHOOK_TOKEN'];
        if (!esperado || !token || token !== esperado) {
          return new Response('Não autorizado', { status: 401 });
        }
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return new Response('Conteúdo inválido', { status: 400 });
        }
        const eventoId = String(payload.id ?? crypto.randomUUID());
        const tipo = String(payload.event ?? '');
        if (!tipo) return new Response('Evento ausente', { status: 400 });
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { error } = await supabaseAdmin.rpc('financeiro_webhook_processar', {
          _evento_id: eventoId,
          _tipo: tipo,
          _payload: payload,
        });
        if (error) return new Response('Erro ao processar evento', { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
