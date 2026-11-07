# The risk-free rate: what safe money earns while you wait

With a benchmark you can see whether a strategy beat buying and holding. But buying a share is itself a risk: its price can fall. There is a choice with almost no risk at all. Before you praise any gain, you should ask how much of it you could have had without taking risk.

## A savings account

Picture two uses for your savings. You can leave them in a bank account that pays 4% a year. Or you can lend them to a friend's new shop, who promises to pay you 7% a year. The shop pays 3 points more. Those 3 points are your payment for the chance that the shop fails. The 4% you would have earned anyway.

In this picture, the bank account stands for the safest place to keep money. The shop stands for a strategy. The picture stops holding in one place. A bank account can be unsafe if the bank fails. Traders use a safer reference than a bank: a short loan to a government.

## Short government bills

A government borrows money by selling short loans called bills. A US Treasury bill, for example, pays back a fixed amount after a few weeks or months, at most one year. The yearly interest a bill pays is the **risk-free rate**.

"Risk-free" means nearly safe, for two reasons:

1. A large government that borrows in its own currency is very unlikely to fail to pay.
2. A bill lasts only weeks or months. Because of this, a change in interest rates moves its value very little.

The rate itself changes over time. In the US, the rate on 3-month bills was close to 0% for most of 2010 to 2015, and above 5% for most of 2023. The 4% in this lesson is illustrative.

## Excess return

Now take a strategy that returned 7% in a year while bills paid 4%:

1. The strategy's return is 7%.
2. The risk-free rate is 4%.
3. The part earned by taking risk is 7% − 4% = 3%.

That 3% is the **excess return**: the return above the risk-free rate. It is the real reward for the strategy's risk. A strategy that returns 3% while bills pay 5% has an excess return of 3% − 5% = −2%. It was worse than leaving the money somewhere safe.

```inkling
title "A return in two layers"
layout stack
- Excess return
- Risk-free rate
- Money you put in
brace excess-return..risk-free-rate "the strategy's return"
step 1: money-you-put-in "You put money into a strategy"
step 2: risk-free-rate "Safe bills would have paid 4% for nothing"
step 3: excess-return "Only the 3% above that is the reward for risk"
highlight excess-return
```

## The same idea, day by day

Your returns are often daily, while the bill rate is quoted per year. To subtract them, turn the yearly rate into a daily one. As you saw with annualising, a mean scales with the number of days. So the daily rate is the yearly rate divided by 252.

```python
import pandas as pd

daily = pd.Series([0.30, -0.20, 0.10, 0.25, -0.15]) / 100   # made-up daily returns
rf_year = 0.04                                              # illustrative bill rate
rf_day = rf_year / 252

excess = daily - rf_day
print(round(rf_day * 100, 4))
print(round(daily.mean() * 252 * 100, 2), round(excess.mean() * 252 * 100, 2))
```

```
0.0159
15.12 11.12
```

1. The daily risk-free rate is 4% / 252 = 0.0159% a day.
2. The mean daily return is 0.06%, which annualises to 0.06% × 252 = 15.12%.
3. Subtract the daily rate from each day, then annualise. The excess return is 11.12% a year, which is 15.12% − 4%.

## Name it

The **risk-free rate** is the interest on short government bills, the return you get for waiting with almost no risk. A strategy's **excess return** is its return minus the risk-free rate over the same period.

> **Key idea:** Any gain up to the risk-free rate you could have had for free, so a strategy's real reward is its excess return.

## What you have now

You can split a return into the safe part and the part earned by risk. Volatility measures how much risk was taken. The open question is how to put the two together: how much excess return did the strategy earn for each unit of volatility?
