# Volatility targeting: sizing so risk stays steady

Fractional Kelly gave you a stake from one estimate of the edge and one number for volatility. But volatility is not one number. An asset can swing 10% a year in a calm year and 40% in a stormy one. With a fixed position, your risk is four times larger in the stormy year. How do you keep the risk you carry steady when the market's risk keeps changing?

## Turn the size down when the road gets rough

Picture driving at a steady level of danger rather than a steady speed. On a dry, empty road you drive faster. In fog you slow down. The speed stands for the size of your position. The road conditions stand for the asset's recent volatility. The level of danger you accept stands for the volatility you want your strategy to have. The picture stops holding in one place. You see fog before you drive into it, but you see a jump in volatility only after it starts.

The rule is one division. You pick a target volatility for the strategy, for example 10% a year. Each day you estimate the asset's recent volatility. You then hold a weight, the position's value as a share of equity, equal to target ÷ estimate.

1. The asset's recent volatility is 20%. The weight is 0.10 / 0.20 = 0.5, so you hold half your equity in it.
2. Volatility rises to 40%. The weight is 0.10 / 0.40 = 0.25.
3. Volatility falls to 8%. The weight is 0.10 / 0.08 = 1.25. On an account of 100,000 you hold 125,000 of the asset.

Step 3 needs money you do not have. Leverage is the total value of your positions divided by your equity. A weight of 1.25 is a leverage of 1.25, and the extra 25,000 is borrowed. Borrowed money also makes losses larger, so you cap the weight, for example at 2.

```inkling
title "Each day, size by recent risk"
layout cycle
center "keep risk near 10%"
measure: circle "Measure recent\nvolatility"
size: circle "Weight =\ntarget ÷ estimate"
hold: circle "Hold that\nposition"
earn: circle "Earn the\nday's return"
cycle measure, size, hold, earn
step 1: measure "Estimate volatility from the last 20 days"
step 2: size "Divide the target by that estimate"
step 3: hold "Trade to that weight, capped at 2"
step 4: earn "The new day's return joins the window"
```

## The rule in code

The code below makes an illustrative asset with one calm year at 10% volatility and one stormy year at 40%. It estimates volatility from a rolling window of 20 days, annualised. It shifts the weight by one day, because today's weight may use only data known yesterday. Without the shift you would have look-ahead bias.

```python
import numpy as np, pandas as pd

rng = np.random.default_rng(7)
daily_vol = np.r_[np.full(250, 0.10), np.full(250, 0.40)] / np.sqrt(252)
returns = pd.Series(rng.normal(0.0003, daily_vol))      # a calm year, then a stormy year

target = 0.10                                            # 10% a year
est_vol = returns.rolling(20).std() * np.sqrt(252)       # recent volatility, annualised
weight = (target / est_vol).clip(upper=2.0).shift(1)     # decide with yesterday's data only
scaled = weight * returns

for name, part in [("calm", slice(20, 250)), ("stormy", slice(270, 500))]:
    raw_vol = returns[part].std() * np.sqrt(252)
    new_vol = scaled[part].std() * np.sqrt(252)
    print(f"{name:6} unscaled {raw_vol:.1%}  scaled {new_vol:.1%}  average weight {weight[part].mean():.2f}")
```

```
calm   unscaled 9.2%  scaled 10.9%  average weight 1.14
stormy unscaled 38.6%  scaled 10.7%  average weight 0.27
```

Without scaling, the volatility jumped from 9.2% to 38.6%. With scaling, both years ran close to the 10% target. The weight did the work: about 1.14 in the calm year and 0.27 in the stormy one.

The rule reacts late. In the first 20 stormy days the scaled volatility was 29.2%, because the window still held calm days. A sudden crash arrives before any estimate can see it.

## The name

Volatility targeting sizes each position as a target volatility divided by a recent estimate of the asset's volatility. The Kelly formula points the same way: a larger variance s² gives a smaller f.

> **Key idea:** Volatility targeting holds a weight of target ÷ recent volatility, so the strategy's risk stays near a chosen level as the market calms and storms.

## What you have now

Your sizing now has three parts. Fractional Kelly sets how much edge you trust, volatility targeting sets the size from the swings, and a cap limits leverage. All three rely on estimates, and the last example showed an estimate lagging a sudden change by days. What stops one bad day, or one bug, from doing damage that no estimate saw coming?
