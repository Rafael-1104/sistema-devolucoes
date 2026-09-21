# Documentacao tecnica para reproducao

## Escopo e premissas

Este documento descreve o comportamento funcional implementado no Sistema de Devolucoes para que outro desenvolvedor ou agente possa reproduzi-lo em outro projeto.

O banco de dados do projeto de destino ja existe. As referencias a recursos como `devolucoes`, `itens_devolucao`, `volumes_item`, `materiais` e `usuarios` sao apenas contratos de leitura/escrita usados pela aplicacao atual. Este documento nao define schema, tabelas, colunas, indices, migrations, policies ou scripts de banco.

A implementacao atual usa React, TanStack Router e Supabase. A arquitetura equivalente pode ser diferente, desde que preserve os fluxos, regras e resultados descritos aqui.

## 1. Visao geral

O sistema controla devolucoes internas de materiais em um fluxo operacional:

1. o usuario autenticado inicia uma devolucao;
2. adiciona materiais por codigo, lote e volumes;
3. edita ou remove itens enquanto a devolucao nao estiver finalizada;
4. gera um CSV consolidado para importacao no ARECO;
5. informa a RM retornada pelo ARECO;
6. consulta uma pre-proxima do relatorio, imprime e confirma a finalizacao.

As principais areas sao:

- **Visao geral:** indicadores por status e as cinco devolucoes mais recentes.
- **Nova devolucao:** criacao, retomada e montagem de itens/volumes.
- **Devolucoes:** historico, busca, filtros, abertura de registros e exclusao permitida.
- **Consulta de Codigo:** busca pontual no catalogo por codigo ou por palavras da descricao.
- **Relatorios:** relatorio apenas para devolucoes com RM, impressao e finalizacao.
- **Usuarios:** listagem dos usuarios existentes e seus perfis; os botoes de criar/editar sao apenas visuais nesta versao.
- **Configuracoes:** formulario visual de preferencias; nao ha persistencia implementada.
- **Diagnostico:** testes de leitura das integracoes e do vinculo entre autenticacao e usuario.

Fonte de verdade: os dados de negocio sao carregados do Supabase. O estado React/external store serve para manter a lista em memoria e atualizar a interface, nao para persistir dados offline.

## 2. Modelo funcional

### 2.1 Devolucao

Uma devolucao possui, no minimo, identificador, status, RM opcional, autoria/data de criacao, itens, informacoes de CSV e informacoes de finalizacao. O identificador interno e retornado pelo banco ao criar o registro; a interface espera o formato `DEV-AAAA-NNNNN`, mas nao o gera no cliente.

Status validos e transicoes observadas:

| Status         | Significado                              | Transicao usada pela aplicacao   |
| -------------- | ---------------------------------------- | -------------------------------- |
| `em_montagem`  | Registro criado e ainda sendo preenchido | criacao; estado inicial          |
| `csv_gerado`   | CSV foi baixado/registrado               | gerar CSV com pelo menos um item |
| `rm_vinculada` | RM do ARECO foi associada                | salvar RM nao vazia              |
| `finalizada`   | Relatorio conferido e registro bloqueado | confirmacao de finalizacao       |

O carregamento normaliza qualquer status desconhecido para `em_montagem`. O frontend considera qualquer status diferente de `finalizada` editavel.

### 2.2 Item e volumes

Cada item mantem codigo do material, descricao, lote e uma lista ordenada de volumes. A quantidade total do item e sempre a soma das quantidades dos volumes validos. A quantidade total da devolucao e a soma dos totais dos itens.

Itens com o mesmo codigo nao sao automaticamente unidos. O sistema alerta quando o codigo ja aparece na lista e permite escolher entre editar um item existente ou adicionar outro separadamente. Isso permite separar lotes. A consolidacao por codigo acontece somente na montagem do CSV.

## 3. Funcionalidades e fluxos completos

### 3.1 Autenticacao e entrada no sistema

**Entrada:** e-mail e senha.

**Fluxo:**

1. A aplicacao restaura a sessao persistida do Supabase.
2. Enquanto a sessao e carregada, a tela protegida mostra carregamento.
3. Sem sessao, qualquer pagina interna redireciona para `/login`.
4. No login, o e-mail e trimado e enviado com a senha para `signInWithPassword`.
5. O botao fica desabilitado durante a requisicao.
6. Em sucesso, o usuario vai para a visao geral.
7. Em falha de credenciais, a mensagem tecnica `Invalid login credentials` vira “E-mail ou senha invalidos.”; outras mensagens sao exibidas como recebidas.

Ao detectar uma sessao, a aplicacao consulta o registro correspondente em `usuarios` para obter nome, cargo e e-mail exibidos. A ausencia desse registro nao invalida a sessao: o nome de exibicao cai para o e-mail ou “Usuario”.

### 3.2 Inatividade e encerramento de sessao

O timeout padrao e de duas horas e o aviso aparece cinco minutos antes. Ambos podem ser configurados por variaveis de ambiente, desde que sejam numeros positivos.

Eventos `pointerdown`, `keydown`, `click`, `mousemove`, `scroll`, `touchstart` e `touchmove` renovam a atividade, com throttle de 250 ms. O timestamp tambem e salvo no `localStorage`. Ao iniciar ou restaurar a sessao:

- se o timestamp persistido ja ultrapassou o timeout, a sessao e encerrada;
- caso contrario, os timers sao reagendados;
- quando o aviso aparece, “Continuar sessao” registra atividade e fecha o aviso;
- ao expirar, executa `signOut`, limpa o timestamp e redireciona para login.

O logout manual executa a mesma limpeza. O painel de debug de inatividade existe somente em desenvolvimento.

### 3.3 Criar ou retomar uma devolucao

Na rota de nova devolucao sem identificador:

1. O usuario clica em “Iniciar nova devolucao”.
2. A aplicacao insere uma devolucao com status `em_montagem` e o id do usuario autenticado, quando disponivel.
3. O banco retorna o registro criado e a lista e recarregada.
4. O registro vira a devolucao ativa em memoria e a rota recebe seu id.
5. Em sucesso, aparece confirmacao com o identificador.
6. Em erro, a operacao e impedida de repetir em paralelo e um toast exibe a falha.

A pagina tambem lista todas as devolucoes nao finalizadas e permite retomar qualquer uma. O id ativo em memoria e usado como fallback quando a rota nao recebeu `id`; nunca se retoma uma finalizada por esse mecanismo.

### 3.4 Adicionar item

**Entradas:** codigo do material, lote e quantidade de volumes com suas quantidades.

**Consulta do codigo:** apos 300 ms sem nova alteracao, o cliente consulta o catalogo pelo codigo exato. O codigo e tratado como texto. A descricao e preenchida pelo catalogo e nao e editavel.

**Validacoes antes de salvar:**

- codigo obrigatorio;
- enquanto a consulta estiver em andamento, salvar e invalido;
- o codigo precisa existir no catalogo;
- lote trimado obrigatorio;
- a soma das quantidades dos volumes precisa ser maior que zero;
- quantidades vazias, nao numericas ou menores/iguais a zero nao entram na lista enviada.

Depois da validacao, o item e inserido com a quantidade total calculada e os volumes sao inseridos. A lista e recarregada do banco. O formulario e limpo e o foco volta para o codigo.

Se o codigo ja existir na devolucao, abre-se um dialogo com os itens coincidentes. “Adicionar ao item existente” carrega aquele item no formulario para edicao; “Adicionar separadamente” fecha o alerta e preserva a nova inclusao como outro registro.

### 3.5 Editar item e lote

Editar o item completo recarrega codigo, lote e volumes no formulario. O mesmo conjunto de validacoes de inclusao e aplicado. A atualizacao altera codigo, descricao, lote e total; em seguida todos os volumes antigos sao removidos e os volumes atuais sao inseridos novamente.

Existe tambem uma edicao inline exclusiva do lote:

- abre um input no proprio registro;
- Enter salva, Escape cancela;
- valor vazio e rejeitado;
- se nao houve mudanca, apenas fecha a edicao;
- o backend atualiza somente lote e timestamp de alteracao, tentando alias de timestamp quando necessario;
- alterar apenas o lote nao marca o CSV como desatualizado.

Nenhuma dessas operacoes e permitida quando o status e `finalizada`.

### 3.6 Volumes

O campo “Quantidade de volumes” aceita somente digitos e inteiros nao negativos.

- aumentar a quantidade cria volumes vazios numerados sequencialmente;
- reduzir sem dados preenchidos remove imediatamente os volumes excedentes;
- reduzir com algum dado preenchido abre confirmacao, pois os dados excedentes serao perdidos;
- cancelar restaura a quantidade anterior;
- continuar remove os excedentes e renumera os restantes a partir de 1;
- a soma exibida considera somente numeros finitos maiores que zero.

No salvamento do item, os volumes validos sao enviados com numero e quantidade. O backend recebe a soma no item e os registros individuais dos volumes.

### 3.7 Remover item

O usuario confirma em dialogo com codigo, descricao, lote, total e numero de volumes. Ao confirmar, os volumes sao removidos primeiro e o item depois. A lista e recarregada somente apos sucesso. A remocao e bloqueada em devolucao finalizada ou enquanto outra acao estiver em andamento.

### 3.8 Gerar CSV para o ARECO

Precondicao: a devolucao precisa conter pelo menos um item.

O conteudo tem exatamente o cabecalho `Codigo;Quantidade` e uma linha por codigo distinto. Itens com o mesmo codigo sao somados, mesmo que tenham lotes diferentes. Lote e distribuicao por volume nao aparecem no arquivo. O arquivo termina com CRLF e recebe BOM UTF-8 para compatibilidade com planilhas.

O nome do arquivo e `<identificador>.csv`. O download ocorre no navegador e, depois, a devolucao e atualizada para `csv_gerado` com data e usuario gerador. Se o download ou a persistencia falhar, a aplicacao informa o erro.

Alteracoes posteriores de itens podem fazer o banco exibir `csv_desatualizado`; o frontend mostra esse aviso e oferece “Gerar CSV novamente”. A edicao isolada do lote e explicitamente tratada como nao invalidante.

### 3.9 Vincular RM

**Entrada:** numero da RM retornado pelo ARECO, trimado.

Valor vazio e rejeitado. Em sucesso, salva RM, status `rm_vinculada` e timestamp de vinculo, recarrega a devolucao, limpa o campo e mostra confirmacao. Se ja houver RM, a mesma operacao funciona como correcao. Enquanto a devolucao nao estiver finalizada, o botao continua disponivel.

Sem RM, o relatorio final nao pode ser aberto/gerado.

### 3.10 Relatorio, impressao e finalizacao

A rota de relatorios lista somente devolucoes com RM. Um id pode vir pela query string, mas a selecao sempre e validada contra essa lista.

1. O usuario seleciona uma devolucao.
2. “Gerar relatorio final” apenas torna a previa visivel; nao grava o documento.
3. A previa mostra identificador, RM, autoria, data do vinculo, itens, lotes, totais e espacos de assinatura.
4. “Imprimir” chama `window.print`; em modo de impressao, somente a folha A4 gerada para impressao fica visivel.
5. “Finalizar devolucao” abre confirmacao explicando o bloqueio definitivo.
6. A confirmacao tenta chamar a funcao remota `finalizar_devolucao`.
7. Se a funcao nao existir na API, usa fallback de atualizacao direta de status, data e usuario.
8. Em ambos os casos, a aplicacao consulta novamente o status e so considera sucesso se o banco responder `finalizada`.
9. Depois do sucesso, a lista e recarregada e a devolucao ativa e limpa.

Uma finalizada continua visivel e pode ser consultada/impressa, mas nao pode editar, incluir, remover, alterar lote, gerar CSV novamente ou excluir.

### 3.11 Historico, busca, filtros e exclusao

A tela de devolucoes filtra em memoria a lista carregada. Os filtros sao:

- texto livre, sem diferenciar maiusculas/minusculas, sobre identificador, RM, nome do criador, codigo e descricao dos itens;
- usuario criador;
- status;
- data inicial inclusiva, comparada com os dez primeiros caracteres da data de criacao;
- data final inclusiva.

Filtros vazios nao restringem o resultado. A tabela mostra estado vazio quando nenhuma devolucao coincide.

Excluir e permitido somente para status diferente de `finalizada`. A confirmacao exibe os dados principais. A remocao verifica cada etapa:

1. exclui volumes por item e compara a quantidade afetada com a quantidade esperada;
2. exclui itens da devolucao e compara a quantidade afetada;
3. exclui a devolucao e exige exatamente um registro afetado;
4. consulta novamente e exige que o registro nao exista;
5. recarrega a lista e mostra sucesso.

Qualquer divergencia, inclusive causada por RLS/permissao, interrompe o fluxo e informa a mensagem. Isso evita declarar sucesso quando o backend nao removeu tudo.

### 3.12 Consulta de codigo

Ha dois modos:

- **Codigo:** consulta um codigo exato e retorna no maximo um material.
- **Descricao:** aplica `ilike` para cada termo informado; todos os termos precisam aparecer na descricao, em qualquer ordem e sem diferenciar maiusculas/minusculas. O resultado e ordenado por descricao e limitado a 200.

A consulta e debounced em 300 ms. Sem qualquer termo, limpa resultados e erros. Codigo inexistente mostra “Material nao encontrado”; busca textual sem resultados mostra “Nenhum material encontrado”. Cada resultado pode ter o codigo copiado, usando Clipboard API ou fallback com textarea.

O atalho F4 navega para essa tela, rola ate “Palavra 1” e coloca o foco no campo.

### 3.13 Visao geral

Os quatro indicadores sao contagens em memoria por status: em montagem, CSV gerado, RM vinculada e finalizadas. A tabela de recentes usa os cinco primeiros registros, ja ordenados por criacao decrescente no carregamento. Abrir uma linha leva ao editor; o relatorio so e habilitado quando existe RM.

### 3.14 Usuarios

A tela consulta todos os registros de `usuarios`, mapeando nomes alternativos para nome, e-mail, cargo/perfil e ativo. Se o campo ativo nao for exatamente `false`, o usuario e considerado ativo.

O estado vazio e simplesmente uma tabela sem linhas. Erros de carregamento ficam no hook, mas a tela atual nao os apresenta. Os botoes “Novo usuario” e “Editar usuario” nao executam operacao de backend nesta implementacao; ao reproduzir fielmente, nao inventar CRUD administrativo sem requisito adicional.

### 3.15 Configuracoes

A tela exibe nome da empresa, unidade/obra, prefixo, almoxarifado e tres regras marcadas por padrao. Os valores usam `defaultValue`/`defaultChecked` e o botao “Salvar alteracoes” nao tem handler nem chamada de servico. Portanto, nao ha estado persistido nem efeito funcional. Caso o produto de destino precise dessas preferencias, isso deve ser tratado como uma extensao separada.

### 3.16 Diagnostico

Ao abrir ou reexecutar, a tela faz apenas consultas de leitura:

- testa acesso a usuarios, materiais, devolucoes, itens e volumes, limitando a um registro e solicitando contagem;
- se o erro vier sem mensagem, consulta diretamente o endpoint REST para detalhar codigo/mensagem/hint;
- verifica a sessao do Supabase Auth;
- com usuario autenticado, verifica se existe o correspondente em usuarios.

O diagnostico nao altera dados e nao deve ser confundido com uma rotina de provisionamento.

## 4. Fluxos de usuario e caminhos alternativos

### Fluxo principal feliz

1. Fazer login.
2. Abrir Nova devolucao.
3. Iniciar o registro.
4. Informar codigo; aguardar descricao valida.
5. Informar lote e volumes positivos.
6. Adicionar um ou mais itens.
7. Gerar e baixar o CSV.
8. Importar o CSV no ARECO fora desta aplicacao.
9. Informar a RM devolvida.
10. Abrir a previa do relatorio.
11. Imprimir, conferir e confirmar finalizacao.

### Caminhos alternativos

- Sair da tela antes de finalizar: o registro permanece no banco e pode ser retomado na lista de abertos.
- Codigo repetido: editar o existente ou manter novo item separado por lote.
- CSV gerado antes de terminar a montagem: o usuario pode gerar novamente; a interface sinaliza desatualizacao quando o dado vier marcado pelo backend.
- RM digitada incorretamente: usar a mesma area para corrigir enquanto nao finalizado.
- Falha parcial de exclusao: o erro e exibido e a operacao nao e tratada como concluida.
- Sessao expirada por inatividade: autenticar novamente; dados ja persistidos continuam no banco.
- Acesso direto a rota protegida sem sessao: redirecionamento para login.

## 5. Regras de negocio consolidadas

1. Somente quatro status sao aceitos pelo dominio.
2. Status desconhecido lido do backend vira `em_montagem` no frontend.
3. Tudo que nao esta `finalizada` e considerado editavel pelo cliente.
4. Devolucao finalizada nao pode ser alterada nem excluida.
5. A criacao inicia em `em_montagem` e associa o usuario autenticado quando houver sessao.
6. O identificador e responsabilidade do banco; o cliente apenas o exibe e usa no nome do CSV.
7. Codigo de material e texto e precisa existir em materiais para salvar item.
8. Descricao do item vem do catalogo e nao e digitada manualmente.
9. Lote e obrigatorio ao criar/editar item e ao editar inline.
10. Item precisa ter quantidade total maior que zero.
11. Quantidade total e sempre soma de volumes validos.
12. Volumes sao numerados a partir de 1 e renumerados apos reducao.
13. Reducao de volumes com dados exige confirmacao explicita.
14. Itens repetidos por codigo podem permanecer separados para representar lotes diferentes.
15. CSV consolida quantidades por codigo, sem lote e sem volumes.
16. Geracao de CSV exige pelo menos um item.
17. RM vazia nao pode ser vinculada.
18. Relatorio so esta disponivel para devolucao com RM.
19. Finalizacao exige confirmacao e verificacao posterior no banco.
20. Operacoes identicas em paralelo sao deduplicadas por chave em memoria.
21. A lista principal e recarregada apos mutacoes relevantes.
22. Exclusao exige verificacao da quantidade de registros afetados em cada nivel.
23. Busca por descricao exige todos os termos informados.
24. A pesquisa de materiais e limitada a 200 resultados.
25. Nao ha persistencia implementada para Configuracoes.
26. Nao ha CRUD implementado para Usuarios, apesar dos controles visuais.

## 6. Estados e eventos

### Estados de carregamento e mutacao

Implementar estados equivalentes para:

- carregamento inicial de sessao;
- carregamento/recarregamento de devolucoes;
- consulta debounced de material;
- salvar item, CSV, RM, exclusao e finalizacao;
- consulta de materiais;
- testes de diagnostico;
- dialogos de confirmacao abertos/fechados;
- formulario em modo adicionar ou editar;
- devolucao ativa e solicitacoes de foco F2/F4.

Durante cada mutacao, desabilitar os controles da mesma operacao para impedir duplo clique. O store atual usa uma chave de exclusao mutua por operacao e ainda trata o bloqueio visual local.

### Eventos de navegacao e teclado

- `F2`: abre a devolucao ativa nao finalizada e foca o codigo; sem devolucao ativa, mostra dialogo.
- `F4`: abre consulta de codigo e foca a primeira palavra.
- Enter salva lote inline.
- Escape cancela lote inline.
- Fechar um dialogo de reducao cancela a operacao destrutiva.
- Voltar limpa a devolucao ativa e retorna para a origem correta.

### Carregamento de dados

No primeiro uso no navegador, a lista e carregada uma vez; apos login o `AuthGate` forca recarregamento. O carregamento busca devolucoes, depois itens, volumes, descricoes de materiais e nomes de usuarios, monta a arvore em memoria, ordena itens por criacao/id e devolucoes por criacao decrescente.

Se nao houver sessao, a lista fica vazia. Se qualquer consulta principal falhar, o estado anterior nao e substituido por uma lista parcial e um erro e exibido.

## 7. APIs e servicos

### Supabase Auth

- `auth.getSession`: restaura sessao, identifica usuario autor e verifica diagnostico.
- `auth.onAuthStateChange`: sincroniza login/logout com o contexto.
- `auth.signInWithPassword`: autentica e-mail/senha.
- `auth.signOut`: logout manual e logout por inatividade.

A sessao e persistida pelo cliente Supabase e o token e renovado automaticamente. Nao expor secrets no cliente; usar somente URL e chave publicavel nas variaveis de ambiente do frontend.

### Leitura de dados

O cliente consulta os recursos existentes para:

- carregar devolucoes e seus itens/volumes;
- carregar nomes de usuarios;
- buscar materiais por codigo ou descricao;
- listar usuarios;
- verificar o diagnostico e o vinculo do usuario autenticado.

As consultas devem respeitar RLS/permissoes ja existentes. A aplicacao nao deve contornar autorizacao usando chave de service role no navegador.

### Escrita de dados

As operacoes funcionais sao insercao/atualizacao/exclusao de devolucoes, itens e volumes, alem da RPC opcional de finalizacao. O frontend atual possui um adaptador tolerante a nomes alternativos de colunas: quando o PostgREST informa coluna ausente, tenta aliases conhecidos e descarta campos que nao tenham alternativa. Ao reproduzir em outro projeto, manter essa tolerancia somente se o banco de destino realmente tiver variacoes de nomenclatura.

Toda escrita trata erro, mostra mensagem ao usuario e recarrega dados depois do sucesso. O fallback de finalizacao deve ser mantido: tentar RPC, aceitar especificamente “funcao inexistente”, atualizar diretamente nesse caso e confirmar lendo o status.

### CSV e navegador

CSV e gerado localmente, sem endpoint externo. O download usa Blob, BOM UTF-8, CRLF e nome baseado no identificador. Impressao usa `window.print` e uma folha de impressao renderizada separadamente.

## 8. Autenticacao e permissoes

O controle de acesso funcional observado e:

- todas as rotas de negocio usam `AuthGate` por meio de `AppLayout`;
- a rota de login e publica;
- sem sessao, o conteudo interno nao e renderizado;
- o cliente envia a sessao Supabase e depende das policies/RLS existentes para permitir ou negar leitura/escrita;
- o frontend nao aplica restricao por cargo/perfil e nao esconde rotas administrativas por role;
- a autoria de criacao, CSV e finalizacao usa o id do usuario autenticado quando disponivel.

Para reproduzir o comportamento atual, nao criar uma ACL adicional baseada em `cargo` sem requisito explicito. Se o projeto de destino tiver policies diferentes, documentar essa diferenca como decisao de integracao, nao como regra descoberta neste projeto.

## 9. Casos especiais e erros

- Banco sem sessao: lista de devolucoes vazia e redirecionamento para login.
- Registro com status desconhecido: tratado como em montagem.
- Material ausente no catalogo: item nao pode ser salvo.
- Consulta de material em andamento: salvar e bloqueado.
- Codigo alterado rapidamente: respostas antigas sao ignoradas por controle de ciclo de vida.
- Pesquisa vazia: nao consulta o backend.
- Clipboard indisponivel: usa fallback com textarea; se falhar, mostra erro.
- Quantidade de volumes vazia ou invalida: nao reduz/aumenta ate receber inteiro valido.
- Reducao com dados: exige confirmacao para evitar perda silenciosa.
- Falha ao inserir volumes depois de inserir item: a camada atual informa o erro, mas nao implementa transacao compensatoria; o destino deve preferir operacao atomica se sua arquitetura permitir, sem alterar o contrato funcional.
- Exclusao bloqueada por RLS: a contagem afetada denuncia a inconsistência e mostra orientação para verificar policy/permissao.
- RPC de finalizacao ausente: fallback direto; outros erros de RPC nao sao ignorados.
- Finalizacao sem persistencia real: falha na leitura de confirmação e permanece não finalizada.
- Nenhuma RM: relatorios mostra estado vazio e botoes ficam indisponiveis.
- Nenhum item: tabela informa estado vazio e CSV e bloqueado.
- Nenhum resultado de filtro: tabela informa que nenhuma devolucao foi encontrada.
- Erro de consulta de usuarios: o hook guarda o erro, mas a tela atual nao o apresenta.
- Configuracoes e Usuarios aparentam ser funcionais visualmente, mas nao alteram o backend.
- O dado exibido como `rmVinculadaPor` pode ficar vazio porque a leitura atual nao resolve esse nome em todos os caminhos; nao inferir autoria ausente.
- O fallback de aliases e limitado a nomes conhecidos; coluna diferente deve gerar erro, nao ser silenciosamente inventada.

## 10. Guia pratico para o Codex

Implemente nesta ordem:

1. **Defina os contratos de dominio no cliente:** devolucao, status, item, volume, material e usuario, sem criar ou modificar banco.
2. **Conecte autenticacao:** restauracao de sessao, login, logout, observacao de mudancas, guarda de rota e perfil complementar opcional.
3. **Implemente o carregamento agregado:** buscar devolucoes e relacionamentos existentes, mapear aliases necessarios, preencher descricoes/nomes e ordenar os dados.
4. **Implemente o store de mutacoes:** criar devolucao, adicionar/editar/remover item, gravar volumes, editar lote, gerar status de CSV, vincular RM e remover devolucao com verificacoes.
5. **Implemente o editor:** consulta debounced por codigo, validacoes, volumes dinamicos, alerta de duplicidade, bloqueio de finalizados e estados de salvamento.
6. **Implemente o CSV:** consolidacao por codigo, formato exato, download local e registro de geracao.
7. **Implemente a retomada e os atalhos:** devolucao ativa, F2, F4, navegacao de origem e foco apos mutacoes.
8. **Implemente historico e filtros:** busca textual nos campos definidos, filtros inclusivos de data e exclusao confirmada com verificacao.
9. **Implemente relatorio e impressao:** somente com RM, previa, totais, assinaturas, modo print e confirmacao de finalizacao com RPC/fallback.
10. **Implemente visao geral, consulta de codigo e diagnostico:** estados vazios, loading, erros e limite de 200 na busca textual.
11. **Reproduza somente o que existe:** Usuarios fica como listagem ate haver requisito de CRUD; Configuracoes fica visual ate existir servico de persistencia.
12. **Valide os cenarios:** login invalido, sessao ausente, criar/retomar, item invalido, item duplicado, volumes, CSV, RM, exclusao, finalizacao, inatividade, filtros, impressao e falhas de permissao.

### Contrato minimo de aceitacao

Uma reproducao esta funcional quando consegue:

- autenticar e bloquear rotas sem sessao;
- carregar dados existentes sem depender de mock ou localStorage de negocio;
- criar e retomar devolucoes;
- preservar itens separados por lote e volumes numerados;
- gerar CSV consolidado exatamente por codigo;
- vincular RM e liberar relatorio;
- impedir edicoes/exclusao apos finalizacao;
- confirmar no backend que exclusoes e finalizacao realmente ocorreram;
- tratar loading, vazio e erro sem declarar sucesso falso.

## Checklist final

- [ ] Funcionalidade 1: autenticacao, sessao persistida, guarda de rotas e encerramento por inatividade.
- [ ] Funcionalidade 2: criacao, retomada, montagem, edicao e exclusao de devolucoes com itens e volumes.
- [ ] Funcionalidade 3: consulta de materiais por codigo/descricao com debounce, AND e limite de resultados.
- [ ] Funcionalidade 4: geracao e download de CSV consolidado para o ARECO.
- [ ] Funcionalidade 5: vinculacao/correcao de RM e desbloqueio do relatorio.
- [ ] Funcionalidade 6: previa, impressao e finalizacao confirmada no backend.
- [ ] Funcionalidade 7: historico com busca, filtros, estados vazios e exclusao verificada.
- [ ] Funcionalidade 8: atalhos F2/F4, foco, retomada e protecao contra cliques duplicados.
- [ ] Funcionalidade 9: visao geral, listagem de usuarios e diagnostico somente leitura.
- [ ] Funcionalidade 10: configuracoes e acoes de usuario mantidas como visuais ate existir persistencia definida.
- [ ] Nenhuma tabela, migration, schema, policy ou segredo foi criado/documentado como requisito de implementacao.
