import { useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import ChartCard from "../ui/ChartCard";
import CompactTable from "../ui/CompactTable";
import DataCard from "../ui/DataCard";
import KpiCardCompact from "../ui/KpiCardCompact";
import { formatCurrency } from "../../lib/formatters";

const STORE_COLORS = ["#4b0c0c", "#cd292d", "#eca02f", "#7a1919", "#d15555", "#3d6b2f", "#2c5282", "#6b4c9a"];

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function storeNamesFromIds(stores, ids) {
  return ids.map((id) => stores.find((s) => s.id === id)?.name).filter(Boolean);
}

export default function RankingComparisonTab({
  stores,
  ranking,
  periodData,
  productComparisonRows,
  opportunities,
  products,
  monthsFilter,
  setMonthsFilter,
  loading
}) {
  const [compareStoreIds, setCompareStoreIds] = useState([]);
  const [productScope, setProductScope] = useState("all");
  const [pickedProductIds, setPickedProductIds] = useState([]);

  const allStoreNamesOrdered = useMemo(() => stores.map((s) => s.name), [stores]);

  const namesInScope = useMemo(() => {
    if (!compareStoreIds.length) return allStoreNamesOrdered;
    const picked = storeNamesFromIds(stores, compareStoreIds);
    return picked.length ? picked : allStoreNamesOrdered;
  }, [compareStoreIds, stores, allStoreNamesOrdered]);

  const namesSet = useMemo(() => new Set(namesInScope), [namesInScope]);

  function toggleStore(id) {
    setCompareStoreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function presetStores(n) {
    if (n === "all") {
      setCompareStoreIds([]);
      return;
    }
    const nStores = Number(n);
    setCompareStoreIds(stores.slice(0, Math.min(nStores, stores.length)).map((s) => s.id));
  }

  function togglePickedProduct(id) {
    setPickedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const rankingInScope = useMemo(() => {
    const base = ranking.length
      ? ranking
      : stores.map((s) => ({ store_name: s.name, efficiency_score: 0, store_id: s.id }));
    return base.filter((r) => namesSet.has(r.store_name));
  }, [ranking, stores, namesSet]);

  const spendByStore = useMemo(() => {
    const map = new Map();
    for (const row of periodData) {
      const name = row.store_name;
      if (!name || !namesSet.has(name)) continue;
      map.set(name, (map.get(name) || 0) + Number(row.total_spent || 0));
    }
    for (const name of namesInScope) {
      if (!map.has(name)) map.set(name, 0);
    }
    return namesInScope.map((name) => ({ name, spend: map.get(name) || 0 }));
  }, [periodData, namesInScope, namesSet]);

  const efficiencyBarData = useMemo(
    () => ({
      labels: rankingInScope.map((r) => r.store_name),
      datasets: [
        {
          label: "Score de eficiência",
          data: rankingInScope.map((r) => Number(r.efficiency_score || 0)),
          backgroundColor: rankingInScope.map((_, i) => STORE_COLORS[i % STORE_COLORS.length]),
          borderRadius: 8
        }
      ]
    }),
    [rankingInScope]
  );

  const spendBarData = useMemo(
    () => ({
      labels: spendByStore.map((s) => s.name),
      datasets: [
        {
          label: `Gasto total (${monthsFilter} meses)`,
          data: spendByStore.map((s) => s.spend),
          backgroundColor: spendByStore.map((_, i) => STORE_COLORS[i % STORE_COLORS.length]),
          borderRadius: 8
        }
      ]
    }),
    [spendByStore, monthsFilter]
  );

  const comparisonRowsFiltered = useMemo(() => {
    let rows = productComparisonRows.filter((row) => namesSet.has(row.store_name));
    if (productScope === "selected") {
      if (!pickedProductIds.length) return [];
      rows = rows.filter((row) => pickedProductIds.includes(row.product_id));
    }
    return rows;
  }, [productComparisonRows, namesSet, productScope, pickedProductIds]);

  const productGroupedChart = useMemo(() => {
    const rows = comparisonRowsFiltered;
    const byProduct = new Map();
    for (const row of rows) {
      const pid = row.product_id;
      if (!pid) continue;
      if (!byProduct.has(pid)) byProduct.set(pid, []);
      byProduct.get(pid).push(row);
    }

    const productEntries = [...byProduct.entries()].filter(([, list]) => {
      const storeNames = new Set(list.map((r) => r.store_name));
      return storeNames.size >= 1;
    });

    const scored = productEntries
      .map(([pid, list]) => {
        const prices = list.map((r) => Number(r.avg_price || 0));
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        return { pid, list, spread: maxP - minP };
      })
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 10);

    const labels = scored.map(({ list }) => list[0]?.product_name || list[0]?.name || "Produto");
    const datasets = namesInScope.map((storeName, idx) => ({
      label: storeName,
      data: scored.map(({ list }) => {
        const row = list.find((r) => r.store_name === storeName);
        return row ? Number(row.avg_price || 0) : null;
      }),
      backgroundColor: STORE_COLORS[idx % STORE_COLORS.length],
      borderRadius: 6
    }));

    return { labels, datasets, hasData: scored.length > 0 };
  }, [comparisonRowsFiltered, namesInScope]);

  const storeInsightCards = useMemo(() => {
    return namesInScope.map((name) => {
      const spend = spendByStore.find((s) => s.name === name)?.spend ?? 0;
      const eff = rankingInScope.find((r) => r.store_name === name)?.efficiency_score ?? 0;
      const opps = opportunities.filter((o) => o.store_name === name);
      const avgGap = opps.length
        ? opps.reduce((s, o) => s + Number(o.above_best_percent || 0), 0) / opps.length
        : 0;
      const potential = opps.reduce(
        (s, o) => s + Math.max(0, Number(o.store_avg_price) - Number(o.network_min_price)) * 30,
        0
      );
      return { name, spend, eff, avgGap, potential };
    });
  }, [namesInScope, spendByStore, rankingInScope, opportunities]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "top" } },
    scales: {
      x: { ticks: { maxRotation: 45, minRotation: 0 } },
      y: { beginAtZero: true }
    }
  };

  const barHorizontalOptions = {
    ...barOptions,
    indexAxis: "y",
    plugins: { legend: { display: false } }
  };

  const efficiencyDoughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, usePointStyle: true, padding: 10 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${Number(ctx.raw || 0).toFixed(1)}`
        }
      }
    }
  };

  const spendLineData = useMemo(
    () => ({
      labels: spendByStore.map((s) => s.name),
      datasets: [
        {
          label: `Gasto total (${monthsFilter} meses)`,
          data: spendByStore.map((s) => Number(s.spend || 0)),
          borderColor: "#C0392B",
          backgroundColor: "rgb(192 57 43 / 18%)",
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 5,
          tension: 0.32
        }
      ]
    }),
    [spendByStore, monthsFilter]
  );

  const spendLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => formatCurrency(ctx.raw || 0)
        }
      }
    },
    scales: {
      x: { ticks: { maxRotation: 45, minRotation: 0 } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCurrency(value)
        }
      }
    }
  };

  const groupedBarOptions = {
    ...barOptions,
    plugins: {
      legend: { display: namesInScope.length <= 8, position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw;
            if (v == null) return `${ctx.dataset.label}:  · `;
            return `${ctx.dataset.label}: ${formatCurrency(v)}`;
          }
        }
      }
    },
    scales: {
      x: { stacked: false, ticks: { maxRotation: 40 } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCurrency(value)
        }
      }
    }
  };

  const hasStores = namesInScope.length > 0;

  return (
    <div className="grid ranking-comparison-root">
      {!stores.length && !loading ? (
        <p className="empty span-12">Nenhuma loja cadastrada para comparar.</p>
      ) : null}

      <section className="card span-12 ranking-comparison-toolbar">
        <h3 className="ranking-toolbar-title">Comparar unidades</h3>
        <p className="subtitle ranking-toolbar-desc">
          Escolha quais lojas entram na análise (2, 3, 4 ou todas) e, se quiser, restrinja a produtos específicos. Os gráficos e tabelas abaixo refletem só essa seleção.
        </p>

        <div className="ranking-toolbar-row">
          <div className="field field-styled">
            <label>Período (dados de gasto)</label>
            <select value={monthsFilter} onChange={(e) => setMonthsFilter(Number(e.target.value))}>
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
            </select>
          </div>

          <div className="ranking-presets">
            <span className="ranking-presets-label">Presets de lojas</span>
            <div className="ranking-presets-btns">
              <button type="button" className="btn btn-ghost ranking-preset-btn" onClick={() => presetStores(2)}>
                2 lojas
              </button>
              <button type="button" className="btn btn-ghost ranking-preset-btn" onClick={() => presetStores(3)}>
                3 lojas
              </button>
              <button type="button" className="btn btn-ghost ranking-preset-btn" onClick={() => presetStores(4)}>
                4 lojas
              </button>
              <button type="button" className="btn btn-secondary ranking-preset-btn" onClick={() => presetStores("all")}>
                Todas as lojas
              </button>
            </div>
          </div>
        </div>

        <div className="ranking-store-grid">
          {stores.map((store) => (
            <label key={store.id} className="ranking-store-chip">
              <input type="checkbox" checked={compareStoreIds.includes(store.id)} onChange={() => toggleStore(store.id)} />
              <span>{store.name}</span>
            </label>
          ))}
        </div>
        <p className="ranking-hint">
          {compareStoreIds.length === 0
            ? "Nenhuma loja marcada: comparamos todas as unidades da rede."
            : `${compareStoreIds.length} loja(s) selecionada(s).`}
        </p>

        <div className="ranking-product-scope">
          <div className="field field-styled">
            <label>Escopo de produtos na tabela e no gráfico de preços</label>
            <select value={productScope} onChange={(e) => setProductScope(e.target.value)}>
              <option value="all">Todos os produtos com dados</option>
              <option value="selected">Apenas produtos escolhidos abaixo</option>
            </select>
          </div>
        </div>

        {productScope === "selected" ? (
          <div className="ranking-product-picks">
            <span className="ranking-product-picks-title">Selecione um ou mais produtos</span>
            <div className="ranking-product-checkboxes">
              {products.map((p) => {
                const id = p.product_id || p.id;
                return (
                  <label key={id} className="ranking-product-chip">
                    <input type="checkbox" checked={pickedProductIds.includes(id)} onChange={() => togglePickedProduct(id)} />
                    <span>{p.product_name || p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <section className="card span-12">
        <h3 className="ranking-kpi-heading">Indicadores por loja (seleção atual)</h3>
        {!hasStores ? <p className="subtitle">Sem lojas no escopo.</p> : null}
        <div className="kpi-grid-5 kpi-grid-extended">
          {storeInsightCards.map((s) => (
            <KpiCardCompact
              key={s.name}
              label={s.name}
              value={formatCurrency(s.spend)}
              hint={`Desvio médio ${formatPercent(s.avgGap)} · Economia potencial ${formatCurrency(s.potential)}`}
            />
          ))}
        </div>
      </section>

      <section className="span-6">
        <ChartCard title="Eficiência por loja" subtitle="Score na rede (quanto maior, melhor)" height={300}>
          {hasStores ? (
            <Doughnut data={efficiencyBarData} options={efficiencyDoughnutOptions} />
          ) : (
            <p className="empty">Sem lojas para exibir.</p>
          )}
        </ChartCard>
      </section>

      <section className="span-6">
        <ChartCard title="Gasto total no período" subtitle={`Soma em compras · ${monthsFilter} meses`} height={300}>
          {hasStores ? (
            <Line data={spendLineData} options={spendLineOptions} />
          ) : (
            <p className="empty">Sem lojas para exibir.</p>
          )}
        </ChartCard>
      </section>

      <section className="span-12">
        <ChartCard
          title="Preço médio por produto (entre lojas)"
          subtitle="Até 10 produtos com maior dispersão de preço na seleção"
          height={380}
        >
          {productGroupedChart.hasData ? (
            <Bar
              data={{ labels: productGroupedChart.labels, datasets: productGroupedChart.datasets }}
              options={groupedBarOptions}
            />
          ) : (
            <p className="empty">Sem dados de preço para comparar com os filtros atuais.</p>
          )}
        </ChartCard>
      </section>

      <section className="span-12">
        <DataCard
          title="Tabela comparativa loja × produto"
          subtitle="Média, mínimo e referência da rede"
          footer={`${comparisonRowsFiltered.length} linha(s) · ajuste lojas e produtos acima.`}
        >
          <CompactTable
            columns={[
              { id: "store_name", label: "Loja", render: (r) => <span className="price-store">{r.store_name}</span> },
              { id: "product_name", label: "Produto", render: (r) => <span className="badge badge-info">{r.product_name}</span> },
              {
                id: "avg_price",
                label: "Média loja",
                render: (r) => {
                  const avg = Number(r.avg_price || 0);
                  const net = Number(r.network_min_price || 0);
                  const diffPct = net > 0 ? ((avg - net) / net) * 100 : 0;
                  const cls = diffPct > 12 ? "price-high" : diffPct > 3 ? "price-mid" : "price-good";
                  return <span className={`price-pill ${cls}`}>{formatCurrency(avg)}</span>;
                }
              },
              { id: "min_price", label: "Mín. loja", render: (r) => <span className="price-pill price-good">{formatCurrency(r.min_price)}</span> },
              { id: "max_price", label: "Máx. loja", render: (r) => <span className="price-pill price-high">{formatCurrency(r.max_price)}</span> },
              { id: "network_min_price", label: "Menor rede", render: (r) => <span className="price-pill price-network">{formatCurrency(r.network_min_price)}</span> },
              { id: "best_store_name", label: "Loja melhor preço", render: (r) => <span className="badge badge-success">{r.best_store_name}</span> },
              {
                id: "gap",
                label: "Vs menor rede",
                render: (r) => {
                  const a = Number(r.avg_price || 0);
                  const n = Number(r.network_min_price || 0);
                  if (!n) return "n/d";
                  return <span className="badge badge-warning">{`${(((a - n) / n) * 100).toFixed(1)}%`}</span>;
                }
              }
            ]}
            rows={comparisonRowsFiltered.slice(0, 60)}
            loading={loading}
            emptyMessage="Nenhum registro para os filtros escolhidos."
          />
        </DataCard>
      </section>
    </div>
  );
}
