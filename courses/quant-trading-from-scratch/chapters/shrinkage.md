# Shrinkage: pulling noisy estimates toward a simple guess

Mean-variance optimisation trusts its inputs completely. But expected returns come from history, and history is noisy. As you saw with overfitting, a method that fits noise looks good on past data and fails on new data. How badly does the optimiser react to a small error in its inputs, and what can you do about it?

## Two reviews of a new restaurant

A new restaurant has 2 online reviews, both 5 stars. Restaurants in your town average 3.8 stars. Do you believe this one is a 5-star place? Most people would guess somewhere between 3.8 and 5. Two reviews are too few to trust, so you pull the guess toward the town's average. With 500 reviews, you would pull much less.

The 5-star average stands for an estimate from history. The town's average stands for a simple guess that needs no estimate of this one asset. How far you pull stands for how much you distrust the estimate. The picture stops holding in one place. You can count the reviews, but an investor has no exact count of how noisy a return estimate is. The size of the pull must itself be chosen or estimated.

## Two assets that move together

Take two assets, both with 20% volatility a year and a correlation of 0.9. From 5 years of history, you estimate their expected returns as 6% and 5%. The standard error of a mean is the volatility divided by the square root of the number of years. That is 20% / 2.236 = 8.9%. So the 1% gap between the two estimates is far smaller than the error of each one.

```python
import numpy as np
vol, corr = 0.20, 0.9
cov = vol**2 * np.array([[1, corr], [corr, 1]])

def weights(mu):
    raw = np.linalg.solve(cov, mu)
    return raw / raw.sum()

estimate = np.array([0.06, 0.05])            # noisy estimates from history
target = np.full(2, estimate.mean())         # simple guess: both the same
for k in (0.0, 0.5, 0.8, 1.0):               # how far to pull toward the target
    mu = (1 - k) * estimate + k * target
    print(f"pull {k:.1f}: returns {mu.round(4)}, weights {weights(mu).round(2)}")
print("swapped:", weights(np.array([0.05, 0.06])).round(2))
```

```
pull 0.0: returns [0.06 0.05], weights [ 1.36 -0.36]
pull 0.5: returns [0.0575 0.0525], weights [0.93 0.07]
pull 0.8: returns [0.056 0.054], weights [0.67 0.33]
pull 1.0: returns [0.055 0.055], weights [0.5 0.5]
swapped: [-0.36  1.36]
```

Walk through it:

1. With no pull, the optimiser puts 136% long in the first asset and 36% short in the second. A gap of 1%, smaller than the noise, drives a large bet.
2. Swap the two estimates and the weights swap too: -36% and 136%. Noise of 1% flips the whole portfolio.
3. The target is the average of the estimates, 5.5% for both. A pull of 0.5 moves each estimate halfway there: 0.5 × 6% + 0.5 × 5.5% = 5.75%.
4. As the pull grows, the weights move toward 50% each. At a pull of 1, the gap is gone and the weights are equal.

```inkling
title "Shrinking an estimate"
layout down
est: box "Estimate from history"
target: box "Simple target"
blend: diamond "Blend by the pull"
out: box "Shrunk estimate"
w: box "Steadier weights" green
est -> blend
target -> blend
blend -> out -> w
circle blend
step 1: est "Start from the noisy estimate"
step 2: target "Choose a guess that needs no estimate"
step 3: blend "Move part of the way toward it"
step 4: out "The gap between assets gets smaller"
step 5: w "The optimiser stops making large bets on noise"
```

The covariance matrix is estimated too, and it can be shrunk the same way. Here, pulling the correlation of 0.9 halfway toward a target of 0.5 gives 0.7. With the original 6% and 5% estimates, the weights become 76% and 24%, with no short at all. A high correlation makes the optimiser treat the two assets as near copies. Because of this, it bets on any gap between them.

## Naming it

**Shrinkage** replaces a noisy estimate with a blend: (1 - k) × the estimate + k × a simple target. The **shrinkage target** is the simple guess, such as the same return for every asset. The **pull**, k, between 0 and 1, says how far to move. Ledoit and Wolf (2004) published a rule that picks the pull for a covariance matrix from the data itself. For returns, a pull chosen by walk-forward testing keeps the choice honest.

Shrinkage adds a small, known error, the pull toward the target. In return it removes a large, unknown one, the noise. The trade pays most when the history is short, such as the 5 years here, because then the noise is largest.

> **Key idea:** Shrinkage pulls noisy estimates part of the way toward a simple target, so the optimiser stops betting heavily on differences smaller than the noise.

## What you have now

You can build a factor, combine it with others by mean-variance optimisation, and keep the weights steady by shrinking the inputs. This completes a portfolio of stocks ranked against each other. Every asset so far has been something you own outright, such as a share. Could you instead agree today on the price of a trade that happens months later?
