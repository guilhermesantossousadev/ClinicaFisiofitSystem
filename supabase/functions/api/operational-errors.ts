const messages: Record<string, [number, string]> = {
 "ENROLLMENT_HAS_HISTORY": [409,"Esta matrícula possui aulas ou chamadas. Encerre a vigência preservando o histórico."],
 "OCCURRENCE_REASON_REQUIRED": [422,"Informe o motivo da alteração da aula."],
 "HOLIDAY_CLOSURE_REQUIRES_APPROVAL": [409,"A data está fechada por feriado. Autorize o funcionamento excepcional antes de remarcar."],
 "PROTECTED_OWNER_ACCOUNT": [409,"A conta proprietária não pode ser bloqueada, rebaixada ou removida."],
 "INVALID_RECORD_TEMPLATE": [422,"O modelo clínico não está disponível nesta clínica."],
  "FORBIDDEN": [
    403,
    "Seu perfil não possui permissão para esta operação."
  ],
  "LEGACY_RECONCILIATION_REQUIRED": [
    409,
    "Este registro legado exige reconciliação de referências antes de ser alterado."
  ],
  "PATIENT_SCHEDULE_CONFLICT": [
    409,
    "O paciente já possui outra aula ou atendimento neste horário."
  ],
  "PROFESSIONAL_SCHEDULE_CONFLICT": [
    409,
    "O profissional já possui outra aula, atendimento ou afastamento neste horário."
  ],
  "SCHEDULE_HISTORY_IMMUTABLE": [
    409,
    "O histórico não pode ser reescrito. Escolha uma vigência atual ou futura."
  ],
  "USE_SCHEDULE_EFFECTIVE_DATE": [
    409,
    "Escolha uma vigência posterior ao início da versão atual para preservar o histórico."
  ],
  "SCHEDULE_HAS_ATTENDANCE": [
    409,
    "Há chamadas registradas no período afetado. Revise as aulas antes de alterar a grade."
  ],
  "SCHEDULE_HAS_EXCEPTIONS": [
    409,
    "Há alterações pontuais no período afetado. Revise essas aulas antes de alterar a grade."
  ],
  "OCCURRENCE_HAS_ATTENDANCE": [
    409,
    "Este paciente já possui chamada nesta aula. Use a correção justificada."
  ],
  "OCCURRENCE_HAS_ATTENDANCE_OR_MAKEUP": [
    409,
    "Há chamada ou reposição reservada nesta aula. Revise a chamada ou cancele a reserva com justificativa."
  ],
  "OCCURRENCE_HISTORY_IMMUTABLE": [
    409,
    "Esta aula possui chamada. O horário e o profissional histórico devem ser preservados."
  ],
  "ATTENDANCE_VERSION_CONFLICT": [
    409,
    "A chamada foi alterada por outro usuário. Atualize a lista antes de corrigir."
  ],
  "ATTENDANCE_CORRECTION_REASON_REQUIRED": [
    422,
    "Informe o motivo da correção (mínimo de 3 caracteres)."
  ],
  "FUTURE_ATTENDANCE": [
    422,
    "A presença só pode ser registrada no dia da aula ou depois dela."
  ],
  "CLASS_MEMBERSHIP_NOT_FOUND": [
    404,
    "Vínculo não encontrado ou encerrado."
  ],
  "CLASS_OCCURRENCE_NOT_FOUND": [
    404,
    "Aula não encontrada ou acesso não autorizado."
  ],
  "CLASS_INACTIVE": [
    409,
    "Esta turma está encerrada."
  ],
  "INVALID_MEMBERSHIP_WEEKDAYS": [
    422,
    "Escolha dias em que este horário está disponível na data de início do paciente."
  ],
  "INVALID_MEMBERSHIP_PERIOD": [
    422,
    "Revise as datas do vínculo e sua vigência."
  ],
  "INVALID_OCCURRENCE_WINDOW": [
    422,
    "Consulte um período válido de até 93 dias."
  ],
  "PAYMENT_LEDGER_IMMUTABLE": [
    409,
    "Este lançamento pertence a um recebimento. Use o fluxo de estorno para preservar o histórico."
  ],
  "IDEMPOTENCY_CONFLICT": [
    409,
    "Esta requisição já foi utilizada com outros dados. Atualize a cobrança e revise o recebimento."
  ],
  "PROFESSIONAL_NOT_FOUND": [
    404,
    "Profissional não encontrado."
  ],
  "INVALID_PROFESSIONAL_PROFILE": [
    422,
    "Selecione um usuário ativo da mesma clínica."
  ],
  "PROFESSIONAL_PROFILE_ALREADY_LINKED": [
    409,
    "Este usuário já está associado a outro profissional."
  ],
  "INVALID_PROFESSIONAL_UNITS": [
    422,
    "Selecione ao menos uma unidade válida."
  ],
  "MAKEUP_CREDIT_NOT_FOUND": [
    404,
    "Crédito de reposição não encontrado."
  ],
  "MAKEUP_CREDIT_UNAVAILABLE": [
    409,
    "Este crédito está reservado, utilizado ou pendente de revisão."
  ],
  "MAKEUP_CREDIT_IN_USE": [
    409,
    "O crédito já está em uso. Revise a reserva ou o comparecimento antes de corrigir a origem."
  ],
  "MAKEUP_REASON_REQUIRED": [
    422,
    "Informe uma justificativa para a decisão sobre o crédito."
  ],
  "PATIENT_ALREADY_IN_ROSTER": [
    409,
    "O paciente já participa desta aula. Escolha outro horário para a reposição."
  ],
  "ALL_UNITS_REQUIRED": [
    403,
    "A operação afeta outras unidades. Solicite a um usuário autorizado a todas elas."
  ],
  "INVALID_CALENDAR_EXCEPTION": [
    422,
    "Revise o período e informe o motivo do feriado ou afastamento."
  ]
};
export function operationalError(reason: unknown) {
 const code=String(reason); const item=messages[code]; return item ? {status:item[0],code,message:item[1]} : null;
}
