type Tom = "neutro" | "destaque" | "verde" | "amarelo" | "perigo";

const tons: Record<Tom, string> = {
  neutro: "border-borda text-suave",
  destaque: "border-destaque/40 text-destaque",
  verde: "border-verde/40 text-verde",
  amarelo: "border-amarelo/40 text-amarelo",
  perigo: "border-perigo/40 text-perigo",
};

export function Etiqueta({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: Tom;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium tracking-wide ${tons[tom]}`}
    >
      {children}
    </span>
  );
}
