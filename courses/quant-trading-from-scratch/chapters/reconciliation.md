# Reconciliation: checking your books against the broker

Pre-trade risk checks make sure every order that leaves is one you meant to send. They cannot tell you what happened after it left. A fill report can be lost on the network. A process can crash after the broker filled an order but before your books recorded it. Your system then trades on wrong numbers, and nothing crashes or looks wrong. How do you find a mistake that makes no noise?

## Compare two lists that should match

Picture checking your card statement against your own list of purchases at the end of the month. You go line by line. Most lines match. One charge for $2,000 is on the statement but not on your list. You do not decide who is right yet. You stop using the card and find out why.

Here is how the picture maps to trading:

- Your list of purchases is your books: the shares and cash your system thinks it holds.
- The card statement is the broker's record of the same account.
- The unknown charge is a gap: a share count or a cash amount that differs.

The picture stops holding in one place. A card statement comes once a month, and you check it by hand. A trading system trades every day, so the check runs every day, in code. Also, the broker can make mistakes too. A gap means a person must look, not that your side is wrong.

## A daily check in code

Run it every day after the market closes, and also when your system starts. The numbers are illustrative: one fill report for a buy of 40 AAA at $50.00 never arrived.

```python
import pandas as pd

ours   = pd.Series({"AAA": 300, "BBB": 0, "CCC": 75}, name="ours")
broker = pd.Series({"AAA": 340, "CCC": 75},           name="broker")
our_cash, broker_cash = 42_485.00, 40_485.00
CASH_TOLERANCE = 1.00          # dollars, for rounding of fees

book = pd.concat([ours, broker], axis=1).fillna(0).astype(int)
book["gap"] = book["broker"] - book["ours"]
print(book)

problems = [f"{sym}: broker has {row.gap:+d} shares" for sym, row in book.iterrows() if row.gap != 0]
if abs(broker_cash - our_cash) > CASH_TOLERANCE:
    problems.append(f"cash: broker has {broker_cash - our_cash:+,.2f}")
for p in problems:
    print("ALERT", p)
```

```
     ours  broker  gap
AAA   300     340   40
BBB     0       0    0
CCC    75      75    0
ALERT AAA: broker has +40 shares
ALERT cash: broker has -2,000.00
```

Walk through it:

1. The broker does not list BBB, because you hold none. `fillna(0)` turns the missing entry into 0, so BBB matches.
2. AAA differs: 340 − 300 = 40 shares more at the broker.
3. Cash differs: 40,485.00 − 42,485.00 = −2,000.00 dollars, which is over the $1.00 tolerance.
4. The two gaps tell one story. 40 × 50.00 = 2,000, so the broker bought 40 shares that your books never recorded.

```inkling
title "Your books against the broker"
layout compare
columns "Your books", "Broker"
row "AAA shares": "300", "340"
row "BBB shares": "0", "0"
row "CCC shares": "75", "75"
row "Cash": "42,485.00", "40,485.00"
step 1: your-books "Your system's record of the account"
step 2: broker "The broker's record of the same account"
step 3: aaa-shares, bbb-shares, ccc-shares "Each share is compared line by line"
step 4: cash "Cash is compared within a small tolerance"
highlight aaa-shares
```

What happens after a gap matters as much as the check:

1. Turn on the kill switch, so no new orders go out on wrong numbers.
2. Find the cause in the broker's list of fills and in your own log of reports.
3. Correct your books from the broker's records, and write down what happened.
4. Turn trading back on only when the next check shows no gaps.

During paper trading the broker is simulated, so gaps come from your own bugs. Run the check there first, and it finds those bugs before real money is at risk.

## Name it

Reconciliation is comparing your positions and cash with the broker's records, one line at a time, and treating every gap as a problem to explain. **Monitoring** is running automatic checks like this one on a live system, on a schedule, so a person does not have to watch it. An **alert** is a message sent to a person when a check fails, for example an email or a chat message.

> **Key idea:** Reconciliation compares your books with the broker's every day, so a lost report shows up as a gap and an alert instead of a silent error.

## What you have now

You have joined pre-trade risk checks and paper trading into a system that checks itself. Every part now has a guard. Data has two times, orders are tracked by state, and only the difference is sent. Every order is checked, and the books are compared each day. The project puts these parts together into one paper-trading system.
