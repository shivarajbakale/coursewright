# Borrow costs: what holding a short leg costs each day

A pairs trade always holds one short leg. Short selling showed that you sell shares you borrowed, and lenders do not lend for free. The backtest in the pairs trade made 9.39 per spread unit with no costs at all. How much of that survives once you pay to hold the short leg?

## Renting a ladder

Picture renting a ladder from a neighbour. You pay a small fee for each day you keep it. The neighbour can ask for it back at any time, even mid-job. If ladders are scarce, the fee is high.

The ladder stands for the shares you borrow. The daily fee stands for the borrow fee. The neighbour asking for it back stands for a recall. The picture stops holding in one place: a ladder keeps its value while you hold it. Borrowed shares can rise in price, and you must return the same number of shares, not the same amount of money.

## Two costs and two risks

1. The **borrow fee** is what the lender charges for the shares you short. It is quoted as a yearly percentage of the short leg's value and charged each day. For large, widely held stocks it is often below 1% a year. For scarce shares it can reach 20% a year or more. Both numbers are illustrative; your broker quotes the real fee, and it can change daily.
2. **Financing** is the interest you pay on money you borrow to hold the long leg. If you pay for the long leg with your own cash, the cost is the interest that cash no longer earns.
3. A **recall** is the lender asking for the shares back. If your broker cannot borrow them elsewhere, you must buy the shares and close the short leg. That can happen while the spread is still far from its mean, which locks in a loss.
4. A **squeeze** is the risk on top of a recall. When many short sellers must buy back the same stock at once, their buying pushes its price up further.

```inkling
title "What a short leg costs"
layout mindmap
- Holding a short leg
  - Borrow fee
    - yearly rate on the short value
    - charged each day
  - Financing
    - interest on the long leg
  - Recall
    - lender wants the shares back
  - Squeeze
    - forced buying lifts the price
step 1: holding-a-short-leg "Every pairs trade holds one short leg"
step 2: borrow-fee, yearly-rate-on-the-short-value, charged-each-day "The lender charges a fee for each day"
step 3: financing, interest-on-the-long-leg "The long leg ties up money too"
step 4: recall, lender-wants-the-shares-back, squeeze, forced-buying-lifts-the-price "The lender can end the trade early"
```

## One trade, two fees

Take the trade from the pairs trade, at 1,000 spread units. You short 1,000 shares of A at 42.74, a short leg worth $42,740. You buy 1,362 shares of B at 24.49, a long leg worth $33,355. The trade lasts 6 days and gains 0.93 per unit, so $930.

This example charges 1/360 of the yearly fee per day. That is a convention many US brokers use; your broker's terms set the real one.

- At 0.5% a year: 42,740 × 0.005 × 6 / 360 = $3.56. That is less than 1% of the gain.
- At 30% a year: 42,740 × 0.30 × 6 / 360 = $213.70. The gain falls to 930 − 213.70 = $716.30, so the fee takes about 23% of it.

If you borrowed the $33,355 for the long leg at an illustrative 6% a year, financing adds 33,355 × 0.06 × 6 / 360 = $33.36.

The same calculation runs over the whole backtest. On each day, the short leg is A when you are short the spread, and h shares of B when you are long it.

```python
# a, b, ratio, pos, pnl: from the pairs-trade example
held = pos.shift(1).fillna(0)                    # the position held overnight into day t
short_value = np.where(held < 0, a, 0) + np.where(held > 0, ratio * b, 0)
for yearly in [0.005, 0.05, 0.30]:
    fee = pd.Series(short_value * yearly / 360)  # this example charges 1/360 of the rate per day
    print(f"fee {yearly:5.1%} a year: cost {fee.sum():5.2f}  "
          f"profit after fee {pnl.sum() - fee.sum():5.2f}")
```

```
fee  0.5% a year: cost  0.05  profit after fee  9.34
fee  5.0% a year: cost  0.46  profit after fee  8.93
fee 30.0% a year: cost  2.73  profit after fee  6.66
```

At 30% a year, the fee takes 2.73 of the 9.39 per unit. The half-life matters here: a slower spread holds the short leg for more days, and every day pays the fee.

> **Key idea:** Borrow costs are the daily fee for the shares you short, plus the financing of the long leg, plus the risk that a recall or a squeeze closes the short leg early.

Check the borrow fee of both stocks before you trade a pair. A scarce short leg can turn a profitable backtest into a live loss.

## What you have now

Borrow costs join the pairs trade to transaction costs. You pay a fee for each day the short leg is open, plus financing, and you carry the risk of a recall. With these, your pairs backtest charges for every part of holding both legs. Twice now you fitted a best straight line with `np.polyfit`, once for the hedge ratio and once for the half-life. How does it decide which line is best?
