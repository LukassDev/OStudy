# OStudy 1.5 — implementação

## Alterações

- Conteúdos: módulos e submódulos começam fechados. A sidebar mantém o comportamento anterior.
- Spaces: estrela de favorito no card e controlos subir/descer; ordem persistida no banco.
- Recursos: renomear o título sem alterar o ficheiro armazenado; subir/descer com ordem persistida.
- Cache: respostas de leitura dos dados de estudo persistidas no AsyncStorage, separadas por conta e consulta, com deduplicação de pedidos concorrentes. Escritas confirmadas invalidam o cache. Logout/troca de conta limpam os stores e o cache. Renovar o token não invalida o cache.
- Sincronização: uma revisão por utilizador permite detetar alterações remotas ao abrir/retomar a app e pelo Realtime. Plano, permissões e quotas não usam o cache de dados.
- Agenda: calendário geral apresentado como lista mensal, filtro por Space, e horário semanal com criação, edição e exclusão manual de aulas.
- Notas: média geral opcional; seleção dos módulos; escalas 10/20/100. Primeiro calcula a média ponderada de cada módulo; depois calcula a média simples entre os módulos selecionados que têm notas.
- Dashboard: carrossel com OrenSays primeiro, média geral opcional e aulas de hoje opcionais; swipe, dots e atalhos para as páginas completas. As novas páginas também estão na sidebar.
- Notificações locais: antecedência configurável (incluindo 10 minutos), sala e início/fim da aula. Eventos de dia inteiro têm hora de aviso configurável. Editar/apagar dados atualiza os agendamentos; tocar no aviso abre a Agenda.
- Importação Pro: endpoint separado do chat; Qwen lê imagens, os extratores existentes leem documentos textuais e Z.ai converte para JSON validado. Prévia editável antes de guardar; inserção de aulas em lote e proteção contra duplicações exatas.
- Traduções das novas funcionalidades nos seis idiomas atuais.

## Ativação

As migrations foram testadas numa base PostgreSQL local isolada (PGlite). **Não foram aplicadas ao Supabase remoto.**

1. Aplicar, por ordem, `supabase/migrations/20260919000001_study_15.sql` e `supabase/migrations/20260919000002_timetable_imports.sql` no projeto correto.
2. Publicar o backend com a rota `/api/timetable/import`. Reutiliza a configuração OpenRouter existente. A autorização Pro e o limite de importações são verificados no servidor.
3. Gerar um novo build nativo do front: foi acrescentado `expo-notifications` e o respetivo plugin em `app.json`. Uma atualização apenas de JavaScript não instala o módulo nativo.
4. Validar notificações num dispositivo Android/iOS, com a app fechada, e testar um documento/imagem real com os fornecedores de IA.

## Limites desta implementação

- O cache guarda dados/metadados; não descarrega automaticamente PDFs ou imagens para uso offline. Leituras individuais superiores a aproximadamente 2 milhões de caracteres não são persistidas. A invalidação é global por conta, não incremental por entidade.
- A Agenda reutiliza os eventos atuais, que têm data sem hora de início/fim. O horário de aulas tem início/fim e recorrência semanal. Não há calendário letivo, feriados ou exceções a uma aula recorrente.
- Horas seguem o fuso do dispositivo. Notificações dependem de autorização e das regras do sistema operativo; não foram verificadas em hardware nesta sessão.
- São agendadas até 50 aulas semanais e os próximos eventos até completar 60 notificações pendentes; a fila de eventos é renovada quando os dados são carregados na app. Alterações noutro dispositivo chegam aos avisos locais quando este dispositivo sincroniza.
- Importação: JPEG, PNG, PDF textual e DOCX, até 3 MB; PDF até 10 páginas; até 50 aulas por importação e 5 tentativas novas por dia/conta. Repetir um ficheiro já analisado reutiliza o resultado sem nova chamada à IA. PDFs digitalizados sem texto pedem uma imagem do horário.
- O ficheiro original da importação não é guardado. Guardam-se o hash e o resultado estruturado no backend.

## Verificações

- Backend: `npm run typecheck` e `node scripts/timetable-regressions.cjs` passaram.
- Front: `node scripts/study-15-regressions.cjs` passou: persistência após reinício, deduplicação, invalidação, isolamento entre contas, médias e passagem do lembrete de domingo para sábado.
- Exportação web: `npx expo export --platform web` passou com as novas rotas Agenda/Notas. O acesso ao AsyncStorage da sessão foi condicionado ao cliente para permitir a renderização estática sem `window`.
- ESLint: sem erros nos ficheiros novos e nos stores/componentes de organização verificados. Permanece um aviso anterior sobre `usedMb` em `ResourcesTab.tsx`.
- SQL: migrations executadas numa base isolada; testados rollback da ordenação parcial, RLS, acesso a Space alheio, horários inválidos, revisão por utilizador, restrição da RPC ao servidor e quota diária.
- TypeScript do front: comparação com os ficheiros de `HEAD` encontrou os mesmos 20 erros, em áreas já existentes (tipos de navegação, tema/componentes de UI, paywall e compras). Não foram corrigidos nesta atualização para evitar alterações fora do âmbito.
- Scripts antigos: `navigation-regressions.cjs` falha na comparação de um SVG por quebra de linha; `space-quota-regressions.cjs` aponta para a pasta antiga `oren-study-backend`. Os ficheiros associados não foram alterados para esconder essas falhas.

Não foi efetuada uma validação visual/interativa autenticada nem uma chamada real paga aos modelos de IA.

## Revisão visual

- Spaces: removidas as setas dos cards. Manter pressionado ativa elevação, feedback tátil e arrastar/soltar; a ordem é guardada pela RPC existente.
- Oren: um único fundo fixo, três conteúdos sempre disponíveis (OrenSays, Nota global média, Aulas de hoje), com dots internos e sem links soltos abaixo.
- Agenda/Notas: navegação partilhada entre Calendário, Horário e Notas. Calendário mensal com marcadores e filtro; horário por dia com lista de aulas; média global sempre apresentada e seleção dos módulos.
- Lembretes num painel próprio, aberto pelo sino. Removidas as opções de ocultar cards.
- Modais usam Input/Button existentes, seletor nativo de horas, seleção compacta de dia/Space e confirmação para apagar aulas.
- Não requer nova migration ou mudança no backend. Validação física do gesto de arrastar e do visual mobile ainda necessária.

Validação desta revisão: exportação web concluída; ESLint dos componentes novos sem erros; testes study-visual-regressions e study-15-regressions aprovados. O TypeScript completo mantém os erros anteriores; não surgiram erros nos novos componentes.
