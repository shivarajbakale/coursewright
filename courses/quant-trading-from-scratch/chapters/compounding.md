# Compounding: returns multiply over time, they don't add

As you saw with a return, a share went from 50 to 55, back to 50, then to 51. Its daily returns were 10%, −9.09% and 2%. Those add up to 2.91%. Yet the price went from 50 to 51, which is a gain of only 2%. Adding returns gave the wrong answer. What is the right way to combine them?

## Interest on interest

Picture a savings account that pays 5% interest a year. You put in 1000 pounds. After one year, you have 1000 × 1.05 = 1050 pounds. In the second year, the bank pays 5% on 1050 pounds, not on 1000. You end with 1050 × 1.05 = 1102.50 pounds. The second year earned 52.50 pounds, because last year's interest also earned interest.

Each year, the bank multiplies your balance by 1.05. Two years multiply it by 1.05 × 1.05 = 1.1025, a gain of 10.25%, not 10%.

Share returns combine the same way. The balance stands for the money you hold in the share. The interest rate stands for each period's return. The picture stops holding in two places. A savings rate is fixed and positive. A share's return changes every period, and it can be negative. The multiplying works the same way for a loss.

## Three days, step by step

To combine returns, first turn each one into a growth factor. A growth factor is 1 plus the return. It is the number your money is multiplied by in that period. A growth factor above 1 is a gain. A growth factor below 1 is a loss.

Say you hold 1000 pounds of a share for three days, with returns of 10%, −10% and 5%:

1. Day 1: the growth factor is 1.10. You have 1000 × 1.10 = 1100 pounds.
2. Day 2: the growth factor is 0.90. You have 1100 × 0.90 = 990 pounds.
3. Day 3: the growth factor is 1.05. You have 990 × 1.05 = 1039.50 pounds.

Over the three days, your money was multiplied by 1.10 × 0.90 × 1.05 = 1.0395. The combined return is 1.0395 − 1 = 0.0395, a gain of 3.95%. The sum of the returns is 5%, so adding overstates the gain by more than 1 percentage point.

The same method answers the opening question. The growth factors for 50, 55, 50 and 51 give 1.10 × 0.9091 × 1.02 = 1.02. That is the 2% gain the prices show.

```python
import numpy as np

returns = np.array([0.10, -0.10, 0.05])
growth = 1 + returns                  # growth factor of each day
total = growth.prod() - 1             # compounded return over all three days

print("growth factors:", growth)
print(f"compounded return: {total:.4f}")
print(f"sum of returns:    {returns.sum():.4f}")
```

```
growth factors: [1.1  0.9  1.05]
compounded return: 0.0395
sum of returns:    0.0500
```

```inkling
title "Each period multiplies what you have"
layout cycle
center "repeat each period"
hold: circle "Money you hold"
ret: circle "This period's return"
grow: circle "Multiply by 1 + return"
cycle hold, ret, grow
step 1: hold "Start with what you hold now"
step 2: ret "The period ends with a return"
step 3: grow "Your money is multiplied by its growth factor"
note grow "the result is next period's start"
```

## Why a loss needs a bigger gain

Look at days 1 and 2. A gain of 10% and then a loss of 10% did not bring you back to 1000 pounds. Their growth factors give 1.10 × 0.90 = 0.99. A growth factor of 0.99 is a loss of 1%.

The same effect decides how hard a loss is to recover:

1. After a loss of 20%, you hold 0.80 of your money. To get back to 1, you need a growth factor of 1 / 0.80 = 1.25, a gain of 25%.
2. After a loss of 50%, you hold 0.50 of your money. You need 1 / 0.50 = 2, a gain of 100%.

The gain needed grows faster than the loss. This is why avoiding large losses matters so much in trading.

> **Key idea:** Compounding combines returns over several periods by multiplying their growth factors, so a loss needs a larger gain to recover.

## What you have now

A return measures one period, and compounding joins many periods by multiplying 1 plus each return. Multiplying long lists of numbers is awkward. An average, like most statistics, is built from a sum. Is there a form of return that you can add across periods and still get the right answer?
