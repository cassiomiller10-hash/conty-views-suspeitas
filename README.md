# Views que não parecem humanas

Classificador explicável para séries de views por hora. Ele não diz se o criador comprou views: diz se a série tem os padrões de entrega automatizada que ele procura, com o motivo em português e os sinais que usou. Não há modelo opaco nem pontuação: cada sinal tem valor, limite e uma frase, e a regra é contar famílias de sinais que concordam.

**Por onde começar a leitura:** a seção [A taxa de falso positivo](#a-taxa-de-falso-positivo) (gerada pelo comando, não escrita à mão), depois [O critério](#o-critério-v1) e [O que o critério não detecta](#o-que-o-critério-não-detecta-e-onde-pode-errar). O código da regra está em [`src/sinais.ts`](src/sinais.ts) e [`src/classificador.ts`](src/classificador.ts); o raciocínio passo a passo, em [`DECISOES.md`](DECISOES.md).

## Como rodar

Requer Node 22 ou mais novo.

```bash
npm ci
npm test                  # testes, inclusive o que compara o bloco abaixo com o medido
npm run evaluate          # gera o dataset, classifica, grava results/metrics.json e reescreve o bloco
npm start                 # API em http://127.0.0.1:3009
```

`npm run evaluate -- --dev` mede só a semente de desenvolvimento, a usada para calibrar, e não grava nada.

## A taxa de falso positivo

O bloco abaixo é escrito por `npm run evaluate`. O teste `test/avaliacao.test.ts` roda a mesma avaliação em memória e falha se o bloco divergir do que seria gerado agora; outro teste falha se a taxa passar da meta, para ninguém "resolver" uma piora só regenerando o README.

**O que essa taxa mede:** o classificador contra o meu próprio gerador de séries, não contra o mundo real. Ela vale enquanto as premissas do gerador (seção [Dataset](#dataset)) valerem. Os limites foram calibrados olhando só a semente de desenvolvimento (7); o número abaixo sai de outra semente (2026), e a faixa, de outras 10 sementes, que os limites não viram.

<!-- evaluate:begin -->
<!-- Gerado por `npm run evaluate`. Não edite à mão: test/avaliacao.test.ts falha se este bloco divergir do medido. -->

Medido no dataset da semente **2026** (`data/dataset.jsonl`, 1.000 séries de 168 horas, sha256 `0a0433ffbd08158a…`), critério **v1**.

| | Medido | Meta |
|---|---|---|
| **Falso positivo** (legítimo classificado como suspeito) | **0,00% (0 de 600)**; intervalo de 95%: 0,00% a 0,61% | até 0,5% |
| Falso positivo nos legítimos comuns | 0 de 340 | zero |
| Falso positivo nos legítimos difíceis | 0 de 260 | entra no total acima |
| Inconclusivo nos legítimos comuns | 0,9% (3 de 340) | até 2% |
| Inconclusivo nos legítimos difíceis | 36,9% (96 de 260) | esperado: é o custo da cautela |
| Detecção nas compras típicas | 88,0% (264 de 300) | pelo menos 80% |
| Detecção nas compras disfarçadas | 0,0% (0 de 100) | nenhuma: o critério não as pega |

**Por tipo de série**

| Grupo | Tipo | Séries | Sem indícios | Inconclusivo | Suspeito | Esperado |
|---|---|---:|---:|---:|---:|---|
| Legítimo comum | Criador pequeno com ciclo diário | 100 | 100 | 0 | 0 | sem indícios |
| Legítimo comum | Crescimento lento | 60 | 60 | 0 | 0 | sem indícios |
| Legítimo comum | Pico de fim de semana | 60 | 59 | 1 | 0 | sem indícios |
| Legítimo comum | Viral orgânico | 120 | 118 | 2 | 0 | sem indícios |
| Legítimo difícil | Menção de conta grande | 80 | 80 | 0 | 0 | sem indícios |
| Legítimo difícil | Saída do algoritmo | 60 | 26 | 34 | 0 | inconclusivo |
| Legítimo difícil | Impulsionamento pago na plataforma | 60 | 11 | 49 | 0 | inconclusivo |
| Legítimo difícil | Público em vários fusos | 60 | 47 | 13 | 0 | sem indícios ou inconclusivo |
| Compra típica | Platô comprado | 80 | 0 | 2 | 78 | suspeito |
| Compra típica | Gotejamento constante | 60 | 0 | 1 | 59 | suspeito |
| Compra típica | Pico seguido de remoção | 50 | 0 | 0 | 50 | suspeito |
| Compra típica | Viral orgânico com pacote somado | 70 | 6 | 27 | 37 | suspeito |
| Compra típica | Entregas em lotes redondos | 40 | 0 | 0 | 40 | suspeito |
| Compra disfarçada | Compra que imita gente | 50 | 46 | 4 | 0 | escapa (documentado) |
| Compra disfarçada | Compra pequena (menos de 15% do volume) | 50 | 50 | 0 | 0 | escapa (documentado) |

**Regras alternativas** (os mesmos sinais; muda só quantas famílias precisam concordar para acusar)

| Regra | Falso positivo | Inconclusivo nos comuns | Detecção nas típicas | Detecção nas disfarçadas |
|---|---|---|---|---|
| Uma família basta | 16,50% (99 de 600) | 0,0% (0 de 340) | 98,0% (294 de 300) | 4,0% (4 de 100) |
| **Duas famílias (v1, a adotada)** | 0,00% (0 de 600) | 0,9% (3 de 340) | 88,0% (264 de 300) | 0,0% (0 de 100) |
| Três famílias | 0,00% (0 de 600) | 0,9% (3 de 340) | 23,0% (69 de 300) | 0,0% (0 de 100) |

**Variação entre sementes** (10 sementes, de 101 a 110, também fora da calibração)

| | Menor | Maior | Somando as sementes |
|---|---|---|---|
| Falso positivo | 0,00% | 0,17% | 0,02% (1 de 6.000) |
| Inconclusivo nos legítimos comuns | 0,0% | 1,2% | 0,7% (24 de 3.400) |
| Detecção nas compras típicas | 86,3% | 89,0% | 87,5% (2.624 de 3.000) |
| Detecção nas compras disfarçadas | 0,0% | 0,0% | 0,0% (0 de 1.000) |

**Motivos dos exemplos** (`src/exemplos.ts`, os mesmos dos testes)

- **Viral orgânico (gêmeo):** sem indícios. "Nenhum sinal de entrega automatizada. O pico não terminou de uma vez: a maior queda em duas horas, descontada a queda normal do horário, foi de 48%. Nas madrugadas, entre 3h e 8h, quando este público costuma dormir, o volume ficou em no máximo 27% do horário mais forte. As contagens variaram como variam pessoas independentes: umas 52 views para cima ou para baixo, quando o acaso sozinho daria umas 16 views. O total acumulado nunca caiu. O pico chegou a 1.000 views por hora, 53 vezes o nível habitual deste vídeo; altura de pico não é sinal, porque é o que acontece quando um vídeo estoura. A subida foi brusca, de cerca de 21 para 370 views por hora em até duas horas, às 14h do dia 10; isso também acontece quando uma conta grande menciona o criador, e subida não é sinal. Isso não certifica que as views são de pessoas, só que os padrões procurados não aparecem."
- **Platô comprado (gêmeo, mesma subida, mesma altura e mesmo total):** suspeito. "A queda das 15h do dia 11 foi abrupta: em duas horas, o volume foi de cerca de 1.000 para 28 views por hora. Descontada a queda normal desse horário (9%), são 97% a menos, e o volume não voltou no dia seguinte. O volume não diminuiu de madrugada: entre 2h e 7h do dia 11, quando este público costuma dormir, ficou em 97% do horário mais forte (fora do pico, essas horas caíam para 32%). Entre 14h do dia 10 e 16h do dia 11, o vídeo recebeu cerca de 970 views por hora, variando umas 8 views para cima ou para baixo; com esse volume, pessoas independentes fariam a contagem variar umas 31 views. Três sinais independentes concordam: o padrão é compatível com entrega automatizada, o que não identifica quem a contratou. Esse alcance precisa de revisão antes de entrar na decisão de renovação."
- **Saída do algoritmo (o caso em que o classificador prefere não acusar):** inconclusivo. "A queda das 14h do dia 12 foi abrupta: em duas horas, o volume foi de cerca de 860 para 190 views por hora. Descontada a queda normal desse horário (17%), são 74% a menos, e o volume não voltou no dia seguinte. Isso acontece quando um pacote de views acaba, mas também quando a plataforma para de recomendar o vídeo ou quando um impulsionamento pago termina. Os outros sinais são de público humano. Nas madrugadas, entre 2h e 7h, quando este público costuma dormir, o volume ficou em no máximo 25% do horário mais forte. As contagens variaram como variam pessoas independentes: umas 223 views para cima ou para baixo, quando o acaso sozinho daria umas 36 views. O total acumulado nunca caiu. Um indício isolado não basta para acusar. O pico chegou a 3.100 views por hora, 48 vezes o nível habitual deste vídeo; altura de pico não é sinal, porque é o que acontece quando um vídeo estoura. A subida foi brusca, de cerca de 86 para 1.600 views por hora em até duas horas, às 19h do dia 10; isso também acontece quando uma conta grande menciona o criador, e subida não é sinal."

<details><summary>Resposta completa da API para a saída do algoritmo</summary>

```json
{
  "classification": "inconclusive",
  "reason": "A queda das 14h do dia 12 foi abrupta: em duas horas, o volume foi de cerca de 860 para 190 views por hora. Descontada a queda normal desse horário (17%), são 74% a menos, e o volume não voltou no dia seguinte. Isso acontece quando um pacote de views acaba, mas também quando a plataforma para de recomendar o vídeo ou quando um impulsionamento pago termina. Os outros sinais são de público humano. Nas madrugadas, entre 2h e 7h, quando este público costuma dormir, o volume ficou em no máximo 25% do horário mais forte. As contagens variaram como variam pessoas independentes: umas 223 views para cima ou para baixo, quando o acaso sozinho daria umas 36 views. O total acumulado nunca caiu. Um indício isolado não basta para acusar. O pico chegou a 3.100 views por hora, 48 vezes o nível habitual deste vídeo; altura de pico não é sinal, porque é o que acontece quando um vídeo estoura. A subida foi brusca, de cerca de 86 para 1.600 views por hora em até duas horas, às 19h do dia 10; isso também acontece quando uma conta grande menciona o criador, e subida não é sinal.",
  "families_fired": [
    "abrupt_end"
  ],
  "analyzed_window": {
    "start": "2026-03-10T19:00:00-03:00",
    "end": "2026-03-12T23:00:00-03:00",
    "hours": 52,
    "kind": "peak"
  },
  "signals": [
    {
      "signal": "abrupt_end",
      "family": "abrupt_end",
      "threshold": 0.7,
      "fires_when": "above",
      "evaluable": true,
      "fired": true,
      "value": 0.74,
      "explanation": "A queda das 14h do dia 12 foi abrupta: em duas horas, o volume foi de cerca de 860 para 190 views por hora. Descontada a queda normal desse horário (17%), são 74% a menos, e o volume não voltou no dia seguinte."
    },
    {
      "signal": "awake_at_night",
      "family": "awake_at_night",
      "threshold": 0.8,
      "fires_when": "above",
      "evaluable": true,
      "fired": false,
      "value": 0.25,
      "explanation": "Nas madrugadas, entre 2h e 7h, quando este público costuma dormir, o volume ficou em no máximo 25% do horário mais forte."
    },
    {
      "signal": "low_variation",
      "family": "regularity",
      "threshold": 0.35,
      "fires_when": "below",
      "evaluable": true,
      "fired": false,
      "value": 6.14,
      "explanation": "As contagens variaram como variam pessoas independentes: umas 223 views para cima ou para baixo, quando o acaso sozinho daria umas 36 views."
    },
    {
      "signal": "round_counts",
      "family": "regularity",
      "threshold": 0.4,
      "fires_when": "above",
      "evaluable": true,
      "fired": false,
      "value": 0,
      "explanation": "As contagens não se concentram em centenas exatas."
    },
    {
      "signal": "removal",
      "family": "removal",
      "threshold": 0.01,
      "fires_when": "above",
      "minimum_views": 100,
      "evaluable": true,
      "fired": false,
      "value": 0,
      "explanation": "O total acumulado nunca caiu."
    }
  ],
  "context": {
    "habitual_views_per_hour": 65,
    "peak_views_per_hour": 3092,
    "peak_multiple": 47.9,
    "window_views": 67743,
    "step_rise": true,
    "peak_windows": 1
  },
  "insufficient_data": [],
  "rule": "suspeito exige duas famílias de sinais; com uma, inconclusivo",
  "criteria_version": "v1",
  "data_quality": {
    "hours": 168,
    "missing_readings": 0,
    "longest_gap_hours": 0,
    "drop_hours": 0
  },
  "audience_timezone": "America/Sao_Paulo"
}
```

</details>
<!-- evaluate:end -->

## O critério (v1)

### As três saídas

| Classificação | O que quer dizer |
|---|---|
| `no_evidence` (sem indícios) | Nenhuma família de sinais disparou. Não certifica que as views são de pessoas: só diz que os padrões procurados não aparecem, e existe compra que o critério não encontra. |
| `inconclusive` | Uma família disparou (todo sinal tem uma explicação inocente), ou faltam dados para julgar. O motivo diz qual dos dois. |
| `suspicious` | Duas ou mais famílias independentes concordam. O motivo descreve o padrão ("compatível com entrega automatizada"), nunca a intenção: uma compra feita por terceiros para prejudicar o criador gera a mesma série. **Suspeito significa "esse alcance não entra na decisão de renovação sem revisão", não punição automática.** |

Não há pontuação nem "confiança": uma nota como 0,87 sugere uma probabilidade que só poderia ser calibrada no próprio dataset sintético. A força da evidência é o número de famílias que concordaram, que é a própria regra. A resposta traz `criteria_version` para uma decisão antiga poder ser refeita com os limites da época.

### As quatro famílias de sinais

O tamanho do pico nunca é sinal, porque estourar é o que um viral faz. Cada família faz uma pergunta sobre o comportamento do volume:

| Família | Pergunta | Dispara quando | O que também produz isso sem compra |
|---|---|---|---|
| Corte (`abrupt_end`) | Como o pico termina? | O volume cai 70% ou mais em até 2 horas, descontada a queda normal daquele horário, e não volta no dia seguinte | O vídeo sai da recomendação; um impulsionamento pago acaba; o post é arquivado |
| Madrugada (`awake_at_night`) | O público dorme? | Nas horas em que este público costuma dormir, o volume fica em 80% ou mais do horário mais forte | Público espalhado por vários fusos |
| Regularidade (`regularity`) | Varia como gente? | A variação de hora em hora fica abaixo de 35% do que o acaso produz sozinho, ou 40% das horas com mais de 200 views são centenas exatas | Série preenchida por quem coletou; contagem arredondada pela fonte |
| Remoção (`removal`) | A plataforma tirou views? | O total acumulado cai mais de 1% e pelo menos 100 views | Ajuste de contagem da própria plataforma |

**A regra:** nenhuma família, `no_evidence`; uma, `inconclusive`; duas ou mais, `suspicious`. Conta-se família, não sinal: 1.000 views exatas por hora são "regular demais" e "centena exata", mas é uma evidência só.

**A janela em análise** é o trecho em que o volume, em média móvel de 24 horas, passa de 3 vezes o nível habitual da série; sem pico, é a série inteira (é assim que o gotejamento constante aparece). Com mais de um pico, cada janela é julgada separadamente e vale a que reuniu mais indícios. Altura do pico, volume total e subida em degrau aparecem no motivo como contexto e não contam.

**Só views.** Nenhum dado influencia a acusação sem estar no dataset que mede o falso positivo. O tamanho habitual do criador fica de fora por princípio: estourar muito acima do habitual é o que um viral faz.

### Como cada sinal é medido

As decisões acima são do desenho; os detalhes abaixo são a implementação, e estão em [`src/sinais.ts`](src/sinais.ts) e [`src/janela.ts`](src/janela.ts).

- **Nível habitual:** o primeiro quartil da média de 24 horas (no mínimo 1 view por hora). Quartil, e não mediana, porque uma compra que ocupa mais da metade da série puxaria a mediana para cima e esconderia o próprio pico. A janela vai da primeira à última hora que, sozinha, passa de 3 vezes esse nível, dentro do trecho em que a média de 24 horas passa.
- **Perfil do dia:** para cada hora do dia, o volume relativo à média de 24 horas ao redor, aprendido fora dos picos (ou na série inteira, se fora deles houver menos de dois dias). As horas de sono são as 5 seguidas mais fracas; com menos de 2 views por hora, o perfil não é aprendido.
- **Corte:** para cada hora da janela, o nível das 3 horas antes contra o das 2 horas logo depois da virada. Só a queda normal do horário é descontada: num horário em que o volume costuma subir, não subir não vira queda. "Não voltou" compara o dia seguinte (18 horas ao redor de 27 horas depois) com o nível de antes, descontado o ciclo; volta de metade ou mais anula a queda. A queda só conta a partir de 20 views por hora e do nível de pico.
- **Madrugada:** cada madrugada da janela é comparada com as 3 horas seguidas mais fortes nas 12 horas antes e nas 12 depois (as duas precisam existir), e vale a madrugada mais acordada. Se o pico existe e, fora dele, as horas mais fracas já têm mais da metade do volume das mais fortes, o público não tem madrugada marcada e o sinal fica não avaliável. Sem pico, a madrugada é comparada direto, e é assim que o gotejamento aparece.
- **Regularidade:** com λ views por hora de pessoas independentes, a contagem varia uns √λ para cima ou para baixo. Para horas seguidas, z = (b − a) / √(a + b); o desvio típico robusto (mediana de |z| ÷ 0,6745) fica perto de 1 para pessoas, acima disso com ondas e ciclo, e perto de 0 para entrega mecânica. Precisa de 12 pares de horas medidas. As centenas exatas precisam de 10 horas com mais de 200 views.
- **Remoção:** olha a série inteira, e não só a janela, porque a plataforma costuma tirar as views dias depois do pico. Mede a maior queda do total em relação ao maior total já lido. Quedas menores, de até 1% ou de menos de 100 views, são recontagem.
- **Sinal não avaliável não conta** e aparece no motivo com a razão.

## A série que a API aceita

`POST /classify`, sem estado. A entrada é o total acumulado de hora em hora, que é o que a plataforma mostra; a API calcula as views de cada hora. Assim, um buraco perde detalhe, mas não perde volume, e uma queda do total vira o sinal de remoção, e não um número negativo estranho.

```json
{
  "series": [
    { "at": "2026-03-08T00:00:00-03:00", "cumulative_views": 5000 },
    { "at": "2026-03-08T01:00:00-03:00", "cumulative_views": 5021 }
  ],
  "audience_timezone": "America/Sao_Paulo"
}
```

- Horário ISO 8601 **com fuso** (`Z` ou `±HH:MM`), em hora cheia, com tolerância de 10 minutos. As contas são em UTC.
- Horário sem fuso, repetido, fora de ordem ou fora da hora cheia, valor negativo ou não inteiro, fuso do público inválido ou série de mais de 30 dias voltam **422** com o campo e o motivo. JSON inválido volta 400.
- `audience_timezone` é opcional (padrão `America/Sao_Paulo`) e só serve para escrever as horas no motivo; a madrugada é aprendida da própria série.
- **Mínimo de 48 horas.** Com menos, com mais de 10% das horas sem leitura ou com um buraco de mais de 6 horas, a resposta é `inconclusive` por dados insuficientes, dizendo o que falta (`insufficient_data`).
- **Envie pontos medidos, sem preenchimento.** Horas faltando não são preenchidas para os sinais: o volume do buraco é dividido igualmente só para exibição (`?hourly=true` devolve as views de cada hora, com essas horas marcadas como `estimated`), e elas ficam fora dos cálculos. Preencher em linha reta cria horas idênticas, que é a assinatura de robô.

A resposta traz `classification`, `reason`, `rule`, `criteria_version`, `families_fired`, `analyzed_window`, `signals` (cada um com `family`, `evaluable`, `fired`, `value`, `threshold`, `fires_when` e `explanation`), `context` (altura do pico, nível habitual, subida em degrau), `data_quality` e `insufficient_data`. `GET /criteria` devolve a regra e os limites em vigor. Exemplos executados contra o servidor estão em [`docs/EXEMPLOS.md`](docs/EXEMPLOS.md).

## O que o critério não detecta e onde pode errar

O critério **não pega**, e o dataset mostra isso com número (as compras disfarçadas na tabela acima):

- compra que imita gente: ruído humano, pausa de madrugada e desligamento aos poucos;
- compra pequena perto do volume orgânico, que também infla pouco;
- fazenda de celulares operados por pessoas, com ritmo e variação humanos;
- compra feita antes do início da série;
- e ele não diz quem contratou a entrega.

Também **deixa passar parte das compras típicas**, e isso foi medido fora do dataset (`test/limites.test.ts`):

- um gotejamento só é acusado quando é quase todo o volume. No cenário testado, com 70% das views ele passa sem indícios; com 90%, fica inconclusivo só pela madrugada; com 98%, é acusado. É o preço do limite de 35% na regularidade: a variação do público real que continua chegando esconde a entrega;
- um pacote que não atravessa uma madrugada inteira só mostra o corte e fica inconclusivo. É o que acontece com parte do "viral orgânico com pacote somado" na tabela.

Ele **pode errar contra o criador** (`test/limites.test.ts`):

- **contagem arredondada pela fonte.** Se o total chega arredondado ("1,2 mil"), toda hora vira centena exata e, nas horas fracas, a contagem anda de 100 em 100, o que também simula um corte. No teste, o viral orgânico do exemplo sai **suspeito**. Por isso a API exige contagens exatas, como as que as APIs das plataformas devolvem; é o caso que eu mais gostaria de proteger (ver próximos passos);
- **duas ações da plataforma juntas.** Se a plataforma para de recomendar um viral (corte) e, na mesma semana, tira 2% das views como inválidas (remoção), são duas famílias, e o resultado é suspeito. A premissa do desenho, de que nenhum comportamento humano produz dois sinais ao mesmo tempo, vale para o público, mas não para duas ações da plataforma;
- **série preenchida por quem coletou.** Preencher a madrugada em linha reta parece regular demais e, em tese, pode disparar dois sinais. No cenário testado, com a madrugada preenchida toda noite, o criador comum continuou sem indícios, mas a API exige pontos medidos por causa disso;
- **viral que sobe de madrugada e é cortado de manhã.** Nas 10 sementes da faixa, o único falso positivo em 6.000 séries legítimas foi uma saída do algoritmo em que o viral subiu durante a madrugada e a plataforma cortou às 9h. A madrugada ficou mais forte que as horas antes (antes do viral) e depois (depois do corte).

No sentido oposto, o **impulsionamento pago na própria plataforma** é alcance comprado com gente real: segue o ciclo do dia, varia como pessoas e termina em degrau. Ele cai em `inconclusive` (só o corte), e não em `suspicious`, de propósito: não é fraude, mas o motivo lembra que um impulsionamento pago que termina produz o mesmo corte.

## Dataset

`npm run evaluate` gera 1.000 séries de 7 dias (168 horas) com um gerador pseudoaleatório próprio (mulberry32), e não com o `Math.random`, para não depender de versão. Cada série tem a própria semente, derivada da semente do dataset, do tipo e do índice: mudar um tipo não altera as séries dos outros. O arquivo [`data/dataset.jsonl`](data/dataset.jsonl) está no repositório, uma série por linha, com tipo, grupo, verdade, resultado esperado, os parâmetros que a geraram e as leituras do total acumulado (`null` onde a leitura falta). Um teste confere que regenerá-lo dá o mesmo hash.

Os parâmetros de cada tipo são as premissas do teste: a taxa vale enquanto elas valerem.

| Tipo | Premissa |
|---|---|
| Público orgânico (base de todos) | Nível de 3 a 150 views por hora (escala logarítmica); ciclo do dia com madrugada fraca e pico à noite, em que as horas de sono têm de 16% a 33% do horário mais forte; cada hora sorteada por Poisson sobre a intensidade multiplicada por uma gama de média 1 (pessoas chegam em ondas) e ondas lentas que voltam à média |
| Criador pequeno com ciclo diário | Só o público orgânico |
| Crescimento lento | O nível multiplica de 1,5 a 4 vezes ao longo da semana |
| Pico de fim de semana | Sábado e domingo com 1,5 a 2,5 vezes o volume, com rampas de 6 horas |
| Viral orgânico | Nível de 5 a 300; o viral chega de 8 a 60 vezes o nível, sobe em 2 a 8 horas e cai pela metade a cada 12 a 60 horas; segue o ciclo do dia |
| Menção de conta grande | Degrau de 4 a 40 vezes em uma hora, caindo pela metade a cada 24 a 96 horas |
| Saída do algoritmo | Viral; de 4 a 30 horas depois do pico, o volume do viral cai para 5% a 25% em 1 a 2 horas e não volta |
| Impulsionamento pago na plataforma | De 3 a 12 vezes o volume por 24 a 72 horas, começando e terminando em degrau de uma hora; segue o ciclo do dia |
| Público em vários fusos | 2 ou 3 públicos em fusos a pelo menos 6 horas de distância; viral; um terço com corte da plataforma |
| Platô comprado | Entrega de 8 a 60 vezes o público por 18 a 48 horas, variando de 0,1% a 0,4%, subindo em até uma hora e parando de uma vez; termina ao menos 28 horas antes do fim da série |
| Gotejamento constante | Criador pequeno (2 a 15 views por hora) com 100 a 600 views por hora entregues durante toda a série, variando de 0,2% a 1% |
| Pico seguido de remoção | Platô de 6 a 24 horas; de 12 a 48 horas depois, a plataforma tira de 30% a 90% das views entregues, em 1 a 6 horas |
| Viral orgânico com pacote somado | Viral, mais um pacote de 3 a 10 vezes o volume orgânico do momento, por 12 a 36 horas, começando até 24 horas depois do viral |
| Entregas em lotes redondos | Vídeo quase sem público (0,1 a 0,6 views por hora) com lotes de 200 a 2.000 views, em centenas exatas, em 35% a 80% das horas, por 48 a 80 horas |
| Compra que imita gente | Entrega com ciclo do dia e irregularidade humana, de 4 a 30 vezes o público, por 36 a 72 horas; sobe em 4 a 10 horas e desliga aos poucos (cai pela metade a cada 4 a 10 horas) |
| Compra pequena | De 3% a 15% do volume orgânico da semana, como platô de 12 a 48 horas ou gotejamento na série inteira |
| Artefatos de coleta (em todos) | Cerca de 10% das séries perdem de 1 a 4 leituras; 5% das legítimas têm de 1 a 3 recontagens para baixo, de até 30 views e até 0,3% do total |

## Testes

```bash
npm test
```

- `test/classificador.test.ts`: os casos óbvios (criador pequeno, gotejamento exato); os **gêmeos**, um viral orgânico e um platô comprado com a mesma subida, a mesma altura e o mesmo total, em que o teste confere que a diferença está no fim, na madrugada e na variação, nunca no tamanho; o viral com 100 vezes mais público e a menção de conta grande, que continuam sem indícios; a saída do algoritmo, inconclusiva só com o corte; o público em vários fusos com corte, que não vira suspeito porque a madrugada fica não avaliável; o público em Lisboa sem fuso informado; horas faltando, recontagem de −3 views, queda de 5% e os casos de dados insuficientes.
- `test/api.test.ts`: o contrato do `POST /classify`, os 422 com campo e motivo, e a prova de que a API e a avaliação chamam a mesma função.
- `test/motivos.test.ts`: os motivos dos exemplos e das 1.000 séries da semente de desenvolvimento não têm nomes do código nem número sem unidade.
- `test/avaliacao.test.ts`: o dataset regenerado tem o mesmo hash; o bloco do README e o `results/metrics.json` são idênticos ao que a avaliação gera agora (se não forem, o teste mostra o número do README, o medido e o comando a rodar); as metas valem.
- `test/gerador.test.ts`: o gerador é determinístico, um tipo não depende dos outros, e os artefatos de coleta respeitam os limites.
- `test/limites.test.ts`: os limites desta seção, para o README não afirmar o que o código não faz.

## Próximos passos

- **Proteger a contagem arredondada pela fonte.** Hoje ela pode acusar um criador honesto (ver acima).
- **Engajamento por hora como primeira extensão.** Provavelmente é o sinal mais forte, porque view comprada quase nunca vem com curtida. Mas curtida também se compra, e incluir esse sinal exige gerar engajamento no dataset e medir tudo de novo: nenhum dado entra na acusação sem estar no dataset que mede o falso positivo.
- **Mais séries legítimas.** Zero falso positivo em 600 ainda deixa o limite superior de 95% (bilateral) em 0,61%, acima da meta de 0,5%. Para esse limite ficar abaixo de 0,5% com zero erros, seriam necessárias cerca de 740 séries legítimas.

## Uso de IA

Ferramenta: Claude Code (Claude Opus 5.5).

- **Decisões minhas:** montei o desenho reunindo ideias de IA (outra ferramenta, fora deste repositório) e o trouxe pronto: as três saídas sem pontuação; o motivo que descreve o padrão e não a intenção; suspeito como revisão, não punição; as quatro famílias com limites e explicações inocentes; contar famílias, não sinais; altura, volume e subida em degrau como contexto; a janela pela média de 24 horas; a madrugada aprendida da série e "não avaliável"; a entrada pelo total acumulado com fuso obrigatório, 422, mínimo de 48 horas e buracos sem preenchimento; só views; a composição do dataset, com legítimos difíceis e compras disfarçadas; o comando que reescreve o README, a semente de desenvolvimento separada da do relatório e os testes que amarram o número; as metas de custo e a justificativa pela proporção real de compradores; o caso em que o classificador prefere não acusar; o que o critério não detecta; e a lista de testes.
- **Feito pela IA:** a verificação de prompt injection na página; as interpretações dos pontos que o desenho não fechava (seção 2 do `DECISOES.md`), entre elas o nível habitual pelo primeiro quartil, o horário mais forte ao redor de cada madrugada, a madrugada marcada até metade do volume, o desconto só de quedas normais e a remoção olhando a série inteira; toda a implementação, o gerador e os parâmetros de cada tipo; a calibração na semente de desenvolvimento, com os erros que ela revelou e as correções (seção 3 do `DECISOES.md`); os testes, os testes de mutação e a avaliação crítica com cenários executados; os exemplos, gerados executando a API; o rascunho deste README.
- **O que revisei:** a revisão foi feita ao longo do processo, junto com a ferramenta. Cada decisão foi discutida comigo antes de virar código, e acompanhei os testes, os cenários, os erros introduzidos de propósito e as validações.

O raciocínio passo a passo, separando o que foi meu e o que foi da IA, está em [`DECISOES.md`](DECISOES.md).
