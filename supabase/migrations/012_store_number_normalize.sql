-- Normaliza store_number para sequência curta 1, 2, 3… (exibição e referência simples).
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY store_number, created_at) AS n
  FROM public.stores
)
UPDATE public.stores s
SET store_number = o.n
FROM ordered o
WHERE s.id = o.id;

COMMENT ON COLUMN public.stores.store_number IS 'Número sequencial da loja na rede (1, 2, 3…); usado como código curto na interface.';
