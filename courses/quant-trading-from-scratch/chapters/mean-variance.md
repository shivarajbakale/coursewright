# Mean-variance optimisation: choosing weights for the best return per risk

You could now hold 3 kinds of position: the market, a momentum factor portfolio, and a second factor. Each has an expected return and a volatility. Their returns are correlated by different amounts. Should you put everything into the one with the best Sharpe ratio, split the money equally, or do something smarter?

## Two walkers on a rough path

Picture two people walking side by side on a rough path, tied together by a rope. Each one stumbles left and right. If they stumble at random times, one often pulls left while the other pulls right. The rope's middle point then wobbles less than either walker. If they always stumble the same way at once, the middle wobbles as much as they do.

Each walker stands for an asset. Their stumbles stand for daily returns, and the rope's middle stands for a portfolio of the two. How often they stumble together stands for correlation. The picture stops holding in one place: walkers do not earn a return. The real question is how to trade wobble against return.

## Two assets, worked through

Asset A has an expected excess return of 6% a year and a volatility of 20%. Asset B has 4% and 10%. Their correlation is 0.2. All numbers are illustrative.

The risk of a mix needs every variance and covariance in one table. Work them out first.

1. The variance of A is 0.20 × 0.20 = 0.04, and the variance of B is 0.10 × 0.10 = 0.01.
2. The covariance is the correlation times both volatilities: 0.2 × 0.20 × 0.10 = 0.004.
3. Half in each gives a variance of 0.25 × 0.04 + 0.25 × 0.01 + 2 × 0.25 × 0.004 = 0.0145. The volatility is its square root, 12.04%.

The average of the two volatilities is 15%, but the mix has only 12.04%. The difference comes from the correlation of 0.2. Because the two assets often move apart, part of their swings cancel.

```python
import numpy as np
mu = np.array([0.06, 0.04])          # expected excess return a year
vol = np.array([0.20, 0.10])         # volatility a year
corr = 0.2
cov = np.array([[vol[0]**2, corr * vol[0] * vol[1]],
                [corr * vol[0] * vol[1], vol[1]**2]])

def report(name, w):
    ret, risk = w @ mu, np.sqrt(w @ cov @ w)
    print(f"{name}: weights {w.round(2)}, return {ret:.2%}, vol {risk:.2%}, Sharpe {ret / risk:.2f}")

report("all in A ", np.array([1.0, 0.0]))
report("all in B ", np.array([0.0, 1.0]))
report("half each", np.array([0.5, 0.5]))
raw = np.linalg.solve(cov, mu)       # best direction: inverse covariance times returns
report("optimised", raw / raw.sum())
```

```
all in A : weights [1. 0.], return 6.00%, vol 20.00%, Sharpe 0.30
all in B : weights [0. 1.], return 4.00%, vol 10.00%, Sharpe 0.40
half each: weights [0.5 0.5], return 5.00%, vol 12.04%, Sharpe 0.42
optimised: weights [0.24 0.76], return 4.49%, vol 9.79%, Sharpe 0.46
```

The last line uses a standard result that this lesson does not derive. The weights with the best Sharpe ratio are proportional to `np.linalg.solve(cov, mu)`. Dividing by their sum makes them add to 1. The result puts 24% in A and 76% in B, and its Sharpe ratio of 0.46 beats every other row.

The optimised mix earns less than half each: 4.49% against 5.00%. But it earns more per unit of risk. Leverage closes the gap. Scaled up 1.23 times to a volatility of 12.04%, the optimised mix earns 5.52%, more than half each at the same risk. These are excess returns, so the cost of the borrowed money is already taken out.

```inkling
title "Three ways to split the money"
layout compare
columns "All in B", "Half each", "Optimised"
row "Return": "4.00%", "5.00%", "4.49%"
row "Volatility": "10.00%", "12.04%", "9.79%"
row "Sharpe ratio": "0.40", "0.42", "0.46"!
step 1: return "Each choice earns a different return"
step 2: volatility "Mixing lowers the swings below the average"
step 3: sharpe-ratio "The optimised weights earn the most per unit of risk"
```

## Naming it

**Diversification** is holding assets that do not move together perfectly, so part of their swings cancel. A portfolio's volatility is below the weighted average of its parts whenever the correlation is below 1. A **covariance matrix** is the square table of every asset's variance on the diagonal and every pair's covariance off it. **Mean-variance optimisation** combines expected returns, the means, with the covariance matrix to choose the weights with the best Sharpe ratio.

> **Key idea:** Mean-variance optimisation uses expected returns and the covariance matrix to find the weights with the highest return per unit of volatility.

## What you have now

You can combine assets so the mix earns more per unit of risk than any one of them. But the optimiser trusts its inputs completely. Expected returns are guesses estimated from noisy history. What happens to the weights when those guesses are a little wrong?
