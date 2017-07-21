'use strict';

if (typeof exploreFunction !== 'function') {
    require('quokka-signet-explorer').before();
}

const assert = require('chai').assert;
// const sinon = require('sinon');
const prettyJson = require('./test-utils/prettyJson');

const synctomic = require('../index.js');

describe('synctomic', function () {
    require('./test-utils/approvals-config');

    describe('construction', function () {
        it('should create a new atom when called which stores original data', function () {
            const myData = { foo: 'bar' };
            const dataAtom = synctomic(myData);
            const result = dataAtom.get();

            this.verify(prettyJson(result));
        });

        it('should never provide access to the original object', function () {
            const myData = { foo: 'bar' };
            const dataAtom = synctomic(myData);
            const result = dataAtom.get();

            assert.notEqual(myData, result);
        });
    });

    describe('set', function () {
        it('should expose a set endpoint', function () {
            const dataAtom = synctomic({ foo: 'bar' });
            const newData = { baz: 'quux' };

            dataAtom.set((data, update) => update(newData));
            const result = dataAtom.get();

            this.verify(prettyJson(result));
        });

        it('should iterate on update until update succeeds', function (done) {
            const dataAtom = synctomic('bar');
            let callCount = 0;

            function asyncUpdate(data, update) {
                setTimeout(function () {
                    callCount++;
                    update('foo');

                    if (dataAtom.get() === 'foo') {
                        assert.equal(callCount, 2);
                        done();
                    }
                }, 10);
            }

            dataAtom.set(asyncUpdate);
            dataAtom.set((value, update) => update('baz'));
        });

        it('should resolve an update on a function which returns a value', function () {
            const dataAtom = synctomic('foo');

            dataAtom.set(() => 'bar');

            assert.equal(dataAtom.get(), 'bar');
        });
    });
});

if (typeof global.runQuokkaMochaBdd === 'function') {
    runQuokkaMochaBdd();
}
