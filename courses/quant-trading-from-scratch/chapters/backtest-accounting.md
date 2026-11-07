# Backtest accounting: cash, holdings and equity, bar by bar

The sizing rule needs the equity at every bar. Equity changes when a fill spends or brings in cash, and again whenever the price moves. A mistake here is easy to make: one gain is counted twice, or a cost is never counted. How do you keep books that count every gain and every cost exactly once?

## A wallet and a coin collection

Picture a wallet and a coin collection. Your wealth is the money in the wallet plus what the coins would sell for today. When you buy a coin at its value, money leaves the wallet and the coin joins the collection. Your wealth does not change at that moment. It changes later, when the coins' value changes. The wallet stands for cash, the coins for holdings and your wealth for equity. The picture stops holding for a short position. You cannot owe coins to a collection. With a short, cash goes up and the holdings are negative.

The books of a backtest have three numbers:

- Cash is the money in the account.
- Holdings are the value of the position: shares times the current price. A short position has negative holdings.
- Equity is cash plus holdings, the account's total value.

To mark to market means to value the position at the latest price at every bar, whether or not you trade. Here the latest price is the close.

## Two rules, nothing else

The books change in exactly two moments:

1. On a fill, the shares change by the signed quantity, and the cash changes by minus the signed quantity times the fill price. A buy spends cash. A sell brings it in.
2. At each close, the holdings are the shares times the close, and the equity is the cash plus the holdings.

There is no separate profit column. A gain shows up only as a change in equity. Because of this, it cannot be counted twice. Suppose you also added each day's gain to cash. The holdings already show the new price, so that gain would appear twice.

```python
class Books:
    def __init__(self, cash):
        self.cash = cash          # money in the account
        self.shares = 0           # signed position
        self.equity = cash

    def apply(self, fill):
        signed = fill.quantity if fill.side == "buy" else -fill.quantity
        self.shares += signed
        self.cash -= signed * fill.price      # a buy spends cash, a sell adds it

    def mark(self, close):
        holdings = self.shares * close        # value of the position at this close
        self.equity = self.cash + holdings
        return holdings

books = Books(10_000)
books.apply(Fill("2025-03-07", "buy", 48, 104.5))
for date in ["2025-03-07", "2025-03-10", "2025-03-11"]:
    holdings = books.mark(bars.loc[date, "close"])
    print(date, books.shares, books.cash, holdings, books.equity)
```

```
2025-03-07 48 4984.0 5136.0 10120.0
2025-03-10 48 4984.0 5088.0 10072.0
2025-03-11 48 4984.0 4944.0 9928.0
```

These are the fills that the trend rule makes, as the full replay will show. Follow the books:

1. You start with 10,000 in cash, no shares and equity of 10,000.
2. At the open of 2025-03-07 you buy 48 shares at 104.5. Cash becomes 10,000 − 48 × 104.5 = 4984. At that moment the holdings are 48 × 104.5 = 5016, so equity is still 10,000. The fill changed the mix, not the total.
3. At the close of 107, the holdings are 48 × 107 = 5136 and the equity is 4984 + 5136 = 10120. The gain of 120 equals 48 × (107 − 104.5).
4. The close of 106 on 2025-03-10 gives equity of 10,072, and the close of 103 on 2025-03-11 gives 9,928.

```inkling
title "What equity is made of"
layout mindmap
- Equity
  - Cash
    - Changes only on fills
  - Holdings
    - Shares, changed by fills
    - Close, new every bar
highlight equity
step 1: equity "Equity is what the account is worth"
step 2: cash "Cash moves only when a fill happens"
step 3: holdings "Holdings are shares times the close"
step 4: close-new-every-bar "Each new close changes equity with no trade"
```

At the close of 2025-03-11 the signal turns −1, so the target is −48 shares. The next morning you sell 96 shares: 48 to close the long and 48 to open the short.

```python
books.apply(Fill("2025-03-12", "sell", 96, 102.5))     # from +48 to -48 shares
holdings = books.mark(bars.loc["2025-03-12", "close"])
print("2025-03-12", books.shares, books.cash, holdings, books.equity)
```

```
2025-03-12 -48 14824.0 -4752.0 10072.0
```

The sale brings in 96 × 102.5 = 9840, so cash is 4984 + 9840 = 14824. That is more than the 10,000 you started with, but it is not all yours. You owe 48 shares, worth −48 × 99 = −4752 at the close. Equity is 14824 − 4752 = 10072.

You can check that number another way. The long lost 48 × (102.5 − 103) = −24 between the close and the sale. The short then gained −48 × (99 − 102.5) = 168. So 9928 − 24 + 168 = 10072, the same equity.

> **Key idea:** Backtest accounting changes cash and shares only on fills and marks the holdings to market at every close, so equity counts every gain and cost once.

## What you have now

You have books that turn fills and closes into equity, for long, flat and short positions. Equity then feeds the sizing rule. You now have every part: bars, a signal, a position, orders, fills, sizing and books. In what order do they run on each bar so that the replay is honest?
