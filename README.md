# Nuvem

Sua nuvem particular de projetos, ideias e notas — aberta no navegador de
qualquer lugar, e sincronizada com uma pasta do seu computador por um
`nuvem push`.

Duas metades:

- **o painel** (Next.js + Supabase): escreve, busca, filtra, funciona no celular
  e dá pra instalar na tela de início;
- **o CLI** (`cli/nuvem.mjs`): `status`, `push`, `pull` e `sync` em cima de uma
  pasta de arquivos `.md`.

O jeito de decidir quem mexeu em quê é emprestado do git: cada item carrega uma
impressão digital do conteúdo, e quando ela mudou dos dois lados a resposta é
**conflito**, nunca "sobrescrevi calado".

---

## Passo 1 — banco no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (o plano grátis
   sobra).
2. Abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)
   e rode. Isso cria a tabela `itens` com o RLS ligado e sem policy — ou seja,
   as chaves públicas não leem nada.
3. Em **Project Settings > API**, anote a **URL** e a **service_role key**.

## Passo 2 — variáveis

Copie `.env.example` para `.env.local` e preencha:

| variável | pra que serve |
| --- | --- |
| `SUPABASE_URL` | endereço do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | chave do servidor (nunca vai pro navegador) |
| `SENHA` | a senha que você digita em `/entrar` |
| `SESSAO_SEGREDO` | assina o cookie de sessão |
| `TOKEN_SYNC` | o token que o CLI usa |

Pra gerar segredos aleatórios:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Passo 3 — rodar aqui

```bash
npm run dev
```

Abre <http://localhost:3000>, entra com a `SENHA` e cria o primeiro item.

## Passo 4 — GitHub e Vercel

O repositório local já existe, com o primeiro commit na `main`. Pra criar o
repositório remoto (privado) e mandar tudo:

```bash
gh auth login && gh repo create zxp-mobilecomputer --private --source=. --push
```

Sem o `gh`: crie o repositório vazio pelo site e depois

```bash
git remote add origin https://github.com/SEU-USUARIO/zxp-mobilecomputer.git && git push -u origin main
```

Depois importe em [vercel.com/new](https://vercel.com/new) e, em **Settings >
Environment Variables**, cadastre as mesmas cinco variáveis do passo 2. Daí em
diante, cada `git push` na `main` republica o painel.

No celular: abra o endereço da Vercel, "Adicionar à tela de início", e ele abre
como aplicativo, sem barra de navegador.

## Passo 5 — o cofre no computador

O CLI trabalha em cima de uma pasta qualquer — **não precisa ser esta**. Aliás,
melhor que não seja: aqui mora o código, lá moram os textos.

```bash
npm link                      # deixa o comando `nuvem` disponível no sistema
mkdir ~/cofre && cd ~/cofre
nuvem login https://sua-nuvem.vercel.app SEU_TOKEN_SYNC
nuvem pull
```

Sem `npm link`, use `node caminho/para/cli/nuvem.mjs` ou `npm run nuvem --` no
lugar de `nuvem`.

---

## Como o painel funciona

- **Anotar é uma linha.** A caixa do topo cria o item com o título e mais nada:
  escreve, Enter, pronto — o campo já fica limpo pro próximo. Anotar e organizar
  são momentos diferentes, e o segundo só acontece se o primeiro for rápido.
  Se você estiver filtrando por uma tag, o item já nasce com ela.
- **A busca acontece enquanto você digita**, sem botão e sem Enter.
- **O item abre pra ler.** Tocar no texto abre a edição com o cursor naquela
  linha; tocar no `○` de uma tarefa marca a tarefa sem sair da leitura.
- **Salva sozinho.** Item que já existe grava um instante depois que você para
  de escrever — o canto de cima diz "salvando…", "salvo 14:32" ou "não salvo".
  Item novo espera o clique em Criar, pra você não encher a lista de rascunho
  vazio. Se a gravação falhar, o texto continua na tela e o erro aparece; ele
  não fica insistindo sozinho, e o botão Salvar tenta de novo quando você quiser.
- **Atalhos** (no computador): `/` busca, `n` cria, `Ctrl+S` salva, `Esc` volta
  pra leitura.

## O dia a dia

```bash
nuvem status    # o que mudou aqui e o que mudou lá
nuvem push      # manda o que você escreveu no computador
nuvem pull      # traz o que você escreveu no celular
nuvem sync      # pull e depois push
```

Duas opções, quando precisar:

- `--apagar` — sincroniza também as remoções. Sem ela, nada é apagado dos dois
  lados: apagar arquivo é a operação que não tem desfazer, então é sempre um
  pedido explícito.
- `--forcar` — resolve conflito. No `push`, vale a versão daqui; no `pull`, vale
  a da nuvem e a sua cópia é guardada como `.local.md` ao lado.

### Os arquivos

O cofre tem quatro pastas, uma por tipo, e o CLI só olha para elas — um
`README.md` solto na raiz nunca vira item:

```
cofre/
  .nuvem/          config.json (url + token) e estado.json (o índice)
  projetos/
  ideias/
  notas/
  referencias/
```

Cada arquivo é markdown com um cabeçalho:

```markdown
---
titulo: Reformar a landing da RUMO
tipo: projeto
status: ativo
tags: rumo, marketing
slug: reformar-a-landing-da-rumo
---

- [x] Reescrever o hero
- [ ] Trocar as fotos
```

O `slug` é a identidade do item. Ele é escrito pelo próprio CLI quando você cria
um arquivo novo (basta escrever o markdown, com ou sem cabeçalho, e dar `push`).
Como a identidade é o slug e não o caminho, mudar o `tipo` só faz o arquivo
trocar de pasta no `pull` seguinte — nada se perde.

### O que o painel entende de markdown

Título (`#` a `####`), lista, lista de tarefa (`- [ ]` / `- [x]`), citação,
bloco de código, `**negrito**`, `*itálico*`, `` `código` `` e link. É o que cabe
num campo de texto no celular. Se um dia precisar de tabela, o único arquivo a
trocar é [`src/lib/markdown.ts`](src/lib/markdown.ts).

---

## Como o código está organizado

```
src/
  app/
    page.tsx              painel: busca, filtros e a lista
    item/[slug]/page.tsx  abrir e editar
    novo/page.tsx         criar
    entrar/page.tsx       login
    acoes.ts              Server Actions (entrar, sair, anotar, salvar, apagar)
    api/sync/route.ts     a porta do CLI (token no header, não cookie)
  components/             Editor, CapturaRapida, Busca, CartaoItem, Etiqueta
  lib/
    tipos.ts              vocabulário puro (tipos, slug, hash) — roda nos dois lados
    itens.ts              tudo que fala com a tabela
    supabase.ts           REST do Supabase, sem SDK
    sessao.ts             HMAC do cookie e conferência dos segredos
    markdown.ts           markdown -> HTML, escapando antes
  proxy.ts                barra quem não tem sessão (o antigo middleware)
cli/nuvem.mjs             o CLI inteiro, sem dependências
supabase/schema.sql       a tabela
```

### Por que assim

- **Uma tabela só.** Projeto, ideia e nota são o mesmo objeto com etiquetas
  diferentes. Três tabelas seriam três telas, três consultas e uma busca que
  não atravessa nada.
- **Sem SDK.** O Supabase é HTTP; usar `fetch` direto mantém o projeto em três
  dependências (`next`, `react`, `react-dom`) e o cold start curto — que é o que
  se sente quando você abre isto na rua.
- **Apagar é marcar.** Sem a data de apagado, o `pull` não teria como distinguir
  "isto foi apagado" de "isto ainda não chegou aqui", e apagaria arquivo à toa.
- **A sessão é um cookie assinado.** Um usuário, uma senha, zero tabela de
  usuários. Trocar `SESSAO_SEGREDO` desconecta tudo.
- **Nenhuma ação deixa o erro subir.** Se o banco não responder, a resposta é
  uma mensagem na tela — nunca a página de erro, que levaria junto o texto que
  você acabou de escrever e ainda não foi gravado.

## Se um dia quiser mais

- anexar imagem (Supabase Storage + um campo `anexos`);
- histórico de versões (uma tabela `versoes` gravada a cada `atualizarItem`);
- busca com acento tolerante (`pg_trgm` e `unaccent` no Postgres);
- rodar o `nuvem sync` sozinho, por tarefa agendada, ao ligar o computador.
