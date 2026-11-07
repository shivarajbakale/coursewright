"""Generates outline.json. Each lesson: (key, name, plain, summary, prerequisites, terms)."""
import json
from pathlib import Path

M = [
 ("markets", "How markets set prices", "What is traded, how a price is agreed, and how to measure a price change.", True, [
  ("market", "A market", "where buyers and sellers agree on prices", "A market matches people who want to buy with people who want to sell, and every match sets a price.", [], ["trade"]),
  ("share", "A share", "a small piece of owning a company", "A share is a slice of a company's ownership that people buy and sell on an exchange.", ["market"], ["exchange", "ticker"]),
  ("quote", "A quote", "the best prices to buy and sell now", "At any moment the best bid is the highest price a buyer offers and the best ask is the lowest price a seller accepts.", ["share"], ["best bid", "best ask"]),
  ("bid-ask-spread", "The bid-ask spread", "the gap you pay to trade at once", "The gap between ask and bid is a cost every immediate trade pays.", ["quote"], ["mid price"]),
  ("price-bar", "A price bar", "one period's open, high, low and close", "A bar summarises all trades in one period by four prices and the volume traded.", ["quote"], ["volume"]),
  ("return", "A return", "the percentage change in a price", "A return measures a gain or loss as a fraction of what you started with.", ["price-bar"], []),
  ("compounding", "Compounding", "returns multiply over time, they don't add", "Returns over several periods combine by multiplying growth factors, so a loss needs a bigger gain to recover.", ["return"], ["growth factor"]),
  ("log-return", "Log returns", "returns you can add across periods", "The logarithm of a growth factor turns multiplying returns into adding them.", ["compounding"], ["logarithm"]),
 ]),
 ("risk", "Measuring risk and performance", "How to put numbers on how much a strategy earns and how bumpy the ride is.", True, [
  ("standard-deviation", "Standard deviation", "how far numbers typically sit from their average", "The standard deviation measures the typical distance of numbers from their mean.", ["return"], ["mean", "variance"]),
  ("volatility", "Volatility", "how much returns swing from day to day", "Volatility is the standard deviation of returns, the standard measure of risk.", ["standard-deviation"], []),
  ("annualising", "Annualising", "scaling daily numbers up to a year", "Average returns scale with time and volatility with the square root of time.", ["volatility", "compounding"], ["trading days"]),
  ("drawdown", "Drawdown", "the fall from a peak to a later low", "A drawdown measures how far an account has fallen from its highest value so far.", ["compounding"], ["equity curve", "maximum drawdown"]),
  ("benchmark", "A benchmark", "what doing nothing clever would have earned", "Buying once and holding is the benchmark every strategy must beat after costs.", ["return"], ["buy and hold"]),
  ("risk-free-rate", "The risk-free rate", "what safe money earns while you wait", "Cash in short government bills earns a nearly safe rate, so a strategy's real gain is its return above it.", ["return"], ["excess return"]),
  ("sharpe-ratio", "The Sharpe ratio", "excess return for each unit of volatility", "The Sharpe ratio divides excess return by volatility so strategies with different risk can be compared.", ["risk-free-rate", "annualising"], ["Sortino ratio"]),
  ("trading-edge", "A trading edge", "a repeatable advantage that survives costs", "An edge is a small, repeatable tilt in your favour, and it usually comes from behaviour, risk or market rules.", ["sharpe-ratio", "bid-ask-spread"], ["risk premium"]),
  ("strategy-families", "Strategy families", "following trends, betting on reversals, collecting carry", "Most systematic strategies bet that a move continues, that it reverses, or that holding a risk pays.", ["trading-edge"], ["trend", "mean reversion", "carry"]),
 ]),
 ("backtest", "Building a backtest in Python", "Replay history through a rule and keep honest books of what it would have done.", True, [
  ("historical-data", "Historical price data", "past bars loaded in time order", "A backtest starts from a table of dated bars, loaded and checked with pandas.", ["price-bar"], ["DataFrame", "time index"]),
  ("signal", "A signal", "a rule that turns data into a view", "A signal is a function from the data known so far to a desired direction or size.", ["historical-data", "strategy-families"], ["moving average"]),
  ("position", "A position", "how much of an asset you hold", "A position is the signed quantity you hold, and it is what earns returns.", ["signal"], ["long", "flat"]),
  ("short-selling", "Short selling", "selling borrowed shares to profit from a fall", "Selling shares you borrowed and buying them back later earns money when the price falls.", ["position"], ["borrow"]),
  ("orders", "Orders", "instructions to buy or sell", "A market order trades at once at the best price; a limit order waits for a price you name.", ["position", "quote"], ["market order", "limit order"]),
  ("fills", "Fills", "what actually traded, at what price", "A fill records the quantity and price an order really got, which can differ from what you asked.", ["orders"], ["partial fill"]),
  ("position-sizing", "Position sizing", "how much money each trade uses", "Sizing turns a signal into a quantity, for example a fixed fraction of the account.", ["fills", "volatility"], ["notional"]),
  ("backtest-accounting", "Backtest accounting", "cash, holdings and equity, bar by bar", "Each bar the books update cash, holdings and equity so every gain and cost is counted once.", ["position-sizing", "short-selling"], ["mark to market"]),
  ("backtest-loop", "The backtest loop", "data, signal, orders, fills and books together", "A backtest repeats one cycle per bar: read data, decide, trade, update the books.", ["backtest-accounting", "drawdown", "sharpe-ratio"], ["vectorised backtest"]),
 ]),
 ("traps", "Costs and the traps that fake profits", "Why most backtests look better than reality, and how to make yours honest.", True, [
  ("transaction-costs", "Transaction costs", "fees and spread paid on every trade", "Commissions and the spread are paid on every trade, so trading more costs more.", ["backtest-loop"], ["commission", "turnover"]),
  ("slippage", "Slippage", "the gap between expected and actual price", "Prices move between decision and fill, so real fills are usually worse than the backtest's.", ["transaction-costs", "fills"], []),
  ("look-ahead-bias", "Look-ahead bias", "using information from after the decision", "A backtest that uses any data not yet known at decision time invents profit.", ["backtest-loop"], ["shift"]),
  ("adjusted-prices", "Adjusted prices", "prices corrected for splits and dividends", "Splits and dividends break a raw price series, so returns need adjusted prices.", ["historical-data", "return"], ["stock split", "dividend"]),
  ("survivorship-bias", "Survivorship bias", "testing only the companies that survived", "Leaving out companies that failed or were delisted makes any strategy look better.", ["adjusted-prices"], ["delisting", "universe"]),
  ("out-of-sample", "Out-of-sample testing", "judging a rule on data it never saw", "Data used to design a rule cannot judge it; held-back data can.", ["look-ahead-bias"], ["in-sample"]),
  ("multiple-testing", "Multiple testing", "many tries make luck look like skill", "Testing many variants guarantees some look good by chance alone.", ["out-of-sample", "sharpe-ratio"], ["parameter"]),
  ("overfitting", "Overfitting", "a rule that fits past noise", "A rule tuned until it matches history's noise fails on new data.", ["multiple-testing"], ["noise"]),
  ("walk-forward", "Walk-forward testing", "fit on the past, test on the next period", "Walk-forward testing rolls a fit window and a test window forward through time.", ["overfitting"], ["rolling window"]),
 ]),
 ("sizing", "Sizing, risk control and honest evaluation", "How big to bet, how to cap losses, and how to decide a result is real before risking money.", True, [
  ("kelly", "The Kelly criterion", "the bet size that grows money fastest", "Kelly picks the fraction of capital that maximises long-run growth when the odds are known.", ["position-sizing", "log-return"], ["expected value"]),
  ("fractional-kelly", "Fractional Kelly", "betting less than Kelly because the odds are guesses", "Because the edge is estimated, betting a fraction of Kelly gives up a little growth for much less risk.", ["kelly"], []),
  ("volatility-targeting", "Volatility targeting", "sizing so risk stays steady", "Scaling positions by recent volatility keeps a strategy's risk near a chosen level.", ["fractional-kelly", "volatility"], ["leverage"]),
  ("risk-limits", "Risk limits", "rules that cap losses and concentration", "Hard limits on loss, position size and exposure stop one bad day from ending the strategy.", ["volatility-targeting", "drawdown"], ["stop loss", "exposure"]),
  ("sharpe-significance", "Is the Sharpe real", "how many trades a result needs", "A Sharpe ratio estimated from little data has a wide error, so a result needs enough independent trades.", ["sharpe-ratio", "multiple-testing"], ["standard error", "t-statistic"]),
  ("stress-tests", "Stress tests", "changing assumptions to find what breaks", "Doubling costs, shifting dates and removing the best trades shows how fragile a result is.", ["sharpe-significance", "slippage"], []),
  ("research-log", "A research log", "writing the hypothesis down before testing", "Recording the idea, every variant tried and every result keeps you honest about multiple testing.", ["stress-tests", "walk-forward"], ["hypothesis"]),
  ("paper-trading", "Paper trading", "running the strategy live without real money", "Running the strategy on live data with simulated fills checks the parts a backtest cannot.", ["research-log", "risk-limits"], ["staged deployment"]),
 ]),
 ("stat-arb", "Statistical arbitrage with pairs", "Trading the gap between two prices that move together.", True, [
  ("covariance", "Covariance", "how two returns move together", "Covariance averages the product of two series' deviations, positive when they move together.", ["standard-deviation"], []),
  ("correlation", "Correlation", "covariance scaled to between -1 and 1", "Correlation divides covariance by both volatilities so its size is comparable across pairs.", ["covariance", "volatility"], []),
  ("stationarity", "Stationarity", "a series that keeps returning to the same level", "A stationary series has a stable mean and spread, so a gap from its mean tends to close.", ["correlation", "strategy-families"], ["random walk"]),
  ("cointegration", "Cointegration", "two wandering prices with a stable gap", "Two prices that each wander can still have a combination that is stationary.", ["stationarity"], ["hedge ratio", "Engle-Granger test"]),
  ("half-life", "Mean-reversion half-life", "how fast a gap closes", "The half-life estimates how long a spread takes to close half its distance to the mean.", ["cointegration"], []),
  ("pairs-trade", "A pairs trade", "buying the cheap leg and selling the rich leg", "A pairs trade enters when the spread's z-score is far from zero and exits as it reverts.", ["half-life", "short-selling", "backtest-loop"], ["z-score", "leg"]),
  ("borrow-costs", "Borrow costs", "what holding a short leg costs each day", "Shorting needs borrowed shares that cost a fee, and a pair can be recalled or squeezed.", ["pairs-trade", "transaction-costs"], ["borrow fee", "recall", "financing"]),
 ]),
 ("factors", "Factor investing and portfolios", "Ranking many assets against each other and combining them into one portfolio.", True, [
  ("linear-regression", "Linear regression", "the best straight line through points", "Least squares finds the line that minimises squared vertical distances.", ["covariance"], ["slope", "residual"]),
  ("beta", "Beta", "how much an asset moves with the market", "Beta is the slope of an asset's returns against the market's, the market risk it carries.", ["linear-regression", "benchmark"], ["alpha"]),
  ("market-neutral", "Market-neutral portfolios", "longs and shorts that cancel market risk", "Balancing beta on the long and short side leaves a bet on the spread between them.", ["beta", "short-selling"], ["hedge"]),
  ("cross-sectional-ranking", "Cross-sectional ranking", "comparing assets with each other on one date", "Ranking every asset by a measure on the same date turns a signal into relative views.", ["signal", "survivorship-bias"], ["cross-section"]),
  ("factor-portfolio", "A factor portfolio", "long the top group, short the bottom group", "Sorting assets into groups by a characteristic and going long the top, short the bottom isolates a factor.", ["cross-sectional-ranking", "market-neutral"], ["factor", "quantile"]),
  ("momentum", "Momentum", "recent winners keep winning for a while", "Assets that rose most over the past year tend to keep outperforming over the next months.", ["factor-portfolio"], ["lookback", "skip month"]),
  ("mean-variance", "Mean-variance optimisation", "choosing weights for the best return per risk", "Combining expected returns and a covariance matrix gives the weights with the best Sharpe ratio.", ["correlation", "momentum"], ["diversification", "covariance matrix"]),
  ("shrinkage", "Shrinkage", "pulling noisy estimates toward a simple guess", "Shrinking estimated returns and covariances toward simple targets stops the optimiser from chasing noise.", ["mean-variance", "overfitting"], []),
 ]),
 ("derivatives", "Futures and options", "Contracts on a future price, how they are priced, and how volatility is traded.", True, [
  ("futures", "A futures contract", "agreeing today on a price for later", "A futures contract fixes a price for a later date, and gains and losses are settled each day.", ["short-selling", "risk-free-rate"], ["margin", "daily settlement", "expiry"]),
  ("futures-roll", "Rolling futures", "replacing an expiring contract with the next", "Holding futures for long means rolling into later contracts, and the curve's shape adds or subtracts return.", ["futures", "strategy-families"], ["futures curve", "contango", "backwardation"]),
  ("option-payoff", "Option payoffs", "the right but not the duty to trade", "A call pays the rise above a strike at expiry and a put pays the fall below it.", ["futures"], ["call", "put", "strike", "premium"]),
  ("put-call-parity", "Put-call parity", "the fixed link between call and put prices", "A call minus a put equals the stock minus the discounted strike, or someone can lock in free money.", ["option-payoff"], ["arbitrage", "present value"]),
  ("normal-distribution", "The normal distribution", "the bell curve of many small effects", "The normal distribution describes outcomes built from many small random effects, set by a mean and a standard deviation.", ["standard-deviation", "log-return"], ["probability density"]),
  ("binomial-pricing", "Pricing by replication", "copying an option's payoff with stock and cash", "In a one-step model, a mix of stock and cash copies the option, so the option must cost what the mix costs.", ["put-call-parity"], ["risk-neutral probability"]),
  ("black-scholes", "The Black-Scholes formula", "an option price from five inputs", "Black-Scholes prices a European option from the price, strike, time, rate and volatility.", ["binomial-pricing", "normal-distribution"], []),
  ("delta", "Delta", "how much an option moves per $1 of stock", "Delta is the change in option value for a small change in the stock price.", ["black-scholes"], ["Greeks"]),
  ("delta-hedging", "Delta hedging", "holding stock to cancel an option's price risk", "Rebalancing a stock position to cancel delta leaves a profit or loss driven by realised volatility.", ["delta", "volatility"], ["gamma", "rebalancing"]),
  ("implied-volatility", "Implied volatility", "the volatility the market price implies", "Solving Black-Scholes backwards for volatility turns an option price into the market's volatility estimate.", ["black-scholes"], ["vega"]),
  ("volatility-smile", "The volatility smile", "different implied volatility at each strike", "Implied volatility varies with strike and expiry because real returns have fat tails and crashes.", ["implied-volatility"], ["skew", "fat tails"]),
  ("volatility-risk-premium", "The volatility risk premium", "options usually cost more than they pay", "Implied volatility tends to exceed later realised volatility, which option sellers earn with crash risk.", ["volatility-smile", "delta-hedging", "trading-edge"], ["realised volatility", "straddle"]),
 ]),
 ("ml", "Machine learning research without fooling yourself", "Using models on market data while keeping the future out of the past.", True, [
  ("point-in-time-features", "Point-in-time features", "inputs built only from what was known then", "Every feature must use only data published before the decision time, including revisions.", ["look-ahead-bias", "cross-sectional-ranking"], ["feature", "publication lag"]),
  ("labels", "Labels", "what the model is asked to predict", "A label fixes the target, such as the return over the next ten days or which barrier is hit first.", ["point-in-time-features", "risk-limits"], ["triple-barrier label", "horizon"]),
  ("classifier", "A classification model", "predicting the chance of up or down", "A classifier such as logistic regression learns from labelled examples to output a probability.", ["labels", "linear-regression"], ["logistic regression", "probability"]),
  ("purged-cross-validation", "Purged cross-validation", "testing folds that cannot see each other", "Overlapping labels leak between folds, so training examples near each test fold are removed.", ["classifier", "walk-forward"], ["fold", "embargo"]),
  ("probability-sizing", "Sizing from probability", "turning a predicted chance into a position", "A position grows with how far the predicted probability is from a coin flip, capped by risk limits.", ["purged-cross-validation", "fractional-kelly"], []),
  ("signal-decay", "Signal decay", "how fast a prediction stops being useful", "Measuring the signal's edge at later horizons shows how quickly it must be traded.", ["probability-sizing", "transaction-costs"], ["information coefficient"]),
 ]),
 ("execution", "Execution and market microstructure", "How orders meet in the book, and how to trade size without moving the price against you.", True, [
  ("order-book", "The limit order book", "every waiting order, queued by price and time", "The book lists resting limit orders at each price, and orders at the same price fill first-come, first-served.", ["orders", "bid-ask-spread"], ["depth", "queue position"]),
  ("market-impact", "Market impact", "your own trading moving the price", "A large order eats through the book, and impact grows roughly with the square root of its size.", ["order-book", "slippage"], ["square-root law", "average daily volume"]),
  ("implementation-shortfall", "Implementation shortfall", "the full cost from decision to fill", "Shortfall compares the price when you decided with the prices you finally got, including what never filled.", ["market-impact"], ["arrival price", "opportunity cost"]),
  ("twap", "TWAP execution", "trading equal slices over time", "Time-weighted execution splits an order into equal pieces spread across a period.", ["implementation-shortfall"], ["child order"]),
  ("vwap", "VWAP execution", "trading more when the market trades more", "Volume-weighted execution follows the day's usual volume pattern to hide in the crowd.", ["twap"], ["volume profile"]),
  ("transaction-cost-analysis", "Transaction cost analysis", "measuring what each trade really cost", "Comparing fills with benchmarks after the fact splits cost into spread, impact and timing.", ["vwap"], ["benchmark price"]),
 ]),
 ("platform", "Building an in-house trading system", "The parts of a real trading system and how they fit, from data to broker and back.", True, [
  ("event-driven-backtester", "The event-driven backtester", "replaying events in timestamp order", "Processing every market and order event in time order lets the same strategy code run in backtest and live.", ["backtest-loop", "fills"], ["event", "event queue"]),
  ("market-data-store", "A market data store", "keeping raw and cleaned data with timestamps", "Storing every observation with when it happened and when you learned it makes point-in-time research possible.", ["event-driven-backtester", "point-in-time-features"], ["bitemporal", "symbology"]),
  ("broker-api", "A broker API", "sending orders and getting fills back", "A broker's API accepts orders and reports their states: sent, accepted, partly filled, filled, cancelled.", ["event-driven-backtester", "orders"], ["order state", "FIX protocol"]),
  ("order-management", "An order management system", "turning target positions into orders", "The order management system compares targets with holdings and open orders, then sends only the difference.", ["broker-api", "twap"], ["idempotency"]),
  ("pre-trade-risk", "Pre-trade risk checks", "blocking bad orders before they leave", "Every order passes size, price and exposure checks, and a kill switch stops everything at once.", ["order-management", "risk-limits"], ["kill switch", "fat finger"]),
  ("reconciliation", "Reconciliation", "checking your books against the broker", "Comparing your positions and cash with the broker's every day, and alerting on gaps, catches silent failures.", ["pre-trade-risk", "paper-trading"], ["monitoring", "alert"]),
 ]),
]

COLOUR = "indigo"
concepts, edges, modules, seen = [], [], [], set()
for mi, (mkey, mtitle, msum, project, lessons) in enumerate(M, 1):
    chapters = []
    for key, name, plain, summary, pre, terms in lessons:
        assert key not in seen, key
        for p in pre:
            assert p in seen, (key, p)
            edges.append({"from": p, "to": key})
        seen.add(key)
        concepts.append({"key": key, "name": name, "summary": summary, "terms": terms})
        chapters.append({"key": key, "title": f"{name}: {plain}", "readingMinutes": 5, "conceptKeys": [key], "summary": summary})
    modules.append({"key": mkey, "title": mtitle, "summary": msum, "chapters": chapters,
                    **({"projectKey": f"{mkey}-project"} if project else {})})

outline = {
    "title": "Quantitative trading from scratch to an in-house system",
    "topic": "Quantitative trading for software engineers",
    "summary": "Starting from what a market and a price are, the course teaches how to measure returns and risk, "
               "build and honestly test a systematic strategy in Python, and size and control its risk. It then goes "
               "deep into pairs trading, factor portfolios, futures and options, machine-learning research, execution "
               "and the parts of an in-house trading system, with a project in every module.",
    "colour": COLOUR, "concepts": concepts, "edges": edges, "modules": modules,
}
Path(__file__).with_name("outline.json").write_text(json.dumps(outline, indent=2, ensure_ascii=False) + "\n")
print(len(concepts), "lessons in", len(modules), "modules")
