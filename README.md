# Plataforma Fisiofit

Monorepositório oficial do site institucional, portal interno, API e banco da
Clínica Fisiofit.

Leia primeiro [context.md](./context.md). Ele é a fonte única da verdade para
arquitetura, infraestrutura, regras de negócio, estado de implementação,
segurança, ambientes e publicação.

## Início rápido

```bash
npm install
npm run dev
```

Portal local: `http://localhost:3000/sistema/`

## Validação

```bash
npm run typecheck
npm test
npm run build
```

O build final fica em `dist/`, com o site na raiz e o portal em
`dist/sistema/`.

Nenhum push ou publicação deve acontecer sem autorização explícita.
