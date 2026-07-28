# Clínica Fisiofit

Site institucional da Clínica Fisiofit, com informações sobre a clínica, serviços, unidades e contato para agendamento pelo WhatsApp.

## Tecnologias

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router

## Executar localmente

Requisitos: Node.js 18 ou superior e npm.

```bash
npm install
npm run dev
```

O site estará disponível em `http://localhost:8080`.

## Validação

```bash
npm run lint
npm test
npm run build
```

O resultado de produção será criado em `dist/`.

## Estrutura

- `src/`: aplicação ativa.
- `public/`: arquivos públicos da marca.
- `CONTEXT.md`: fonte oficial de conteúdo, identidade e regras do projeto.
- `futuras-implementacoes/`: módulos demonstrativos preservados, mas excluídos da aplicação.

## Publicação

O projeto não possui integração automática com nenhum provedor. Pode ser enviado ao GitHub e publicado na plataforma de preferência.

Para hospedagens estáticas, configure o redirecionamento de rotas para `index.html`, pois a navegação usa React Router.

## Dados de ambiente

Arquivos `.env` e `.env.*` são ignorados pelo Git. Nunca envie segredos ou credenciais ao repositório.
