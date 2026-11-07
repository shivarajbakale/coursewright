# Delta hedging: holding stock to cancel an option's price risk

Say you sell the call for $10.45. If the stock jumps to $130, you owe $30 at expiry and lose $19.55. You do not want to bet on the stock. Delta says the call moves like 0.6368 shares. Can you hold shares to cancel the call's price risk?

## Cancel the move, then keep it cancelled

Think of carrying a full cup of coffee across a moving train. Each time the train sways, you tilt your hand the other way. The sway stands for a stock move, and your tilt stands for the shares you hold. The picture stops holding in one way. A tilt is free and constant, but a share trade costs money and happens at fixed times.

Holding delta shares against an option is delta hedging. After you sell the call, you buy 0.6368 shares for $63.68. You pay with the $10.45 premium and borrow the other $53.23. A $1 rise now gains $0.64 on the shares and loses about $0.64 on the call.

As you saw with delta, delta changes when the stock moves. At $101 the call's delta is 0.6553, not 0.6368. The rate at which delta changes per $1 of stock is **gamma**. At $100, gamma is 0.0188. Because delta drifts, you must reset the number of shares at fixed times. This reset is **rebalancing**:

```inkling
title "The hedging loop"
layout cycle
center "every day"
measure: circle "Work out delta"
trade: circle "Buy or sell shares"
move: circle "Stock moves"
gap: circle "Small gain or loss"
cycle measure, trade, move, gap
step 1: measure "Price the call and read its delta"
step 2: trade "Trade until you hold delta shares"
step 3: move "Over the day, the stock moves"
step 4: gap "The hedge cancels most of the move, not all"
```

## One day of the hedge

Two effects remain after the hedge.

1. A quiet day earns money. If the stock does not move, the call loses $0.0255 of value in one day. You owe it, so that is your gain. Interest on the $53.23 loan costs $0.0106. Your net gain is 0.0255 − 0.0106 = 0.0149.
2. A move of x dollars costs money in either direction. Your loss is about half of gamma times x squared. For a $2 move, 0.5 × 0.0188 × 2^2 = 0.0376.

The two effects cancel when 0.5 × 0.0188 × 1.26^2 = 0.0149, a move of $1.26. Now compare that with the volatility of 20% used to price the call. A typical daily move is 100 × 0.20 / 15.87 = 1.26 dollars, because √252 is 15.87. That match is no accident. The price at 20% is the price at which the hedge breaks even if the stock moves at 20%.

If the stock moves at 30% instead, the typical day is $1.89. The cost becomes 0.5 × 0.0188 × 1.89^2 = 0.0336, larger than the daily gain of $0.0149. You lose a little almost every day.

## A full year, 2,000 times

The code below sells the call priced at 20%, rebalances daily for 252 days, and closes out at expiry. It runs 2,000 random paths per true volatility.

```python
import numpy as np
from bs import black_scholes, delta              # functions from the last two lessons

def hedged_short_call(true_vol, seed, S=100.0, K=100.0, T=1.0, r=0.05, vol=0.20, days=252):
    rng = np.random.default_rng(seed)
    dt = T / days
    cash = black_scholes(S, K, T, r, vol)        # premium received for the call
    shares = 0.0
    for day in range(days):
        target = delta(S, K, T - day * dt, r, vol)
        cash -= (target - shares) * S            # rebalance: buy or sell shares
        shares = target
        cash *= np.exp(r * dt)                   # interest on cash for one day
        S *= np.exp((r - true_vol**2 / 2) * dt + true_vol * np.sqrt(dt) * rng.standard_normal())
    return cash + shares * S - max(S - K, 0)     # close out at expiry

if __name__ == "__main__":
    for true_vol in (0.20, 0.30):
        pnl = np.array([hedged_short_call(true_vol, seed) for seed in range(2000)])
        print(f"stock moves at {true_vol:.0%}: mean {pnl.mean():.2f}, sd {pnl.std():.2f}")
```

```
stock moves at 20%: mean -0.00, sd 0.43
stock moves at 30%: mean -3.97, sd 1.96
```

1. When the stock moves at 20%, the profit averages $0.00, with a standard deviation of only $0.43.
2. When the stock moves at 30%, you lose $3.97 on average. The call at 30% is worth $14.23. So (14.23 − 10.45) × 1.0513 = 3.97, the price gap grown to expiry at 5%.

The hedge removed the bet on the direction of the stock. What is left is a bet on how much the stock moves.

> **Key idea:** Delta hedging holds delta shares against an option and rebalances them, so the profit depends on how much the stock actually moves compared with the volatility used to price the option.

## What you have now

A hedged option seller wins when the stock moves less than the volatility in the price, and loses when it moves more. So the volatility inside a price matters a great deal. Options trade at market prices, not at your chosen 20%. What volatility does a market price contain?
