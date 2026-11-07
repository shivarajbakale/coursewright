# The volatility smile: different implied volatility at each strike

The Black-Scholes formula assumes one fixed volatility for the stock. If the market believed that, every option on the stock would show the same implied volatility. Take one-year options on a stock index at 100, with strikes from $80 to $120. Do their implied volatilities agree?

## One stock, many volatilities

They do not. Here is an illustrative set of implied volatilities, with a shape typical of stock index options:

| Strike | 80 | 90 | 100 | 110 | 120 |
| --- | --- | --- | --- | --- | --- |
| Implied volatility | 27% | 23% | 20% | 18% | 17% |

Plot implied volatility against strike, and you get a curve. In currency markets the curve often rises at both ends, like a smile. This shape is the **volatility smile**, and the name now covers any such curve. In stock markets the curve slopes down from low strikes to high strikes. This downward slope is the **skew**.

Think of insurance prices in a town by a river. Flood cover costs more than the average risk suggests, because floods are rare but ruinous. The flood stands for a market crash, and flood cover stands for a put with a low strike. The picture stops holding on one point. Flood risk is set by weather, but a crash is partly caused by the traders themselves selling at once.

## What the skew costs

Price each put with its own implied volatility, then with a flat 20%:

```python
import pandas as pd
from bs import black_scholes

# illustrative implied volatilities for one-year options on a stock index at 100
smile = pd.Series({80: 0.27, 90: 0.23, 100: 0.20, 110: 0.18, 120: 0.17})
table = pd.DataFrame({
    "implied vol": smile,
    "put price": [black_scholes(100, k, 1, 0.05, v, "put") for k, v in smile.items()],
    "put at flat 20%": [black_scholes(100, k, 1, 0.05, 0.20, "put") for k in smile.index],
})
print(table.round(2))
```

```
     implied vol  put price  put at flat 20%
80          0.27       1.91             0.69
90          0.23       3.16             2.31
100         0.20       5.57             5.57
110         0.18       9.89            10.68
120         0.17      16.41            17.40
```

Read the first row. The put with strike $80 costs $1.91 with the skew. A flat 20% would price it at $0.69. So the market charges 1.91 / 0.69 = 2.77 times the flat-volatility price for protection against a fall of more than 20%.

## Why the curve is not flat

```inkling
title "Why low strikes carry more volatility"
layout mindmap
- Skew
  - Fat tails
    - Huge days happen more often than the bell says
  - Crash fear
    - Buyers pay up for puts that protect them
  - Falling prices
    - Volatility rises when prices fall
step 1: skew "Low-strike options show higher implied volatility"
step 2: fat-tails "Real returns have more extreme days than a bell"
step 3: crash-fear "Investors pay extra for protection"
step 4: falling-prices "Falls and high volatility arrive together"
```

1. Real returns have **fat tails**. Extreme days happen far more often than the normal distribution predicts. Under a normal distribution, a daily move beyond 5 standard deviations has a probability of 0.00000057. That is about once in 6,900 years of 252 trading days.
2. Real markets have had larger moves. On 19 October 1987, the US S&P 500 index fell by about 20% in one day. With a daily standard deviation of about 1%, that fall was about 20 standard deviations.
3. Many investors own stocks and buy low-strike puts to protect them. Few want to sell that protection, so its price rises.
4. In stock markets, volatility rises when prices fall, as it did in 1987 and 2008. Because of this, a low-strike put pays off in a world with higher volatility than today's.

Implied volatility also changes with expiry, not only with strike. The full grid of implied volatility by strike and expiry is called the volatility surface.

The smile does not mean the formula is useless. Traders keep the formula and change its volatility input for each strike and expiry. The formula then works as a translator between prices and volatilities.

> **Key idea:** The volatility smile is the pattern of implied volatility across strikes, and in stock markets it is a skew with higher volatility at low strikes, because real returns have fat tails and crash risk.

## What you have now

Options on stock indices price in more crash risk than a bell curve holds. Now compare the price with the outcome. Does an option's implied volatility, on average, match the volatility the stock then shows?
