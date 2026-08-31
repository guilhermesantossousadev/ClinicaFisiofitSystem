import { useEffect, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { TextField } from "../components/FormPrimitives";
import { Row, messageOf, brl, MetricLite, ModuleState } from "./OperationalShared";

export function OperationalReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setReport((await api<Row>(`/reports/annual?year=${year}`)).data);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => void load(), [year]);
  function exportCsv() {
    if (!report) return;
    const csv = [
      "Mês;Receitas;Despesas;Previsto receitas;Previsto despesas",
      ...(report.months ?? []).map((m: Row) =>
        [
          m.month,
          m.realizedIncomeCents,
          m.realizedExpenseCents,
          m.expectedIncomeCents,
          m.expectedExpenseCents,
        ].join(";"),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `fisiofit-relatorio-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">FECHAMENTO E ANÁLISE</p>
          <h1>Relatório anual</h1>
          <p>Doze meses lado a lado, previsto e realizado.</p>
        </div>
        <div className="title-actions">
          <TextField
            label="Ano"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <button className="btn secondary" onClick={exportCsv} disabled={!report || loading}>
            Exportar planilha
          </button>
          <button className="btn primary" onClick={() => window.print()} disabled={!report || loading}>
            Gerar PDF
          </button>
        </div>
      </div>
      <ModuleState loading={loading} error={error} retry={load} />
      <div className="metrics">
        <MetricLite
          label="Receitas realizadas"
          value={brl(report?.totals?.realizedIncomeCents ?? 0)}
        />
        <MetricLite
          label="Despesas realizadas"
          value={brl(report?.totals?.realizedExpenseCents ?? 0)}
        />
        <MetricLite
          label="Resultado"
          value={brl(
            (report?.totals?.realizedIncomeCents ?? 0) -
              (report?.totals?.realizedExpenseCents ?? 0),
          )}
        />
        <MetricLite label="Ano" value={year} />
      </div>
      <section className="card annual-table" aria-labelledby="annual-table-title" aria-describedby="annual-table-description">
        <h2 className="sr-only" id="annual-table-title">Comparativo mensal de {year}</h2>
        <p className="annual-table-description" id="annual-table-description">Valores realizados e previstos por mês, com total anual na última coluna.</p>
        <div className="month-grid" role="table" aria-label={`Relatório financeiro de ${year}`}>
          <div className="month-row head" role="row">
            <strong role="columnheader">Indicador</strong>
            {(report?.months ?? []).map((m: Row) => (
              <span role="columnheader" key={m.month}>{new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${m.month}T12:00:00Z`)).replace(".", "")}</span>
            ))}
            <strong role="columnheader">Total</strong>
          </div>
          {[
            ["Receitas", "realizedIncomeCents"],
            ["Despesas", "realizedExpenseCents"],
            ["Prev. receitas", "expectedIncomeCents"],
            ["Prev. despesas", "expectedExpenseCents"],
          ].map(([label, key]) => (
            <div className="month-row" role="row" key={key}>
              <strong role="rowheader">{label}</strong>
              {(report?.months ?? []).map((m: Row) => (
                <span role="cell" key={m.month}>{brl(m[key])}</span>
              ))}
              <strong role="cell">{brl(report?.totals?.[key] ?? 0)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
