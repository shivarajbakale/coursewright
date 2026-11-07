# Implied volatility: the volatility the market price implies

The Black-Scholes formula needs a volatility, and nobody can observe the future one. But options trade on exchanges, so their prices are known. Say the one-year call with strike $100 trades at $12.00, not $10.45. What volatility would make the formula give $12.00?

## Running the formula backwards

Think of a taxi fare. The fare depends on distance, and the meter turns distance into money. If you know only the fare and the meter's rate, you can work out the distance. The fare stands for the option price, the meter for the formula, and the distance for volatility. The picture stops holding on one point. A taxi has one route, but traders disagree about future volatility. The price shows only the volatility at which buyers and sellers met.

Four of the five inputs are known: S = 100, K = 100, T = 1 and r = 5%. A higher volatility always gives a higher option price, as you saw with the formula. Because of this, exactly one volatility gives each price. You can find it by search:

1. Try 20%. The formula gives $10.45, below $12.00, so the answer is higher.
2. Try 30%. The formula gives $14.23, above $12.00, so the answer is lower.
3. Try the middle, 25%. The formula gives $12.34, too high. The answer lies between 20% and 25%.
4. Keep halving the range until the price matches to the cent.

```inkling
title "Two directions through one formula"
layout right
vol: box "Volatility"
formula: round "Black-Scholes"
price: box "Option price"
solver: diamond "Search"
iv: box "Implied volatility" yellow
vol -> formula -> price
price --> solver : "market price $12.00"
solver --> iv : "24.11%"
circle iv
step 1: vol, formula, price "Forwards: a volatility gives a price"
step 2: solver "Backwards: search for the volatility that fits"
step 3: iv "The answer is the price's implied volatility"
```

The volatility that makes the formula match a market price is the **implied volatility**. Traders often quote options by implied volatility instead of price. A volatility can be compared across stocks, strikes and expiries, while a dollar price cannot.

## The search in Python

The function `brentq` from SciPy finds where a function crosses zero between two bounds. Here the function is "formula price minus market price":

```python
from scipy.optimize import brentq
from bs import black_scholes                   # the function from the formula lesson

def implied_vol(price, S, K, T, r, kind="call"):
    # find the sigma at which the formula gives the market price
    return brentq(lambda s: black_scholes(S, K, T, r, s, kind) - price, 0.001, 3.0)

print(round(implied_vol(10.45, 100, 100, 1, 0.05), 4))
print(round(implied_vol(14.23, 100, 100, 1, 0.05), 4))
print(round(implied_vol(12.00, 100, 100, 1, 0.05), 4))
```

```
0.2
0.3
0.2411
```

The first two lines recover the volatilities that made those prices. The third says a price of $12.00 implies a volatility of 24.11%.

## How price and volatility trade off

How much does the price move per point of volatility? That rate is **vega**, the Greek for volatility. It is the change in option value for a change of 1 in σ. For the call at the running example, vega is S × n(d1) × √T, where n is the normal density. This is 100 × 0.3752 × 1 = 37.52. Per percentage point of volatility it is $0.375.

So a quick estimate needs no search. The price is 12.00 − 10.45 = 1.55 dollars above the 20% price. Divide by vega: 1.55 / 0.375 = 4.13 points. The estimate 20% + 4.13 points gives 24.13%, close to the exact 24.11%. The estimate is a little off because vega itself changes as volatility changes.

Implied volatility is an estimate from prices, not a measurement. It mixes what traders expect with what they charge for carrying the risk of the option.

> **Key idea:** Implied volatility is the volatility that makes the Black-Scholes formula give an option's market price, found by solving the formula backwards.

## What you have now

You can turn any option price into one number, its implied volatility. If the formula's assumptions held, every option on the same stock would show the same implied volatility. Do the options at strikes far below and far above $100 agree with the one at $100?
