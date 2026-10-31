# Saldo — controle financeiro

Aplicação de controle financeiro pessoal para acompanhar receitas e despesas, organizar lançamentos e consultar relatórios. Os dados ficam no dispositivo; não há conta, sincronização ou serviço de armazenamento em nuvem.

## Começar

### Site

Abra `index.html` em um navegador moderno. O uso local não exige servidor nem instalação. Para instalar como aplicativo e usar o modo offline do navegador, hospede os arquivos em HTTPS; service workers e instalação PWA não funcionam em `file://`.

O primeiro acesso cria lançamentos demonstrativos para ajudar a conhecer os painéis. Edite ou apague esses registros e substitua-os pelos seus dados. O guia [Guia do usuário](docs/GUIA_DO_USUARIO.md) explica os recursos, o assistente, relatórios e backups.

### Android

O código do aplicativo nativo está em `android-app`. Para gerar um APK de release no Windows, siga as instruções em [Desenvolvimento](docs/DESENVOLVIMENTO.md). O APK compilado não é mantido no repositório; ele pode ser anexado a uma release do GitHub para distribuição.

As versões web e Android guardam os dados separadamente. Exporte um backup JSON em uma versão e restaure-o na outra para transferir os lançamentos.

## Recursos

- Painel mensal com saldo, receitas, despesas, categorias e limite de gastos.
- Criação, edição, busca, filtro e exclusão de lançamentos.
- Relatórios por mês, ano e período personalizado na versão web; a versão Android permite escolher o mês e ajustar um intervalo de datas.
- Exportação de relatórios CSV e PDF, conforme os recursos disponíveis na plataforma.
- Backup e restauração dos dados em JSON.
- Tema claro/escuro, nome de perfil e assistente local de organização na versão web.
- Estimativa informativa de ICMS configurável por categoria, com referência inicial de 18% para São Paulo.
- Interface responsiva para telas móveis e suporte offline depois de instalada como PWA ou como aplicativo Android.

Consulte [Guia do usuário](docs/GUIA_DO_USUARIO.md) para detalhes, limitações e passos de recuperação de dados.

## Armazenamento e privacidade

No site, o IndexedDB é o armazenamento principal; se ele não estiver disponível, a aplicação tenta usar o armazenamento local do navegador. Dados antigos são migrados automaticamente quando o banco IndexedDB é iniciado. No Android, os dados são gravados em um arquivo JSON no espaço privado do aplicativo, com AsyncStorage como cópia secundária.

Os dados não são enviados a um servidor. Eles não são sincronizados entre aparelhos e podem ser removidos ao limpar os dados do navegador ou desinstalar/limpar os dados do aplicativo. Faça backups periódicos e guarde-os fora do dispositivo. Restaurar um backup substitui os dados existentes.

## Desenvolvimento e compilação

O site é composto por HTML, CSS e JavaScript, sem dependências externas de runtime. Para conferir as instruções de build e estrutura do app Android, consulte [Desenvolvimento](docs/DESENVOLVIMENTO.md).

Resumo do projeto:

```text
index.html                 Interface do site
styles.css                 Estilos responsivos e temas
app.js                     Lógica, armazenamento e recursos do site
sw.js                      Cache offline do site
manifest.webmanifest       Metadados de instalação PWA
icons/                     Ícones do site
android-app/src/           Aplicativo React Native / Expo
android-app/build-apk.ps1  Script de build Android para Windows
android-app/build-apk.ps1  Script para compilar o APK no Windows
docs/                      Guias do usuário e desenvolvimento
```

## Referências e limitações tributárias

A estimativa usa como referência geral a alíquota interna de ICMS de 18% em São Paulo, conforme a [Lei Estadual nº 6.374/1989](https://www.al.sp.gov.br/norma/25030). O cálculo simplificado aplica a taxa configurada à despesa por categoria; não identifica a incidência ou a base fiscal de cada compra. Não é apuração fiscal, orientação contábil nem substituto de comprovantes.

O lançamento demonstrativo de salário usa R$ 5.130,63 como referência bruta mensal do piso nacional do magistério para jornada de 40 horas. Não calcula salário líquido, descontos ou remuneração de uma carreira específica. Ajuste o lançamento para corresponder ao valor realmente recebido.

A organização por categoria e a revisão de orçamento são práticas gerais de planejamento; veja, por exemplo, as orientações arquivadas do [Consumer Financial Protection Bureau](https://www.consumerfinance.gov/archive/blog/budgeting-how-to-create-a-budget-and-stick-with-it/). O comportamento de uso offline do site segue o modelo de [service workers documentado pela MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

## Licenças

O arquivo `android-app/LICENSE` contém a licença incluída pelo Expo no projeto nativo. Verifique as licenças de cada dependência antes de redistribuir o aplicativo ou publicar uma versão em uma loja.
