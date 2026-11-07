# Linear regression: the best straight line through points

Covariance and correlation tell you that two series move together. They do not tell you by how much. Say one stock's daily return goes up by 1%. How much do you expect the other stock's return to change? To answer that, you need a rule that turns one number into a forecast of the other.

## A ruler laid over dots

Plot each day as a dot. The first stock's return is the position across, x. The second stock's return is the height, y. Now lay a ruler over the dots so it passes as close to all of them as it can.

In this picture, the ruler is your rule. Its tilt says how much y changes when x changes by 1. The gap between each dot and the ruler, measured straight up or down, is how wrong the rule is on that day.

The picture stops holding in one place. Your eye places the ruler by feel, and two people place it differently. You need one exact definition of "as close as it can". The usual definition is this: the sum of the squared vertical gaps must be as small as possible. Squaring makes every gap positive, so gaps above and below the line cannot cancel. Squaring also punishes one big miss more than two small ones.

## Five dots, worked through

Take five dots, with x = 1, 2, 3, 4, 5 and y = 2, 3, 5, 4, 6. The line that makes the squared gaps smallest has a known answer. Its tilt is the covariance of x and y divided by the variance of x.

1. The covariance of x and y is 2.25, and the variance of x is 2.5.
2. The tilt is 2.25 / 2.5 = 0.9.
3. The line must pass through the point of the two means, (3, 4). So its height at x = 0 is 4 - 0.9 × 3 = 1.3.
4. The line forecasts y = 1.3 + 0.9 × x. At x = 3 it forecasts 4.0, but the dot is at 5. That miss is 5 - 4.0 = 1.0.

```python
import numpy as np
x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
y = np.array([2.0, 3.0, 5.0, 4.0, 6.0])
slope = np.cov(x, y)[0, 1] / np.var(x, ddof=1)
intercept = y.mean() - slope * x.mean()
residuals = y - (intercept + slope * x)
print(f"slope {slope:.2f}, intercept {intercept:.2f}")
print("residuals", residuals.round(2))
print(f"sum of squared residuals {np.sum(residuals**2):.2f}")
```

```
slope 0.90, intercept 1.30
residuals [-0.2 -0.1  1.  -0.9  0.2]
sum of squared residuals 1.90
```

Check that no other line beats it. Try the line y = 1 + 1 × x, which looks just as reasonable. Its misses are 0, 0, 1, -1 and 0. The sum of their squares is 2.0. That is larger than 1.90, so the fitted line wins.

```inkling
title "Fitting the best line"
dots: box "Dots (x, y)"
line: box "Candidate line"
gaps: box "Vertical gaps"
score: box "Sum of squares"
best: box "Smallest sum wins" green
dots -> line -> gaps -> score -> best
highlight best
step 1: dots "Each day becomes one dot"
step 2: line "Propose a straight line"
step 3: gaps "Measure each dot's gap straight up or down"
step 4: score "Square the gaps and add them"
step 5: best "The fitted line has the smallest total"
```

## Naming it

This method is linear regression, also known as least squares. It finds the straight line y = a + b × x with the smallest sum of squared vertical gaps.

- The **slope**, b, is the tilt of the line: how much y changes, on average, when x goes up by 1. It equals the covariance of x and y divided by the variance of x.
- The **intercept**, a, is the line's height where x is 0.
- A **residual** is one dot's vertical gap from the line: the actual y minus the forecast y. It is the part of y the line does not explain. The residuals of a fitted line always add up to 0.

The slope is not the correlation. Correlation stays between -1 and 1 and has no units. The slope keeps the units of y per unit of x, so it can be 0.9, 3 or -40.

> **Key idea:** Linear regression finds the line with the smallest sum of squared residuals; its slope, covariance divided by variance, says how much y moves for each 1 that x moves.

## What you have now

You can turn covariance into a slope: a number that says how much one series moves with another, plus residuals for what is left over. The obvious next question is about a stock and the whole market. If you put the market's daily return on the x axis, what does the slope tell you about the stock?
