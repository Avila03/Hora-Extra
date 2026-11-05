# Hora Extra

Aplicativo de gestão de um espaço particular para festas, jantares e encontros de família e amigos.

## Estado da versão 0.2

- Interface responsiva com módulos de Eventos, Estoque, Patrimônio, Compras, Tarefas, Manutenção e Equipe.
- Demonstração interativa e persistente no navegador via `localStorage`, com perfis simulados.
- Banco relacional PostgreSQL/Supabase definido em `supabase/schema.sql`, com políticas RLS para uma futura integração.
- **Esta versão é uma demonstração local, não sincroniza dados entre dispositivos e não autentica usuários reais.** As permissões de demonstração não substituem segurança no servidor.

## Melhorias de demonstração (0.2)

- Planejamento de cada evento com cardápio, checklist de preparação, compras vinculadas e sugestões de reposição.
- Modelos reutilizáveis de tarefas de preparação, cozinha e encerramento.
- Movimentações de estoque com quantidade, justificativa e histórico local.
- Importar/exportar cópia de segurança dos dados locais em JSON (na tela inicial).
- Menu móvel expandido com acesso aos nove módulos e ícones consistentes.

**Atenção:** os dados são demonstrativos e não sincronizados. A lista automática de compras sugere somente reposição até estoque mínimo; o cálculo de ingredientes por convidado ainda não foi implementado. A edição direta de saldos na demonstração não é uma trilha de auditoria completa. Nunca use o perfil simulado para controlar acesso a informações reais.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Implantação

Conecte este repositório a um novo projeto Vercel (framework Next.js). Em seguida, crie um projeto Supabase exclusivo e execute, nesta ordem, `supabase/schema.sql` e `supabase/02-security-hardening.sql` no SQL Editor antes de habilitar autenticação real. **Não** reutilize bancos dos outros aplicativos.

## Limitações atuais de infraestrutura

A conta Supabase da organização atingiu o limite de dois projetos gratuitos ativos. A conta conectada da Vercel recusou a criação de um novo projeto (403). Nenhum projeto existente foi modificado.

## Observações de segurança

- A interface atual é apenas demonstrativa: usuários e permissões são simulados no cliente.
- A base SQL está preparada, mas ainda precisa ser aplicada e validada com testes reais de RLS, permissões e estoque antes do uso coletivo.
- O banco deve ser exclusivo e jamais incluir chaves administrativas no frontend.

## Próximas etapas

1. Criar/liberar projeto Supabase independente e testar RLS.
2. Integrar login real, convite para colaboradores, sincronização de dados e RPC de movimentação de estoque.
3. Ativar deploy automático e testes de produção.
