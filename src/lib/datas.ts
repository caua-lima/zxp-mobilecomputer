/** Datas do jeito que a gente fala: "agora", "há 3 h", "12 de março". */

const formatoCurto = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
});

const formatoLongo = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function quandoFoi(iso: string) {
  const data = new Date(iso);
  const segundos = (Date.now() - data.getTime()) / 1000;

  if (segundos < 90) return "agora";
  if (segundos < 3600) return `há ${Math.round(segundos / 60)} min`;
  if (segundos < 86400) return `há ${Math.round(segundos / 3600)} h`;
  if (segundos < 7 * 86400) return `há ${Math.round(segundos / 86400)} d`;

  const mesmoAno = data.getFullYear() === new Date().getFullYear();
  return mesmoAno
    ? formatoCurto.format(data)
    : formatoCurto.format(data) + " de " + data.getFullYear();
}

export function dataCompleta(iso: string) {
  return formatoLongo.format(new Date(iso));
}
