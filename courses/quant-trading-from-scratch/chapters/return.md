# A return: the percentage change in a price

As you saw with a price bar, the closes of two bars in a row tell you how a price moved. In the last example, the price rose from 100.30 to 100.90, a rise of 0.60 pounds. On a share that costs 5 pounds, a rise of 0.60 pounds would be huge. On a share that costs 100 pounds, it is small. How do you compare moves between shares with different prices?

## A pay rise of 5 pounds

Picture two people who each get a pay rise of 5 pounds an hour. One earned 10 pounds an hour, and the other earned 100 pounds an hour. The rise is the same in pounds. For the first person, though, it is half their old pay. For the second, it is a twentieth. To compare the two rises on equal terms, you divide each one by the pay it started from.

The picture maps onto prices directly. The old pay stands for the starting price. The rise stands for the change in price. The fraction stands for the return. The picture stops holding in one place: pay rarely falls, and prices fall often. A return can be negative.

## Working it out

The return over one period is the change in price divided by the starting price:

return = (end price − start price) / start price

Here are three cases, with illustrative prices:

1. A share goes from 50 to 55. The return is (55 − 50) / 50 = 0.10, a gain of 10%.
2. A share goes from 200 to 205. The return is (205 − 200) / 200 = 0.025, a gain of 2.5%.
3. A share goes from 55 back to 50. The return is (50 − 55) / 55 = −0.0909, a loss of 9.09%.

Cases 1 and 2 both rise by 5 pounds. The first gains 4 times as much for each pound you put in. That is the comparison the price alone could not give you.

Cases 1 and 3 are the same 5 pounds, up and then down. The gain is 10%, but the loss is only 9.09%. The reason is the starting price. The loss is measured from 55, which is a bigger number than 50. So a rise and a fall of equal size in pounds give returns of different sizes.

The 0.60 pound rise from the price bar is (100.90 − 100.30) / 100.30 = 0.00598, a gain of about 0.6%.

```inkling
title "From two prices to a return"
layout right
start: box "Start price\n50"
end: box "End price\n55"
change: round "Change\n55 − 50 = 5"
ret: box "Return\n5 / 50 = 10%" green
start -> change
end -> change
change -> ret : "divide by start"
start --> ret : "the base"
circle ret
step 1: start, end "Two prices, one period apart"
step 2: change "Subtract to get the change in pounds"
step 3: ret "Divide by the start price to get the return"
```

In pandas, `pct_change()` does this for every pair of rows in a column of closing prices:

```python
import pandas as pd

close = pd.Series([50.0, 55.0, 50.0, 51.0],
                  index=pd.date_range("2024-03-04", periods=4, freq="D"))
returns = close.pct_change()
print(returns.round(4))
```

```
2024-03-04       NaN
2024-03-05    0.1000
2024-03-06   -0.0909
2024-03-07    0.0200
Freq: D, dtype: float64
```

The first row is `NaN`, which means "not a number". It is empty because the first day has no earlier price to compare with. Each later row is that day's return.

## Naming it

A return is a gain or a loss measured as a fraction of the starting price. A positive return is a gain, and a negative return is a loss. A return has no unit, so you can compare returns between any two shares, at any prices.

> **Key idea:** A return is the change in price divided by the starting price, so it measures a gain or loss per pound you started with.

## What you have now

A price bar gives you closing prices, and a return turns two closes into one comparable number. The table above has three daily returns: 10%, −9.09% and 2%. Their sum is 2.91%. Yet the price went from 50 to 51, which is a gain of 2%. Why do the daily returns not add up to the return over the whole period?
