# Amostras de notas fiscais (regressão IA)

Imagens copiadas de exemplos reais (WhatsApp) para testar `parseReceiptWithAI`.

- **Golden esperado:** `../receipt-golden/` + `manifest.json`
- **Batch:** na raiz do repo: `node scripts/test-receipt-batch.mjs`
- **Só com golden:** `node scripts/test-receipt-batch.mjs --only golden`
- **Limite:** `RECEIPT_BATCH_LIMIT=2 node scripts/test-receipt-batch.mjs`

Requer `OPENAI_API_KEY` no `.env` (e `OPENROUTER_API_KEY` para fallback).
