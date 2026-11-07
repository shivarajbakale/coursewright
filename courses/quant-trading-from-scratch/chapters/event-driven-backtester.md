# The event-driven backtester: replaying events in timestamp order

The backtest loop you built takes a whole table of bars and walks through it. A vectorised backtest goes further and computes every day in one pass over the columns. Live trading does not work like that. Prices arrive one at a time, and a fill comes back only after you send an order. If your backtest and your live system are two separate programs, they can disagree, and you will not know which one is wrong. How do you write one strategy that runs the same way in both?

## One pile of messages, sorted by time

Picture a post room that sorts letters by the time on the postmark. The clerk always opens the oldest letter first. Opening a letter can create a new letter, for example a reply, and the reply goes into the pile with its own time. The clerk never looks at a letter whose time is still in the future.

Here is how the picture maps to the system:

- A letter is one message: a new bar, an order, or a fill.
- The postmark is the time the message happens.
- The clerk is a loop that takes the oldest message and hands it to the code that handles that kind.

The picture stops holding in one place. Real post can arrive late, after newer letters. In a backtest you know every time in advance, so nothing is late. Live, the messages come from the market and from your broker, the firm that sends your orders to the market. You must sort them as they arrive.

```inkling
title "The event loop"
layout cycle
center "until the queue is empty"
pop: circle "Take oldest event"
route: round "Pick its handler"
run: round "Handler runs"
push: round "New events join\nthe queue"
cycle pop, route, run, push
step 1: pop "The loop takes the event with the earliest time"
step 2: route "The event's kind picks the code that handles it"
step 3: run "A bar goes to the strategy, an order to the broker"
step 4: push "Orders and fills go back in with their own times"
highlight pop
```

## A queue in 25 lines

Python's `heapq` module keeps a list ordered so that the smallest item comes out first. Each message carries its time and a counter. The counter breaks ties: when two messages have the same time, the one pushed first comes out first.

```python
import heapq
from dataclasses import dataclass, field

@dataclass(order=True)
class Event:
    time: int                      # minutes after the open
    seq: int                       # breaks ties: first pushed, first out
    kind: str = field(compare=False)
    data: dict = field(compare=False)

queue, seq = [], 0
def push(time, kind, data):
    global seq
    heapq.heappush(queue, Event(time, seq, kind, data)); seq += 1

def on_bar(e):                     # the strategy: buy 10 when close > 100
    if e.data["close"] > 100:
        push(e.time, "order", {"qty": 10})

def on_order(e):                   # simulated broker: fill 1 minute later
    push(e.time + 1, "fill", {"qty": e.data["qty"], "price": 101.0})

for t, close in [(0, 99.5), (1, 100.5), (2, 100.8)]:
    push(t, "bar", {"close": close})

handlers = {"bar": on_bar, "order": on_order, "fill": lambda e: None}
while queue:
    e = heapq.heappop(queue)
    print(e.time, e.kind, e.data)
    handlers[e.kind](e)
```

```
0 bar {'close': 99.5}
1 bar {'close': 100.5}
1 order {'qty': 10}
2 bar {'close': 100.8}
2 fill {'qty': 10, 'price': 101.0}
2 order {'qty': 10}
3 fill {'qty': 10, 'price': 101.0}
```

The prices are made up. Walk through the trace:

1. At minute 0 the close is 99.5. That is not above 100, so the strategy does nothing.
2. At minute 1 the close is 100.5. The strategy pushes an order with time 1.
3. The order comes out next, because its time is 1. The simulated broker pushes a fill for minute 2.
4. At minute 2 the bar and the fill have the same time. The bar was pushed first, so the strategy sees it first.
5. The strategy sends a second order, and its fill arrives at minute 3.

The strategy never reads a future bar, because a bar at minute 2 is not in its hands until the clock reaches minute 2. Because of this, look-ahead bias cannot creep in through the loop itself. The one-minute delay before the fill is a choice you make about the market, like your slippage assumption.

## Name it

An **event** is one timestamped message the system must react to: a bar, an order or a fill. An **event queue** holds the events not yet handled and always gives out the earliest one. An event-driven backtester is a loop that takes events from that queue in time order and passes each to its handler.

To go live, you keep `on_bar` as it is. You replace the loop over stored bars with live prices, and the simulated broker with a real one.

> **Key idea:** An event-driven backtester replays every bar, order and fill in timestamp order, so the strategy code sees the same sequence in a backtest as it would live.

## What you have now

You have joined the backtest loop and fills into one engine that works on time-ordered events. The engine is only as honest as the bars you feed it. If a price was corrected a day later, which version did the strategy see at minute 1, and how do you store both?
