import { Line } from "react-chartjs-2";
import ChartCard from "../ui/ChartCard";
import { formatCurrency } from "../../lib/formatters";
import { bucketLabel } from "../../lib/analyticsFormatters";
import "../../charts/chartSetup";

const CHART_COLORS = ["#4b0c0c", "#cd292d", "#eca02f"];

export default function PriceEvolutionChart({ pricePoints = [], spendByBucket = [], granularity = "month", avgPrice = 0, height = 280 }) {
  const hasPoints = pricePoints.length > 0;
  const hasBuckets = spendByBucket.some((b) => Number(b.amount) > 0);

  if (hasPoints) {
    const data = {
      labels: pricePoints.map((p) => p.date),
      datasets: [
        {
          label: "Preço unitário",
          data: pricePoints.map((p) => p.unitPrice),
          borderColor: CHART_COLORS[0],
          backgroundColor: "rgba(75, 12, 12, 0.08)",
          tension: 0.2,
          pointRadius: 4
        },
        {
          label: "Média do período",
          data: pricePoints.map(() => avgPrice),
          borderColor: CHART_COLORS[2],
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    };
    return (
      <ChartCard title="Evolução de preço" subtitle="Cada ponto é uma compra no período" height={height}>
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
              y: { ticks: { callback: (v) => formatCurrency(v) } },
              x: {
                ticks: {
                  maxRotation: 45,
                  callback: (_, i) => {
                    const d = pricePoints[i]?.date;
                    return d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
                  }
                }
              }
            }
          }}
        />
      </ChartCard>
    );
  }

  if (hasBuckets) {
    const labels = spendByBucket.map((b) => bucketLabel(b.label, granularity));
    const data = {
      labels,
      datasets: [
        {
          label: "Gasto",
          data: spendByBucket.map((b) => b.amount),
          borderColor: CHART_COLORS[1],
          backgroundColor: "rgba(205, 41, 45, 0.15)",
          tension: 0.25,
          fill: true
        }
      ]
    };
    return (
      <ChartCard title="Gasto no período" subtitle="Por intervalo selecionado" height={height}>
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { ticks: { callback: (v) => formatCurrency(v) } } }
          }}
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Evolução de preço" height={height}>
      <p className="empty">Sem dados no período.</p>
    </ChartCard>
  );
}
