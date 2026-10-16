# Registro de execução e análise — GitHub Actions com IA

**Aluno:** Eduardo Augusto Teresin Ferreira  
**RA:** 2026108377  
**Turma:** 2ESBN  
**Projeto:** Desenho Assinado — Cloudflare Pages, Functions e D1  
**Repositório:** https://github.com/eduardoaugustotferreira-hash/desenho-assinado

## 1. Visão geral

Nesta atividade, organizei uma sequência de verificações para reduzir o risco de enviar alterações com problemas à branch `main`. O trabalho reúne testes automáticos de código e SQL, proteção de branch, revisão de Pull Requests com IA e atualização controlada de um banco Cloudflare D1. Os resultados são apresentados abaixo com links de execução e os problemas observados durante os testes.

## 2. Testes automatizados de integração contínua — Tarefa 1

O workflow [`ci.yml`](.github/workflows/ci.yml) executa o job `verificar` quando há `push` e quando um Pull Request é aberto ou atualizado contra a `main`. Ele procura possíveis segredos versionados, aplica os arquivos de `migrations/` em SQLite local e valida os arquivos HTML.

Para provar que a verificação identifica problemas, acrescentei temporariamente a instrução inválida `CREATE TABLEx erro_proposital (id INTEGER);` à migração. O teste de SQLite falhou e o job retornou erro; após remover a linha e publicar a correção, o workflow voltou a concluir com sucesso.

**Evidências:**

- [Execução com falha proposital do CI](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38670823910/job/116213287942?pr=1).
- [Execução aprovada do CI após as correções](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38842376496).
- [Histórico completo do workflow de CI](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/workflows/ci.yml).

**Por que validar no SQLite antes do D1?** Porque uma falha de sintaxe ou de sequência entre migrações pode ser detectada em um ambiente de teste, evitando que uma alteração inválida chegue diretamente ao banco remoto.

## 3. Controle das alterações na branch principal — Tarefa 2

Configurei o ruleset `protecao-main` para exigir Pull Request e a aprovação do status check `verificar` antes da integração na `main`. Também habilitei a restrição de exclusões e o bloqueio de *force push*.

No [Pull Request #1](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/pull/1), a versão com SQL propositalmente inválido deixou o merge indisponível, porque os checks `ci / verificar (push)` e `ci / verificar (pull_request)` falharam. Depois do commit de correção, os checks ficaram verdes e o botão de merge foi liberado.

Também criei uma branch temporária, fiz um commit vazio e tentei enviar esse commit diretamente à `main`, usando `git push origin HEAD:main`. O GitHub recusou a operação, registrando a seguinte saída:

```text
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Changes must be made through a pull request.
remote: - Required status check "verificar" is expected.
! [remote rejected] HEAD -> main (push declined due to repository rule violations)
```

**Evidências:** [PR #1 com os testes bloqueado e liberado](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/pull/1) e [execução do CI que provocou o bloqueio](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38670823910/job/116213287942?pr=1). A saída da tentativa de push direto está reproduzida acima.

## 4. Revisão de Pull Request com Inteligência Artificial — Tarefa 3

Implementei o workflow [`revisao-ia.yml`](.github/workflows/revisao-ia.yml), acionado em Pull Requests do próprio repositório. Ele monta um prompt com o `git diff`, executa `actions/ai-inference` com um token armazenado no secret `COPILOT_PAT` e publica a análise por meio do `gh pr comment`.

**Teste de vulnerabilidade e correção.** Acrescentei temporariamente uma função auxiliar com a consulta abaixo, que incorporava a variável `nome` ao texto SQL:

```javascript
.prepare(`SELECT * FROM notas WHERE aluno = '${nome}'`)
```

Em uma das primeiras respostas, a IA priorizou uma possível exposição do token do Copilot e não destacou esse SQL. Após melhorar o prompt para pedir atenção explícita à SQL Injection, a revisão identificou o problema em `functions/api/desenho.js` e recomendou substituir a interpolação por parâmetros. Fiz a correção:

```javascript
.prepare("SELECT * FROM notas WHERE aluno = ?").bind(nome).all()
```

Na revisão seguinte, a IA reconheceu o uso de `?` e `.bind(nome)` e informou que não identificou SQL Injection nesse trecho. A função usada no teste não era chamada pela aplicação, mas o padrão original de consulta seria inseguro se viesse a receber entradas externas.

**Evidências da revisão:**

- [PR #1 — histórico dos comentários automáticos da IA, antes e depois da correção](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/pull/1).
- [Execução da revisão após a identificação da vulnerabilidade](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38839224649).
- [Execução da revisão após a correção do SQL](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38839631640).

**Teste de permissões.** Retirei temporariamente `pull-requests: write` das permissões do workflow. A IA produziu sua resposta, mas a publicação do comentário foi recusada pelo GitHub com a mensagem `GraphQL: Resource not accessible by integration (addComment)`, seguida de `Process completed with exit code 1`. Restaurei a permissão, publiquei novo commit e a execução seguinte voltou a concluir com sucesso.

- [Execução com a falha de permissão](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38839944374).
- [Execução aprovada após restaurar a permissão](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38840607503).

### Análise crítica do retorno da IA

A IA sugeriu criar um arquivo `SECURITY-REVIEW.md` para registrar seus achados. Embora esse arquivo pudesse ser útil em outro contexto, a sugestão não era necessária para esta avaliação, que pede especificamente o `AVALIACAO.md` como documento de entrega. Além disso, a IA inicialmente deixou de destacar o SQL vulnerável e só o identificou depois que ajustei o prompt; por isso, considero importante conferir a análise com o código, os testes e os objetivos da tarefa, em vez de tratá-la como uma validação automática infalível.

O alerta recorrente sobre um possível uso indevido do `COPILOT_PAT` por colaboradores capazes de alterar workflows merece atenção: ele descreve um risco **condicional**, não uma prova de que o token tenha sido exposto. Por essa razão, não descartei o aviso como falso, mas distingui a possibilidade apontada da ocorrência efetiva de um incidente.

## 5. Aplicação controlada de migrações no D1 — Tarefa 4

Criei o workflow [`migrar.yml`](.github/workflows/migrar.yml) para executar em `push` na `main` **somente se o commit afetar `migrations/**`**. Ele usa o Wrangler para aplicar migrações no banco remoto `desenho-assinado-db`, selecionando o ambiente `production` definido no `wrangler.toml`.

A execução inicial registrou `0001_inicial.sql` e `0002_adiciona_coluna.sql` como aplicadas; entretanto, a `0002` havia sido enviada vazia e o banco ainda não possuía a coluna `observacao`. Como a migração já constava no histórico do D1, abri outro PR com a `0003_adiciona_observacao.sql`, contendo `ALTER TABLE notas ADD COLUMN observacao TEXT;`, e mantive a `0002` sem comando para não produzir erro de coluna duplicada no teste local.

Após o novo merge, a execução remota aplicou a `0003` com sucesso. No console do Cloudflare, a consulta `PRAGMA table_info(notas);` apresentou as colunas `id` (INTEGER), `aluno` (TEXT), `nota` (REAL) e `observacao` (TEXT), confirmando o resultado no esquema real.

**Evidências das migrações:**

- [Execução inicial no banco remoto](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38842876367/job/116786724709).
- [Execução aprovada da migração 0003](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/runs/38844714177/job/116792498698).
- [PR #3 — correção que adicionou a coluna observacao](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/pull/3).

**Verificação do filtro de caminhos.** Fiz outro Pull Request alterando somente o `README.md` e concluí o merge na `main`. A revisão confirmou que apenas a documentação havia sido modificada, enquanto a página do workflow `Migrar D1` continuou com as mesmas três execuções anteriores: não houve novo disparo após o merge do README.

- [PR #4 — alteração exclusiva do README e merge aprovado](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/pull/4).
- [Histórico do Migrar D1 — sem execução para o PR #4](https://github.com/eduardoaugustotferreira-hash/desenho-assinado/actions/workflows/migrar.yml).

## 6. Respostas às perguntas do enunciado

**1. O `ci.yml` roda duas vezes quando você faz push numa ramificação com PR aberto. Por quê, e qual das duas execuções o status check da `main` considera?**

Isso acontece porque o workflow responde a dois eventos diferentes: `push` na branch e `pull_request` aberto ou atualizado contra a `main`. Para decidir se o PR pode ser integrado, a proteção considera o check `verificar` associado à validação do Pull Request; no histórico também aparecem os resultados da execução de `push`, que precisa permanecer consistente com o código enviado.

**2. Por que um PR vindo de um fork não consegue usar `secrets.COPILOT_PAT`? Qual ataque essa regra impede?**

O GitHub não disponibiliza automaticamente os secrets do repositório de destino para workflows acionados por Pull Requests provenientes de forks, pois o código enviado pode ser controlado por pessoas externas. Essa restrição dificulta que alguém modifique um workflow ou comando do PR para copiar o `COPILOT_PAT` e enviá-lo a um servidor externo.

**3. Por que o workflow da Tarefa 3 declara `permissions` em vez de usar as permissões padrão do `GITHUB_TOKEN`?**

Declarar `contents: read` e `pull-requests: write` permite limitar o acesso do token ao que o workflow realmente precisa: ler os arquivos e publicar o comentário no PR. No teste em que removi a permissão de escrita, a análise da IA terminou, mas o GitHub recusou `addComment`, demonstrando a necessidade dessa autorização específica.

**4. A revisão da IA pode substituir o status check da Tarefa 2? Justifique com o que você observou no item 4 da Tarefa 3.**

Não, porque o status check executa verificações reproduzíveis que podem bloquear o merge quando o código falha, enquanto a IA oferece uma avaliação interpretativa que pode deixar passar problemas ou sugerir medidas fora do escopo. Neste trabalho, ela inicialmente não destacou o SQL vulnerável e também recomendou um documento que não era o solicitado; portanto, a análise por IA complementa, mas não substitui o CI nem a revisão humana.

## 7. Considerações finais

Os testes demonstraram diferenças importantes entre **detectar um erro**, **impedir a integração de código inválido**, **receber uma sugestão de IA** e **aplicar uma alteração real no banco remoto**. A principal lição foi conferir cada camada com evidências próprias: logs e status checks para a automação, comentários para a revisão, e `PRAGMA table_info(notas)` para confirmar o efeito da migração no D1.