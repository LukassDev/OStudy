# Login Google na web

O fluxo web sai e regressa na mesma aba. O callback é sempre
`<origem atual>/auth/callback`; a rota conclui a sessão no Supabase.
O Android mantém o fluxo de deep link com `expo-web-browser`.

## Configuração do projeto Supabase alojado

Em **Authentication → URL Configuration → Redirect URLs**, adicionar:

- `http://127.0.0.1:8081/auth/callback`
- `http://localhost:8081/auth/callback`

Conservar os URLs já autorizados e o **Site URL** existente. Para outra porta,
endereço de rede local ou domínio de produção do app, adicionar o callback
exato dessa origem. A configuração local em `supabase/config.toml` não altera
a lista do projeto alojado.

Se o callback não estiver autorizado, o Supabase pode regressar ao Site URL
(por exemplo, ao site de apresentação), onde o app não consegue concluir o
login. Alterações no código não substituem esta configuração do serviço.

Referência: https://supabase.com/docs/guides/auth/redirect-urls

## Verificação

1. Abrir `/login` na origem autorizada e escolher “Continuar com Google”.
2. Concluir o login Google e confirmar que regressa a `/auth/callback` na mesma origem.
3. Confirmar a navegação para dashboard ou onboarding e a sessão após atualizar.
4. Em caso de recusa/erro do provedor, o callback deve permitir voltar ao login.

Regressões locais do serviço: `node scripts/web-auth-regressions.cjs`.
