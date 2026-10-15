const messages: Record<string, [number, string]> = {
      CONTRACT_HAS_FUTURE_CHARGES: [409, "Cobrança futura incompatível. Confira a vigência e corrija explicitamente a cobrança antes de salvar o contrato."],
      ENROLLMENT_NOT_ACTIVE: [409, "Matrícula inativa ou fora da vigência informada."],
      CONTRACT_AMOUNT_CONFLICT: [409, "Contrato alterado por outro usuário. Atualize a tela e confira a prévia novamente."],
      INVALID_CONTRACT_TERMS: [422, "Informe um valor positivo, vigência no primeiro dia do mês e justificativa com ao menos 10 caracteres."],
      CONTRACT_RETROACTIVE_CHANGE: [409, "A vigência antecede a última condição contratual. Revise o histórico antes de continuar."],
      CONTRACT_PERIOD_SPLIT: [409, "A cobertura atravessa uma mudança de contrato. Separe as cobranças por vigência."],
      CONTRACT_PRICE_UNCONFIRMED: [409, "Há matrícula sem preço contratado confirmado. Revise individualmente a condição contratual antes de alterar preços ou gerar cobranças."],
      PLAN_COMBINATION_EXISTS: [409, "Esta combinação de duração e frequência já existe. Edite ou reative o plano cadastrado."],
      PLAN_STRUCTURE_IN_USE: [409, "Este plano possui matrículas. Edite o preço ou utilize outra combinação para mudar duração e frequência."],
      INVALID_PLAN_COMBINATION: [422, "Selecione Mensal, Trimestral ou Semestral, com 1x, 2x ou 3x por semana, e informe o preço."],
      USE_PLAN_CHANGE: [409, "Use Trocar plano para alterar plano ou vigência com prévia e preservação do histórico."],
      INVALID_PLAN_CHANGE_DATE: [422, "A troca deve vigorar no primeiro dia de um mês futuro."],
      PLAN_UNCHANGED: [422, "Selecione um plano diferente do atual."],
      PLAN_CHANGE_UNKNOWN_COVERAGE: [409, "Há cobrança futura sem cobertura definida. Solicite a revisão financeira antes da troca."],
      PLAN_CHANGE_COVERAGE_CONFLICT: [409, "A vigência atravessa uma cobrança existente. Escolha o primeiro mês após sua cobertura."],
      PLAN_CHANGE_FUTURE_RECEIPTS: [409, "Há cobrança paga ou parcial a partir da vigência. Preserve o recebimento: escolha uma vigência após a cobertura ou solicite revisão financeira."],
      AMOUNT_BELOW_RECEIVED: [409, "O valor devido não pode ser menor que o valor recebido. Solicite revisão financeira de estorno ou crédito."],
      PAYMENT_BALANCE_CONFLICT: [409, "Os recebimentos precisam de conciliação financeira antes do ajuste."],
      CHARGE_NOT_FOUND: [404, "Cobrança não encontrada."],
      INVALID_CHARGE_AMOUNT: [422, "Informe um valor devido maior que zero."],
      CHARGE_REASON_REQUIRED: [422, "Informe uma justificativa com ao menos 10 caracteres."],
      CHARGE_ALREADY_EXISTS: [409, "Já existe cobrança para esta cobertura. Atualize a tela."],
      ENROLLMENT_OUTSIDE_COVERAGE: [409, "A cobertura está fora da vigência da matrícula."],
};

export function financialError(reason: unknown) {
  const code = String(reason);
  const entry = messages[code];
  return entry ? { status: entry[0], code, message: entry[1] } : null;
}
