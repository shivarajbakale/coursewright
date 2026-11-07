# Slippage: the gap between expected and actual price

With transaction costs, your backtest now pays the commission and half the spread on every trade. It still assumes that each trade fills at exactly the price the rule saw when it decided. That is not true. Between the decision and the fill, time passes and prices move. How far apart are the price you expected and the price you got?

## The price moves while you act

Think of seeing a train ticket for $40 on a booking site. By the time you type in your card number, the last seat at $40 is gone, and you pay $42. You still travel, but the plan said $40. The advertised fare stands for the price your backtest assumed. The fare you paid stands for the fill price. The picture stops holding in one way: a market price can also move in your favour. Over many trades, though, it moves against you more often.

Three causes make a fill differ from the expected price:

1. **Delay.** A daily rule sees the close only after the close has happened. It cannot trade at that price, so its order fills later, at a different price.
2. **Size.** The best ask may offer 100 shares. If you buy 300, the other 200 fill at higher asks further up the queue.
3. **Width.** In a calm hour the spread may be $0.02 wide. In a fast hour it can be $0.20 wide, and your market order pays the wide one.

```inkling
title "Where the gap opens"
layout sequence
rule: box "Your rule"
broker: box "Broker"
market: box "Market"
market -> rule : "close is $100.00"
rule -> broker : "buy 100 shares"
broker -> market : "market order"
market --> broker : "filled at $100.06"
broker --> rule : "6 cents worse per share"
steps auto
```

## Measuring it from fills

**Slippage** is the difference between the price you expected and the price you got, counted so that a worse price is positive. For a buy it is fill minus expected. For a sell it is expected minus fill, because a lower sale price is worse for you.

Slippage is small, so traders measure it in **basis points**. One basis point is 0.01%, so 10,000 basis points make 100%. Here are four fills compared with the prices a backtest expected:

```python
import pandas as pd

trades = pd.DataFrame({
    "side":     [1, -1, 1, -1],             # 1 = buy, -1 = sell
    "expected": [100.00, 101.50, 99.80, 100.90],
    "fill":     [100.06, 101.41, 99.83, 100.86],
    "shares":   [100, 100, 200, 200],
})
trades["slip"] = trades.side * (trades.fill - trades.expected)   # > 0 means worse
trades["bps"] = trades.slip / trades.expected * 10_000
trades["dollars"] = trades.slip * trades.shares
print(trades[["slip", "bps", "dollars"]].round(2))
print("average bps:", round(trades.bps.mean(), 2))
print("total dollars:", round(trades.dollars.sum(), 2))
```

```
   slip   bps  dollars
0  0.06  6.00      6.0
1  0.09  8.87      9.0
2  0.03  3.01      6.0
3  0.04  3.96      8.0
average bps: 5.46
total dollars: 29.0
```

Read it row by row:

1. The first buy expected $100.00 and filled at $100.06. That is 0.06 / 100.00 × 10,000 = 6 basis points, or $6 on 100 shares.
2. The first sell expected $101.50 and got $101.41. The sale got $0.09 less, which is 8.87 basis points worse.
3. The other two trades lost 3.01 and 3.96 basis points.
4. On average each trade lost 5.46 basis points, and the four trades together lost $29.

## Putting it into the backtest

A backtest cannot know each future fill, so it adds an estimate to the cost of every trade. A careful choice is to round the measured average up, here to 6 basis points. The cost per trade from transaction costs was 10 basis points. The new cost per trade is 10 + 6 = 16 basis points, or 0.16%. A rule that trades all its equity once a day now pays 252 × 0.16% = 40.32% a year.

A second fix removes the delay from the backtest itself. A rule that decides on today's close fills at the next bar's open, not at today's close.

> **Key idea:** Slippage is how much worse your fill was than the price you expected, and a backtest must add an estimate of it to the cost of every trade.

## What you have now

Your cost model now holds the commission, half the spread and an estimate of slippage. Delay was one cause of slippage: a rule cannot act on a price before it exists. A backtest can break that rule in a worse way. What happens when a backtest decides with data that did not exist yet?
