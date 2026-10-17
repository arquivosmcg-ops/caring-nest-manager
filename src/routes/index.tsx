import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Gestão do Residencial — São Camilo" },
    { name: "description", content: "Acesso à gestão de residentes, cuidados e visitas do Residencial São Camilo." },
    { property: "og:title", content: "Gestão do Residencial — São Camilo" },
    { property: "og:description", content: "Gestão de residentes, cuidados e visitas do Residencial São Camilo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
