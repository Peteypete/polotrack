//! Interface to the internal data API used to retrieve data from the database.

const _ = require('lodash');
const fetch = require('node-fetch');

import { getBtcValue } from './exchangeRates';

const INTERNAL_API_URL = 'http://localhost:7878';

/**
 * Given an array of {pair, date} objects, queries the internal API to fetch the exchange rate at as close a
 * point to the supplied times for each of the requests.  Returns a promise that will yield all results
 * after they've all completed in the form `[{pair, rate, date} ...]`.
 */
function batchFetchRates(requests, poloRates, cmcRates, cachedRates, dispatch) {
  if(!cachedRates || !dispatch)
    debugger;

  return Promise.all(_.map(requests, ({pair, date}) => {
    return new Promise((f, r) => {
      if(pair == 'BTC/BTC')
        return f({pair: pair, date: date, rate: 1});

      // check if there's already a cached entry and if there is, return it without making any requests
      const cached = _.filter(cachedRates[pair] || [], cachedRate => {
        return date == cachedRate.date
      });
      if(cached.length !== 0)
        return f({...cached[0], pair: pair});

      const sqlDate = new Date(date).toISOString().substring(0, 19).replace('T', ' ');
      fetch(`${INTERNAL_API_URL}/rate/${encodeURIComponent(pair)}/${encodeURIComponent(sqlDate)}`).then(res => {
        return res.json();
      }).then(body => {
        if(body.no_data) {
          // if no historical data for the currency, then try to get the static rate from Poloniex or coinmarketcap
          body.rate = getBtcValue(pair.split('/')[1], 1, poloRates, cmcRates)
        }
        const realRate = pair.includes('USDT') ? 1 / body.rate : body.rate;

        // cache the rate internally
        dispatch({type: 'globalData/historicalRateReceived', pair: pair, histRate: {date: date, rate: realRate}});

        f({
          pair: pair,
          rate: realRate,
          date: date,
        });
      }).catch(err => {
        console.log('Error while trying to convert result from `batchFetchRates` from JSON.');
        r();
      });
    });
  }));
}

export { batchFetchRates };
