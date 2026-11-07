# Market impact: your own trading moving the price

The limit order book showed that a small order fills at the best price. But a strategy that manages real money can need thousands of shares, and the best ask may hold only 300. What price do you pay for the rest, and why does it get worse as your order grows?

## Eating through the book

Picture a farmers' market where five stalls sell the same tomatoes at different prices. You need 40 kilograms. The cheapest stall has 6 kilograms, so you buy them and walk to the next stall, which charges more. Each stall stands for one price level in the book, and its stock stands for the depth there. The more you need, the further up the row of prices you walk.

The picture stops holding in one place. At a farmers' market, the stalls do not react when they see you buy. In a market, other traders watch the book. When your buying empties the asks, sellers raise their prices and buyers join in. Because of this, the price rises further than the visible depth alone predicts.

Here is the sell side of a book, with the best bid at $100.00. The mid price is $100.01. You send a market buy order for 2,000 shares.

```python
asks = [(100.02, 300), (100.03, 500), (100.04, 800), (100.05, 1200)]
mid = 100.01
to_buy, paid = 2000, 0.0
for price, shares in asks:
    take = min(shares, to_buy)
    paid += take * price
    to_buy -= take
    print(f"take {take:>4} at {price:.2f}")
    if to_buy == 0:
        break
avg = paid / 2000
print(f"average {avg:.4f}, {avg - mid:.4f} above mid")
```

```
take  300 at 100.02
take  500 at 100.03
take  800 at 100.04
take  400 at 100.05
average 100.0365, 0.0265 above mid
```

1. The first 300 shares fill at $100.02, the best ask.
2. The order then takes all of $100.03 and $100.04: 500 + 800 = 1,300 more shares.
3. The last 400 shares fill at $100.05. Now the best ask is $100.05, so the next buyer pays more too.
4. Your average price is $100.0365, which is $0.0265 above the mid price. A 100-share order would pay only $0.01 above the mid price.

```inkling
title "A large buy walks up the asks"
layout down
order: box "Buy 2,000 shares" blue
l1: box "100.02: take 300"
l2: box "100.03: take 500"
l3: box "100.04: take 800"
l4: box "100.05: take 400"
avg: box "Average 100.0365" yellow
order -> l1 -> l2 -> l3 -> l4 -> avg
circle avg
step 1: order, l1 "The best ask fills first"
step 2: l2, l3 "Each empty level sends the order to a higher price"
step 3: l4 "The last shares fill at the highest price"
step 4: avg "The average sits 0.0265 above the mid price"
```

## A rule of thumb for size

Real orders are much bigger than one snapshot of the book, so traders estimate the price move with a formula fitted to past trades. Its input is your order size divided by the **average daily volume**. That is the number of shares traded per day, averaged over past days. The estimate is:

impact = Y × daily volatility × square root of (order shares / average daily volume)

Y is a number that each trading firm fits from its own fills. The formula is an empirical rule: it describes measured trades and has no proof behind it. Here we use Y = 0.8 as an illustrative value. The stock has a daily volatility of 2%, an average daily volume of 1,000,000 shares and a price of $50.

```python
import numpy as np
import pandas as pd

Y, sigma, adv, price = 0.8, 0.02, 1_000_000, 50.0  # Y is illustrative
q = np.array([5_000, 10_000, 20_000, 40_000])
impact = Y * sigma * np.sqrt(q / adv)          # fraction of the price
print(pd.DataFrame({"shares": q, "impact_pct": (100 * impact).round(3),
                    "cost_usd": (impact * q * price).round(0)}).to_string(index=False))
```

```
 shares  impact_pct  cost_usd
   5000       0.113     283.0
  10000       0.160     800.0
  20000       0.226    2263.0
  40000       0.320    6400.0
```

For 10,000 shares the move is 0.8 × 2% × 0.1 = 0.16%. Four times the shares, 40,000, gives 0.32%: the move per share doubles, because the square root of 4 is 2. The dollar cost grows by 6,400 / 800 = 8 times, because you pay twice as much on four times as many shares.

## Name it

**Market impact** is the change in price that your own trading causes. It is one of the causes of slippage, and you pay it on top of the bid-ask spread. The **square-root law** is the rule of thumb above: impact grows with the square root of order size compared with average daily volume.

> **Key idea:** Market impact is the price move your own order causes, and as a rule of thumb it grows with the square root of your order's share of daily volume.

## What you have now

Slippage now has a cause you can estimate before you trade, from the depth of the book and your order's size. Impact pushes you to trade slowly, but a slow order leaves time for the price to move away. How do you measure the whole cost, from the moment you decided to trade to the last fill?
