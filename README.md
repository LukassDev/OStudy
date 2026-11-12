# OStudy 2.0.0

OStudy é um gestor de estudo local-first, pensado para organizar disciplinas, tarefas, calendário, conteúdos e aprendizagem com suporte de IA. A aplicação foi construída em Expo + React Native e já está pronta para Android, iOS e Web, mantendo os dados no dispositivo/navegador e evitando dependência de backend central.

A versão atual é 2.0.0 e reúne as principais melhorias do ciclo de produto do app: dashboard mais funcional, gestão de Spaces, sincronização do Google Classroom, tutor de IA mais robusto e melhor suporte para web e exportação de dados.

## Visão geral da app

- Dashboard com resumo rápido de média, próximos eventos e aulas
- Organização por Spaces e subspaces para cada disciplina ou área de estudo
- Agenda e calendário para aulas, provas, eventos e tarefas
- Registo de notas e médias por módulos/disciplinas
- Critérios por módulo, com pesos predefinidos para testes, fichas, apresentações e outros trabalhos, e médias de comportamento e participação
- Chat por Space com tutor de IA, anexos, documentos e geração de quiz/flashcards
- Recursos do Space com texto, PDFs, ficheiros e pré-visualização de Office
- Google Classroom opcional para sincronizar tarefas e calendário
- Dados locais em SQLite com exportação/importação e backup automático
- Suporte multilíngue: inglês, português, espanhol, francês, alemão e italiano

## Estrutura do projeto

- `Frontend/`: app principal em Expo/React Native
- `Web/`: site institucional em Next.js e export do app web para Firebase Hosting
- `builds/`: APK/AAB e artefactos de distribuição
- `LICENSE`: licença do projeto

## Requisitos

- Node.js `>=22.13.0 <23`
- npm
- Android Studio + Android SDK para builds Android locais
- macOS + Xcode para builds iOS locais (ou EAS)
- Chave OpenRouter para usar o tutor de IA

## Como iniciar

No diretório `Frontend/`:

```powershell
npm ci
npm start
```

Para abrir a versão web no Expo:

```powershell
npm run web
```

A chave OpenRouter deve ser configurada dentro da própria aplicação, em Perfil/Definições. Não é necessário ter backend próprio para usar a maior parte das funcionalidades locais.

## Novidades da 2.0.0

A versão atual consolida a nova base de experiência do OStudy:

- Dashboard com navegação mais direta e visão geral do estudo
- Sidebar com pesquisa por Spaces, favoritos e organização em árvore
- Gestão de Spaces com navegação por tabs: avaliações, calendário, Classroom, chats, conteúdo e recursos
- Melhor integração entre calendário, aulas, eventos e média geral
- Tutor de IA mais completo, com contexto local, anexos, OCR, extração de texto e geração de materiais de estudo
- Suporte de dados e exportação mais confiável para migração entre dispositivos
- Backup automático e gestão de limites de IA para desempenho e memória
- Integração opcional com Google Classroom por utilizador
- Web mais estável, com app em `/app` e site institucional em `/`

## Dados locais e privacidade

Os dados de estudo e as definições ficam guardados localmente em SQLite no dispositivo ou browser. Não há sincronização automática entre dispositivos.

Para transferir dados:

1. Abre **Definições → Dados locais**
2. Exporta a base
3. Importa a base noutra instância da app

A importação substitui os dados locais existentes.

A chave OpenRouter é guardada separadamente da base exportada: no mobile usa armazenamento seguro e na Web usa `localStorage`.

Os limites do tutor podem ser ajustados em **Perfil → Privacidade e definições → Definições da IA → Limites do tutor**. Eles ajudam a controlar histórico, contexto, anexos, tokens e desempenho geral da IA; o botão **Restaurar limites padrão** repõe os valores iniciais.

## Google Classroom (opcional)

O OStudy pode sincronizar tarefas do Google Classroom para o calendário de um Space. A Web usa um Client ID configurado pelo utilizador; o Android usa autorização nativa. A opção é 100% local e não precisa de backend central.

### Configuração rápida

1. Cria um projeto na [Google Cloud Console](https://console.cloud.google.com/)
2. Ativa a Google Classroom API
3. Cria um cliente OAuth adequado à plataforma: **Aplicativo da Web** para Web ou **Android** para Android (pacote `com.ostudy.app` e SHA-1 da assinatura da versão instalada)
4. Na Web, guarda o Client ID em **Perfil → Definições da IA**. No Android, o SDK nativo usa o pacote e o SHA-1, sem colar o Client ID no app nem ativar esquema de URI personalizado.
5. Liga a conta Google e selecciona a turma no Space correspondente

A sincronização é automática ao abrir a app e também pode ser forçada no calendário/agenda.

## Build e publicação

No diretório `Frontend/`:

```powershell
npx expo export --platform web
npx expo export --platform android
npx expo export --platform ios
```

O export web sai para `Frontend/dist/`. Os builds nativos também podem ser configurados via [EAS](./Frontend/eas.json).

Para publicar o site institucional e o app web juntos no Firebase Hosting, instala as dependências em `Web/` e `Frontend/` e executa no `Web/`:

```powershell
npm run build:firebase
npm run deploy:firebase
```

O site institucional vive na raiz e o app Web em `/app`. A publicação exige autenticação no Firebase CLI e a criação do projeto `ostudyweb`.

## Testes e validação

No diretório `Frontend/`:

```powershell
npm run test:ai
npm run test:db
npm run test:import
npm run test:grades
npm run test:math
npm run test:tutor
npm run test:tutor-local
npm run test:office
npm run test:backup
npm run lint
npx tsc --noEmit
```

## Documentação adicional

- [Web/README.md](./Web/README.md)
- [Cálculo das médias por módulo](./Frontend/docs/grade-calculation.md)
- [LICENSE](./LICENSE)
- [Frontend/LICENSE](./Frontend/LICENSE)

## Licença

O projeto é distribuído sob a [MIT License](./LICENSE). Consulta o ficheiro para os termos completos.
