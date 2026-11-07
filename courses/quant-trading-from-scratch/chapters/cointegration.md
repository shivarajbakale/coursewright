# Cointegration: two wandering prices with a stable gap

Stationarity showed that a single price behaves much like a random walk, so it has no level to return to. That rules out mean reversion on one price. But think of two companies that sell the same product in the same market. News that lifts one company's price often lifts the other's by a similar amount. Each price wanders, but could the gap between them stay put?

## A walker and a dog on a leash

Picture a person walking a dog through a park. The person drifts wherever they like. The dog runs off in random directions. Track either one alone and the path looks like a random walk. Yet the distance between them never grows past the leash. When the dog runs far ahead, the leash pulls it back.

The person stands for price B. The dog stands for price A. The distance between them stands for the gap between the two prices. The leash stands for whatever ties the two businesses together, such as the same costs and the same customers. The picture stops holding in one place: a leash is a fixed object. The tie between two companies can break, for example when one changes its business, and then the gap wanders too.

Two price series are **cointegrated** when each wanders on its own, but a combination of them is stationary. The combination is A − h × B, where h is the **hedge ratio**: the number of shares of B you pair with one share of A. The value of A − h × B on each day is the **spread** of the pair. This is a different spread from the bid-ask spread: here it means the gap between two stocks' prices.

## Testing a pair in two steps

The **Engle-Granger test** checks for cointegration in two steps:

1. Fit the best straight line through the points (price of B, price of A). Its slope is the hedge ratio h.
2. Build the spread A − h × B and run the ADF test on it.

Step 1 has a catch. It chooses h to make the spread as calm as possible on this data. Because of this, a plain ADF test on that spread finds a pull too easily. The Engle-Granger test uses stricter thresholds to make up for the choice. `statsmodels` does both steps in `coint`.

```inkling
title "The Engle-Granger test"
layout down
prices: box "Price A and\nprice B"
fit: box "Fit a straight line:\nslope is the hedge ratio"
spread: box "Spread:\nA minus h times B"
adf: box "ADF test with\nstricter thresholds"
small: diamond "p-value\nbelow 0.05?"
yes: round "Cointegrated" green
no: round "No evidence" gray
prices -> fit -> spread -> adf -> small
small -> yes : "yes"
small -> no : "no"
circle yes
step 1: prices "Each price wanders on its own"
step 2: fit "The slope of the best line gives the hedge ratio"
step 3: spread "The hedge ratio turns two prices into one spread"
step 4: adf, small "Test the spread, allowing for the fitted ratio"
step 5: yes, no "A small p-value means the gap is stable"
```

The code below builds an illustrative pair. Price B wanders. Price A is 5 + 1.5 × B plus a gap that keeps 90% of itself each day. A third price C wanders with no tie to A.

```python
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller, coint

rng = np.random.default_rng(5)
n = 500
b = pd.Series(30 + rng.normal(0, 0.5, n).cumsum())   # price B wanders
gap = np.zeros(n)
for t in range(1, n):                                 # a gap pulled back to 0
    gap[t] = 0.9 * gap[t - 1] + rng.normal(0, 0.5)
a = 5 + 1.5 * b + gap                                 # price A follows B
c = pd.Series(30 + rng.normal(0, 0.5, n).cumsum())   # price C: unrelated

print("A alone:", round(adfuller(a)[1], 3), " B alone:", round(adfuller(b)[1], 3))
ratio, level = np.polyfit(b, a, 1)                    # best straight line: A = level + ratio * B
spread = a - ratio * b
print("hedge ratio:", round(ratio, 3))
print("spread, adfuller:", round(adfuller(spread)[1], 4))
print("A and B, coint:", round(coint(a, b)[1], 4))
print("A and C, coint:", round(coint(a, c)[1], 4))
```

```
A alone: 0.318  B alone: 0.451
hedge ratio: 1.515
spread, adfuller: 0.0005
A and B, coint: 0.0026
A and C, coint: 0.6172
```

Read it line by line:

1. A and B alone give p-values of 0.318 and 0.451. Neither price is stationary.
2. The fitted hedge ratio is 1.515, close to the true 1.5. Noise moves it a little.
3. The plain ADF test on the spread gives 0.0005. `coint` gives 0.0026, larger, because it allows for the fitted ratio. Trust the `coint` number.
4. A and C give 0.6172. There is no evidence of a stable gap.

> **Key idea:** Two prices are cointegrated when each wanders but the spread A − h × B is stationary; the Engle-Granger test fits h, then tests the spread.

One warning from multiple testing applies here. Test 100 unrelated pairs at the 0.05 threshold, and about 100 × 0.05 = 5 pass by luck alone. A pair needs a business reason to be tied, not only a small p-value.

## What you have now

Cointegration joins stationarity to a pair of prices: the hedge ratio turns two wandering prices into one spread that returns to its mean. Knowing the gap closes is not enough to plan a trade, though. How long does it take?
