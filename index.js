(function (moduleFactory) {
    let isNode = typeof module !== undefined && typeof module.exports !== undefined

    if (isNode) {
        const signet = require('./signet-types');
        const matchlight = require('matchlight')(signet);

        module.exports = moduleFactory(signet, matchlight.match);
    } else if (typeof signet === 'object') {
        window.synctomic = moduleFactory(signet, matchlight.match);
    } else {
        throw new Error('The module synctomic requires Signet to run.');
    }

})(function () {
    'use strict';

    return function synctomic(dataValue) {
        const dataStore = {
            value: dataValue,
            updateTimestamp: process.hrtime()
        };

        function fastCopy(object) {
            return JSON.parse(JSON.stringify(object));
        }

        function constructTimestamp(timevalues) {
            return timevalues[0] * 1000000 + timevalues[1] / 1000;
        }

        function compareTimes(timevalues1, timevalues2) {
            var timestamp1 = constructTimestamp(timevalues1);
            var timestamp2 = constructTimestamp(timevalues2);

            return timestamp1 === timestamp2;
        }

        const updateFactory = (lastTimestamp, mutator) => (updatedData) => {
            if (compareTimes(dataStore.updateTimestamp, lastTimestamp)) {
                dataStore.value = updatedData;
                dataStore.updateTimestamp = process.hrtime();
            } else {
                set(mutator);
            }
        };

        function asynchronizeMutator(mutator) {
            const mutatorArity = mutator.length;
            return mutatorArity > 1 ? mutator : (value, update) => update(mutator(value));
        }

        function set(mutator) {
            let dataCopy = fastCopy(dataStore.value);
            const asyncMutator = asynchronizeMutator(mutator);
            const update = updateFactory(dataStore.updateTimestamp, asyncMutator);

            asyncMutator(dataCopy, update);
        }

        function get() {
            return fastCopy(dataStore.value);
        }

        return {
            get: get,
            set: set
        }
    }

});
