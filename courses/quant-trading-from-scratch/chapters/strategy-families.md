# Strategy families: following trends, betting on reversals, collecting carry

You now know what a trading edge needs: a small advantage that repeats and survives costs, with a reason behind it. Edges come in many forms, but most rules make one of 3 bets about how prices behave. What are those 3 bets, and when does each one win?

## Three bets about a price

Picture three people watching a river after rain:

1. The first says the water rose today, so it will keep rising tomorrow.
2. The second says the water is far above its normal level, so it will fall back.
3. The third does not guess at all. She rents out her boat and collects a fee every day, as long as no flood comes.

In this picture, the water level stands for a price. Each person stands for one family of strategies. The picture stops holding in one place. A river follows rain in a way you can predict from the weather. Prices react to news that nobody can see coming.

## Following and fading a move

Here are two made-up price paths and two rules. Each rule looks at today's return and decides whether to hold the share tomorrow.

- The first rule holds tomorrow if the price rose today. It bets that a move continues.
- The second rule holds tomorrow if the price fell today. It bets that a move reverses.

```python
paths = {
    "steady rise": [100, 102, 104, 106, 108, 110, 112],
    "back and forth": [100, 104, 100, 104, 100, 104, 100],
}
for name, close in paths.items():
    rets = [close[i] / close[i - 1] - 1 for i in range(1, len(close))]
    trend, reversal = 1.0, 1.0           # growth factors
    for today, tomorrow in zip(rets, rets[1:]):
        if today > 0:
            trend *= 1 + tomorrow        # rose today: trend rule holds tomorrow
        else:
            reversal *= 1 + tomorrow     # fell today: reversal rule holds tomorrow
    print(name, round((trend - 1) * 100, 2), round((reversal - 1) * 100, 2))
```

```
steady rise 9.8 0.0
back and forth -11.1 8.16
```

Follow the results:

1. On the steady rise, every day is up. The first rule holds from 102 to 112, a gain of 112 / 102 − 1 = 9.8%. The second rule never holds, so it earns 0%.
2. On the back-and-forth path, the first rule holds after each rise, and each next day falls by 100 / 104 − 1 = −3.85%. Three such days give 0.9615³ = 0.889, a loss of 11.1%.
3. On the same path, the second rule holds after each fall, and gains 4% twice: 1.04 × 1.04 = 1.0816, a gain of 8.16%.

Neither rule is better in general. Each wins on the path it bets on, and loses on the other path.

## Collecting carry

The third family does not bet on the direction of a move. It holds something that pays while you hold it. A classic example uses two currencies. An **exchange rate** is the price of one currency in another. Say you borrow 100 in a currency that charges 1% a year, swap it, and earn 5% a year in the other currency.

1. If the exchange rate does not move, you earn 5 and pay 1, a gain of 5 − 1 = 4 in a year.
2. If the currency you hold falls 6%, your 105 is worth 105 × 0.94 = 98.7. You owe 101, so the result is 98.7 − 101 = −2.3, a loss of 2.3.

This is a risk premium at work: you are paid 4 a year for carrying the chance of a sudden fall.

```inkling
title "Three families of bets"
layout compare
columns "Trend", "Reversion", "Carry"
row "The bet": "a move continues", "a move reverses", "holding pays"
row "Wins when": "prices keep going", "prices swing back", "prices stay calm"
row "Loses when": "a move turns", "a move keeps going", "a sudden fall"
step 1: the-bet "Each family makes a different bet"
step 2: wins-when "Each wins when prices behave as it bets"
step 3: loses-when "And each loses when the market does the opposite"
```

## Name it

A systematic strategy follows fixed rules written in code. Most of them belong to one of 3 families:

- A **trend** strategy bets that a price that has moved will keep moving the same way.
- A **mean reversion** strategy bets that a price far from its recent average will move back toward it.
- A **carry** strategy holds something that pays a steady return while it is held, and accepts the risk of a sudden loss.

> **Key idea:** Most systematic strategies bet that a move continues, that it reverses, or that holding a risk pays.

## What you have now

You can name the bet behind a strategy and say whether it wins when prices keep going, swing back, or stay calm. With the Sharpe ratio, drawdown and a benchmark, you can also score how well it did. The next step is to test one of these bets on real past prices, honestly.
