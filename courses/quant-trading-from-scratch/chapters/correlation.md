# Correlation: covariance scaled to between -1 and 1

Covariance told you that stocks A and B move together: their covariance was 2.6. Is 2.6 a lot? You cannot tell. A pair of wild stocks gets a big covariance even if they agree only loosely. A pair of calm stocks gets a small one even if they agree on every day. You need a version of covariance that ignores how much each stock swings.

## Divide out the swing

Picture two people rating films. One gives scores from 1 to 10. The other gives scores from 1 to 100. To see whether they agree, you first put both on the same scale. Then you compare.

Here each person stands for one stock. Their score scale stands for the stock's volatility, the typical size of its daily move. Putting both on one scale stands for dividing each stock's deviations by its own standard deviation. The picture stops holding in one place: film scores have a fixed top, but returns do not. You measure the scale from the data, so a short sample gives a rough scale.

The recipe has one step on top of covariance. Divide the covariance by the volatility of A and by the volatility of B:

correlation = covariance(A, B) / (volatility of A × volatility of B)

Both volatilities carry the same unit as the returns. Because of this, the units cancel and correlation has no unit at all. It always lands between −1 and 1:

- 1 means the two move in perfect step, every day, by the same scaled amount.
- 0 means no straight-line link between the two.
- −1 means they move in perfect opposite step.

```inkling
title "Covariance versus correlation"
layout compare
columns "Covariance", "Correlation"
row "Unit": "percent squared", "none"
row "Possible values": "any number", "from -1 to 1"
row "B twice as wild": "doubles to 5.2", "stays 0.96"!
row "Compare across pairs": no, yes
step 1: unit "Correlation divides the units away"
step 2: possible-values "So its size sits on a fixed scale"
step 3: b-twice-as-wild "A wilder stock changes covariance, not correlation"
step 4: compare-across-pairs "That is why you can rank pairs by it"
```

## The five days again

Use the same five days of returns from covariance. The covariance of A and B is 2.6. The standard deviation of A is 2.0736% and of B is 1.3038%. So:

2.6 / (2.0736 × 1.3038) = 2.6 / 2.7036 = 0.9617

A correlation of about 0.96 is close to 1. The two stocks move in nearly perfect step.

Now make a third stock D that moves exactly like B, but twice as far each day. Its covariance with A doubles. Its correlation with A stays the same.

```python
import pandas as pd

r = pd.DataFrame({"A": [2.0, -1.0, 3.0, -2.0, 1.0],
                  "B": [1.0, -1.0, 2.0, -1.0, 0.0]})  # daily returns in %
r["D"] = 2 * r["B"]                                    # like B, twice as far

print(r["A"].cov(r["B"]), r["A"].cov(r["D"]))              # 2.6 5.2
print(round(r["A"].corr(r["B"]), 2), round(r["A"].corr(r["D"]), 2))  # 0.96 0.96
print(r.corr().round(2))                               # every pair at once
```

D's volatility is twice B's volatility. The covariance doubles too. Because the division includes both, the two factors of 2 cancel. The correlation of B and D is exactly 1, because D is B times 2.

> **Key idea:** Correlation is covariance divided by both series' volatilities, so it has no unit and always lies between −1 and 1.

Two cautions:

1. Five days is far too few to trust 0.96. With more days, the estimate moves less.
2. A correlation near 1 says the daily returns agree. It does not say the prices stay close. In one simulated year of 252 trading days, stock Y earned stock X's return plus 0.1% each day, plus small noise. Their correlation was 0.98. Yet X ended the year 23% down and Y ended 0.2% up.

## What you have now

Correlation is covariance with each stock's volatility divided out, so you can compare a calm pair with a wild pair. But it describes daily moves, not whether the gap between two prices stays put. What does it mean for a series to keep coming back to the same level?
