# Vercel Deploy Notes

Guia rapido para manter a publicacao do `Dashboard-ISP` organizada.

## Estado Atual

- Projeto oficial Vercel: `dashboard-isp`
- Dominio oficial: `https://dash.ispconsulte.com.br`
- Repositorio GitHub conectado: `ispconsulte/DashBoard-ISP`
- Branch de producao: `main`
- Build:
  - `installCommand`: `npm --prefix frontend ci`
  - `buildCommand`: `npm --prefix frontend run build`
  - `outputDirectory`: `frontend/dist`

## O Que Ja Foi Organizado

- O projeto paralelo `dashboard-isp-nogitdeploy` foi removido.
- O dominio `dash.ispconsulte.com.br` ficou somente no projeto oficial.
- O `vercel.json` local esta alinhado com a configuracao da Vercel.
- O repositorio esta publico, entao o bloqueio antigo por autor de commit deixou de ser o fluxo principal esperado.

## Como Conferir Se O Auto Deploy Esta Saudavel

1. Confirmar que houve push na `main`
2. Conferir se a Vercel criou um novo deployment do projeto `dashboard-isp`
3. Validar se o deployment ficou `Ready`
4. Validar se `https://dash.ispconsulte.com.br` respondeu normalmente

Comandos uteis:

- `npx vercel project inspect dashboard-isp --scope ispconsulte`
- `npx vercel ls dashboard-isp --scope ispconsulte`
- `npx vercel inspect <deployment-url> --scope ispconsulte`

## Quando O Codex Precisar Intervir

Se a `main` estiver mais nova que a producao e a Vercel nao tiver atualizado:

1. Conferir se o projeto oficial continua ligado ao repo certo
2. Conferir se a branch de producao continua `main`
3. Conferir se o build/output continuam batendo com `vercel.json`
4. Fazer redeploy do ultimo deployment bom, se necessario

Comandos uteis:

- `npx vercel api /v9/projects/<project-id> --scope ispconsulte`
- `npx vercel redeploy <deployment-id> --scope ispconsulte --target production`
- `npx vercel promote <deployment-id> --scope ispconsulte -y`

## Observacao Importante

Mesmo com o repo publico, ainda vale manter este documento porque ele registra:

- qual e o projeto oficial
- qual dominio e o correto
- qual branch publica em producao
- qual e o fluxo seguro de verificacao quando a Vercel parecer inconsistente
