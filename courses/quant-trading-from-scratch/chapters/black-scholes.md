# The Black-Scholes formula: an option price from five inputs

A tree with 1,000 steps priced the call at about $10.45. Each step copied the option with shares and cash. As the steps get smaller, the stock's log return becomes a bell shape. Is there one formula for that limit, so you need no tree at all?

## The limit of the tree

In 1973, Fischer Black and Myron Scholes published that formula, and Robert Merton published the same result the same year. It prices a European option from five inputs:

1. S, the stock price today.
2. K, the strike.
3. T, the time to expiry in years.
4. r, the risk-free rate, with continuous interest.
5. σ (sigma), the volatility of the stock's log returns, per year.

Think of a recipe card for a cake. The five inputs are the ingredients, and the formula is the method. The same ingredients always give the same cake. The picture stops holding on one ingredient. You can weigh flour exactly, but nobody can observe the future volatility of a stock. The formula needs it anyway.

For a call, the formula is:

call = S × N(d1) − K × e^(−r × T) × N(d2)

Here N is the area under the standard normal curve to the left of a point, as you saw with the normal distribution. The two points are:

- d1 = (ln(S / K) + (r + σ² / 2) × T) / (σ × √T)
- d2 = d1 − σ × √T

Read the formula as replication. The first part, S × N(d1), is the value of the shares in the copy. The second part is the present value of the cash borrowed. N(d2) is the risk-neutral probability that the call ends above the strike.

```inkling
title "Five inputs, one price"
layout down
s: box "S: stock price $100"
k: box "K: strike $100"
t: box "T: 1 year"
r: box "r: 5% a year"
v: box "σ: 20% a year" yellow
f: round "Black-Scholes formula"
c: circle "Call: $10.45"
s -> f
k -> f
t -> f
r -> f
v -> f
f -> c
note v "the only input nobody can observe"
step 1: s, k, t "The contract and the stock give three inputs"
step 2: r "The risk-free rate gives the fourth"
step 3: v "Volatility is the fifth, and the hardest"
step 4: f, c "The formula turns them into one price"
```

## The running example by hand

Take S = 100, K = 100, T = 1, r = 5% and σ = 20%.

1. ln(100 / 100) is 0, because the stock is at the strike.
2. σ² / 2 is 0.2^2 / 2 = 0.02. So r + σ² / 2 is 0.05 + 0.02 = 0.07.
3. σ × √T is 0.2 × 1 = 0.2. So d1 is 0.07 / 0.2 = 0.35.
4. d2 is 0.35 − 0.2 = 0.15.
5. N(0.35) is 0.6368, and N(0.15) is 0.5596, from `norm.cdf`.
6. The call is 100 × 0.6368 − 95.12 × 0.5596 = 63.68 − 53.23 = 10.45.

The same steps in Python:

```python
import numpy as np
from scipy.stats import norm

def black_scholes(S, K, T, r, sigma, kind="call"):
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    if kind == "call":
        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

print(round(black_scholes(100, 100, 1, 0.05, 0.20), 2))         # call at 20% volatility
print(round(black_scholes(100, 100, 1, 0.05, 0.20, "put"), 2))  # put at 20% volatility
print(round(black_scholes(100, 100, 1, 0.05, 0.30), 2))         # call at 30% volatility
print(round(black_scholes(110, 100, 1, 0.05, 0.20), 2))         # call with the stock at 110
```

```
10.45
5.57
14.23
17.66
```

The put price, $5.57, agrees with put-call parity: 10.45 − 5.57 = 4.88 = 100 − 95.12. Raise the volatility from 20% to 30%, and the call rises from $10.45 to $14.23. A wider bell gives more chances of a large payoff. The loss is still capped at the premium. So more volatility makes both calls and puts cost more.

## What the formula assumes

The formula is exact only under its assumptions:

1. Log returns are normal, with a volatility that stays fixed until expiry.
2. You can trade shares and borrow cash at the rate r at any moment, with no costs.
3. The stock pays no dividend, and the option is exercised only at expiry.

Real markets break each of these. The formula is still the shared language of option traders, because it turns any price into a volatility and back.

> **Key idea:** The Black-Scholes formula prices a European option from the stock price, strike, time, rate and volatility, as the limit of copying the option with shares and cash.

## What you have now

You can price a call or a put from five inputs. The price changes when any input changes. The stock price changes every second. How much does the option's value move when the stock moves by $1?
