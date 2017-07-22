'use strict';

if (typeof exploreFunction !== 'function') {
    require('quokka-signet-explorer').before();
}

const assert = require('chai').assert;
const prettyJson = require('./test-utils/prettyJson');
const sinon = require('sinon');

const synctomic = require('../index.js');

describe('synctomic', function () {
    require('./test-utils/approvals-config');

    describe('construction', function () {
        it('should create a new atom when called which stores original data', function () {
            const myData = { foo: 'bar' };
            const dataAtom = synctomic.buildAtom(myData);
            const result = dataAtom.get();

            this.verify(prettyJson(result));
        });

        it('should never provide access to the original object', function () {
            const myData = { foo: 'bar' };
            const dataAtom = synctomic.buildAtom(myData);
            const result = dataAtom.get();

            assert.notEqual(myData, result);
        });
    });

    describe('set', function () {
        it('should expose a set endpoint', function () {
            const dataAtom = synctomic.buildAtom({ foo: 'bar' });
            const newData = { baz: 'quux' };

            dataAtom.set((data, update) => update(newData));
            const result = dataAtom.get();

            this.verify(prettyJson(result));
        });

        it('should iterate on update until update succeeds', function (done) {
            const dataAtom = synctomic.buildAtom('bar');
            let callCount = 0;

            function asyncUpdate(data, update) {
                setTimeout(function () {
                    callCount++;
                    const updateSuccessful = update('foo');

                    if (updateSuccessful) {
                        assert.equal(callCount, 2);
                        done();
                    }
                }, 10);
            }

            dataAtom.set(asyncUpdate);
            dataAtom.set((value, update) => update('baz'));
        });

        it('should resolve an update on a function which returns a value', function () {
            const dataAtom = synctomic.buildAtom('foo');

            dataAtom.set(() => 'bar');

            assert.equal(dataAtom.get(), 'bar');
        });
    });

    describe('setOnce', function () {

        it('should update like set would without interruption', function () {
            const dataAtom = synctomic.buildAtom('foo');

            dataAtom.setOnce(() => 'bar');

            assert.equal(dataAtom.get(), 'bar');
        });

        it('should iterate on update until update succeeds', function (done) {
            const dataAtom = synctomic.buildAtom('bar');

            function asyncUpdate(data, update) {
                setTimeout(function () {
                    update('foo');

                    assert.notEqual(dataAtom.get(), 'foo');
                    done();
                }, 10);
            }

            dataAtom.setOnce(asyncUpdate);
            dataAtom.set(() => 'baz');
        });

        it('should should call error on failure', function (done) {
            const dataAtom = synctomic.buildAtom('bar');

            function asyncUpdate(data, update) {
                setTimeout(function () {
                    update('foo');
                    assert.notEqual(dataAtom.get(), 'foo');
                }, 10);
            }

            // This test will fail if done is not called.
            dataAtom.setOnce(asyncUpdate, done);
            dataAtom.set(() => 'baz');
        });

    });

    describe('onChange', function () {

        it('should watch object and execute when something changes', function () {
            const dataAtom = synctomic.buildAtom({ foo: { bar: ['baz'] } });

            const watchSpy = sinon.spy();
            dataAtom.onChange('', watchSpy);

            dataAtom.set((data, update) => {
                data.foo.bar.push('quux');
                update(data);
            });

            this.verify(prettyJson(watchSpy.args));
        });

        it('should create a deregistration function', function () {
            const dataAtom = synctomic.buildAtom({ foo: { bar: ['baz'] } });

            const watchSpy = sinon.spy();
            const deregister = dataAtom.onChange('', watchSpy);
            deregister();

            dataAtom.set((data, update) => {
                data.foo.bar.push('quux');
                update(data);
            });

            assert.equal(watchSpy.callCount, 0);
        });

        it('should only fire a watch on a deep property if the property changes', function () {
            const dataAtom = synctomic.buildAtom({ foo: { bar: ['baz'] } });

            const watchSpy = sinon.spy();
            dataAtom.onChange('foo.bar', watchSpy);

            dataAtom.set((data, update) => {
                data.foo.blerg = 'blerg';
                update(data);
            });

            dataAtom.set((data, update) => {
                data.foo.bar.push('quux');
                update(data);
            });

            this.verify(prettyJson(watchSpy.args));

        });

    });
});

if (typeof global.runQuokkaMochaBdd === 'function') {
    runQuokkaMochaBdd();
}
