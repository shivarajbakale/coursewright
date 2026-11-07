# Short selling: selling borrowed shares to profit from a fall

Your rule is either long or flat. On 2025-03-12 the close of XYZ fell from 103 to 99, and the rule held nothing, so it earned nothing. How can a position earn money when the price goes down?

## Selling a book you borrowed

Your neighbour lends you a book that sells for 20 today. You sell it at once for 20. A week later the same book sells for 15. You buy a copy for 15 and give it back to your neighbour. You keep 20 − 15 = 5. The book stands for a share and the neighbour stands for the lender. Buying a copy and giving it back stands for closing the trade. The picture stops holding in three places:

1. Your neighbour lends for free. A lender of shares charges a fee for each day of the loan.
2. Your neighbour waits for you. A lender of shares can ask for them back at any time.
3. A book price has a ceiling in practice. A share price can rise without limit, so a loss has no upper limit.

To borrow shares means to receive them from a lender with a promise to return the same number later. The lender is often the firm that holds your account. Short selling is selling borrowed shares now and buying them back later to return them. While you owe the shares, your position is negative. A position of −10 means you owe 10 shares, and this is called a short position.

## One short trade, step by step

1. On 2025-03-11 you borrow 10 shares of XYZ.
2. You sell them at the close of 103. Your cash rises by 10 × 103 = 1030, and your position is −10.
3. On 2025-03-12 the close is 99. You buy 10 shares back for 10 × 99 = 990.
4. You return the 10 shares to the lender. Your position is 0, and you kept 1030 − 990 = 40.

As you saw with a position, the gain is the shares held times the price change. The shares held are −10 and the change is 99 − 103 = −4. So the gain is −10 × (−4) = 40. A negative position times a fall gives a gain.

```inkling
title "One short trade"
layout sequence
you: person "You"
lender: box "Lender"
mkt: box "Market"
lender -> you : "lends 10 shares"
you -> mkt : "sells 10 at 103"
mkt --> you : "cash 1,030"
you -> mkt : "buys 10 at 99, pays 990"
mkt --> you : "10 shares"
you -> lender : "returns 10 shares"
steps auto
```

## A rule that goes both ways

Now let the signal be −1 when the close is below its moving average. `np.sign` gives +1 for a positive number, −1 for a negative one and 0 for zero. This version replaces the earlier `trend_signal`.

```python
import numpy as np

def trend_signal(closes, window=3):
    """+1 above the moving average, -1 below it, 0 on it or without history."""
    average = closes.rolling(window).mean()
    signal = pd.Series(np.sign(closes - average), index=closes.index)
    return signal.fillna(0).astype(int)

position = trend_signal(closes) * 10
held = position.shift(1).fillna(0)
pnl = held * closes.diff().fillna(0) + 0
print(pd.DataFrame({"close": closes, "position": position, "pnl": pnl}))
print("total:", pnl.sum())
```

```
            close  position   pnl
date
2025-03-03  100.0         0   0.0
2025-03-04  102.0         0   0.0
2025-03-05  101.0         0   0.0
2025-03-06  104.0        10   0.0
2025-03-07  107.0        10  30.0
2025-03-10  106.0        10 -10.0
2025-03-11  103.0       -10 -30.0
2025-03-12   99.0       -10  40.0
2025-03-13  101.0         0 -20.0
2025-03-14  104.0        10   0.0
total: 10.0
```

The rows up to 2025-03-10 match the long-or-flat rule. The difference starts on 2025-03-11:

1. At the close of 103 the signal is −1, so the position goes from +10 to −10. You sell your 10 shares and sell 10 borrowed ones.
2. On 2025-03-12 the price falls by 4. The short position gains 40.
3. On 2025-03-13 the price rises from 99 to 101. The loss is −10 × 2 = −20. At that close the signal is 0, so you buy back and return the shares.

The total is 30 − 10 − 30 + 40 − 20 = 10, against −10 for the long-or-flat rule. The two rules differ by 20 because only one of them held a position from 103 to 101.

The risk is not the same on both sides. If you buy 10 shares at 103, the price cannot fall below 0, so the worst loss is 10 × 103 = 1030. If you short 10 shares at 103 and the price rises to 150, the loss is −10 × (150 − 103) = −470. If the price keeps rising, the loss keeps growing.

> **Key idea:** Short selling is selling borrowed shares and buying them back later, which gives a negative position that gains when the price falls.

## What you have now

A position can now be long, flat or short, and one formula gives its gain for every case. So far you changed the position by saying "buy" or "sell" at a close. In a real market, how do you tell someone to make that trade, and at what price?
