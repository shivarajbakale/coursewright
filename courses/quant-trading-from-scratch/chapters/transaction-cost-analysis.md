# Transaction cost analysis: measuring what each trade really cost

VWAP execution and TWAP execution both promise a fill price close to a market average. Your backtest also assumed a cost for every trade, as you saw with transaction costs. Both are claims made before the trade. After the trade, how do you check them, and how do you find where the money went?

## Compare each fill with a reference

Picture a long drive. When you leave, the pump near your home charges $1.50 a litre. On the road you pay $1.59 on average. The stations you passed charged $1.56 on average while you drove. Against the price at home, you paid 9 cents a litre more. Against the stations on your road, you paid only 3 cents more. Prices along the road went up, and that was not your doing.

The price at home stands for the arrival price. The average at the stations stands for the market's VWAP while you traded. The picture stops holding in one place. Your fuel does not change the pump price, but your buying does push up the market price. So part of the rise "along the road" was caused by you.

## Split one order

You bought 12,000 shares. The arrival price, the mid price at the decision, was $50.00, and the bid-ask spread was $0.04. You filled at $50.09 on average. The market's VWAP over the same hours was $50.06. A buyer who trades at once pays the best ask, which sits half the spread above the mid price. The split, per share and in dollars, is below.

1. Total cost against arrival: 50.09 − 50.00 = 0.09 dollars, or 0.18% of the price. On the order, 12,000 × 0.09 = 1,080 dollars.
2. Spread: half the spread, 0.02 dollars. On the order, 12,000 × 0.02 = 240 dollars.
3. Timing: the market moved from $50.00 to a VWAP of $50.06 while you traded. On the order, 12,000 × 0.06 = 720 dollars.
4. Impact: what is left, 0.09 − 0.02 − 0.06 = 0.01 dollars. On the order, 12,000 × 0.01 = 120 dollars.

The split is an estimate. Your own buying pushed the VWAP up too, so part of the timing cost is really market impact.

```inkling
title "Where the cost of one order went"
layout down
fills: box "Your fills: 50.09"
refs: box "Arrival 50.00, VWAP 50.06"
total: box "Total: 0.09 a share" yellow
spread: box "Spread: 0.02"
timing: box "Timing: 0.06"
impact: box "Impact: 0.01"
fills -> total
refs -> total
total -> spread
total -> timing
total -> impact
circle total
step 1: fills, refs "Each fill is set against reference prices"
step 2: total "The gap from arrival is the total cost"
step 3: spread "Half the spread is paid to trade at once"
step 4: timing, impact "The market's own move and your push share the rest"
```

## Many orders at once

One order can be luck, so you collect every order in a table. The `side` column is 1 for a buy and −1 for a sell. Multiplying by it makes a positive number a cost for both.

```python
import pandas as pd

orders = pd.DataFrame({
    "side":    [1, 1, -1, -1],                  # 1 = buy, -1 = sell
    "shares":  [12_000, 3_000, 8_000, 20_000],
    "arrival": [50.00, 20.00, 75.00, 40.00],
    "fill":    [50.09, 20.01, 74.91, 39.90],    # your average fill price
    "vwap":    [50.06, 20.02, 74.95, 39.95],    # market VWAP while you traded
})
s = orders["side"]
orders["vs_arrival_%"] = 100 * s * (orders["fill"] - orders["arrival"]) / orders["arrival"]
orders["vs_vwap_%"] = 100 * s * (orders["fill"] - orders["vwap"]) / orders["vwap"]
orders["cost_usd"] = s * (orders["fill"] - orders["arrival"]) * orders["shares"]
cols = ["side", "shares", "vs_arrival_%", "vs_vwap_%", "cost_usd"]
print(orders[cols].round(3).to_string(index=False))
print("total cost", round(orders["cost_usd"].sum()))
```

```
 side  shares  vs_arrival_%  vs_vwap_%  cost_usd
    1   12000          0.18      0.060    1080.0
    1    3000          0.05     -0.050      30.0
   -1    8000          0.12      0.053     720.0
   -1   20000          0.25      0.125    2000.0
total cost 3830
```

1. The third order sold at $74.91 against an arrival price of $75.00. The side of −1 turns −0.09 into a cost of 0.12%.
2. The second order shows −0.05% against VWAP. A negative number means it beat the market's average.
3. The four orders traded 2,060,000 dollars in all. The total cost is 3,830 / 2,060,000 = 0.19% of that.

That 0.19% is a measured number. You can put it into the backtest in place of the cost you guessed. With hundreds of orders, you can also check the square-root rule of thumb against your own fills.

## Name it

**Transaction cost analysis** compares your fills with reference prices after the trade, and splits the cost into spread, impact and timing. A **benchmark price** is one such reference: the arrival price, the market's VWAP over your trading hours, or the closing price.

> **Key idea:** Transaction cost analysis measures each fill against benchmark prices, so the cost you assume in research comes from what your trades really paid.

## What you have now

You can now follow an order from the limit order book to a measured cost, and send that cost back into your research. Every step so far ran by hand, one script at a time. A real firm runs these parts every day without a person in the loop. What parts does such a system need, and how do they connect?
