import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        font: {
          family: "Lucida Sans"
        }
      }
    },
    tooltip: {
      bodyFont: {
        family: "Lucida Sans"
      },
      titleFont: {
        family: "Lucida Sans"
      }
    }
  },
  scales: {
    x: {
      ticks: {
        font: { family: "Lucida Sans" }
      },
      grid: { display: false }
    },
    y: {
      ticks: {
        font: { family: "Lucida Sans" }
      },
      grid: {
        color: "#e4e7ec"
      }
    }
  }
};
