import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PasswordInputProps = React.ComponentProps<"input"> & {
  containerClassName?: string;
};

export function PasswordInput({ className, containerClassName, ...props }: PasswordInputProps) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        type={visivel ? "text" : "password"}
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        onClick={() => setVisivel((v) => !v)}
      >
        {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
