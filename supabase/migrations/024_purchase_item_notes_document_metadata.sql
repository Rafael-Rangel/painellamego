-- Observações por item + metadados fiscais estruturados (importação IA).

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS document_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.purchase_drafts
  ADD COLUMN IF NOT EXISTS document_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.purchase_items.notes IS 'Observações do produto na nota (ex.: bonificação, lote, FCP na descrição).';
COMMENT ON COLUMN public.purchases.document_metadata_json IS 'Metadados fiscais: chave, série, pedido, transportadora, etc.';
COMMENT ON COLUMN public.purchase_drafts.document_metadata_json IS 'Metadados fiscais do rascunho (espelho de purchases).';
