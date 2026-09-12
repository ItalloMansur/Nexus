# NEXUS — segundo cérebro pessoal

Um único chat com quatro modos: GPT, Claude, Painel e Nexus.

## Modos

- **GPT** — conversa direta com OpenAI.
- **Claude** — conversa direta com Anthropic.
- **Painel** — consulta GPT, Claude, v0 e NotebookLM em paralelo.
- **Nexus** — consulta o painel, compara as respostas e pede uma síntese ao GPT (ou Claude, se GPT não estiver configurado).

## Segurança

As chaves ficam no backend em `.env`. Nunca coloque API keys no React/frontend.

## NotebookLM

O projeto não presume uma API pública geral de chat do NotebookLM. Para integrá-lo como quarta fonte, configure `NOTEBOOKLM_BRIDGE_URL` para um bridge controlado por você. Sem bridge, o NEXUS mostra a falha dessa fonte sem derrubar as outras três.

## Rodar

```bash
npm install
cp .env.example .env
# preencha as chaves/modelos
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:8787

## Variáveis

- `OPENAI_API_KEY` + `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`
- `V0_API_KEY` + `V0_MODEL`
- `NOTEBOOKLM_BRIDGE_URL` + opcionais `NOTEBOOKLM_BRIDGE_TOKEN` e `NOTEBOOKLM_NOTEBOOK_ID`

## Próxima etapa

Persistir conversas/insights em SQLite, importar `conversations.json` do ChatGPT, adicionar busca semântica, decisões, objetivos, padrões e a Home "O que preciso lembrar hoje?".
