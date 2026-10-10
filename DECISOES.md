# Diário de decisões: Desafio 09 (Views que não parecem humanas)

Registro cronológico do raciocínio. Cada entrada separa quem fez o quê:

- 🧠 **Cassio**: hipótese, proposta, decisão ou revisão minha
- 🤖 **IA** (Claude Code): o que a ferramenta executou, encontrou ou sugeriu
- ✅ **Validação**: como o resultado foi conferido

---

## 1. Enunciado

- 🤖 **IA**: abriu o desafio na plataforma (repositório novo, sem base, nível complexo) e verificou a página por prompt injection: texto oculto, comentários HTML, atributos, caracteres invisíveis e palavras dirigidas a ferramentas. Só apareceu o aviso padrão da Conty.

**Contexto:** a marca paga o criador por alcance. Pico comprado, repetição mecânica e queda abrupta inflam o número e estragam a decisão de quem renovar. Falso positivo também custa caro: criador honesto não pode ser punido por um vídeo que estourou de verdade.

**O que fazer:** um classificador explicável para uma série de views por hora; um conjunto sintético gerado por mim, com casos legítimos e suspeitos; uma API que recebe a série e devolve a classificação, um motivo legível e os sinais usados. Sem modelo opaco.

**Entrega:** API, dataset sintético, README e testes dos casos óbvios; a taxa esperada de falso positivo no dataset e um caso em que o classificador prefere não acusar; um comando que gera o dataset e calcula essa taxa, e um teste que falha quando o número do README diverge do medido; declaração de uso de IA.

**Avaliação:** o motivo dá para ler sem conhecer o código; a taxa do README sai do comando, não de estimativa escrita à mão; um pico orgânico plausível não cai no mesmo balde de um pico comprado, e o teste mostra a diferença; o critério está documentado, inclusive o que ele não detecta; o dataset é reproduzível e não depende de rede social real.

- 🤖 **IA**: levantou 7 decisões em aberto: as classes, o que distingue o pico comprado do orgânico, o formato da série, só views ou mais contexto, o dataset, a taxa e o README, e a meta de custo.

## 2. Desenho

### 🧠 Decisões do Cassio

- 🧠 **Cassio**: montei o desenho reunindo ideias de IA (outra ferramenta, fora deste repositório) e o trouxe pronto, no mesmo formato dos diários anteriores. O texto vai abaixo, sem edição.

> O tamanho do pico nunca é sinal, porque estourar é exatamente o que um viral faz. O que separa o orgânico do comprado é o comportamento do volume: como o pico termina, se o público dorme e se as contagens variam como variam pessoas. Cada pergunta vira um sinal com valor e limite, e só acuso quando duas famílias independentes de sinais concordam.
>
> **1. Classes**
>
> Minha decisão é ter três saídas: `no_evidence` (sem indícios), `inconclusive` e `suspicious`. Não uso "legítimo" porque o classificador não certifica nada. Ele só diz que não encontrou os padrões que procura, e existe compra que ele não encontra.
>
> Não haverá pontuação nem "confiança". Uma nota como 0,87 sugere uma probabilidade, e ela só poderia ser calibrada no meu próprio dataset sintético, o que seria circular. Cada sinal volta com valor, limite, se disparou e uma frase em português. A força da evidência é o número de famílias que concordaram, que é a própria regra de decisão. A resposta traz também `criteria_version`, para uma decisão antiga poder ser reproduzida com os limites da época.
>
> O motivo descreve o padrão, nunca a intenção. Ele diz "compatível com entrega automatizada", e não "o criador comprou views", porque uma compra feita por terceiros para prejudicar o criador gera a mesma série. Por isso `suspicious` significa "esse alcance não entra na decisão de renovação sem revisão", e não punição automática.
>
> **2. Sinais e combinação**
>
> Uso quatro famílias, cada uma medindo uma propriedade diferente da série:
>
> | Família | Pergunta | Dispara quando (limite inicial) | O que também produz isso sem compra |
> |---|---|---|---|
> | Corte (`abrupt_end`) | Como o pico termina? | Cai 70% ou mais em até 2 h, descontada a queda normal daquele horário, e não volta no dia seguinte | Vídeo sai da recomendação; impulsionamento pago acaba; post arquivado |
> | Madrugada (`awake_at_night`) | O público dorme? | Nas horas em que o público do criador costuma dormir, o pico mantém 80% ou mais do volume do horário mais forte | Público espalhado por vários fusos |
> | Regularidade (`regularity`) | Varia como gente? | A variação de hora em hora fica abaixo de 35% do que o acaso produz sozinho, ou 40% das horas com mais de 200 views são múltiplos de 100 | Série preenchida por quem coletou; contagem arredondada pela fonte |
> | Remoção (`removal`) | A plataforma tirou views? | O acumulado cai mais de 1% (e pelo menos 100 views) | Ajuste de contagem da própria plataforma |
>
> A regularidade é o sinal mais bem fundamentado. Com 1.000 views por hora vindas de pessoas que decidem de forma independente, a contagem costuma variar umas 30 para cima ou para baixo só por acaso, e tendências e ondas só aumentam essa variação. Um pico que varia 3 views é mais regular do que gente consegue ser.
>
> A regra é esta: nenhuma família leva a `no_evidence`, uma leva a `inconclusive`, duas ou mais levam a `suspicious`. Conto famílias, e não sinais, para o mesmo fenômeno não votar duas vezes: 1.000 views exatas por hora são "regular demais" e "número redondo", mas é uma evidência só. A última coluna da tabela justifica a regra. Todo sinal tem uma explicação inocente, e nenhum comportamento humano dessa coluna produz dois sinais ao mesmo tempo. O dataset tem casos de cada um para medir isso.
>
> A altura do pico, o volume total e a subida em degrau não são sinais. Subida brusca acontece quando uma conta grande menciona o criador. Ela aparece no motivo como contexto, mas não conta.
>
> Os sinais olham a janela em análise. É o trecho em que o volume, suavizado em 24 horas, passa de 3 vezes o nível habitual da própria série. Quando não há pico, a janela é a série inteira, e é assim que o gotejamento constante aparece. Com mais de um pico, cada janela é julgada separadamente e a pior define a classificação.
>
> A madrugada é aprendida do próprio criador, nas horas mais fracas fora do pico. Se ele não tem madrugada marcada nem fora do pico, como acontece com público em vários fusos, o sinal fica "não avaliável" em vez de disparar. Sinal não avaliável não conta e aparece no motivo com a razão.
>
> **3. Formato da série**
>
> A API é um `POST /classify` sem estado. A entrada é o total acumulado de hora em hora, que é o que a plataforma mostra (como no desafio 04), e a API calcula as views novas de cada hora. Isso traz duas vantagens: um buraco perde detalhe, mas não perde volume, e uma queda do acumulado vira o sinal de remoção, em vez de um número negativo estranho.
>
> Cada ponto tem horário ISO 8601 com fuso obrigatório, em hora cheia (tolerância de 10 minutos). Horário sem fuso, repetido ou fora de ordem, ou valor negativo, volta 422. As contas são feitas em UTC. O campo opcional `audience_timezone` (padrão `America/Sao_Paulo`) serve só para escrever as horas locais no motivo, já que a madrugada é aprendida da série.
>
> O mínimo é 48 horas, para comparar um dia com o outro, e o máximo é 30 dias. A resposta é `inconclusive` por dados insuficientes, dizendo o que falta, em três situações: menos de 48 horas, mais de 10% das horas faltando ou um buraco maior que 6 horas.
>
> Horas faltando não são preenchidas para efeito de sinal. Preencher um buraco de forma linear cria horas idênticas, que é exatamente a assinatura de robô. Por isso o volume do buraco é distribuído só para exibição, e essas horas ficam fora de todos os cálculos. Quedas do acumulado abaixo do limite de remoção são tratadas como ruído de recontagem.
>
> **4. Só views**
>
> Fico só com views, com uma regra: nenhum dado influencia a acusação sem estar no dataset que mede o falso positivo. Um campo opcional de curtidas que mudasse a decisão criaria pedidos que a taxa do README não cobre.
>
> O tamanho habitual do criador fica de fora por princípio. Estourar muito acima do habitual é justamente o que um viral faz, e usar isso puniria o criador pequeno que viralizou, que é o falso positivo que o enunciado mais teme.
>
> Engajamento por hora fica documentado como primeira extensão. Provavelmente é o sinal mais forte, porque view comprada quase nunca vem com curtida. Mas curtida também se compra, e incluí-lo exigiria gerar engajamento no dataset e medir tudo de novo.
>
> **5. Dataset**
>
> Serão mil séries de 7 dias (168 horas), com semente fixa, em quatro grupos. Os legítimos difíceis foram desenhados para tropeçar em exatamente um sinal cada. Os comprados disfarçados foram desenhados para escapar e mostram com número o que o README diz que o critério não detecta.
>
> | Grupo | Tipo | Séries | Esperado |
> |---|---|---|---|
> | Legítimos comuns | Criador pequeno com ciclo diário | 100 | sem indícios |
> | | Crescimento lento | 60 | sem indícios |
> | | Pico de fim de semana | 60 | sem indícios |
> | | Viral orgânico (sobe em horas, cauda longa) | 120 | sem indícios |
> | Legítimos difíceis | Menção de conta grande (subida em degrau) | 80 | sem indícios |
> | | Saída do algoritmo (viral que despenca) | 60 | inconclusivo |
> | | Impulsionamento pago na plataforma (começa e termina em degrau) | 60 | inconclusivo |
> | | Público em vários fusos (madrugada rasa) | 60 | sem indícios ou inconclusivo |
> | Comprados típicos | Platô comprado | 80 | suspeito |
> | | Gotejamento constante | 60 | suspeito |
> | | Pico seguido de remoção | 50 | suspeito |
> | | Viral orgânico com pacote somado | 70 | suspeito |
> | | Entregas em lotes redondos | 40 | suspeito |
> | Comprados disfarçados | Imita gente (ruído, pausa de madrugada, desligamento em rampa) | 50 | escapa |
> | | Compra pequena (menos de 15% do volume) | 50 | escapa |
>
> Em todos os grupos entram artefatos de coleta: cerca de 10% das séries com 1 a 4 horas faltando e 5% dos legítimos com pequenas recontagens para baixo.
>
> Cada série guarda o tipo, a verdade e os parâmetros que a geraram, para qualquer erro poder ser inspecionado. O README descreve os parâmetros de cada tipo, porque eles são as premissas do teste. A geração usa um gerador pseudoaleatório próprio com semente, e não o aleatório padrão da linguagem, para não depender de versão. O dataset é commitado em `data/dataset.jsonl`, e um teste confere que regenerá-lo dá o mesmo hash.
>
> **6. Taxa e README**
>
> O classificador é uma função pura (série → resultado), e a API e a avaliação chamam a mesma função. Assim, a taxa medida é a da API, não a de uma cópia.
>
> Um único comando, `evaluate`, gera o dataset, classifica as mil séries, grava `results/metrics.json` e reescreve um bloco do README delimitado por marcadores. Ninguém digita número no README. Tudo no bloco é gerado:
> - a taxa de falso positivo (legítimos classificados como `suspicious`), com contagem e intervalo de 95%;
> - o inconclusivo nos legítimos;
> - a detecção nas compras típicas e nas disfarçadas;
> - a tabela por tipo;
> - a comparação com regras alternativas (uma família basta; três famílias);
> - os motivos dos casos de exemplo.
>
> Um teste roda a mesma avaliação em memória e exige que o bloco do README seja idêntico ao que seria gerado agora. Se divergir, falha mostrando o número do README, o medido e o comando a rodar. Um segundo teste falha se a taxa passar da meta da seção 7, para ninguém "resolver" uma piora só regenerando o README.
>
> Calibro os limites olhando uma semente de desenvolvimento, e o número do README sai de outra semente, que os limites não viram. O bloco mostra também a faixa da taxa em 10 sementes. O README diz com todas as letras que essa taxa mede o classificador contra o meu próprio gerador, não contra o mundo real. A declaração de uso de IA fecha o README, como nos anteriores.
>
> **7. Meta de custo**
>
> Aceito no máximo 0,5% de falso positivo no dataset, com os legítimos difíceis incluídos, e zero nos comuns. O custo dessa cautela aparece no inconclusivo. Ele é esperado nos difíceis, que imitam compra em um sinal, e deve ficar em até 2% nos comuns. Nas compras, a meta é detectar ao menos 80% das típicas. As disfarçadas eu aceito perder e documento.
>
> A taxa precisa ser baixa por causa da proporção real de compradores. No dataset, 40% das séries são compradas, mas no mundo real a proporção deve ser bem menor. Se 2% dos criadores compram e o classificador pega 85% deles, 1% de falso positivo faz mais de uma em cada três acusações ser injusta. Com 0,5%, a proporção cai para pouco mais de uma em cada cinco. É por isso que `suspicious` leva à revisão, nunca à punição automática.
>
> Não persigo 0%. Isso exigiria não acusar quase nada, e zero em 600 legítimos não é zero no mundo: o limite superior de 95% ainda seria 0,5%.
>
> **Caso em que o classificador prefere não acusar**
>
> O exemplo do README é a saída do algoritmo, um viral que despenca quando a plataforma para de recomendar o vídeo:
>
> ```json
> {
>   "classification": "inconclusive",
>   "reason": "A queda do dia 12 foi abrupta: o volume caiu 81% em duas horas, bem mais do que esse horário costuma cair, e não voltou no dia seguinte. Isso acontece quando um pacote de views acaba, mas também quando a plataforma para de recomendar um vídeo. Os outros sinais são de público humano: entre 3h e 8h, quando este público costuma dormir, o volume caiu para 28% do horário mais forte, e as contagens variaram como variam pessoas independentes. Um indício isolado não basta para acusar.",
>   "analyzed_window": { "start": "2026-03-10T19:00:00-03:00", "end": "2026-03-12T16:00:00-03:00" },
>   "signals": [
>     { "family": "abrupt_end", "fired": true, "value": 0.81, "threshold": 0.70, "fires_when": "above" },
>     { "family": "awake_at_night", "fired": false, "value": 0.28, "threshold": 0.80, "fires_when": "above" },
>     { "family": "regularity", "fired": false, "value": 1.40, "threshold": 0.35, "fires_when": "below" },
>     { "family": "removal", "fired": false, "value": 0.0, "threshold": 0.01, "fires_when": "above" }
>   ],
>   "rule": "suspeito exige duas famílias de sinais; com uma, inconclusivo",
>   "criteria_version": "v1"
> }
> ```
>
> Cada sinal traz também a sua frase, e o motivo é montado a partir delas. Para comparação, este é o motivo do platô comprado do teste dos gêmeos:
>
> "Entre 14h do dia 10 e 9h do dia 11, o vídeo recebeu cerca de 1.000 views por hora, variando no máximo 4 em torno da média; com esse volume, pessoas independentes fariam a contagem variar umas 30. O volume não diminuiu de madrugada (manteve 97% do horário mais forte, quando fora do pico caía para 25%) e terminou de uma vez, com queda de 92% em uma hora. Três sinais independentes concordam: o padrão é compatível com entrega automatizada, o que não identifica quem a contratou."
>
> **O que o critério não detecta e onde pode errar**
>
> Esta parte vai para o README, com a taxa dos tipos disfarçados ao lado.
>
> O critério não pega:
> - compra que imita gente (ruído humano, pausa de madrugada e desligamento em rampa);
> - compra pequena perto do volume orgânico, que também infla pouco;
> - fazenda de celulares operados por pessoas, que tem ritmo e variação humanos;
> - compra feita antes do início da série.
>
> Ele também não diz quem contratou a entrega.
>
> Ele pode errar contra o criador quando a série já chega preenchida por quem coletou, ou com contagens arredondadas pela fonte ("1,2 mil"). Essa série parece regular demais e, se o trecho preenchido cobrir uma madrugada, pode disparar dois sinais. Por isso a documentação da API exige pontos medidos, sem preenchimento.
>
> No sentido oposto, impulsionamento pago na própria plataforma é alcance comprado com gente real e termina em degrau. Ele cai em `inconclusive`, não em `suspicious`, e o README explica por quê.
>
> **Testes adicionais**
>
> Além dos exigidos pelo desafio, quero validar:
>
> - Casos óbvios: criador pequeno com ciclo diário sai `no_evidence`; gotejamento exato, dia e noite, sai `suspicious`.
> - Gêmeos: um viral orgânico e um platô comprado com a mesma subida, a mesma altura e o mesmo total de views. O orgânico sai `no_evidence` e o comprado, `suspicious`. O teste confere quais sinais diferem: a diferença está no fim, na madrugada e na variação, nunca no tamanho.
> - O mesmo viral multiplicado por 100 continua `no_evidence`, assim como a menção de conta grande com subida em degrau.
> - Saída do algoritmo sai `inconclusive` só com o corte disparado. Público em vários fusos com corte também não vira `suspicious`, porque a madrugada fica não avaliável.
> - Viral com público em Lisboa, sem informar o fuso, continua `no_evidence`, porque a madrugada vem da própria série.
> - Série orgânica com 4 horas faltando não dispara regularidade. Recontagem de −3 views não dispara remoção, e queda de 5% dispara.
> - Série de 30 horas sai `inconclusive` por dados insuficientes, e horário sem fuso volta 422.
> - Os motivos dos exemplos não contêm nomes de campos do código nem números sem unidade.
> - O bloco do README é idêntico ao medido, a taxa está dentro da meta e o dataset regenerado tem o mesmo hash.

### 🤖 Pontos que o desenho não fecha (padrões adotados pela IA, confirmados pelo Cassio)

- 🤖 **IA**: o texto das decisões chegou com uma frase de abertura e uma de fechamento dirigidas ao Cassio por quem o redigiu ("O texto 2 é a sua resposta do Desafio 03 […]", "Se o texto 2 era para ser um rascunho seu do 09 […]"). Apontei isso antes de começar e tratei como desenho só a parte "Decisões — Desafio 09".
- 🧠 **Cassio**: confirmou que reuniu ideias de IA para montar o desenho. Isso fica registrado aqui e na declaração de uso de IA do README.

Adotei estes padrões, que o Cassio confirmou depois da avaliação crítica (seção 5):

1. **Formato da entrada.** `series` é uma lista de `{ at, cumulative_views }`, com nomes em inglês, como o resto do contrato. A hora cheia é conferida no fuso do próprio ponto e depois convertida para UTC; todos os pontos precisam cair na mesma grade de hora em hora.
2. **Contagem das horas.** As 48 horas mínimas são contadas entre a primeira e a última leitura. "Horas faltando" são leituras faltando. "Buraco maior que 6 horas" é mais de 6 leituras seguidas faltando. Mais de 30 dias volta 422 (o desenho dá o máximo, mas não a resposta), série vazia volta 422, e uma leitura só é dado insuficiente.
3. **Nível habitual:** o primeiro quartil da média de 24 horas, e não a mediana. A calibração mostrou que, quando a compra ocupa mais da metade da série, a mediana sobe e a compra se parte em janelas pequenas.
4. **Janela aparada:** da primeira à última hora que, sozinha, passa de 3 vezes o nível habitual, dentro do trecho em que a média de 24 horas passa. A média de 24 horas espalha o pico para as horas vizinhas.
5. **Madrugada:**
   - as horas de sono são as 5 seguidas mais fracas do perfil (o exemplo do desenho, "entre 3h e 8h", tem 5 horas);
   - o "horário mais forte" de cada madrugada são as 3 horas seguidas de maior volume nas 12 horas antes e nas 12 depois, e as duas precisam existir;
   - vale a madrugada mais acordada da janela;
   - "madrugada marcada" quer dizer que, fora do pico, as horas de sono têm no máximo metade do volume das mais fortes;
   - sem pico, a madrugada é avaliada direto, sem essa checagem. Senão o gotejamento, que o desenho quer pegar justamente pela série inteira, nunca seria avaliado. O custo é que um público em vários fusos sem nenhum pico pode cair em inconclusivo pela madrugada.
6. **Corte:**
   - compara o nível das 3 horas antes da virada com o das 2 horas logo depois, que é a queda "em até 2 horas";
   - só a queda normal do horário é descontada; quando o horário costuma subir, não subir não vira queda;
   - "não volta no dia seguinte" quer dizer que o nível do dia seguinte (18 horas), descontado o ciclo, fica abaixo de metade do de antes;
   - uma queda sem dia seguinte para conferir fica não avaliável;
   - a queda só conta a partir de 20 views por hora e do nível de pico; sem pico, do nível habitual.
7. **Regularidade.** Para horas seguidas, z = (b − a) / √(a + b), e o valor do sinal é a mediana de |z| ÷ 0,6745, que dá perto de 1 para pessoas independentes e perto de 0 para entrega mecânica. Precisa de 12 pares de horas. As centenas exatas precisam de 10 horas com mais de 200 views.
8. **Remoção olha a série inteira, e não só a janela.** É um desvio do "os sinais olham a janela em análise": a plataforma costuma tirar as views dias depois do pico. O sinal mede a maior queda do total em relação ao maior total já lido.
9. **Pisos contra o acaso.** O corte e a madrugada só são avaliados a partir de 20 views por hora no horário de referência. O perfil do dia só é aprendido com 2 views por hora em média, e nenhuma hora do perfil vale menos de 5% da média.
10. **Intervalo de 95%: Clopper-Pearson exato, bilateral.** Para 0 em 600 ele dá 0,61%; o 0,5% do desenho é o limite unilateral (a "regra de três"). O README mostra o bilateral.
11. **Resposta.** Além do que o desenho pede, a resposta traz `families_fired`, `evaluable` e `explanation` em cada sinal, `minimum_views` na remoção, `context` (altura, nível habitual, subida em degrau), `data_quality` e `insufficient_data`. Também existem `?hourly=true` (as views de cada hora, com as horas de buraco marcadas como estimadas) e `GET /criteria`.
12. **Sementes:** 7 para o desenvolvimento, 2026 para o relatório e de 101 a 110 para a faixa.
13. **Premissas numéricas do gerador.** Os parâmetros de cada tipo, que estão no README, são escolha da IA. Por exemplo: o gotejamento típico domina o volume (criador de 2 a 15 views por hora recebendo de 100 a 600); os lotes redondos vão para um vídeo quase sem público, porque com público a soma da hora deixa de ser centena exata; e o imitador desliga em cauda (cai pela metade a cada 4 a 10 horas).
14. **"Viral multiplicado por 100".** No teste, é o mesmo viral com 100 vezes mais público, sorteado de novo. Multiplicar as contagens por 100 faria toda hora virar centena exata, que é justamente o modo de falha da contagem arredondada (ver avaliação crítica).
15. **"Madrugada" nas frases** só aparece quando as horas de sono aprendidas caem de madrugada no fuso informado. Com público em outro fuso, a frase diz "nas horas em que este público costuma dormir".

## 3. Implementação

- 🤖 **IA**: o classificador é uma função pura (`src/classificador.ts`), e a API e a avaliação chamam essa mesma função. A avaliação passa até pelo mesmo contrato: monta o corpo do `POST /classify` para cada série do dataset e valida pela mesma porta. Os sinais estão em `src/sinais.ts`, a janela e o perfil em `src/janela.ts`, a leitura da série em `src/serie.ts`, o gerador em `src/gerador.ts`, o PRNG em `src/prng.ts` e a avaliação e o bloco do README em `src/avaliacao.ts`.

### Calibração na semente de desenvolvimento (7)

Cada rodada abaixo é a semente 7; a do relatório não foi aberta antes de o classificador ser congelado.

| Rodada | Falso positivo | Inconclusivo nos comuns | Detecção nas típicas | O que a rodada revelou e o que mudou depois dela |
|---|---|---|---|---|
| 1 | 5 de 600 | 3 de 340 | 259 de 300 | A madrugada era comparada com o horário mais forte do perfil (a noite). Num viral que sobe de madrugada e é cortado antes da noite seguinte, as duas noites ficavam fora do pico, e a madrugada parecia acordada. Mudou: o horário mais forte passou a ser o das 12 horas antes e depois de cada madrugada. |
| 2 | 0 de 600 | 3 de 340 | 255 de 300 | Cortes falsos em criadores pequenos. **Erro meu:** perto do começo da série, um índice de hora negativo fazia a queda esperada valer 1, e a queda normal da noite contava como corte. Mudou: a queda esperada passou a ser calculada sobre as mesmas horas medidas, e, para conter o acaso, o nível depois da queda passou a ser medido em 6 horas. |
| 3 | 0 de 600 | 0 de 340 | 255 de 300 | A medida em 6 horas aceitava declínios lentos, e 13 dos 50 imitadores entravam como corte. Mudou: voltei às 2 horas que o desenho pede, e o desligamento do imitador virou uma cauda que cai pela metade a cada 4 a 10 horas (uma rampa linear até zero acelera no fim e acaba sendo brusca). |
| 4 | 0 de 600 | 1 de 340 | 253 de 300 | Três problemas. (a) A checagem do dia seguinte caía nas horas da remoção, que ficam fora dos cálculos, e a frase dizia "a menos de um dia do fim da série", o que estava errado: virou uma janela de 18 horas, com a frase certa. (b) O perfil tinha horas com zero, e a conta dava NaN: entraram o piso e o mínimo de volume. (c) A mediana inflada partia os lotes redondos em janelas pequenas: entrou o primeiro quartil. |
| 5 | 0 de 600 | 3 de 340 | 262 de 300 | "Descontada a queda normal" estava creditando subidas: um volume que só não subiu de manhã virava "queda de 71%". Mudou: só quedas normais são descontadas. |
| 6 | 0 de 600 | 2 de 340 | 262 de 300 | Lendo os motivos, uma frase chamava de "madrugada" as horas de sono de um público em outro fuso (14h às 19h em São Paulo). Mudou só o texto. |
| 7 | 0 de 600 | 2 de 340 | 262 de 300 | Teste do piso de volume: com 20 ou 30 views por hora, nada muda; com 50, o inconclusivo nos comuns cai para 1 em 340, mas a detecção cai para 259 em 300. Mantido em 20. |

- 🤖 **IA**: congelado o classificador, rodei a semente do relatório (2026) pela primeira vez. Resultado: falso positivo 0 de 600, inconclusivo de 3 em 340 nos comuns, detecção de 264 em 300 nas típicas e de 0 em 100 nas disfarçadas. Nas 10 sementes da faixa, houve 1 falso positivo em 6.000 legítimos. O bloco do README é gerado a partir desses números.

### ✅ Validação

- ✅ 72 testes em 6 arquivos, entre eles todos os pedidos no desenho. Os 1.000 motivos da semente de desenvolvimento passam pelo detector de número sem unidade, que também foi testado (ele pega "limite de 35" e "contagem 4").
- ✅ **Testes de mutação:** 13 erros introduzidos de propósito numa cópia, cada um conferido antes de rodar. Todos foram pegos:
  - contar sinais em vez de famílias;
  - uma família bastar para acusar;
  - o corte sem a checagem do dia seguinte;
  - o corte sem descontar a queda normal do horário;
  - a madrugada avaliada sem madrugada marcada;
  - o buraco preenchido entrando nos cálculos;
  - a remoção sem o mínimo de 100 views;
  - a altura do pico virando sinal;
  - a regularidade com limite de 0,6;
  - o gerador com um parâmetro mudado;
  - o número do README editado à mão;
  - um nome de campo no motivo;
  - o horário sem fuso aceito como UTC.
- ✅ A mutação "corte sem a checagem do dia seguinte" no começo só era pega pelos números da avaliação. Acrescentei um teste direto: uma pane de 3 horas que derruba o volume em 90% e passa no mesmo dia não pode contar como corte. Rodei a mutação de novo, e esse teste a pega sozinho.
- ✅ Quando o número do README diverge, o teste mostra o valor do README, o medido e o comando a rodar.
- ✅ **Intervalo de confiança.** O valor de referência que escrevi no teste para 3 em 600 (0,014521) estava errado; era de memória. Conferi com uma implementação independente em Python, com a soma binomial exata em frações: 0,001032 a 0,014542, igual à do código. Corrigi o teste.
- ✅ **Servidor real.** Os exemplos de `docs/EXEMPLOS.md` foram gerados chamando o servidor HTTP numa porta temporária. O `npm start` foi conferido na porta 3009 com o `curl` documentado.
- ✅ A mesma série escrita com os horários em `-03:00` ou em `Z` dá o mesmo resultado. Uma série de 30 dias é classificada em menos de 1 ms.

## 4. Avaliação crítica (cenários executados)

- 🤖 **IA**: rodei cenários fora do dataset contra o classificador real. Os que viram limites documentados estão em `test/limites.test.ts`.

| Cenário | Resultado | Leitura |
|---|---|---|
| Viral orgânico com o total **arredondado pela fonte** (centenas, como "1,2 mil") | **suspeito** (corte e regularidade) | Falso positivo. Toda hora vira centena exata e, nas horas fracas, a contagem anda de 100 em 100, o que simula um corte. Com milhares, até a madrugada dispara. Resolvido pela regra A (seção 5). |
| O mesmo viral com as contagens multiplicadas por 100 | inconclusivo (centenas exatas) | É o mesmo modo de falha, mais brando. |
| **Saída do algoritmo e limpeza de 2%** das views pela plataforma | **suspeito** (corte e remoção) | Falso positivo. A premissa "nenhum comportamento humano produz dois sinais" vale para o público, não para duas ações da plataforma. |
| Madrugada preenchida em linha reta pelo coletor, toda noite | sem indícios | O medo do desenho não se confirmou nos cenários testados. |
| Gotejamento sobre um criador real, de 15% a 98% das views | passa até 70%; inconclusivo com 80% e 90%; suspeito com 95% e 98% | O gotejamento só é acusado quando é quase todo o volume. |
| Platô de 30 horas, de 2 a 64 vezes o público | passa com 2 vezes; inconclusivo com 4; suspeito a partir de 8 | |
| Robô que só entrega de dia e para de uma vez | suspeito (corte e regularidade) | Pular a madrugada não basta para escapar. |
| Público em 4 fusos, sem pico | sem indícios | |
| O falso positivo das 10 sementes da faixa (1 em 6.000) | suspeito (corte e madrugada) | Viral que subiu de madrugada e foi cortado às 9h. A madrugada fica mais forte que as horas antes (antes do viral) e depois (depois do corte). É uma ambiguidade real: é o mesmo desenho de um robô que só rodou naquela noite. |

Sugestões, medidas numa cópia, sem mudar o repositório:

- **A. Total arredondado vira dado insuficiente.** Se 95% ou mais das leituras do total são centenas exatas, a fonte arredonda (entre pessoas, isso acontece em 1% das leituras), e a resposta é inconclusiva por dados insuficientes. Medido: elimina o falso positivo do arredondamento e não muda nenhum número do dataset. O custo teórico é um vídeo sem nenhum público que recebe só lotes redondos a partir de um total redondo; ele escaparia como dado insuficiente.
- **B. Remoção só acima de 5%.** Medido: tira o caso da limpeza de 2%, mas uma limpeza de 8% junto com a saída do algoritmo continua dando suspeito. Custa 2 detecções em 3.000 nas 10 sementes. É uma correção parcial; o problema de fundo (duas ações da plataforma) fica documentado.
- **C. Mais séries legítimas.** Para o limite superior de 95% ficar abaixo de 0,5% com zero erros, seriam necessárias 736 séries legítimas (o menor n com 1 − 0,025^(1/n) abaixo de 0,5%); hoje são 600.

## 5. Decisão sobre a avaliação crítica

### 🧠 Decisão do Cassio

> confirmo os padrões, implementa A e documenta B e C.
>
> tbm quero read-me bem documentado

### 🤖 Implementação

- 🤖 **IA, regra A (o total arredondado vira dados insuficientes):**
  - **A regra.** Se 95% ou mais das leituras acima de zero são centenas exatas, a resposta é `inconclusive` por dados insuficientes, com o motivo "o total parece arredondado pela fonte (em X de Y leituras, ele é uma centena exata, o que com contagem exata acontece em cerca de 1% das leituras)". O pedido final do motivo passou a ser leituras exatas, sem arredondamento nem preenchimento.
  - **Leituras zeradas não contam.** Zero é centena exata, mas não diz nada sobre arredondamento: um vídeo que passa dias com o total em zero não pode ser confundido com total arredondado.
  - **Onde ficou no código.** Os limites `roundStep` (100, o mesmo das centenas exatas) e `roundedSourceShare` (0,95) entraram em `src/criterios.ts`. A resposta ganhou `nonzero_readings` e `round_readings` em `data_quality`.
  - **Versão do critério.** Continua `v1`, porque a regra entrou antes da primeira publicação e nenhuma decisão foi tomada com a versão anterior.
- 🤖 **IA, o custo da regra A, documentado e testado:** um gotejamento exato que parte de um total redondo também cai em dados insuficientes. Por isso, o gotejamento exato dos exemplos passou a partir de 4.321 views (um vídeo tem views antes da compra), e o caso do total redondo virou teste em `test/limites.test.ts`.
- 🤖 **IA, B e C:** ficaram documentados no README, na tabela "Alternativas consideradas" (B medida e não adotada, com o resultado da medição; C com as 736 séries) e em "Próximos passos".
- 🤖 **IA, README:** reescrito com sumário, um diagrama do fluxo, como ler o bloco gerado, o critério com os detalhes de cada sinal, os casos de dados insuficientes, a referência completa da API (campos, erros, endpoints) e da resposta (campos e o significado do valor de cada sinal), dataset e sementes, o que a avaliação faz passo a passo e como mudar o critério, o mapa do código e o que cada arquivo de teste prova.
- 🤖 **IA, na releitura do README:** uma frase dizia que as saídas do algoritmo "nunca saem suspeitas". Isso vale para o dataset do relatório, mas, nas 10 sementes da faixa, uma saiu. A frase foi corrigida para apontar a tabela e a explicação.

### ✅ Validação

- ✅ **Testes novos da regra A:**
  - o total arredondado dá dados insuficientes, com a frase exata;
  - o viral orgânico com o total arredondado em centenas e em milhares não é mais acusado;
  - um total exato que às vezes cai numa centena não aciona a regra;
  - o vídeo com o total zerado não é confundido com total arredondado;
  - o custo da regra (gotejamento exato a partir de 5.000 views).

  O detector de número sem unidade passou a aceitar "leituras" como unidade e checa também esse motivo.
- ✅ **Mutações da regra A.** "Regra desligada" foi pega. "Contar as leituras zeradas" escapou na primeira rodada, porque nenhum teste tinha um vídeo com o total zerado por muito tempo. Escrevi esse teste, e a mutação passou a ser pega.
- ✅ **Números do dataset.** `npm run evaluate` regenerou os arquivos, e nenhum número mudou: falso positivo de 0 em 600, inconclusivo de 3 em 340 nos comuns, detecção de 264 em 300 nas típicas, 1 falso positivo em 6.000 e 2.624 de 3.000 detecções nas 10 sementes. Também não mudou nada na semente de desenvolvimento. O bloco do README só mudou na resposta completa da saída do algoritmo, que ganhou os dois campos novos de `data_quality`.
- ✅ 77 testes passando. Os exemplos de `docs/EXEMPLOS.md` foram regenerados contra o servidor real.

## 6. Publicação

- 🤖 **IA**: repositório local atualizado e testado; ainda não publicado. Publico quando o Cassio pedir.
