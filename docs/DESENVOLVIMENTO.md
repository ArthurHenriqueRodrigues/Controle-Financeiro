# Desenvolvimento

Este documento descreve a estrutura e os passos para executar ou compilar o projeto. O site não precisa de etapa de build. O aplicativo Android nativo usa React Native, Expo e Gradle.

## Estrutura

| Caminho | Finalidade |
|---|---|
| `index.html` | Estrutura e conteúdo da interface web. |
| `styles.css` | Layout responsivo, componentes e tema escuro do site. |
| `app.js` | Lógica web, lançamentos, relatórios, assistente e armazenamento. |
| `manifest.webmanifest` | Metadados de instalação da PWA. |
| `sw.js` | Cache dos arquivos estáticos para funcionamento offline. |
| `icons/` | Ícones e imagens da PWA. |
| `android-app/src/FinanceScreen.js` | Telas do aplicativo nativo. |
| `android-app/src/FinanceContext.js` | Estado e persistência local do aplicativo Android. |
| `android-app/src/finance.js` | Categorias, cálculos, dados de demonstração e funções financeiras compartilhadas no app. |
| `android-app/src/ui.js` | Componentes visuais e estilos do aplicativo nativo. |
| `android-app/app.json` | Metadados, identificador e versão Expo/Android. |
| `android-app/build-apk.ps1` | Prebuild Expo e compilação release no Windows. |
| `docs/` | Documentação do usuário e do desenvolvimento. |

## Executar o site

Para uso local básico, abra `index.html` em um navegador. Para testar instalação PWA e service worker, sirva os arquivos em `localhost` ou HTTPS. Por exemplo, com qualquer servidor estático disponível no ambiente de desenvolvimento, defina a raiz do servidor como a pasta do projeto.

O site não tem etapa de compilação ou pacote de dependências JavaScript. Alterações no `app.js`, `styles.css` ou `index.html` podem ser validadas no navegador. Ao alterar os recursos servidos pelo service worker, atualize também a identificação/versionamento do cache em `sw.js` para que clientes instalados busquem os arquivos novos.

## Dados locais

### Site

O estado da aplicação inclui lançamentos, limite, taxas estimadas, nome e preferência de tema. O IndexedDB usa o banco `saldo-financeiro-v2`, store `app-state` e registro `current`. Na inicialização, o estado existente é lido e normalizado. Se ainda não houver estado no banco, o site importa o valor legado de `localStorage` (`saldo-financeiro-v1`) e remove essa chave após a migração bem-sucedida.

Se IndexedDB falhar, a aplicação tenta gravar em `localStorage` e informa o modo alternativo ao usuário. Backups usam JSON versionado pelo campo `format` (`saldo-backup-v1`) e contêm estado e data de exportação. A importação valida o conteúdo antes de substituir o estado.

### Android

O estado é gravado em `saldo-financeiro.json` dentro do diretório privado do aplicativo por meio de `expo-file-system`. A escrita é feita em arquivo temporário e movida para o destino. AsyncStorage (`saldo-financeiro-v1`) é usado como cópia secundária e como fonte de migração quando o arquivo ainda não existe.

O aplicativo Android e o site usam o mesmo conceito de backup, mas não compartilham um banco automaticamente. A troca entre plataformas é feita pelo arquivo JSON exportado pelo usuário.

## Compilar o APK no Windows

### Requisitos

- Windows PowerShell.
- Node.js 22 ou superior.
- JDK 17 ou superior, com `JAVA_HOME` apontando para a instalação.
- Android SDK com licenças aceitas e estes componentes:
  - plataforma `android-37.0`;
  - Android Build Tools `37.0.0`;
  - NDK `27.1.12297006`;
  - CMake `3.31.6`.
- Espaço livre para dependências do JavaScript, ferramentas Android e arquivos intermediários nativos.

Configure `ANDROID_SDK_ROOT` (ou `ANDROID_HOME`) para a pasta do SDK. O script também reconhece ferramentas portáteis em `%LOCALAPPDATA%\saldo-build-tools` se estiverem nos caminhos esperados.

### Instalação de dependências e build

No PowerShell:

```powershell
Set-Location .\android-app
npm install
npm run apk
```

O script `build-apk.ps1` usa Expo prebuild para gerar a pasta nativa `android`, executa `assembleRelease` e copia o APK para `android-app/Saldo.apk`. A pasta Android gerada não é a fonte de configuração principal e é ignorada pelo `.gitignore`; mantenha a configuração de versão no `app.json`.

Para uma compilação de desenvolvimento, consulte os scripts em `android-app/package.json` e a documentação do Expo. `npm run android` requer um dispositivo/emulador e as ferramentas Android configuradas.

### Versão

Atualize `expo.version` e `expo.android.versionCode` em `android-app/app.json` antes de gerar uma nova release. A versão do pacote Gradle gerado é derivada desses valores durante o prebuild. `versionCode` deve aumentar a cada pacote Android que será instalado como atualização.

O APK local é útil para instalação de teste. Distribuir pela Play Store requer configurar uma chave e um processo de assinatura de produção. Não inclua chaves, senhas ou arquivos de assinatura privados no repositório.

## Verificações manuais recomendadas

Antes de distribuir uma alteração que afete persistência ou relatórios:

1. Abrir o site e confirmar que os lançamentos aparecem após recarregar.
2. Criar, editar, filtrar e excluir um lançamento de teste.
3. Exportar um backup JSON, restaurá-lo e conferir lançamentos e preferências.
4. Conferir os relatórios mensal, anual e de intervalo personalizado.
5. Testar a exclusão por período e confirmar que registros fora dele permanecem.
6. Verificar a interface em uma largura de celular e a instalação/abertura offline da PWA.
7. No Android, compilar o APK, instalá-lo em um aparelho/emulador, reiniciar e conferir os dados salvos.
8. Testar exportação/restauração JSON e compartilhamento CSV/PDF no Android.
9. Conferir o texto e as taxas da simulação tributária; ela não deve ser apresentada como cálculo fiscal oficial.

## Publicação no GitHub

Publique o código-fonte, documentação, arquivos de configuração e assets necessários para reproduzir o projeto. Não publique `node_modules`, arquivos locais de ambiente, chaves de assinatura ou diretórios de build gerados. O APK pode ser anexado a uma GitHub Release em vez de mantido no histórico de cada commit.

Antes de publicar:

1. confira o diff e os arquivos incluídos;
2. confirme que nenhum backup financeiro real, segredo, arquivo `.env` ou chave foi adicionado;
3. valide que o README e estes guias correspondem aos recursos disponíveis;
4. crie uma release e anexe o APK se desejar distribuir o binário.

Consulte as licenças dos pacotes dependentes antes de redistribuir o produto.
