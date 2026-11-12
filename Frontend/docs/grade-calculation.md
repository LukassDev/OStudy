# Notas por módulo e disciplina

Em **Disciplina → Avaliações → Novo módulo**, o modelo inicial é **55% Testes / fichas sumativas + 25% Trabalhos / apresentações + 20% Atitudes e valores**. Esta é uma predefinição de estimativa escolhida pelo utilizador, não uma regra oficial portuguesa nem uma tabela oficial da escola.

Os pesos dos três grupos são editáveis dentro do menu recolhível **Critérios de avaliação** e devem somar 100%. Testes e fichas pertencem ao primeiro grupo; apresentações e outros trabalhos/projetos pertencem ao segundo. Cada grupo usa a média simples de todas as suas avaliações, normalizadas à escala escolhida: dois testes e uma ficha contam como três avaliações, não como duas médias de tipos. Os pesos individuais antigos não se aplicam neste modelo.

As atitudes têm um único campo numérico ou qualitativo, de 0 a 20, inicialmente em branco. Não são preenchidas com 15/16 nem divididas automaticamente entre comportamento e participação. Exemplo: média de testes/fichas 15, trabalhos 12 e atitudes 18 dá **15 × 0,55 + 12 × 0,25 + 18 × 0,20 = 14,85/20**.

Enquanto faltarem notas, os grupos conhecidos têm os seus pesos redistribuídos proporcionalmente. Sem atitudes, o exemplo anterior dá **(15 × 55 + 12 × 25) / 80 = 14,0625/20**. Sem trabalhos, com testes 16 e atitudes 18, dá **(16 × 55 + 18 × 20) / 75**. Não se transfere automaticamente todo o peso em falta para um único grupo. Zero é uma nota válida; em branco significa desconhecido.

O modelo fica guardado no JSON dos critérios (`grouped: true`), sem alteração do esquema SQLite. Os módulos antigos conservam os seis critérios e o cálculo anteriores. Em **Editar critérios → Aplicar modelo 55 / 25 / 20**, é possível convertê-los explicitamente; a mudança só é guardada ao confirmar. A conversão limpa as antigas médias de comportamento/participação para permitir introduzir a média de atitudes. As avaliações mantêm o seu tipo e são agrupadas no cálculo. Novos módulos copiam critérios agrupados anteriores; quando o modelo anterior é antigo, começam com 55/25/20, com atitudes em branco.

A referência escolar consultada em 12/11/2026 é o [documento oficial de 2023/2024 da João de Barros](https://www.aejoaodebarros.pt/component/phocadownload/category/21-criterios-de-avaliacao?download=923:criterios-de-avaliacao), página 5: ensino profissional 80% conhecimentos/capacidades e 20% atitudes/valores. Esta fonte não estabelece a divisão 55/25, que permanece uma estimativa escolhida para a aplicação. Não se confirmou a vigência dos critérios em 2026/2027.

A média da disciplina é a média simples dos seus módulos com média calculável. A média geral é a média simples das disciplinas selecionadas no ecrã **Notas**. Não há arredondamentos intermédios; a apresentação usa até duas casas decimais. Estas médias acompanham o progresso e não substituem a classificação oficial do curso, que pode exigir arredondamentos e componentes como FCT e PAP.

As notas anteriores à introdução dos módulos são preservadas em **Sem módulo** e mantêm a sua média ponderada. Se existirem módulos, esse conjunto entra como um grupo adicional na média da disciplina até se atribuir um módulo e tipo a cada avaliação. Eliminar um módulo preserva as suas avaliações em **Sem módulo**, removendo os critérios e médias de atitudes do módulo.

Quando uma nota é incerta, escolhe **Qualitativa** no formulário da avaliação ou na média de comportamento/participação. A interface mostra apenas o nome do qualitativo. A conversão guardada e usada internamente na média mantém-se: **Muito insuficiente = 2; Insuficiente = 7; Suficiente = 12; Bom = 16; Muito bom = 19** (na escala de 0 a 20). A conversão adapta-se à escala escolhida: Bom equivale a 80/100. Estas equivalências correspondem aos pontos médios dos intervalos assumidos [0,4), [4,10), [10,14), [14,18) e [18,20]. São estimativas acordadas com o utilizador, não critérios oficiais de uma escola.

A seleção qualitativa fica guardada e identificada como estimativa. As médias por módulo, disciplina e geral mostram «≈» quando incluem estimativas; um critério com 0% não ativa este indicador. Mudar para **Nota numérica** permite introduzir a nota exata e remover a marcação qualitativa.

Os módulos e critérios ficam na base SQLite, juntamente com as avaliações, e acompanham a exportação/importação e os backups. A migração para a versão 5 preserva as notas numéricas existentes e atualiza as estimativas qualitativas anteriores para a conversão acordada.

Os backups das versões anteriores são importados através de uma base temporária, onde as colunas novas recebem os valores iniciais e se executam as migrações. As notas antigas conservam a nota, a escala, o peso e o tópico; quando o backup é anterior aos módulos, ficam em **Sem módulo**. O ficheiro original não é modificado. Os snapshots exportados ficam preparados para reabertura em memória, incluindo quando a base ativa usa WAL.

Validação: `npm run test:grades` cobre o cálculo por tipo, escalas, médias provisórias, isolamento entre módulos/disciplinas, média geral, migração SQLite e preservação das avaliações ao eliminar um módulo. `npm run test:import` usa o motor WASM SQLite da própria app para importar backups das versões 1–5 com e sem WAL, verificar as relações e testar a preservação dos dados em cancelamentos ou falhas.
