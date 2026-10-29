# OStudy

OStudy is a local-first study app for organizing study spaces, notes, learning plans, chats, grades, and calendar events. Your study data stays in a local SQLite database on your device or in your browser; the app does not require an OStudy account or a self-hosted backend.

The interface is available in English, Portuguese (Brazil), Spanish, French, German, and Italian.

## Features

- Local SQLite storage for your profile and study data.
- AI study tutor powered by OpenRouter, with configurable models and an editable behavior prompt.
- PDF text extraction with OCR support for tutor conversations.
- Local previews for supported Office documents.
- Import and export of SQLite database files to move data between devices.
- Configurable automatic local backups: every 1, 6, 12, 24, or 168 hours, retaining the 10 most recent copies.
- Calendar, grades, study spaces, notes, learning plans, and reviewed-topic tracking.

## Requirements

- Node.js 22.13 or newer in the 22.x release line and npm.
- Android Studio and an Android SDK for local Android builds.
- macOS and Xcode for local iOS builds. EAS Build can be used for cloud builds.
- An OpenRouter API key to use AI features. AI usage may incur charges from OpenRouter.

## Getting started

```bash
npm ci
npm start
```

Then use the Expo CLI to open the app on a connected device, emulator, or development client. To start the web version:

```bash
npm run web
```

No backend service or build-time API environment variables are required. Add your OpenRouter API key in the app's settings before using the tutor.

## Data and backups

Study data is stored in the app's local SQLite database. It is not automatically synchronized between devices. Use **Settings → Local data** to export a database file from one device and import it on another. Importing replaces the current local data.

### Tutor limits

Adjust these values in **Profile → Privacy and settings → AI settings → Tutor limits**. Despite the section name, some limits also apply to attachments, resources, and document previews. Values must be whole numbers within the listed ranges. Changes are saved in the local SQLite database and move to another device only when that database is exported and imported.

| Group | Limit | Default | Range | What it controls |
|---|---|---:|---:|---|
| AI tutor | Tutor history messages | 40 | 1–200 | Maximum number of previous messages included in the tutor's request context. |
| AI tutor | Maximum context | 18,000 characters | 100–1,000,000 | Maximum size of the formatted local study context sent to the tutor. |
| AI tutor | Text extracted from attachments | 15,000 characters | 1–1,000,000 | Maximum extracted text from each text attachment included in tutor context. |
| AI tutor | Maximum response | 4,096 tokens | 1–32,768 | Maximum number of tokens requested from the model for a response. |
| AI tutor | Request timeout | 90 seconds | 1–600 | How long to wait for an OpenRouter response before cancelling the request. |
| Chat attachments | Attachment per message | 15 MiB | 1–100 | Maximum size of each image or document attached to a message. |
| Chat attachments | Attachment stored on web | 1 MiB | 1–50 | Additional per-attachment limit on web; does not apply to mobile storage. |
| Resources | Resource file | 50 MiB | 1–500 | Maximum size of a file uploaded to a study space's resources. |
| Resources | Web text file | 1 MiB | 1–50 | Additional limit for text resources on web. The web app only stores text files as resources. |
| Resources | Web resource text | 15,000 characters | 1–1,000,000 | Maximum text content of a resource stored on web. |
| Quizzes and flashcards | Maximum items per quiz/flashcards | 30 items | 1–100 | Maximum number of items accepted when parsing tutor-generated quizzes or flashcards. |
| Document previews | Archive entries | 10,000 | 1–50,000 | Maximum number of internal files processed in compressed Office documents. |
| Document previews | Uncompressed size | 120 MiB | 1–1,024 | Maximum combined uncompressed content size in a compressed Office document. |
| Document previews | Maximum HTML size | 24 Mi characters | 1–256 | Maximum HTML size produced for an Office document preview. |
| Document previews | Spreadsheets | 100 | 1–5,000 | Maximum number of worksheets processed in an XLS/XLSX file. |
| Document previews | Rows per sheet | 5,000 | 1–100,000 | Maximum number of rows processed in each worksheet. |
| Document previews | Columns per sheet | 200 | 1–10,000 | Maximum number of columns processed in each worksheet. |
| Document previews | Slides per presentation | 300 | 1–5,000 | Maximum number of slides processed in a PowerPoint presentation. |

These limits help protect performance and memory use. Raising them may make requests, uploads, or previews slower and use more resources. **Restore default limits** resets the values to the defaults above; save to apply the changes.

Automatic backups are opt-in. On desktop web, choose and authorize a destination folder in a supported browser (Chrome or Edge). On mobile, backups are stored in the app's documents directory on that device. The app checks for due backups while it is open and when it returns to the foreground; it cannot guarantee a backup while the app is closed or a browser tab is suspended. Mobile backups are not automatically copied to a PC.

The profile and onboarding state persist as long as the app's local data remains available. Clearing the website's browser data, clearing app data, or uninstalling the mobile app removes that local database. Keep exported or automatic backups somewhere safe if you need to preserve your data.

## Build and export

```bash
npx expo export --platform web
npx expo export --platform android
npx expo export --platform ios
```

The web export is written to `dist/`. Native production builds can also be configured through EAS using `eas.json`.

## Checks

Run the focused regression scripts with npm:

```bash
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

## Security

Do not commit API keys, `.env*` files (except the template `.env.example`), Android signing files (`.jks` or `.keystore`), or personal database backups. The OpenRouter key is configured by the user in the app and is used for requests to OpenRouter.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). It permits use and modification only for permitted noncommercial purposes. The license explicitly allows certain nonprofit, educational, public research, public safety or health, environmental protection, and government organizations to use the software regardless of funding source. It does not generally permit commercial use by businesses, including internal commercial use, or commercial distribution. The license requires redistributions to include its terms and the `Required Notice: OStudy` attribution. See [LICENSE](./LICENSE) for the complete terms.

PolyForm Noncommercial is source-available and is not an OSI-approved open source license.
