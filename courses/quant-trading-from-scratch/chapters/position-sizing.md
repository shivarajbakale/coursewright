# Position sizing: how much money each trade uses

Every order so far asked for 10 shares. At a price of 104, that is 10 × 104 = 1040 in shares. In an account of 10,000 that is about a tenth of the money. In an account of 1,000,000 it is almost nothing. A fixed count of shares ignores both the account and the price. So how many shares should an order ask for?

## Half the flour you have

A recipe can say "use 3 cups of flour" or "use half the flour you have". The second rule grows and shrinks with your supply. The flour you have stands for the account's total value, which is called equity. "Half" stands for a fraction you choose. The cups stand for shares. The picture stops holding in two places. Shares come only in whole numbers. Also, a share's price changes every day, so the same amount of money buys a different number of shares each day.

The notional of a position is its value in money: the number of shares times the price. Position sizing is the rule that turns a signal into a number of shares. The simplest rule is a fixed fraction: the notional is a fixed fraction of equity.

## Sizing one trade

Take equity of 10,000, a fraction of 0.5 and a close of 104 when the signal turns +1.

1. The target notional is 0.5 × 10,000 = 5000.
2. That buys 5000 / 104 = 48.08 shares.
3. Round down to 48 shares. Rounding up would spend more than the fraction allows.
4. The real notional is 48 × 104 = 4992, and 5000 − 4992 = 8 stays as cash.

For a signal of −1, the same steps give −48 shares, a short position of the same size.

```python
def target_shares(signal, equity, price, fraction=0.5):
    """Shares to hold: a fixed fraction of equity, in the signal's direction."""
    notional = fraction * equity                 # money to put in the trade
    return signal * int(notional // price)       # whole shares only

print(target_shares(+1, 10_000, 104.0))
print(target_shares(-1, 10_000, 103.0))
print(target_shares(0, 10_000, 104.0))
print(target_shares(+1, 12_000, 104.0))
```

```
48
-48
0
57
```

The four results:

1. A signal of +1 at 104 gives 48 shares, as worked out above.
2. A signal of −1 at 103 gives −48. The notional of 5000 buys 5000 / 103 = 48.54 shares, and the whole part is 48.
3. A signal of 0 gives 0 shares, whatever the equity.
4. With equity grown to 12,000, the target notional is 0.5 × 12,000 = 6000. That is 6000 / 104 = 57.69 shares, so 57.

The code rounds before it applies the sign, and the order matters. Python's `//` rounds toward the lower number. Because of this, `-5000 // 104` gives −49, one share more than the fraction allows on the short side.

```inkling
title "From equity to shares"
eq: box "Equity\n10,000"
frac: box "Fraction\n0.5"
notional: box "Notional\n5,000"
price: box "Price 104"
shares: box "48 shares" green
eq -> frac -> notional -> price -> shares
highlight notional
step 1: eq "Start from what the account is worth"
step 2: frac "Choose the share of it to use"
step 3: notional "That gives the money for the trade"
step 4: price, shares "Divide by the price and round down"
```

## Same money, different risk

A fixed fraction fixes the money in a trade. It does not fix how much that money swings. As you saw with volatility, a price that moves more each day carries more risk. The daily volatility of XYZ's 10 closes is 0.0267, or 2.67%. A notional of 4992 then moves by about 4992 × 0.0267 ≈ 133 on a typical day. A share with half that volatility, with the same notional, would move by about half as much. So two trades of the same size in money can carry very different risk. Sizing by money is the simplest rule, and it is not the only one.

This lesson keeps the fraction at or below 1. Because of this, a long position never needs more money than the account holds.

> **Key idea:** Position sizing turns a signal into shares; the fixed-fraction rule sets the notional to a fraction of equity and rounds down to whole shares.

## What you have now

You can now size an order from the signal, the equity and the price. The fills from before then say what it really traded. The rule needs the equity at each bar, and equity changes with every fill and every price. How do you keep the books so that the equity is right at every bar?
