# Pricing by replication: copying an option's payoff with stock and cash

A call's price could depend on how likely the stock is to rise. People disagree on that, and you cannot measure it. Is there a price for the call that does not need anyone's forecast?

## Copy the payoff, and the price follows

Think of a cook who copies a famous dish from shop-bought parts. If the copy tastes the same, the dish cannot cost more than the parts. Otherwise people buy the parts. Here the dish stands for the option, and the parts stand for shares and borrowed cash. The picture stops holding on one point. A cook's copy is close, but this copy pays exactly the same in every outcome.

## One step, two outcomes

Take the stock at $100 and a call with a strike of $100 that expires in one year. The risk-free rate is 5%. Use a toy model: in one year the stock is either $120 or $80, nothing else. The call then pays $20 or $0.

Build a mix of shares and a loan that pays the same:

1. The stock range is 120 − 80 = 40 dollars. The call's payoff range is 20 − 0 = 20 dollars.
2. Hold 20 / 40 = 0.5 shares. Their value then moves by the same $20 as the call.
3. The 0.5 shares are worth 0.5 × 80 = 40 in the down case, but the call pays 0. So borrow cash that you must repay as $40 at expiry.
4. The present value of $40 is 40 × 0.9512 = 38.05. That is the amount you borrow today.

Check both outcomes. Up: 0.5 × 120 − 40 = 20. Down: 0.5 × 80 − 40 = 0. The mix pays exactly what the call pays.

So the call must cost what the mix costs today: 0.5 × 100 − 38.05 = 11.95. If the call cost more, you could sell it and buy the mix, and you would keep the difference with no risk. That would be an arbitrage, as you saw with put-call parity.

```inkling
title "Copying the call in one step"
layout right
today: box "Today: stock $100"
up: box "Up: stock $120\ncall pays $20" green
down: box "Down: stock $80\ncall pays $0" pink
mix: sticky "0.5 shares\nminus $38.05 loan"
price: circle "Call costs $11.95"
today -> up : "up"
today -> down : "down"
mix -> today : "copies the call"
mix -> price
step 1: today, up, down "In one year the stock is $120 or $80"
step 2: mix "Shares and a loan pay the same as the call"
step 3: price "So the call costs what the mix costs"
```

Notice what you never used: the chance that the stock goes up. The copy works whether that chance is 10% or 90%.

## The probability the price implies

There is a second way to get $11.95. Find the chance of "up" that makes the stock's expected price grow at the risk-free rate. Call it q:

1. Today's $100 grown at 5% is 100 × 1.0513 = 105.13, the futures price you saw before.
2. Solve q × 120 + (1 − q) × 80 = 105.13. This gives q = (105.13 − 80) / 40 = 0.628.
3. The call's expected payoff with this q is 0.628 × 20 = 12.56. Its present value is 0.9512 × 12.56 = 11.95.

This q is the **risk-neutral probability**. It is not a forecast. It is the weight that makes "expected payoff, discounted at the risk-free rate" give the replication price.

## From one step to many

Two outcomes are a crude model. Split the year into many small steps, each up or down, sized for a volatility of 20%. Price backwards one step at a time with q:

```python
import numpy as np

def tree_call(S, K, T, r, sigma, steps):
    dt = T / steps
    u, d = np.exp(sigma * np.sqrt(dt)), np.exp(-sigma * np.sqrt(dt))
    q = (np.exp(r * dt) - d) / (u - d)           # risk-neutral chance of "up"
    ups = np.arange(steps, -1, -1)
    value = np.maximum(S * u**ups * d**(steps - ups) - K, 0)  # payoffs at expiry
    for _ in range(steps):                       # step back one period at a time
        value = np.exp(-r * dt) * (q * value[:-1] + (1 - q) * value[1:])
    return value[0]

for n in (1, 10, 100, 1000):
    print(n, round(tree_call(100, 100, 1, 0.05, 0.20, n), 4))
```

```
1 12.1623
10 10.2534
100 10.4306
1000 10.4486
```

With 1,000 steps the price settles near $10.45, the call premium you met with option payoffs.

> **Key idea:** If a mix of shares and borrowed cash pays exactly what an option pays in every outcome, the option must cost what the mix costs, whatever anyone forecasts.

## What you have now

Replication prices an option from the stock price, the rate and the size of the moves. With many small steps, the stock's log return becomes a bell, as you saw with the normal distribution. Is there a single formula for the limit of infinitely many steps?
