# Exemplos executados

Gerados chamando o servidor HTTP de verdade (`npm start` sobe o mesmo app na porta 3009). Os corpos estão em [`docs/exemplos/`](exemplos/) e saem das séries de [`src/exemplos.ts`](../src/exemplos.ts), as mesmas dos testes. As respostas abaixo são as que o servidor devolveu.

## O caso em que o classificador prefere não acusar: saída do algoritmo

Um viral que despenca quando a plataforma para de recomendar o vídeo. Só o corte dispara; a madrugada e a variação são de público humano.

```bash
curl -s -X POST 'http://127.0.0.1:3009/classify' -H 'content-type: application/json' --data @docs/exemplos/saida-do-algoritmo.json
```

HTTP 200

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

## Gêmeo comprado: platô com a mesma subida, altura e total do viral

Três famílias concordam: o fim, a madrugada e a variação.

```bash
curl -s -X POST 'http://127.0.0.1:3009/classify' -H 'content-type: application/json' --data @docs/exemplos/gemeo-comprado.json
```

HTTP 200

```json
{
  "classification": "suspicious",
  "reason": "A queda das 15h do dia 11 foi abrupta: em duas horas, o volume foi de cerca de 1.000 para 28 views por hora. Descontada a queda normal desse horário (9%), são 97% a menos, e o volume não voltou no dia seguinte. O volume não diminuiu de madrugada: entre 2h e 7h do dia 11, quando este público costuma dormir, ficou em 97% do horário mais forte (fora do pico, essas horas caíam para 32%). Entre 14h do dia 10 e 16h do dia 11, o vídeo recebeu cerca de 970 views por hora, variando umas 8 views para cima ou para baixo; com esse volume, pessoas independentes fariam a contagem variar umas 31 views. Três sinais independentes concordam: o padrão é compatível com entrega automatizada, o que não identifica quem a contratou. Esse alcance precisa de revisão antes de entrar na decisão de renovação.",
  "families_fired": [
    "abrupt_end",
    "awake_at_night",
    "regularity"
  ],
  "analyzed_window": {
    "start": "2026-03-10T14:00:00-03:00",
    "end": "2026-03-11T16:00:00-03:00",
    "hours": 26,
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
      "value": 0.97,
      "explanation": "A queda das 15h do dia 11 foi abrupta: em duas horas, o volume foi de cerca de 1.000 para 28 views por hora. Descontada a queda normal desse horário (9%), são 97% a menos, e o volume não voltou no dia seguinte."
    },
    {
      "signal": "awake_at_night",
      "family": "awake_at_night",
      "threshold": 0.8,
      "fires_when": "above",
      "evaluable": true,
      "fired": true,
      "value": 0.97,
      "explanation": "O volume não diminuiu de madrugada: entre 2h e 7h do dia 11, quando este público costuma dormir, ficou em 97% do horário mais forte (fora do pico, essas horas caíam para 32%)."
    },
    {
      "signal": "low_variation",
      "family": "regularity",
      "threshold": 0.35,
      "fires_when": "below",
      "evaluable": true,
      "fired": true,
      "value": 0.26,
      "explanation": "Entre 14h do dia 10 e 16h do dia 11, o vídeo recebeu cerca de 970 views por hora, variando umas 8 views para cima ou para baixo; com esse volume, pessoas independentes fariam a contagem variar umas 31 views."
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
    "habitual_views_per_hour": 18,
    "peak_views_per_hour": 1050,
    "peak_multiple": 56.9,
    "window_views": 24510,
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

## Gêmeo orgânico: o viral do mesmo criador

Mesma altura e mesmo total do platô acima; nenhuma família dispara.

```bash
curl -s -X POST 'http://127.0.0.1:3009/classify' -H 'content-type: application/json' --data @docs/exemplos/gemeo-organico.json
```

HTTP 200

```json
{
  "classification": "no_evidence",
  "reason": "Nenhum sinal de entrega automatizada. O pico não terminou de uma vez: a maior queda em duas horas, descontada a queda normal do horário, foi de 48%. Nas madrugadas, entre 3h e 8h, quando este público costuma dormir, o volume ficou em no máximo 27% do horário mais forte. As contagens variaram como variam pessoas independentes: umas 52 views para cima ou para baixo, quando o acaso sozinho daria umas 16 views. O total acumulado nunca caiu. O pico chegou a 1.000 views por hora, 53 vezes o nível habitual deste vídeo; altura de pico não é sinal, porque é o que acontece quando um vídeo estoura. A subida foi brusca, de cerca de 21 para 370 views por hora em até duas horas, às 14h do dia 10; isso também acontece quando uma conta grande menciona o criador, e subida não é sinal. Isso não certifica que as views são de pessoas, só que os padrões procurados não aparecem.",
  "families_fired": [],
  "analyzed_window": {
    "start": "2026-03-10T14:00:00-03:00",
    "end": "2026-03-15T00:00:00-03:00",
    "hours": 106,
    "kind": "peak"
  },
  "signals": [
    {
      "signal": "abrupt_end",
      "family": "abrupt_end",
      "threshold": 0.7,
      "fires_when": "above",
      "evaluable": true,
      "fired": false,
      "value": 0.48,
      "explanation": "O pico não terminou de uma vez: a maior queda em duas horas, descontada a queda normal do horário, foi de 48%."
    },
    {
      "signal": "awake_at_night",
      "family": "awake_at_night",
      "threshold": 0.8,
      "fires_when": "above",
      "evaluable": true,
      "fired": false,
      "value": 0.27,
      "explanation": "Nas madrugadas, entre 3h e 8h, quando este público costuma dormir, o volume ficou em no máximo 27% do horário mais forte."
    },
    {
      "signal": "low_variation",
      "family": "regularity",
      "threshold": 0.35,
      "fires_when": "below",
      "evaluable": true,
      "fired": false,
      "value": 3.32,
      "explanation": "As contagens variaram como variam pessoas independentes: umas 52 views para cima ou para baixo, quando o acaso sozinho daria umas 16 views."
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
    "habitual_views_per_hour": 19,
    "peak_views_per_hour": 1028,
    "peak_multiple": 53.4,
    "window_views": 26115,
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

## Gotejamento exato, dia e noite

1.000 views em toda hora. A regularidade aparece por dois sinais (variação e centenas exatas), mas conta como uma família só.

```bash
curl -s -X POST 'http://127.0.0.1:3009/classify' -H 'content-type: application/json' --data @docs/exemplos/gotejamento-exato.json
```

HTTP 200

```json
{
  "classification": "suspicious",
  "reason": "O volume não diminuiu de madrugada: entre 21h e 2h do dia 9, as horas mais fracas do dia, ficou em 100% do horário mais forte. Ao longo da série, o vídeo recebeu cerca de 1.000 views por hora, variando menos de 1 view para cima ou para baixo; com esse volume, pessoas independentes fariam a contagem variar umas 32 views. Em 168 de 168 horas com mais de 200 views, a contagem foi uma centena exata (como 1.000 views); entre pessoas, isso acontece em cerca de 1% das horas. Dois sinais independentes concordam: o padrão é compatível com entrega automatizada, o que não identifica quem a contratou. Esse alcance precisa de revisão antes de entrar na decisão de renovação.",
  "families_fired": [
    "awake_at_night",
    "regularity"
  ],
  "analyzed_window": {
    "start": "2026-03-08T00:00:00-03:00",
    "end": "2026-03-15T00:00:00-03:00",
    "hours": 168,
    "kind": "whole_series"
  },
  "signals": [
    {
      "signal": "abrupt_end",
      "family": "abrupt_end",
      "threshold": 0.7,
      "fires_when": "above",
      "evaluable": true,
      "fired": false,
      "value": 0,
      "explanation": "O volume não teve queda brusca: a maior queda em duas horas, descontada a queda normal do horário, foi de 0%."
    },
    {
      "signal": "awake_at_night",
      "family": "awake_at_night",
      "threshold": 0.8,
      "fires_when": "above",
      "evaluable": true,
      "fired": true,
      "value": 1,
      "explanation": "O volume não diminuiu de madrugada: entre 21h e 2h do dia 9, as horas mais fracas do dia, ficou em 100% do horário mais forte."
    },
    {
      "signal": "low_variation",
      "family": "regularity",
      "threshold": 0.35,
      "fires_when": "below",
      "evaluable": true,
      "fired": true,
      "value": 0,
      "explanation": "Ao longo da série, o vídeo recebeu cerca de 1.000 views por hora, variando menos de 1 view para cima ou para baixo; com esse volume, pessoas independentes fariam a contagem variar umas 32 views."
    },
    {
      "signal": "round_counts",
      "family": "regularity",
      "threshold": 0.4,
      "fires_when": "above",
      "evaluable": true,
      "fired": true,
      "value": 1,
      "explanation": "Em 168 de 168 horas com mais de 200 views, a contagem foi uma centena exata (como 1.000 views); entre pessoas, isso acontece em cerca de 1% das horas."
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
    "habitual_views_per_hour": 1000,
    "peak_views_per_hour": 1000,
    "peak_multiple": 1,
    "window_views": 168000,
    "step_rise": false,
    "peak_windows": 0
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

## Público em vários fusos, com corte

A madrugada fica não avaliável, porque fora do pico este público não tem madrugada marcada. Com só o corte, o resultado é inconclusivo.

```bash
curl -s -X POST 'http://127.0.0.1:3009/classify' -H 'content-type: application/json' --data @docs/exemplos/varios-fusos-com-corte.json
```

HTTP 200

```json
{
  "classification": "inconclusive",
  "reason": "A queda das 15h do dia 11 foi abrupta: em duas horas, o volume caiu 87% (de cerca de 1.300 para 160 views por hora), num horário em que o volume não costuma cair, e não voltou no dia seguinte. Isso acontece quando um pacote de views acaba, mas também quando a plataforma para de recomendar o vídeo ou quando um impulsionamento pago termina. Os outros sinais são de público humano. As contagens variaram como variam pessoas independentes: umas 389 views para cima ou para baixo, quando o acaso sozinho daria umas 36 views. O total acumulado nunca caiu. Não dá para avaliar a madrugada: fora do pico, as horas mais fracas deste público têm 54% do volume das mais fortes, sem madrugada marcada, como acontece com público espalhado por vários fusos. Um indício isolado não basta para acusar. O pico chegou a 2.700 views por hora, 42 vezes o nível habitual deste vídeo; altura de pico não é sinal, porque é o que acontece quando um vídeo estoura. A subida foi brusca, de cerca de 84 para 830 views por hora em até duas horas, às 9h do dia 10; isso também acontece quando uma conta grande menciona o criador, e subida não é sinal.",
  "families_fired": [
    "abrupt_end"
  ],
  "analyzed_window": {
    "start": "2026-03-10T10:00:00-03:00",
    "end": "2026-03-11T23:00:00-03:00",
    "hours": 37,
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
      "value": 0.87,
      "explanation": "A queda das 15h do dia 11 foi abrupta: em duas horas, o volume caiu 87% (de cerca de 1.300 para 160 views por hora), num horário em que o volume não costuma cair, e não voltou no dia seguinte."
    },
    {
      "signal": "awake_at_night",
      "family": "awake_at_night",
      "threshold": 0.8,
      "fires_when": "above",
      "evaluable": false,
      "fired": false,
      "value": null,
      "explanation": "Não dá para avaliar a madrugada: fora do pico, as horas mais fracas deste público têm 54% do volume das mais fortes, sem madrugada marcada, como acontece com público espalhado por vários fusos."
    },
    {
      "signal": "low_variation",
      "family": "regularity",
      "threshold": 0.35,
      "fires_when": "below",
      "evaluable": true,
      "fired": false,
      "value": 10.81,
      "explanation": "As contagens variaram como variam pessoas independentes: umas 389 views para cima ou para baixo, quando o acaso sozinho daria umas 36 views."
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
    "peak_views_per_hour": 2706,
    "peak_multiple": 41.8,
    "window_views": 47137,
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

## Dados insuficientes: 30 horas

Menos de 48 horas não dá para comparar um dia com o outro.

```bash
curl -s -X POST 'http://127.0.0.1:3009/classify' -H 'content-type: application/json' --data @docs/exemplos/serie-de-30-horas.json
```

HTTP 200

```json
{
  "classification": "inconclusive",
  "reason": "Dados insuficientes para avaliar: a série cobre 30 horas, e são necessárias pelo menos 48 horas para comparar um dia com o outro. Envie leituras medidas de hora em hora, sem preenchimento, cobrindo pelo menos 48 horas.",
  "families_fired": [],
  "analyzed_window": null,
  "signals": [],
  "context": null,
  "insufficient_data": [
    "a série cobre 30 horas, e são necessárias pelo menos 48 horas para comparar um dia com o outro"
  ],
  "rule": "suspeito exige duas famílias de sinais; com uma, inconclusivo",
  "criteria_version": "v1",
  "data_quality": {
    "hours": 30,
    "missing_readings": 0,
    "longest_gap_hours": 0,
    "drop_hours": 0
  },
  "audience_timezone": "America/Sao_Paulo"
}
```

## Série mal formada: 422 com o campo e o motivo

**Horário sem fuso**

```bash
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"series":[{"at":"2026-03-08T00:00:00","cumulative_views":5000},{"at":"2026-03-08T01:00:00-03:00","cumulative_views":5021}]}'
```

HTTP 422

```json
{
  "error": "invalid_series",
  "field": "series[0].at",
  "message": "series[0].at: o horário '2026-03-08T00:00:00' não tem fuso. Inclua o fuso, como em 2026-03-08T00:00:00-03:00 ou 2026-03-08T00:00:00Z."
}
```

**Horário repetido**

```bash
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"series":[{"at":"2026-03-08T00:00:00-03:00","cumulative_views":5000},{"at":"2026-03-08T00:05:00-03:00","cumulative_views":5003}]}'
```

HTTP 422

```json
{
  "error": "invalid_series",
  "field": "series[1].at",
  "message": "series[1].at: '2026-03-08T00:05:00-03:00' cai na mesma hora cheia da leitura anterior."
}
```

**Valor negativo**

```bash
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"series":[{"at":"2026-03-08T00:00:00-03:00","cumulative_views":-1}]}'
```

HTTP 422

```json
{
  "error": "invalid_series",
  "field": "series[0].cumulative_views",
  "message": "series[0].cumulative_views: informe o total acumulado de views, um inteiro maior ou igual a zero."
}
```

## Views de cada hora para exibição (`?hourly=true`)

Com as leituras das 6h e das 7h do dia 9 faltando, o volume do buraco é dividido igualmente entre as três horas afetadas, que vêm marcadas como `estimated` e ficam fora dos sinais. Trecho da resposta:

```json
[
  {
    "start": "2026-03-09T03:00:00-03:00",
    "views": 22,
    "status": "measured"
  },
  {
    "start": "2026-03-09T04:00:00-03:00",
    "views": 9,
    "status": "measured"
  },
  {
    "start": "2026-03-09T05:00:00-03:00",
    "views": 23,
    "status": "estimated"
  },
  {
    "start": "2026-03-09T06:00:00-03:00",
    "views": 23,
    "status": "estimated"
  },
  {
    "start": "2026-03-09T07:00:00-03:00",
    "views": 22,
    "status": "estimated"
  },
  {
    "start": "2026-03-09T08:00:00-03:00",
    "views": 55,
    "status": "measured"
  }
]
```

## O critério em vigor

```bash
curl -s http://127.0.0.1:3009/criteria
```

HTTP 200

```json
{
  "criteria_version": "v1",
  "rule": "suspeito exige duas famílias de sinais; com uma, inconclusivo",
  "families": [
    "abrupt_end",
    "awake_at_night",
    "regularity",
    "removal"
  ],
  "limits": {
    "timestampToleranceMinutes": 10,
    "minHours": 48,
    "maxHours": 720,
    "maxMissingShare": 0.1,
    "maxGapHours": 6,
    "smoothingHours": 24,
    "windowMultiple": 3,
    "minHourlyViews": 20,
    "abruptDrop": 0.7,
    "recoveredShare": 0.5,
    "awakeShare": 0.8,
    "markedNightMaxShare": 0.5,
    "nightBlockHours": 5,
    "strongBlockHours": 3,
    "lowVariation": 0.35,
    "minPairs": 12,
    "roundShare": 0.4,
    "roundMinViews": 200,
    "roundMinHours": 10,
    "removalShare": 0.01,
    "removalMinViews": 100
  }
}
```
