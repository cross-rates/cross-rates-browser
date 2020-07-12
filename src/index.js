import * as currenciesIso from "./resources/currencies-iso-4217.json";
import * as currencyCodes from "./resources/currencies-iso-4217-code.json";
import {monobankApiClient} from "./components/monobankApiClient";
import {binanceApiClient} from "./components/binanceApiClient";
import {cryptoCurrenciesRepository} from "./components/CryptoCurrenciesRepository";
import {cryptoRatesRepository} from "./components/CryptoRatesRepository";
import {fiatRatesRepository} from "./components/FiatRatesRepository";

const uahNumCode = 980;
const BTC = "BTC";
const EUR = "EUR";
const USDT = "USDT";

function getCryptoCurrencies() {
    return cryptoCurrenciesRepository.getLatest()
        .sort()
        .map(currencyStrCode => ({
            crypto: true,
            code: currencyStrCode,
            afterDecimalPoint: 8,
            name: currencyStrCode,
        }))
}

function getCryptoPrice(left, right) {
    const cryptoRates = cryptoRatesRepository.getLatest();
    let ticker = cryptoRates.filter(r => r.symbol === `${left}${right}`)[0] || {};
    let price = +(ticker.price);

    if (price && !isNaN(price)) {
        return price;
    }
    ticker = cryptoRates.filter(r => r.symbol === `${right}${left}`)[0] || {};
    price = +(ticker.price);

    if (price && !isNaN(price)) {
        return 1 / price;
    }
    const ticker1 = cryptoRates.filter(r => r.symbol === `${left}${USDT}`)[0] || {};
    const price1 = +(ticker1.price);
    const ticker2 = cryptoRates.filter(r => r.symbol === `${right}${USDT}`)[0] || {};
    const price2 = +(ticker2.price);
    price = price1 / price2;

    if (price && !isNaN(price)) {
        return price;
    }
}

function transformCrypto(amountFrom, currencyFrom, currencyTo) {
    let price = getCryptoPrice(currencyFrom, currencyTo);
    if (price) {
        return amountFrom * price;
    }
    price = getCryptoPrice(currencyTo, currencyFrom);
    if (price) {
        return amountFrom / price;
    }
}

function transformFiatToCrypto(fiatAssetAmount, currency, resultCurrency) {
    if (currency === resultCurrency) {
        return fiatAssetAmount
    }
    const eurAmount = (currency === EUR)
        ? fiatAssetAmount
        : transformFiatToFiat(fiatAssetAmount, currency, EUR);

    const btcEurPrice = getCryptoPrice(BTC, EUR);
    const btcAmount = eurAmount / btcEurPrice;

    if (resultCurrency === BTC) {
        return btcAmount
    }
    let amount = transformCrypto(btcAmount, BTC, resultCurrency);
    if (amount) {
        return amount;
    }
    console.warn("not found adequate transformation", arguments);
    return 0;
}

function transformCurrencyToUAH(amount, currencyNumCode) {
    if (currencyNumCode === uahNumCode) {
        return amount;
    }
    const rateCross = findFiatRate(currencyNumCode, uahNumCode);
    return amount * rateCross;
}

function transformFiatToFiat(amount, currency, resultCurrency) {
    const outputCurrencyNumCode = +(currencies.getByStringCode(resultCurrency).numCode);
    const currencyNumCode = +(currencies.getByStringCode(currency).numCode);

    if (currencyNumCode === outputCurrencyNumCode) {
        return amount
    }
    const amountInUah = transformCurrencyToUAH(amount, currencyNumCode);

    if (outputCurrencyNumCode === uahNumCode) {
        return amountInUah
    }
    const rateCross = findFiatRate(outputCurrencyNumCode, uahNumCode);
    return amountInUah / rateCross;
}


function transformCryptoToCrypto(amount, currency, resultCurrency) {
    if (currency === resultCurrency) {
        return amount
    }
    let resultAmount = transformCrypto(amount, currency, resultCurrency);
    if (resultAmount) {
        return resultAmount
    }
    let btcAmount = transformCrypto(amount, currency, BTC);
    return transformCrypto(btcAmount, BTC, resultCurrency);
}

function transformCryptoToFiat(amount, currency, resultCurrency) {
    const btcAmount = (currency === BTC)
        ? amount
        : transformCrypto(amount, currency, BTC);

    const btcEurPrice = getCryptoPrice(BTC, EUR);
    const amountInEur = btcAmount * btcEurPrice;

    if (currency === BTC && resultCurrency === EUR) {
        return amountInEur;
    }

    return transformFiatToFiat(amountInEur, EUR, resultCurrency);
}

const cryptoCurrencyTypeName = "crypto";
const fiatCurrencyTypeName = "fiat";
const typeToTransformer = {
    [fiatCurrencyTypeName + fiatCurrencyTypeName]: transformFiatToFiat,
    [fiatCurrencyTypeName + cryptoCurrencyTypeName]: transformFiatToCrypto,
    [cryptoCurrencyTypeName + fiatCurrencyTypeName]: transformCryptoToFiat,
    [cryptoCurrencyTypeName + cryptoCurrencyTypeName]: transformCryptoToCrypto,
};

const currencies = {
    getByStringCode(code) {
        return currenciesIso[code]
    },
    getByNumCode(code) {
        const currencyCodeLength = 3;
        const strCode = "" + code;
        let addZeros = currencyCodeLength - strCode.length;

        while (addZeros > 0) {
            code = "0" + code;
            --addZeros
        }
        let res = currencyCodes[code];
        if (!res) {
            console.warn("can't find currency data for code", code)
        }
        return res
    },
};

function findFiatRate(left, right) {
    const rate = fiatRatesRepository.getLatest().filter(r => (r.currencyCodeA === left)
        && (r.currencyCodeB === right))[0];

    return rate.rateCross || ((rate.rateBuy + rate.rateSell) / 2);
}

function getFiatCurrencies() {
    return Object
        .values(fiatRatesRepository.getLatest().reduce((result, rate) => {
            try {
                const currency = currencies.getByNumCode(rate.currencyCodeA);
                result[currency.code] = currency;
            } catch (e) {
                console.error(e)
            }
            try {
                const currency = currencies.getByNumCode(rate.currencyCodeB);
                result[currency.code] = currency;
            } catch (e) {
                console.error(e)
            }
            return result
        }, {}))
        .sort((a, b) => compareStrings(a.code, b.code))
}

function isFiat(currencyStrCode) {
    return !!currencies.getByStringCode(currencyStrCode);
}

function getCurrencyType(currency) {
    return isFiat(currency) ? fiatCurrencyTypeName : cryptoCurrencyTypeName
}

function compareStrings(a, b) {
    return (a < b) ? -1 : (a > b ? 1 : 0)
}

export const rates = {
    transform(amount, currency, resultCurrency) {
        const pairType = getCurrencyType(currency) + getCurrencyType(resultCurrency);
        return typeToTransformer[pairType](amount, currency, resultCurrency)
    },
    isReady() {
        return !!fiatRatesRepository.getLatest().length
            && !!cryptoRatesRepository.getLatest().length
    },
    getCryptoCurrencies() {
        return getCryptoCurrencies()
    },
    getFiatCurrencies() {
        return getFiatCurrencies()
    },
    refreshRates() {
        fetchLatestRates()
    },
};

const milli = 1000;
const startTimeout = 20 * milli;
const timeoutStep = 5 * milli;
const endTimeout = 5 * milli;
let currentTimeout = startTimeout;
let currentCryptoTimeout = 30 * milli;
let savedRates = null;
let savedCryptoRates = null;

function fetchLatestRates() {
    [
        function fetchLatestFiatRates() {
            monobankApiClient.getRates(
                fiatRates => {
                    if (fiatRates
                        && !fiatRates.errorDescription
                        && fiatRates.length
                    ) {
                        if (fiatRates !== savedRates) {
                            fiatRatesRepository.save(fiatRates);
                            savedRates = fiatRates;
                        }
                    } else {
                        console.warn("Fetching latest rates failed", fiatRates);
                        throw fiatRates
                    }
                },
                e => {
                    console.warn(e);
                    console.log(`Will re-fetch after timeout: ${currentTimeout / milli}s`);
                    setTimeout(fetchLatestFiatRates, currentTimeout);
                    let newTimeoutValue = currentTimeout - timeoutStep;
                    if (newTimeoutValue < endTimeout) {
                        newTimeoutValue = endTimeout
                    }
                    currentTimeout = newTimeoutValue;
                }
            );
        },
        function fetchCryptoCurrencies() {
            binanceApiClient.fetchCryptoCurrencies(
                response => {
                    let symbols = response.data.symbols;
                    if (symbols) {
                        cryptoCurrenciesRepository.save(Object.keys(symbols
                            .sort((a, b) => compareStrings(a.symbol, b.symbol))
                            .reduce((result, symbol) => {
                                result[symbol.baseAsset] = true;
                                result[symbol.quoteAsset] = true;
                                return result
                            }, {})));
                    } else {
                        console.warn("Fetching latest binance symbols failed", response);
                        throw response
                    }
                },
                e => {
                    console.warn(e);
                    const timeout = 10000;
                    console.warn(`Will re-fetch cryptoRates after timeout: ${timeout / milli}s`);
                    setTimeout(fetchCryptoCurrencies, timeout);
                }
            )
        },
        function fetchLatestCryptoCurrenciesRates() {
            binanceApiClient.fetchLatestCryptoCurrenciesRates(
                response => {
                    let cryptoRates = response.data;
                    if (cryptoRates) {
                        if (cryptoRates !== savedCryptoRates) {
                            cryptoRatesRepository.save(cryptoRates);
                            savedCryptoRates = cryptoRates;
                        }
                    } else {
                        console.warn("Fetching latest cryptoRates failed", response);
                        throw response
                    }
                },
                e => {
                    console.warn(e);
                    console.warn(`Will re-fetch cryptoRates after timeout: ${currentCryptoTimeout / milli}s`);
                    setTimeout(fetchLatestCryptoCurrenciesRates, currentCryptoTimeout);
                });
        },
    ].forEach(task => {
        try {
            task()
        } catch (e) {
            console.error(e);
        }
    });
}

fetchLatestRates();

