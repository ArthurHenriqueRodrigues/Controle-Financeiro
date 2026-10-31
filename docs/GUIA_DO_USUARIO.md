# Guia do usuário

## Conteúdo

- [Primeiro acesso](#primeiro-acesso)
- [Lançamentos](#lançamentos)
- [Limite mensal](#limite-mensal)
- [Relatórios](#relatórios)
- [Assistente do site](#assistente-do-site)
- [Perfil e aparência](#perfil-e-aparência)
- [Impostos estimados](#impostos-estimados)
- [Uso offline e celular](#uso-offline-e-celular)
- [Armazenamento e backups](#armazenamento-e-backups)
- [Resolver problemas](#resolver-problemas)

## Primeiro acesso

Ao abrir pela primeira vez, o Saldo cria lançamentos demonstrativos dos seis meses recentes. Eles são exemplos locais, não dados bancários. Edite ou exclua-os e registre seus próprios valores. O limite inicial demonstrativo é R$ 4.200,00.

Escolha o mês no seletor do cabeçalho para atualizar os painéis mensais. As datas dos lançamentos determinam em qual mês e relatório cada registro aparece.

## Lançamentos

Na página **Lançamentos**, use **Novo lançamento** para registrar uma entrada ou saída. Informe descrição, valor, data, categoria e, quando disponível, forma de pagamento. Os valores devem representar o que deseja acompanhar; o aplicativo não importa extratos bancários.

Use a busca por descrição e os filtros de tipo e categoria para localizar registros. Para editar ou excluir um lançamento, use os controles do próprio registro. A exclusão individual solicita confirmação.

Categorias de despesas disponíveis: Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Contas, Compras e Outros. Categorias de receitas: Salário, Freelance, Investimentos, Reembolso e Outros.

## Limite mensal

O limite é um valor de referência para acompanhar despesas no mês selecionado. Edite-o pelo painel **Orçamento mensal**. O indicador compara as despesas registradas no mês com o limite:

- dentro do limite, mostra o valor restante;
- ao ultrapassar o limite, destaca o excedente em vermelho.

O alerta não bloqueia novos lançamentos. O limite é uma preferência geral, não um limite independente para cada mês.

## Relatórios

### Site

Abra **Relatórios** e escolha:

- **Mês** para consultar um mês específico;
- **Ano** para ver o total anual e o comparativo mês a mês;
- **Período personalizado** para informar as datas inicial e final.

O relatório apresenta receitas, despesas, saldo, despesas por categoria, estimativa de ICMS e os lançamentos do período. Use **Baixar CSV** para exportar os detalhes ou **Exportar / imprimir** para imprimir ou salvar em PDF pelo navegador.

O botão **Apagar lançamentos do período** remove permanentemente todos os registros incluídos no período atualmente selecionado, sem afetar lançamentos fora dele. A aplicação pede confirmação antes da exclusão. Essa operação não tem desfazer; exporte um backup antes, se houver dúvida.

### Android

Na tela **Relatório**, use as setas para mudar o mês ou ajuste as datas inicial e final para um intervalo. O app oferece compartilhamento de CSV, geração de PDF e controles para exportar/restaurar o backup JSON. O resumo anual mês a mês e a exclusão de todos os registros de um período estão disponíveis no site, não na tela nativa atual.

## Assistente do site

O assistente disponível no site funciona localmente e entende um conjunto limitado de frases. Ele consulta os dados do mês selecionado, aplica filtros/ordenação à tabela e abre alguns formulários. Ele não conversa com serviços externos, não acessa contas bancárias e não realiza exclusões em lote.

Peça **“comandos”**, **“ajuda”** ou **“o que você faz”** para ver a lista na própria interface. Exemplos:

| Pedido | Ação |
|---|---|
| `saldo`, `receitas`, `despesas` | Resume os totais do mês selecionado. |
| `orçamento` | Compara as despesas do mês ao limite e informa o restante ou excedente. |
| `impostos` | Mostra a estimativa de ICMS do período. |
| `maior gasto` ou `maiores gastos` | Mostra a categoria com maior total de despesas. |
| `maior despesa` | Mostra o lançamento de despesa com maior valor. |
| `quanto gastei em Alimentação` | Soma os lançamentos da categoria citada no mês. |
| `mostre despesas` / `mostre receitas` | Filtra a tabela pelo tipo. |
| `mostre despesas de Alimentação` | Filtra por tipo e categoria. |
| `buscar mercado` | Procura lançamentos cujo texto corresponda ao termo. |
| `organize por maior valor` / `menor valor` / `mais recente` | Ordena a tabela. |
| `limpar filtros` | Remove busca e filtros e volta à ordem mais recente. |
| `editar Aluguel` | Abre para edição o lançamento com essa descrição exata, se houver um único candidato. |
| `novo lançamento` | Abre o formulário de lançamento. |
| `alterar orçamento` | Abre o formulário do limite mensal. |
| `modo escuro` / `modo claro` | Alterna o tema. |
| `configurações` | Abre perfil, tema e opções de backup. |

O assistente não interpreta linguagem livre de forma geral. Se não reconhecer um pedido, use os controles visíveis da página ou reformule com um dos exemplos acima. Para evitar remover o item errado, ele orienta a excluir pela tabela em vez de executar exclusões.

## Perfil e aparência

No site, abra **Perfil e preferências** para alterar o nome exibido, escolher tema claro/escuro ou exportar/restaurar os dados. As preferências ficam no dispositivo. O app Android nativo não oferece atualmente o mesmo controle de nome, tema e assistente do site.

## Impostos estimados

A tela **Impostos** apresenta uma simulação informativa por categoria, com alíquota inicial de 18% como referência geral para o ICMS interno de São Paulo. É possível ajustar cada percentual ou zerar categorias sem incidência conhecida. A conta é simplificada e não determina quais produtos tiveram ICMS nem aplica regimes fiscais específicos.

Não use essa estimativa para declaração, prestação de contas, cálculo fiscal ou decisão contábil. Consulte documentos fiscais e um profissional qualificado para esses fins.

O lançamento demonstrativo **Salário professor (bruto, referência 40h)** usa R$ 5.130,63 como referência mensal bruta do piso nacional do magistério para jornada de 40 horas. O app não calcula remuneração líquida, descontos previdenciários ou tabela de carreira. Corrija ou apague o exemplo conforme sua realidade.

## Uso offline e celular

### Site/PWA

O site se adapta a telas menores. Para uso offline após instalação:

1. Abra a aplicação publicada em HTTPS.
2. No Android, use Chrome e escolha **Instalar aplicativo** ou **Adicionar à tela inicial**.
3. No iPhone/iPad, use Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**.
4. Abra a aplicação instalada ao menos uma vez enquanto estiver online para carregar os arquivos necessários.

Abrir o arquivo `index.html` por `file://` permite o uso local, mas não ativa service worker nem instalação PWA. Uma instalação web também não sincroniza registros entre navegadores ou dispositivos.

### Aplicativo Android

O app nativo mantém os dados no próprio aparelho e tem telas de painel, lançamentos, relatórios e estimativa de impostos. Ele não transfere automaticamente os dados do navegador; faça a exportação JSON em uma plataforma e restaure-a na outra.

## Armazenamento e backups

- Site: IndexedDB é o armazenamento principal; se indisponível, há uma alternativa no armazenamento local do navegador. Dados legados são migrados automaticamente quando possível.
- Android: arquivo `saldo-financeiro.json` no espaço privado do app e cópia secundária via AsyncStorage.
- Backup: exporte um arquivo JSON e guarde-o em um local seguro fora do app/dispositivo.
- Restauração: o conteúdo do arquivo substitui o estado atual. Confirme que selecionou o backup correto.

Limpar os dados do navegador, remover o perfil do navegador, limpar os dados do app ou desinstalar o Android pode apagar os dados locais. Ter o site e o app instalados não cria cópias sincronizadas.

## Resolver problemas

**Meus dados não aparecem em outro navegador ou no app.** Os dados são locais e não sincronizam. Restaure um backup JSON na outra instalação.

**A página não abre offline.** Abra o site publicado em HTTPS, carregue-o online pelo menos uma vez e instale-o pelo navegador. `file://` não oferece o cache offline do service worker.

**O app informa erro ao salvar ou carregar.** Não limpe os dados do app. Verifique o espaço disponível, feche e reabra o aplicativo e, se os dados ainda estiverem acessíveis, exporte um backup antes de qualquer reinstalação.

**O total de ICMS parece diferente de um comprovante.** A tela usa percentuais aproximados por categoria, não os dados fiscais de cada item. Consulte o documento fiscal; a estimativa não é cálculo oficial.

**Restaurei um arquivo e perdi alterações recentes.** A restauração substitui o estado anterior e não existe desfazer. Escolha um backup mais recente, caso exista.
