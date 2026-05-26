const MAX_RANGE_DAYS = 730;

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function parseYmd(str) {
  const d = new Date(`${str}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysBetween(from, to) {
  return Math.ceil((to - from) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * @param {import('express').Request['query']} query
 */
export function parseAnalyticsDateRange(query = {}) {
  const preset = String(query.preset || "").trim();
  const months = Number(query.months || 0);
  const granularity = ["day", "week", "month"].includes(String(query.granularity))
    ? String(query.granularity)
    : "month";

  const today = startOfDay(new Date());
  let from;
  let to = endOfDay(new Date());

  if (query.dateFrom && query.dateTo) {
    from = startOfDay(parseYmd(String(query.dateFrom)));
    to = endOfDay(parseYmd(String(query.dateTo)));
    if (!from || !to) throw new Error("Datas inválidas.");
  } else if (preset === "today") {
    from = today;
  } else if (preset === "7d") {
    from = new Date(today);
    from.setDate(from.getDate() - 6);
  } else if (preset === "30d") {
    from = new Date(today);
    from.setDate(from.getDate() - 29);
  } else if (preset === "thisMonth") {
    from = startOfMonth(today);
  } else if (months >= 1 && months <= 24) {
    from = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
  } else {
    from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  }

  if (from > to) throw new Error("Data inicial deve ser anterior à final.");
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    throw new Error(`Período máximo de ${MAX_RANGE_DAYS} dias.`);
  }

  return {
    from,
    to,
    fromStr: toDateStr(from),
    toStr: toDateStr(to),
    granularity,
    preset: preset || (months ? `months-${months}` : "default"),
    bucketKey(date) {
      const d = new Date(date);
      if (granularity === "day") return toDateStr(d);
      if (granularity === "week") {
        const x = new Date(d);
        const day = x.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        x.setDate(x.getDate() + diff);
        return toDateStr(x);
      }
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    },
    buildLabels() {
      const labels = [];
      const cursor = new Date(from);
      if (granularity === "month") {
        cursor.setDate(1);
        while (cursor <= to) {
          labels.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        return labels;
      }
      if (granularity === "week") {
        const c = new Date(from);
        const day = c.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        c.setDate(c.getDate() + diff);
        while (c <= to) {
          labels.push(toDateStr(c));
          c.setDate(c.getDate() + 7);
        }
        return labels;
      }
      const c = new Date(from);
      while (c <= to) {
        labels.push(toDateStr(c));
        c.setDate(c.getDate() + 1);
      }
      return labels;
    }
  };
}

export function parseIdList(queryValue) {
  return String(queryValue || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
