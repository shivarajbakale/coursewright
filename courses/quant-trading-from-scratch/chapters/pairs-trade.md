# A pairs trade: buying the cheap leg and selling the rich leg

The mean-reversion half-life told you how fast a cointegrated spread closes. Now you want to profit from it. You cannot buy or sell a spread on an exchange. You can only trade the two stocks. When should you trade them, in which direction, and when should you stop?

## Two shops selling the same coffee

Picture two shops on one street that sell the same coffee. Their prices move together, because the beans cost both the same. One morning, shop A charges much more than usual compared with shop B. You expect the gap to close. Either A gets cheaper or B gets dearer, and you do not care which.

Shop A stands for stock A, the rich side of the pair. Shop B stands for stock B, the cheap side. "Much more than usual" stands for a spread far above its mean. The picture stops holding in one place: you cannot sell coffee you do not own. With stocks you can, through short selling.

## The z-score says how far is far

A spread of 9.39 means nothing until you know its usual level and its usual swing. The **z-score** puts the spread on a common scale:

z = (spread − rolling mean) / rolling standard deviation

A z-score of 2 means the spread is 2 standard deviations above its recent mean. The rolling window here is 20 days, about 2 to 3 times the half-life of 8.1 days.

Each side of a pair is a **leg**. One unit of the spread is one share of A against h shares of B, where h is the hedge ratio. The rules, with thresholds of 2 and 0.5 chosen for illustration:

1. If you are flat and z is above 2, the spread is rich. Sell the spread: short 1 share of A and buy h shares of B.
2. If you are flat and z is below −2, the spread is cheap. Buy the spread: buy 1 share of A and short h shares of B.
3. If you hold a position and z is between −0.5 and 0.5, the gap has closed. Exit both legs.
4. Otherwise, keep what you hold.

```inkling
title "One pairs trade"
layout flow
spread: box "Spread and\nits z-score"
check: diamond "z above 2?"
sell: box "Short A\nbuy h of B" orange
wait: box "Hold both legs"
close: diamond "z near 0?"
exit: round "Exit both legs" green
spread -> check
check -> sell : "yes"
sell -> wait -> close
close -> exit : "yes"
close --> wait : "not yet"
highlight check
step 1: spread "Measure how far the spread is from its recent mean"
step 2: check "A z-score above 2 means the spread is rich"
step 3: sell "Sell the rich leg, buy the cheap leg"
step 4: wait, close "Wait while the gap closes"
step 5: exit "Close both legs when z returns near 0"
```

## A backtest on the pair

The code uses the prices `a` and `b` from the cointegration example. It fits the hedge ratio on the first 250 days only, then trades the last 250. A ratio fitted on every day would use future prices, which is look-ahead bias.

```python
# a, b: the two prices from the cointegration example
ratio, _ = np.polyfit(b[:250], a[:250], 1)       # fit on the first 250 days only
spread = a - ratio * b
z = (spread - spread.rolling(20).mean()) / spread.rolling(20).std()

pos = pd.Series(0.0, index=spread.index)         # +1 = long the spread, -1 = short it
for t in range(250, len(spread)):                # trade the last 250 days
    prev = pos[t - 1]
    if prev == 0 and z[t] > 2:
        pos[t] = -1                              # spread rich: sell A, buy B
    elif prev == 0 and z[t] < -2:
        pos[t] = 1                               # spread cheap: buy A, sell B
    elif prev != 0 and abs(z[t]) < 0.5:
        pos[t] = 0                               # gap has closed: exit
    else:
        pos[t] = prev

pnl = pos.shift(1) * spread.diff()               # yesterday's position earns today's move
print(f"hedge ratio {ratio:.3f}")
print("trades entered:", int(((pos != 0) & (pos.shift(1) == 0)).sum()))
print(f"days in a trade: {int((pos != 0).sum())} of 250")
print(f"profit per spread unit: {pnl.sum():.2f}")
```

```
hedge ratio 1.362
trades entered: 11
days in a trade: 90 of 250
profit per spread unit: 9.39
```

The `shift(1)` matters. A position decided at today's close earns only tomorrow's move.

Follow the second trade, on day 296:

1. The spread is 9.39, its 20-day mean is 7.57 and its standard deviation is 0.91. So z = (9.39 − 7.57) / 0.91 = 2.0.
2. You short 1 share of A at 42.74 and buy 1.362 shares of B at 24.49.
3. On day 302, z is 0.42. A is at 41.15 and B at 24.01. You exit both legs.
4. The short A leg gains 42.74 − 41.15 = 1.59. The long B leg loses 0.66. The net is 1.59 − 0.66 = 0.93.

Both stocks fell, and the trade still made money. A fell further than 1.362 times B's fall, and that difference is the gain.

> **Key idea:** A pairs trade sells the rich leg and buys the cheap leg when the spread's z-score is far from 0, and exits both legs when the z-score returns near 0.

The profit of 9.39 per spread unit is before any costs. Each trade pays the bid-ask spread and a commission on both legs, once to enter and once to exit.

## What you have now

A pairs trade joins the z-score of a cointegrated spread to short selling and the backtest loop. Every trade holds one short leg for days at a time. What does holding a short leg cost while you wait for the gap to close?
