# ADENDO OBRIGATÓRIO AO PROMPT MESTRE FISIOFIT UI/UX V2.2

**Executar somente após a conclusão da UI/UX V2.1 e a identificação de seu commit final.** A referência V2.2 anterior permanece válida; estas instruções a complementam, não a substituem.

Você recebeu o arquivo `Fisiofit_UIUX_V2_2_Referencias_Visuais.zip`.

1. Extrair o ZIP na worktree **isolada da V2.2**, sem sobrescrever código e sem incluir essas referências de terceiros no bundle do produto.
2. Ler `LEIA_PRIMEIRO.md` e `manifesto_referencias.json`.
3. Abrir `GALERIA_REFERENCIAS.html` (conexão à internet necessária para carregar screenshots externas) e os estudos locais `01_VISUAIS_OFFLINE/*.png`.
4. Para **cada padrão relevante**, relacionar a referência, a decisão para a Fisiofit e a tela/componente que será afetado. Não tratar imagens como especificação técnica ou autorização para novas operações.
5. A referência funcional/visual **principal é Jane** (R01/R02 e estudos offline 01/02/03/10): grade vertical real por tempo, dia/semana, múltiplos profissionais, filtros, navegação Hoje, zoom, blocos proporcionais à duração e drawer de turma sem perder contexto.
6. Adaptar a turmas recorrentes de pilates/fisioterapia, modelo Class, participantes/roster, salas, chamadas, reposições e exceções, mantendo RN-006 (capacidade informativa), permissões e invariantes já homologados.
7. Fresha/Cliniko (R03–R05) complementam visão por profissional; Zenamu/Mindbody (R06/R07) complementam a perspectiva de turmas e chamada; Linear (R08/R09) orienta filtros; Shopify (R10–R12), tabelas e formulários; Stripe (R13/R14), informação financeira; Notion (R15/R16), drawer contextual.
8. **Não recriar** refinamentos de componentes concluídos na V2.1; reaproveitar os padrões atuais.
9. Não copiar tela pixel a pixel, marca, imagem, ícones proprietários, textos ou código dos produtos citados. Paleta, escala tipográfica e identidade finais da Fisiofit V2.1 prevalecem.
10. Os desenhos locais são **propostas visuais ilustrativas**: não equivalem a telas reais existentes ou features de backend já disponíveis. Não inventar disponibilidade, regras, presença, cobrança nem ações de gravação.
11. Gerar screenshots reais da V2.1 e da V2.2, em viewport idêntica, com dados sintéticos e estados equivalentes; apresentar comparativo e matriz de aceitação (referência → decisão → componente → teste → evidência).
12. Testar calendário diário/semanal/multi-profissional, filtros por unidade, conflitos/simultaneidades, painel lateral, roster, chamada, zoom, responsividade e keyboard navigation; preservar geração de ocorrências e isolamento entre unidades.
13. Não alterar banco, API, schema, RLS, autenticação, contratos ou dados de produção para viabilizar detalhes visuais sem prévia autorização. Não publicar automaticamente.

## Critério visual especial da agenda

A qualidade da agenda deve ser verificada não apenas pela semelhança com o Jane, mas pela rapidez e precisão das tarefas da Fisiofit: encontrar o profissional certo, identificar a turma, consultar participantes, abrir a chamada e voltar ao mesmo dia/horário/filtros sem perda de contexto. Avaliar o uso da tela pela recepção e pelo profissional, inclusive em tablet e smartphone.

## Entrega adicional

No relatório final, incluir `REFERENCE_TRACEABILITY.md` com uma linha por referência aplicada: ID, produto, padrão utilizado, adaptação Fisiofit, evidência visual, teste funcional e eventuais divergências justificadas.
