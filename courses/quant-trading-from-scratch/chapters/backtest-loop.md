# The backtest loop: data, signal, orders, fills and books together

You have every part of a backtest: bars, a signal, a position, orders, fills, sizing and books. Each part works alone. Run them in the wrong order and the replay cheats, for example by trading at a price from before the decision. In what order do the parts run on each bar?

## One day at a desk

Picture a trader who works the same routine every day. In the morning, yesterday's order trades. In the evening, they read the closing price, update the account, decide on a view and write tomorrow's order. The trader stands for the loop, and each day stands for one bar. The picture stops holding in one place. A real trader can react during the day. This loop sees each bar only through its open and its close.

The backtest loop runs these steps for every bar, in this order:

1. Fill the order from the previous bar at this bar's open.
2. Mark the books to market at this bar's close.
3. Compute the signal from the closes up to this bar.
4. If the signal changed, size a new target from the equity and the close.
5. Make the order that moves the position to the target. It trades on the next bar.

The order matters. Step 1 comes before step 2, because the fill changes the shares that the close values. Step 3 comes after the close, because the signal needs it. Its order can then trade only on the next bar.

Step 4 resizes only when the signal changes. Without that rule, the target would move with every change in equity. After the close of 107 on 2025-03-07, equity is 10,120 and the target would be 0.5 × 10,120 / 107 = 47.29, so 47 shares. The loop would then sell 1 share for no reason.

```inkling
title "One bar of the backtest loop"
layout cycle
center "every bar"
fill: circle "Fill at open"
mark: circle "Mark at close"
decide: circle "Compute signal"
size: circle "Size target"
order: circle "Order for next bar"
cycle fill, mark, decide, size, order
step 1: fill "Yesterday's order trades at today's open"
step 2: mark "The close sets today's equity"
step 3: decide "The signal reads closes up to today"
step 4: size "A changed signal gets a new target"
step 5: order "The gap becomes tomorrow's order"
```

## The loop in code

This function uses `trend_signal`, `order_for`, `fill_order`, `target_shares` and `Books` from the earlier lessons.

```python
def run_backtest(bars, cash=10_000, fraction=0.5):
    books, order, signal, target = Books(cash), None, 0, 0
    rows = []
    for i, (date, bar) in enumerate(bars.iterrows()):
        fill = fill_order(order, date, bar) if order else None   # 1. trade at the open
        if fill:
            books.apply(fill)
        books.mark(bar["close"])                                  # 2. books at the close
        new = trend_signal(bars["close"].iloc[: i + 1]).iloc[-1]  # 3. decide
        if new != signal:                                         # 4. size on a change
            signal = new
            target = target_shares(signal, books.equity, bar["close"], fraction)
        order = order_for(target, books.shares)                   # 5. order for next bar
        rows.append({"date": date, "close": bar["close"], "fill": fill.price if fill else None,
                     "shares": books.shares, "cash": books.cash, "equity": books.equity})
    return pd.DataFrame(rows).set_index("date")

print(run_backtest(bars))
```

```
            close   fill  shares     cash   equity
date
2025-03-03  100.0    NaN       0  10000.0  10000.0
2025-03-04  102.0    NaN       0  10000.0  10000.0
2025-03-05  101.0    NaN       0  10000.0  10000.0
2025-03-06  104.0    NaN       0  10000.0  10000.0
2025-03-07  107.0  104.5      48   4984.0  10120.0
2025-03-10  106.0    NaN      48   4984.0  10072.0
2025-03-11  103.0    NaN      48   4984.0   9928.0
2025-03-12   99.0  102.5     -48  14824.0  10072.0
2025-03-13  101.0    NaN     -48  14824.0   9976.0
2025-03-14  104.0  101.5       0   9952.0   9952.0
```

The rows up to 2025-03-12 match the books from backtest accounting. On 2025-03-13 the signal is 0, because the close equals its average. So on 2025-03-14 the loop buys back 48 shares at 101.5, and cash becomes 14824 − 48 × 101.5 = 9952. The final equity of 9,952 is a return of 9952 / 10000 − 1 = −0.48%.

## A longer replay

Ten bars prove only that the parts fit. The function below makes 500 illustrative daily bars from random price changes. They are not real prices.

```python
def make_bars(n=500, seed=4):
    """Illustrative daily bars from a random walk; not real prices."""
    rng = np.random.default_rng(seed)
    close = 100 * np.cumprod(1 + rng.normal(0.0003, 0.01, n))
    open_ = np.r_[100, close[:-1]] * (1 + rng.normal(0, 0.002, n))
    high = np.maximum(open_, close) * (1 + rng.uniform(0, 0.005, n))
    low = np.minimum(open_, close) * (1 - rng.uniform(0, 0.005, n))
    volume = rng.integers(1_000, 5_000, n)
    index = pd.bdate_range("2023-01-02", periods=n, name="date")
    return pd.DataFrame({"open": open_, "high": high, "low": low,
                         "close": close, "volume": volume}, index=index)

result = run_backtest(make_bars())
equity = result["equity"]
daily = equity.pct_change().dropna()
print("total return:", round(equity.iloc[-1] / equity.iloc[0] - 1, 4))
print("max drawdown:", round((equity / equity.cummax() - 1).min(), 4))
print("Sharpe (risk-free 0):", round(daily.mean() / daily.std() * 252 ** 0.5, 2))
print("buy and hold:", round(result["close"].iloc[-1] / result["close"].iloc[0] - 1, 4))
```

```
total return: -0.0954
max drawdown: -0.156
Sharpe (risk-free 0): -0.58
buy and hold: 0.161
```

The `equity` column is the equity curve, so the measures you met earlier apply to it directly. The strategy lost 9.54% and fell 15.6% at its maximum drawdown. Its Sharpe ratio is −0.58, annualised over 252 trading days. The code takes the risk-free rate as 0 to stay short. Buy and hold gained 16.1% on the same bars, so the rule lost against its benchmark. It traded 197 times in 500 bars. The prices are random, so no rule has a real advantage here. With seeds 1 to 14, the same rule returns between −22.27% and +13.84%.

## The same rule as whole columns

A vectorised backtest computes the result with column operations on all bars at once, as you did with a position. It is short and fast:

```python
b = make_bars()
held = trend_signal(b["close"]).shift(1).fillna(0)
fast = 10_000 * (1 + 0.5 * held * b["close"].pct_change().fillna(0)).cumprod()
print("vectorised total return:", round(fast.iloc[-1] / fast.iloc[0] - 1, 4))
```

```
vectorised total return: -0.0832
```

It gives −8.32% against the loop's −9.54%. The difference has three causes. The vectorised version trades at the close, holds fractions of shares and resizes on every bar. The loop is slower, but each of its steps can do what a real account does.

> **Key idea:** The backtest loop runs one cycle per bar, fill, mark, decide, size and order, so every decision trades only on a later bar.

## What you have now

You have one runnable backtest that joins historical price data, the signal, positions long and short, orders, fills, sizing and books into an equity curve. You can measure that curve with drawdown and the Sharpe ratio. These books still trade for free, and real trades never do. How much do the costs of trading take from a result like this one?
