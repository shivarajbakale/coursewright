# Log returns: returns you can add across periods

As you saw with compounding, returns over more than one period combine by multiplying growth factors. Three days of 10%, −10% and 5% give 1.10 × 0.90 × 1.05 = 1.0395, a gain of 3.95%. Adding the returns gave 5%, which is wrong. Sums are easier to work with than products. An average is built from a sum, for example. Can you change returns into numbers that combine by adding?

## Counting doublings

Picture money that doubles. Start with 1 pound. It grows to 2, then 4, then 8 pounds. Instead of saying "it grew 8 times", you can say "it doubled 3 times". Now split the growth into two parts. First the money doubles once, from 1 to 2. Then it doubles twice, from 2 to 8. The growth multiplies, 2 × 4 = 8. The count of doublings adds, 1 + 2 = 3.

So counting doublings turns multiplying into adding. A tool that counts this way is called a logarithm. The picture stops holding in two places:

1. A count of doublings uses steps of 2. The logarithm used in finance counts steps of a different number, e ≈ 2.71828. This step size keeps the formulas simplest. The adding works the same with any step size.
2. A count can be a fraction or negative. Growth by 1.5 is less than one doubling. A halving is −1 doubling.

## The logarithm, precisely

The natural logarithm of a number x, written ln(x), is the power you raise e to, to get x. Three facts follow:

1. ln(1) = 0, because no growth is zero steps.
2. ln(x) is negative when x is below 1. A loss has a negative logarithm.
3. ln(a × b) = ln(a) + ln(b). This is the counting rule from the doublings.

The reverse of ln is the exponential, exp(x), which is e raised to the power x. In numpy, they are `np.log` and `np.exp`.

## Three days, added

The log return of one period is the logarithm of its growth factor: ln(end price / start price). Take prices of 100, 110, 99 and 103.95, which give the three returns above:

1. Day 1: ln(110 / 100) = ln(1.10) = 0.0953.
2. Day 2: ln(99 / 110) = ln(0.90) = −0.1054.
3. Day 3: ln(103.95 / 99) = ln(1.05) = 0.0488.
4. Add them: 0.0953 − 0.1054 + 0.0488 = 0.0387.
5. Turn the sum back: exp(0.0387) − 1 = 0.0395, a gain of 3.95%.

The sum gives the same 3.95% that compounding gave, with no multiplying.

```python
import numpy as np
import pandas as pd

close = pd.Series([100.0, 110.0, 99.0, 103.95])
log_returns = np.log(close).diff()      # ln(today) - ln(yesterday)

print(log_returns.round(4).tolist())
total_log = log_returns.sum()
print(f"sum of log returns: {total_log:.4f}")
print(f"back to a simple return: {np.exp(total_log) - 1:.4f}")
```

```
[nan, 0.0953, -0.1054, 0.0488]
sum of log returns: 0.0387
back to a simple return: 0.0395
```

`np.log(close).diff()` works because ln(end / start) = ln(end) − ln(start). The `sum()` skips the empty first row.

```inkling
title "Simple returns and log returns"
layout compare
columns "Simple return", "Log return"
row "Day 1": "10%", "0.0953"
row "Day 2": "−10%", "−0.1054"
row "Day 3": "5%", "0.0488"
row "Combine by": "multiplying 1 + r", "adding"!
row "Three days": "3.95%", "0.0387, which is 3.95%"
step 1: day-1, day-2, day-3 "The same three days, written two ways"
step 2: combine-by "Log returns combine by adding"
step 3: three-days "Both give the same result"
```

A log return is close to the ordinary return when the move is small. For a 1% return, ln(1.01) = 0.00995. For a 10% return, the two differ more: 0.0953 against 0.10. Log returns are also symmetric. A move from 100 to 110 is +0.0953, and the move back to 100 is −0.0953.

> **Key idea:** A log return is the logarithm of a period's growth factor, and log returns over several periods add up to the log return of the whole span.

## What you have now

A return measures one period, compounding multiplies periods together, and a log return lets you add them instead. You can now turn any list of prices into returns and combine them correctly. In the example, the daily returns jumped between +10% and −10%. How do you measure how far returns jump around, as one number?
