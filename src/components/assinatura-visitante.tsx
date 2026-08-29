import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

/** Campo de assinatura desenhada (touch/mouse) — devolve um PNG em dataURL. */
export function AssinaturaVisitante({
  valor,
  onChange,
}: {
  valor: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(!valor);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const posicao = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniciar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    desenhando.current = true;
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicao(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setVazio(false);
  };

  const finalizar = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-md border border-dashed border-border bg-surface">
        <canvas
          ref={canvasRef}
          className="h-32 w-full touch-none"
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={finalizar}
          onPointerLeave={finalizar}
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            Assine aqui com o dedo ou o mouse
          </span>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={limpar}>
        <Eraser className="mr-2 size-3.5" /> Limpar assinatura
      </Button>
    </div>
  );
}
