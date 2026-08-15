import { useEffect, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { TextField } from "../components/FormPrimitives";
import { Row, messageOf, brl, MetricLite } from "./OperationalShared";

export function OperationalReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Row | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try {
      setReport((await api<Row>(`/reports/annual?year=${year}`)).data);
    } catch (e) {
      setError(messageOf(e));
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
          <button className="btn secondary" onClick={exportCsv}>
            Exportar planilha
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            Gerar PDF
          </button>
        </div>
      </div>
      {error && <div className="login-error">{error}</div>}
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
      <section className="card annual-table">
        <div className="month-grid">
          <div className="month-row head">
            <strong>Indicador</strong>
            {(report?.months ?? []).map((m: Row) => (
              <span key={m.month}>{m.month.slice(5, 7)}</span>
            ))}
            <strong>Total</strong>
          </div>
          {[
            ["Receitas", "realizedIncomeCents"],
            ["Despesas", "realizedExpenseCents"],
            ["Prev. receitas", "expectedIncomeCents"],
            ["Prev. despesas", "expectedExpenseCents"],
          ].map(([label, key]) => (
            <div className="month-row" key={key}>
              <strong>{label}</strong>
              {(report?.months ?? []).map((m: Row) => (
                <span key={m.month}>{brl(m[key])}</span>
              ))}
              <strong>{brl(report?.totals?.[key] ?? 0)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
