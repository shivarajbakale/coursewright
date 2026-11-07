# The volatility risk premium: options usually cost more than they pay

An option's implied volatility is a price. A year later you can measure how much the stock really moved. As you saw with delta hedging, a hedged option seller wins when the stock moves less than the price assumed. So which is larger on average: the volatility in the price, or the volatility that follows?

## Measuring what happened

The **realised volatility** of a period is the standard deviation of its daily log returns, annualised. You compute it after the fact, as you saw with volatility and annualising. Implied volatility looks forward, and realised volatility looks back. Even a stock that truly moves at 16% shows a different number in one year, because one year is a small sample:

```python
import numpy as np
from hedge import hedged_short_call            # from the delta hedging lesson, saved in hedge.py

# realised volatility of one simulated year whose true volatility is 16%
rng = np.random.default_rng(1)
log_returns = 0.16 / np.sqrt(252) * rng.standard_normal(252)
print("realised:", round(log_returns.std() * np.sqrt(252), 4))

# sell a straddle priced at 20% implied volatility and delta hedge it daily.
# By put-call parity a hedged put earns the same as a hedged call, so double it.
for true_vol in (0.16, 0.40):
    pnl = np.array([2 * hedged_short_call(true_vol, seed) for seed in range(1000)])
    print(f"stock moves at {true_vol:.0%}: mean {pnl.mean():.2f}, worst {pnl.min():.2f}")
```

```
realised: 0.1465
stock moves at 16%: mean 3.09, worst 0.50
stock moves at 40%: mean -15.63, worst -45.54
```

The first line shows that one year at a true 16% gave a realised volatility of 14.65%.

## Selling insurance that is priced high

Think of a home insurer. It charges each year more than the average claim, and it keeps the difference. In return it must pay out in a disaster year. The premium stands for the option price, the claims stand for the option payoffs, and the disaster stands for a crash. The picture stops holding on one point. An insurer spreads risk across many houses, but a crash hits every stock option at once.

Studies of US stock index options, such as the work of Peter Carr and Liuren Wu in 2009, found a pattern. Implied volatility was above the realised volatility that followed in most periods. This gap is the **volatility risk premium**. It is a risk premium, as you saw with a trading edge. Option buyers pay it for protection, and option sellers earn it for carrying crash risk.

A common way to sell volatility is a short **straddle**. A straddle is a call and a put with the same strike and expiry. At strike $100 it costs 10.45 + 5.57 = 16.02. It pays the distance between the stock and $100 at expiry, in either direction. A seller who delta hedges it bets only on how much the stock moves.

## Good years and a bad one

Read the last two output lines. The straddle is priced at an implied volatility of 20%:

1. When the stock moves at 16%, the hedged seller earns $3.09 on average. The worst of 1,000 years still earns $0.50.
2. When the stock moves at 40%, as in a crash year, the seller loses $15.63 on average, and up to $45.54.

Now picture 10 illustrative years: 9 quiet years and 1 crash year. The quiet years earn 9 × 3.09 = 27.81. The crash year takes 15.63 of it back. The total is 27.81 − 15.63 = 12.18, or about $1.22 a year. One bad year erases about five good ones.

```inkling
title "Selling volatility year by year"
layout stack
- Crash year: lose $15.63
- Nine quiet years: earn $27.81
- Ten years in all: earn $12.18
brace crash-year-lose-15-63..nine-quiet-years-earn-27-81 "the same seller"
step 1: nine-quiet-years-earn-27-81 "Most years the seller collects the premium"
step 2: crash-year-lose-15-63 "One crash takes much of it back"
step 3: ten-years-in-all-earn-12-18 "What is left is the volatility risk premium"
```

That shape decides how you size the trade. A seller with too much leverage can lose all their money in the crash year and never see the quiet years after it. So the sizing, risk limits and stress tests from earlier lessons matter most here.

> **Key idea:** The volatility risk premium is the gap by which implied volatility has exceeded later realised volatility, earned by option sellers in exchange for large losses in crashes.

## What you have now

You can now price an option, hedge it, read its implied volatility and compare that with realised volatility. A hedged option is a bet on volatility, and selling one earns a premium in return for crash risk. The same research habits apply here: test the trade out of sample, and count its costs.
