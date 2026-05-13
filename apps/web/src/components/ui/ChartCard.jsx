import DataCard from "./DataCard";

export default function ChartCard({ title, subtitle, children, actions, height = 280 }) {
  return (
    <DataCard title={title} subtitle={subtitle} actions={actions}>
      <div className="chart chart-canvas" style={{ height }}>
        {children}
      </div>
    </DataCard>
  );
}
