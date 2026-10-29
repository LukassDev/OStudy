# OStudy

OStudy é uma aplicação local-first para organizar o estudo: espaços por disciplina, planos, tópicos, conversas com um tutor de IA, recursos, avaliações e calendário.

O código da aplicação está em [`Frontend/`](./Frontend/). A aplicação usa Expo e React Native, com suporte a Android, iOS e Web. A interface está disponível em inglês, português (Brasil), espanhol, francês, alemão e italiano.

Este repositório inclui a aplicação em `Frontend/` e esta documentação. A pasta `Web/` do workspace local não faz parte do repositório; as instruções de publicação do site institucional abaixo pressupõem que essa pasta também esteja disponível.

## Requisitos

- Node.js `>=22.13.0 <23` e npm.
- Android Studio e Android SDK para builds Android locais.
- macOS e Xcode para builds iOS locais. Também é possível configurar builds na nuvem através do EAS.
- Uma chave OpenRouter para usar o tutor de IA. O uso de modelos e OCR pode gerar custos na conta OpenRouter.

## Desenvolvimento

```powershell
cd Frontend
npm ci
npm start
```

Para iniciar a versão Web:

```powershell
npm run web
```

Configura a chave OpenRouter nas definições da aplicação. Não é necessário configurar uma chave de API de build nem um backend OStudy para executar as funcionalidades locais.

## Dados e definições

Os dados de estudo e as definições da aplicação são guardados numa base de dados SQLite local, no dispositivo ou navegador. Não existe sincronização automática entre dispositivos. Para transferir os dados, usa **Definições → Dados locais** para exportar a base de dados e importá-la noutro dispositivo; a importação substitui os dados locais existentes.

Os limites do tutor podem ser ajustados em **Perfil → Privacidade e definições → Definições da IA → Limites do tutor**. Apesar do nome da secção, alguns limites também controlam anexos, recursos e pré-visualizações de documentos. Os valores são números inteiros dentro dos intervalos indicados abaixo. As alterações ficam na base SQLite local e só passam para outro dispositivo quando a base é exportada e importada.

### O que cada limite controla

| Grupo | Limite | Predefinição | Intervalo | Efeito |
|---|---|---:|---:|---|
| Tutor IA | Mensagens de histórico do tutor | 40 | 1–200 | Número máximo de mensagens anteriores incluídas no contexto enviado ao tutor. |
| Tutor IA | Contexto máximo | 18 000 caracteres | 100–1 000 000 | Limita o tamanho do contexto de estudo local formatado para o pedido ao tutor. |
| Tutor IA | Texto extraído de anexos | 15 000 caracteres | 1–1 000 000 | Limita o texto extraído de cada anexo de texto incluído no contexto do tutor. |
| Tutor IA | Resposta máxima | 4 096 tokens | 1–32 768 | Máximo de tokens pedidos ao modelo para gerar uma resposta. |
| Tutor IA | Timeout do pedido | 90 segundos | 1–600 | Tempo máximo de espera por uma resposta do OpenRouter antes de cancelar o pedido. |
| Anexos do chat | Anexo por mensagem | 15 MiB | 1–100 | Tamanho máximo de cada imagem ou documento anexado a uma mensagem. |
| Anexos do chat | Anexo guardado na Web | 1 MiB | 1–50 | Limite adicional por anexo na Web; não se aplica ao armazenamento mobile. |
| Recursos | Ficheiro de recurso | 50 MiB | 1–500 | Tamanho máximo de um ficheiro enviado para os recursos de um Space. |
| Recursos | Ficheiro de texto na Web | 1 MiB | 1–50 | Limite adicional para recursos de texto na Web. A versão Web só guarda ficheiros de texto. |
| Recursos | Texto de recurso na Web | 15 000 caracteres | 1–1 000 000 | Tamanho máximo do conteúdo textual de um recurso guardado na Web. |
| Quizzes e flashcards | Máximo de itens por quiz/flashcards | 30 itens | 1–100 | Número máximo de itens aceites ao interpretar quizzes ou flashcards gerados pelo tutor. |
| Pré-visualização de documentos | Entradas no arquivo | 10 000 | 1–50 000 | Número máximo de ficheiros internos processados em documentos Office compactados. |
| Pré-visualização de documentos | Tamanho descomprimido | 120 MiB | 1–1 024 | Tamanho total máximo dos conteúdos descomprimidos num documento Office compactado. |
| Pré-visualização de documentos | Tamanho máximo do HTML | 24 Mi caracteres | 1–256 | Tamanho máximo do HTML produzido para uma pré-visualização Office. |
| Pré-visualização de documentos | Folhas de cálculo | 100 | 1–5 000 | Número máximo de folhas de cálculo processadas num ficheiro XLS/XLSX. |
| Pré-visualização de documentos | Linhas por folha | 5 000 | 1–100 000 | Número máximo de linhas processadas em cada folha de cálculo. |
| Pré-visualização de documentos | Colunas por folha | 200 | 1–10 000 | Número máximo de colunas processadas em cada folha de cálculo. |
| Pré-visualização de documentos | Slides por apresentação | 300 | 1–5 000 | Número máximo de slides processados numa apresentação PowerPoint. |

Os limites protegem o desempenho e o uso de memória; aumentá-los pode tornar pedidos, carregamentos ou pré-visualizações mais lentos e consumir mais recursos. **Restaurar limites padrão** repõe os valores da coluna “Predefinição”; é necessário guardar para aplicar as alterações.

A chave OpenRouter é guardada separadamente da base exportada: usa armazenamento seguro no mobile e `localStorage` na Web. Por isso, a chave não é transferida com a base de dados.

Backups automáticos são opcionais. No mobile ficam no armazenamento da aplicação; na Web, numa pasta autorizada pelo utilizador, usando um browser compatível. Os backups são verificados enquanto a aplicação está aberta ou regressa ao primeiro plano.

## Build

Executa estes comandos a partir de `Frontend/`:

```powershell
npx expo export --platform web
npx expo export --platform android
npx expo export --platform ios
```

O export Web é escrito em `Frontend/dist/`. Builds nativos também podem ser configurados através do [EAS](./Frontend/eas.json).

Para publicar o site institucional e o app Web juntos no Firebase Hosting, configura o projeto Firebase `ostudyweb`, instala as dependências em `Web/` e `Frontend/` e executa em `Web/`:

```powershell
npm run build:firebase
npm run deploy:firebase
```

O site institucional fica na raiz e o app Web em `/app`. A publicação requer autenticação no Firebase CLI e a criação do projeto `ostudyweb`.

## Testes e verificações

Executa os comandos em `Frontend/`:

```powershell
npm run test:ai
npm run test:db
npm run test:math
npm run test:tutor
npm run test:tutor-local
npm run test:office
npm run test:backup
npm run lint
npx tsc --noEmit
```

## Documentação adicional

- [README do frontend](./Frontend/README.md)
- [Configuração de autenticação Web](./Frontend/WEB_AUTH.md)
- [Notas da atualização 1.5](./Frontend/UPDATE_1_5.md)

## Licença

O projeto é distribuído sob a [PolyForm Noncommercial License 1.0.0](./Frontend/LICENSE). Consulta o ficheiro da licença para os termos completos.
