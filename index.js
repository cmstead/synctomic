(function (moduleFactory) {
    let isNode = typeof module !== undefined && typeof module.exports !== undefined

    if (isNode) {
        const signet = require('signet')();
        const matchlight = require('matchlight')(signet);

        module.exports = moduleFactory(signet, matchlight.match);
    } else if (typeof signet === 'object') {
        window.synctomic = moduleFactory(signet, matchlight.match);
    } else {
        throw new Error('The module synctomic requires Signet to run.');
    }

})(function (signet, match) {
    'use strict';

    function helperFactory() {

        const isNull = signet.isTypeOf('null');
        const isReferencible = signet.isTypeOf('variant<composite<^null, object>, function>');

        function constructTimestamp(timevalues) {
            return timevalues[0] * 1000000 + timevalues[1] / 1000;
        }

        function getHRTimestamp() {
            return constructTimestamp(process.hrtime());
        }

        function fastCopy(object) {
            return JSON.parse(JSON.stringify(object));
        }

        function getValue(data, key) {
            return match(data, (matchCase, matchDefault) => {
                matchCase(isReferencible, (data) => data[key]);
                matchDefault(() => null);
            });
        }

        function recurOrReturn(data, keyTokens) {
            return match(data, (matchCase, matchDefault) => {
                matchCase(isNull, (data) => data);
                matchDefault(() => deref(data, keyTokens));
            });
        }

        function deref(data, keyTokens) {
            return match(keyTokens, (matchCase, matchDefault) => {
                matchCase([], () => data);
                matchDefault(([key, ...rest]) => recurOrReturn(getValue(data, key), rest));
            });
        }

        function getProperty(data, deepKey) {
            const keyTokens = match(deepKey.trim(), (matchCase, matchDefault) => {
                matchCase('', () => []);
                matchDefault(() => {
                    return deepKey
                        .split('.')
                        .map((key) => key.trim());
                });
            });

            return deref(data, keyTokens);
        }

        function asynchronizeMutator(mutator) {
            return mutator.length > 1
                ? mutator
                : (value, update) => update(mutator(value));
        }

        return {
            asynchronizeMutator: asynchronizeMutator,
            fastCopy: fastCopy,
            getHRTimestamp: getHRTimestamp,
            getProperty: getProperty
        };

    }

    function watcherFactory(dataStore, { fastCopy }) {
        let watchers = {};

        function getWatchState(watchCheck) {
            return JSON.stringify(watchCheck(dataStore.value));
        }

        function callWatchers(lastData) {
            const currentData = fastCopy(dataStore.value);
            const lastDataCopy = fastCopy(lastData);

            Object.keys(watchers)
                .forEach((key) => {
                    const watcher = watchers[key];
                    const currentState = getWatchState(watcher.watchCheck);
                    const stateMatch = watcher.lastState === currentState;

                    if (!stateMatch) {
                        watchers[key].watchAction(currentData, lastDataCopy);
                        watcher.lastState = currentState;
                    }
                });
        }

        function buildWatcher(watchCheck, watchAction) {
            return {
                lastState: getWatchState(watchCheck),
                watchCheck: watchCheck,
                watchAction: watchAction
            };
        }

        function addWatcher(key, watcher) {
            watchers[key] = watcher;
        }

        function deleteWatcherFactory(key) {
            return () => { watchers[key] = undefined; delete watchers[key]; };
        }

        return {
            addWatcher: addWatcher,
            buildWatcher: buildWatcher,
            callWatchers: callWatchers,
            deleteWatcherFactory: deleteWatcherFactory
        };
    }

    function buildAtom(dataValue) {
        const helpers = helperFactory();
        const {
            asynchronizeMutator,
            fastCopy,
            getHRTimestamp,
            getProperty
        } = helpers;

        let dataStore = {
            value: dataValue,
            updateTimestamp: getHRTimestamp()
        };

        const watchers = watcherFactory(dataStore, helpers)

        const updateFactory = (lastTimestamp, error) => (updatedData) => {
            const lastData = fastCopy(dataStore.value);
            let updateSuccessful = false;

            if (dataStore.updateTimestamp === lastTimestamp) {
                dataStore.value = updatedData;
                dataStore.updateTimestamp = getHRTimestamp();
                updateSuccessful = true;

                watchers.callWatchers(lastData);
            } else {
                error();
            }

            return updateSuccessful;
        };

        function setter(mutator, error) {
            const { value, updateTimestamp } = dataStore;
            const update = updateFactory(updateTimestamp, error);

            asynchronizeMutator(mutator)(fastCopy(value), update);
        }

        function set(mutator) {
            const error = () => set(mutator);
            setter(mutator, error);
        }

        function setOnce(mutator, error) {
            const err = typeof error === 'function' ? error : () => null;
            setter(mutator, err);
        }

        function get() {
            return fastCopy(dataStore.value);
        }

        function buildWatchCheck(key) {
            return (data) => getProperty(data, key);
        }

        function onChange(watchCheck, watchAction) {
            const watchKey = JSON.stringify(getHRTimestamp());
            const constructedCheck = buildWatchCheck(watchCheck);
            const watcher = watchers.buildWatcher(constructedCheck, watchAction);

            watchers.addWatcher(watchKey, watcher);

            return watchers.deleteWatcherFactory(watchKey);
        }

        return {
            get: signet.enforce(
                '() => *',
                get),
            onChange: signet.enforce(
                'variant<string, function>, ' +
                'function<* => undefined> ' +
                '=> function<() => undefined>',
                onChange),
            set: signet.enforce(
                'function<*, [function] => *> ' +
                '=> undefined',
                set),
            setOnce: signet.enforce(
                'function<*, [function] => *> ' +
                '=> undefined',
                setOnce)
        }
    }

    return {
        buildAtom: buildAtom
    };

});
